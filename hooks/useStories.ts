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

    console.log('Setting up real-time subscription for stories...')
    
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
          console.log('Real-time story update received:', payload)
          
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
          
          // If story is completed and we're tracking it, fetch its feedback
          if (updatedStory.processing_status === 'completed' && processingStoryId === updatedStory.id) {
            loadStoryFeedback(updatedStory.id)
          }
        }
      )
      .subscribe()

    return () => {
      console.log('Cleaning up real-time subscription')
      subscription.unsubscribe()
    }
  }, [user, queryClient, processingStoryId])

  const loadStoryFeedback = async (storyId: string) => {
    try {
      const { data: feedback, error } = await supabase
        .from('story_feedback')
        .select('*')
        .eq('story_id', storyId)

      if (error) throw error

      // Update the story with its feedback in the cache
      queryClient.setQueryData(['stories', user?.id], (oldStories: any[]) => {
        if (!oldStories) return []
        return oldStories.map(story =>
          story.id === storyId
            ? { ...story, story_feedback: feedback }
            : story
        )
      })
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

      // Generate unique filename with timestamp to prevent caching issues
      const timestamp = Date.now()
      const fileName = `${user.id}/${timestamp}-${Math.random().toString(36).substr(2, 9)}.webm`
      
      const audioFile = new File([storyData.audioBlob], fileName, { 
        type: storyData.audioBlob.type || 'audio/webm' 
      })
      
      console.log('🎵 Uploading audio file:', {
        fileName,
        size: audioFile.size,
        type: audioFile.type
      })
      
      const { data: uploadData, error: uploadError } = await storage.uploadAudio(
        audioFile,
        fileName
      )

      if (uploadError) {
        throw new Error(`Failed to upload audio: ${uploadError.message}`)
      }

      // Get the public URL for the uploaded file with cache-busting
      const audioUrl = storage.getAudioUrl(fileName) + `?t=${timestamp}`
      
      console.log('🎵 Generated audio URL:', audioUrl)
      
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

      console.log('🎵 Story created successfully:', {
        storyId: story.id,
        audioUrl: story.audio_url
      })

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