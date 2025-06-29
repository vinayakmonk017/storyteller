import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db, storage, Story, StoryFeedback, supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

export function useStories() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [processingStoryId, setProcessingStoryId] = useState<string | null>(null)

  // Query for fetching stories
  const {
    data: stories = [],
    isLoading: loading,
    refetch: refreshStories
  } = useQuery({
    queryKey: ['stories', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await db.getUserStories(user.id)
      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })

  // Set up real-time subscription
  useEffect(() => {
    if (!user) return

    const subscription = supabase
      .channel('stories-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'stories',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const updatedStory = payload.new as Story
          
          // Update the query cache
          queryClient.setQueryData(['stories', user.id], (oldStories: any[]) => {
            if (!oldStories) return []
            return oldStories.map(story => 
              story.id === updatedStory.id 
                ? { ...story, ...updatedStory }
                : story
            )
          })
          
          // Check if this is the story we're waiting for
          if (updatedStory.processing_status === 'completed') {
            // Check if this is our processing story OR if we should switch to this completed story
            if (processingStoryId === updatedStory.id || 
                (processingStoryId && !stories.find(s => s.id === processingStoryId && s.processing_status === 'completed'))) {
              
              loadStoryFeedback(updatedStory.id)
            }
          } else if (updatedStory.processing_status === 'failed' && processingStoryId === updatedStory.id) {
            setProcessingStoryId(null)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'story_feedback',
          filter: `story_id=eq.${processingStoryId}`
        },
        (payload) => {
          // Refresh stories to get the feedback
          queryClient.invalidateQueries({ queryKey: ['stories', user.id] })
          
          // Clear processing state
          setProcessingStoryId(null)
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user, queryClient, processingStoryId])

  const loadStoryFeedback = async (storyId: string) => {
    try {
      const { data: feedback, error } = await supabase
        .from('story_feedback')
        .select('*')
        .eq('story_id', storyId)

      if (error) {
        throw error
      }

      // Update the story with its feedback in the cache
      queryClient.setQueryData(['stories', user?.id], (oldStories: any[]) => {
        if (!oldStories) return []
        return oldStories.map(story =>
          story.id === storyId
            ? { ...story, story_feedback: feedback }
            : story
        )
      })
      
      if (feedback && feedback.length > 0) {
        setProcessingStoryId(null)
      }
      
    } catch (error) {
      console.error('Error loading story feedback:', error)
    }
  }

  // Mutation for creating stories
  const createStoryMutation = useMutation({
    mutationFn: async (storyData: {
      title: string
      genre: string
      prompt: string
      duration_seconds: number
      feedback_personality: string
      audioBlob: Blob
    }) => {
      if (!user) throw new Error('User not authenticated')

      // Upload audio file
      const fileName = `${user.id}/${Date.now()}.webm`
      const audioFile = new File([storyData.audioBlob], fileName, { 
        type: storyData.audioBlob.type || 'audio/webm' 
      })
      
      const { data: uploadData, error: uploadError } = await storage.uploadAudio(
        audioFile,
        fileName
      )

      if (uploadError) {
        throw new Error(`Failed to upload audio: ${uploadError.message}`)
      }

      // Get the public URL for the uploaded file
      const audioUrl = storage.getAudioUrl(fileName)
      
      // Validate that the URL is accessible
      if (!audioUrl || audioUrl === 'placeholder-url') {
        throw new Error('Failed to generate valid audio URL')
      }

      // Create story record
      const { data: story, error: storyError } = await db.createStory({
        user_id: user.id,
        title: storyData.title,
        genre: storyData.genre,
        prompt: storyData.prompt,
        duration_seconds: storyData.duration_seconds,
        feedback_personality: storyData.feedback_personality,
        audio_url: audioUrl,
        processing_status: 'pending'
      })

      if (storyError) {
        throw new Error(`Failed to create story: ${storyError.message}`)
      }

      // Trigger processing via edge function
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-story`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            storyId: story.id,
            audioUrl: audioUrl,
            feedbackPersonality: storyData.feedback_personality
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('Edge function error:', errorText)
          throw new Error(`Edge function failed: ${response.status} ${errorText}`)
        }

        const result = await response.json()
        console.log('Edge function result:', result)
        
        if (!result.success) {
          throw new Error(result.error || 'Processing failed')
        }
      } catch (processingError) {
        console.error('Processing initiation error:', processingError)
        // Update story status to failed
        await db.updateStory(story.id, { processing_status: 'failed' })
        throw processingError
      }

      return story
    },
    onSuccess: (newStory) => {
      // Add the new story to the cache
      queryClient.setQueryData(['stories', user?.id], (oldStories: any[]) => {
        return [newStory, ...(oldStories || [])]
      })
      
      // Set processing story ID for tracking
      setProcessingStoryId(newStory.id)
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['user-stats', user?.id] })
    },
    onError: (error) => {
      console.error('Error creating story:', error)
      setProcessingStoryId(null)
    }
  })

  const getStoryById = async (storyId: string) => {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          story_feedback (*)
        `)
        .eq('id', storyId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error getting story by ID:', error)
      return null
    }
  }

  // Better logic to find the completed story
  useEffect(() => {
    if (processingStoryId && stories.length > 0) {
      // First, try to find the exact story we're tracking
      let targetStory = stories.find(s => s.id === processingStoryId)
      
      // If the tracked story doesn't exist or is still pending, 
      // look for any completed story with the same title (in case of duplicate creation)
      if (!targetStory || targetStory.processing_status === 'pending') {
        const completedStories = stories.filter(s => s.processing_status === 'completed')
        if (completedStories.length > 0) {
          // Get the most recent completed story
          targetStory = completedStories.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0]
        }
      }

      if (targetStory?.processing_status === 'completed') {
        if (targetStory.story_feedback && targetStory.story_feedback.length > 0) {
          setProcessingStoryId(null)
        } else {
          loadStoryFeedback(targetStory.id)
        }
      }
    }
  }, [stories, processingStoryId])

  // Add timeout fallback
  useEffect(() => {
    if (processingStoryId) {
      const timeout = setTimeout(() => {
        setProcessingStoryId(null)
      }, 5 * 60 * 1000) // 5 minutes

      return () => clearTimeout(timeout)
    }
  }, [processingStoryId])

  return {
    stories,
    loading,
    createStory: createStoryMutation.mutate,
    isCreatingStory: createStoryMutation.isPending,
    getStoryById,
    refreshStories,
    processingStoryId,
    setProcessingStoryId
  }
}