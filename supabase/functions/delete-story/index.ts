import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface DeleteStoryRequest {
  storyId: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { storyId }: DeleteStoryRequest = await req.json()

    if (!storyId) {
      return new Response(
        JSON.stringify({ error: 'Story ID is required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    console.log(`Deleting story with ID: ${storyId}`)

    // First, get the story to check if it exists and get the audio URL
    const { data: story, error: fetchError } = await supabaseClient
      .from('stories')
      .select('audio_url, user_id')
      .eq('id', storyId)
      .single()

    if (fetchError || !story) {
      console.error('Story not found:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Story not found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      )
    }

    // Delete the audio file from storage if it exists
    if (story.audio_url) {
      try {
        // Extract the file path from the URL
        const url = new URL(story.audio_url)
        const pathParts = url.pathname.split('/')
        const fileName = pathParts[pathParts.length - 1]
        const filePath = `${story.user_id}/${fileName}`

        console.log(`Deleting audio file: ${filePath}`)

        const { error: storageError } = await supabaseClient.storage
          .from('audio_recordings')
          .remove([filePath])

        if (storageError) {
          console.warn('Error deleting audio file:', storageError)
          // Continue with story deletion even if audio deletion fails
        } else {
          console.log('Audio file deleted successfully')
        }
      } catch (audioError) {
        console.warn('Error processing audio file deletion:', audioError)
        // Continue with story deletion even if audio deletion fails
      }
    }

    // Delete the story (this will cascade delete feedback due to foreign key constraints)
    const { error: deleteError } = await supabaseClient
      .from('stories')
      .delete()
      .eq('id', storyId)

    if (deleteError) {
      console.error('Error deleting story:', deleteError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete story' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    // Update user stats after deletion
    try {
      await updateUserStatsAfterDeletion(supabaseClient, story.user_id)
    } catch (statsError) {
      console.warn('Error updating user stats after deletion:', statsError)
      // Don't fail the deletion if stats update fails
    }

    console.log(`Successfully deleted story ${storyId}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Story deleted successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in delete-story function:', error)
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

async function updateUserStatsAfterDeletion(supabaseClient: any, userId: string) {
  // Recalculate user stats based on remaining stories
  const { data: stories, error: storiesError } = await supabaseClient
    .from('stories')
    .select('duration_seconds, genre, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (storiesError) {
    throw storiesError
  }

  const totalStories = stories.length
  const totalMinutes = stories.reduce((sum: number, story: any) => 
    sum + Math.ceil(story.duration_seconds / 60), 0
  )

  // Calculate favorite genre
  const genreCounts: { [key: string]: number } = {}
  stories.forEach((story: any) => {
    genreCounts[story.genre] = (genreCounts[story.genre] || 0) + 1
  })
  
  const favoriteGenre = Object.entries(genreCounts)
    .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || null

  // Calculate current streak
  let currentStreak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  for (let i = 0; i < stories.length; i++) {
    const storyDate = new Date(stories[i].created_at)
    storyDate.setHours(0, 0, 0, 0)
    
    const daysDiff = Math.floor((today.getTime() - storyDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysDiff === currentStreak) {
      currentStreak++
    } else {
      break
    }
  }

  // Update user stats
  const { error: updateError } = await supabaseClient
    .from('user_stats')
    .update({
      total_stories: totalStories,
      total_minutes: totalMinutes,
      current_streak: currentStreak,
      favorite_genre: favoriteGenre,
      last_story_date: stories.length > 0 ? new Date(stories[0].created_at).toISOString().split('T')[0] : null,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)

  if (updateError) {
    throw updateError
  }

  console.log(`Updated user stats after story deletion for user ${userId}`)
}