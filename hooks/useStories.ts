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
          console.log('Story status:', updatedStory.processing_status)
          console.log('Processing story ID:', processingStoryId)
          console.log('Updated story ID:', updatedStory.id)
          
          // Update the query cache
          queryClient.setQueryData(['stories', user.id], (oldStories: any[]) => {
            if (!oldStories) return []
            return oldStories.map(story => 
              story.id === updatedStory.id 
                ? { ...story, ...updatedStory }
                : story
            )
          })
          
          // CRITICAL FIX: Clear processing state immediately when story is completed
          if (updatedStory.processing_status === 'completed' && processingStoryId === updatedStory.id) {
            console.log('✅ Story processing completed, clearing loading state')
            
            // Load feedback first
            loadStoryFeedback(updatedStory.id).then(() => {
              // Clear processing state after feedback is loaded
              setProcessingStoryId(null)
              console.log('🎉 Processing state cleared, should show feedback now')
            })
          } else if (updatedStory.processing_status === 'failed' && processingStoryId === updatedStory.id) {
            console.log('❌ Story processing failed, clearing loading state')
            setProcessingStoryId(null)
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
      console.log('📥 Loading feedback for story:', storyId)
      
      const { data: feedback, error } = await supabase
        .from('story_feedback')
        .select('*')
        .eq('story_id', storyId)

      console.log('📋 Feedback data:', feedback)
      if (error) {
        console.error('❌ Feedback error:', error)
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
      
      console.log('✅ Feedback loaded and cache updated')
    } catch (error) {
      console.error('💥 Error loading story feedback:', error)
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

      console.log('🚀 Starting story creation...')

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

      const audioUrl = storage.getAudioUrl(fileName)

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

      console.log('📝 Story created, triggering processing...')

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
          console.error('Edge function error:', await response.text())
          // Don't throw here, let the real-time subscription handle failures
        } else {
          console.log('✅ Processing initiated successfully')
        }
      } catch (processingError) {
        console.error('Processing initiation error:', processingError)
        // Don't throw here, let the real-time subscription handle failures
      }

      return story
    },
    onSuccess: (newStory) => {
      console.log({newStory})
      console.log('🎯 Story creation mutation succeeded, setting processing ID:', newStory.id)
      
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
      console.error('💥 Error creating story:', error)
      // Clear processing state on error
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

  // Add timeout fallback to prevent infinite loading
  useEffect(() => {
    if (processingStoryId) {
      console.log('⏰ Setting 5-minute timeout for processing story:', processingStoryId)
      
      const timeout = setTimeout(() => {
        console.warn('⚠️ Processing timeout reached, clearing loading state')
        setProcessingStoryId(null)
      }, 5 * 60 * 1000) // 5 minutes

      return () => {
        clearTimeout(timeout)
      }
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