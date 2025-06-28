import { useState, useEffect } from 'react'
import { db, storage, Story, StoryFeedback, supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

export function useStories() {
  const { user } = useAuth()
  const [stories, setStories] = useState<(Story & { story_feedback?: StoryFeedback[] })[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      loadStories()
      setupRealtimeSubscription()
    }
  }, [user])

  const setupRealtimeSubscription = () => {
    if (!user) return

    console.log('Setting up real-time subscription for stories...')
    
    // Subscribe to changes in the stories table for this user
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
          
          // Update the story in our local state
          setStories(prevStories => 
            prevStories.map(story => 
              story.id === updatedStory.id 
                ? { ...story, ...updatedStory }
                : story
            )
          )
          
          // If story is completed, also fetch its feedback
          if (updatedStory.processing_status === 'completed') {
            loadStoryFeedback(updatedStory.id)
          }
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      console.log('Cleaning up real-time subscription')
      subscription.unsubscribe()
    }
  }

  const loadStoryFeedback = async (storyId: string) => {
    try {
      const { data: feedback, error } = await supabase
        .from('story_feedback')
        .select('*')
        .eq('story_id', storyId)

      if (error) throw error

      // Update the story with its feedback
      setStories(prevStories =>
        prevStories.map(story =>
          story.id === storyId
            ? { ...story, story_feedback: feedback }
            : story
        )
      )
    } catch (error) {
      console.error('Error loading story feedback:', error)
    }
  }

  const loadStories = async () => {
    if (!user) return []
    
    setLoading(true)
    try {
      const { data, error } = await db.getUserStories(user.id)
      if (error) throw error
      setStories(data || [])
      return data || []
    } catch (error) {
      console.error('Error loading stories:', error)
      return []
    } finally {
      setLoading(false)
    }
  }

  const createStory = async (storyData: {
    title: string
    genre: string
    prompt: string
    duration_seconds: number
    feedback_personality: string
    audioBlob: Blob
  }) => {
    if (!user) throw new Error('User not authenticated')

    try {
      // Upload audio file with better error handling
      const fileName = `${user.id}/${Date.now()}.webm`
      
      // Convert blob to file for better upload handling
      const audioFile = new File([storyData.audioBlob], fileName, 
                                 { 
        type: storyData.audioBlob.type || 'audio/webm' 
      })
      
      const { data: uploadData, error: uploadError } = await storage.uploadAudio(
        audioFile,
        fileName
      )

      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw new Error(`Failed to upload audio: ${uploadError.message}`)
      }

      const audioUrl = storage.getAudioUrl(fileName)
      console.log('Audio uploaded successfully:', audioUrl)

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
        console.error('Story creation error:', storyError)
        throw new Error(`Failed to create story: ${storyError.message}`)
      }

      console.log('Story created successfully:', story.id)

      // Add the new story to our local state immediately
      setStories(prev => [story, ...prev])

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
          throw new Error(`Failed to process story: ${response.status} ${errorText}`)
        }

        console.log('Story processing initiated successfully')
      } catch (processingError) {
        console.error('Processing initiation error:', processingError)
        // Don't throw here - the story was created successfully, processing just failed to start
        // The user can try again or we can implement retry logic
      }

      return story
    } catch (error) {
      console.error('Error creating story:', error)
      throw error
    }
  }

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

  const refreshStories = async () => {
    const updatedStories = await loadStories()
    return updatedStories
  }

  return {
    stories,
    loading,
    createStory,
    getStoryById,
    refreshStories
  }
}