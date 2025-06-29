import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ProcessStoryRequest {
  storyId: string
  audioUrl: string
  feedbackPersonality: string
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

    const { storyId, audioUrl, feedbackPersonality }: ProcessStoryRequest = await req.json()

    // Step 1: Update story status to processing
    const { error: updateError } = await supabaseClient
      .from('stories')
      .update({ processing_status: 'processing' })
      .eq('id', storyId)

    if (updateError) {
      throw updateError
    }

    // Step 2: Transcribe audio using OpenAI Whisper
    const transcript = await transcribeAudio(audioUrl)

    // Step 3: Generate AI feedback using OpenAI GPT
    const feedback = await generateFeedback(transcript, feedbackPersonality)

    // Step 4: Save feedback to database
    const { error: feedbackError } = await supabaseClient
      .from('story_feedback')
      .insert({
        story_id: storyId,
        feedback_text: feedback.detailed_feedback,
        strengths: feedback.strengths,
        improvements: feedback.improvements,
        next_steps: feedback.next_steps,
        overall_score: feedback.score
      })

    if (feedbackError) {
      throw feedbackError
    }

    // Step 5: Update story with transcript and completion status
    const { error: finalUpdateError } = await supabaseClient
      .from('stories')
      .update({
        transcript,
        processing_status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', storyId)

    if (finalUpdateError) {
      throw finalUpdateError
    }

    // Step 6: Check for new achievements
    await checkAchievements(supabaseClient, storyId)

    return new Response(
      JSON.stringify({ 
        success: true, 
        transcript, 
        feedback,
        storyStatus: 'completed',
        message: 'Story processed successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error processing story:', error)
    
    // Try to update story status to failed
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      const { storyId } = await req.json()
      
      const { error: failedUpdateError } = await supabaseClient
        .from('stories')
        .update({ 
          processing_status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', storyId)
        
      if (failedUpdateError) {
        console.error('Error updating story to failed status:', failedUpdateError)
      }
    } catch (updateError) {
      console.error('Error updating story to failed status:', updateError)
    }
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        storyStatus: 'failed'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

async function transcribeAudio(audioUrl: string): Promise<string> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.')
  }

  try {
    // Download the audio file
    const audioResponse = await fetch(audioUrl)
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`)
    }
    
    const audioBlob = await audioResponse.blob()

    // Create form data for OpenAI Whisper API
    const formData = new FormData()
    formData.append('file', audioBlob, 'audio.webm')
    formData.append('model', 'whisper-1')
    formData.append('language', 'en')
    formData.append('response_format', 'text')
    
    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI Whisper API error: ${response.status} ${errorText}`)
    }

    const transcript = await response.text()
    return transcript.trim()
    
  } catch (error) {
    console.error('Error in transcribeAudio:', error)
    throw new Error(`Transcription failed: ${error.message}`)
  }
}

async function generateFeedback(transcript: string, personality: string): Promise<{
  detailed_feedback: string
  strengths: string[]
  improvements: string[]
  next_steps: string[]
  score: number
}> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.')
  }

  try {
    const systemPrompts = {
      encouraging: "You are an encouraging storytelling coach. Provide supportive, motivating feedback that builds confidence while offering constructive suggestions. Focus on what the storyteller did well and frame improvements as exciting opportunities for growth.",
      
      stephen_king: "You are Stephen King providing storytelling feedback. Be insightful with a touch of dark humor. Focus on the craft of storytelling, character development, and the human elements that make stories compelling. Be honest but encouraging about areas for improvement.",
      
      literary: "You are a sophisticated literary critic and writing instructor. Provide thoughtful analysis of narrative structure, prose style, thematic elements, and literary techniques. Offer suggestions for deeper literary exploration and artistic development.",
      
      casual: "You are a friendly, enthusiastic storytelling buddy. Give feedback in a casual, conversational tone. Focus on what was engaging and fun about the story while offering helpful suggestions in an approachable way.",
      
      professional: "You are a professional writing instructor providing structured, educational feedback. Focus on technical storytelling skills, narrative techniques, and practical steps for improvement. Be clear, organized, and actionable in your suggestions."
    }

    const systemPrompt = systemPrompts[personality as keyof typeof systemPrompts] || systemPrompts.encouraging

    const userPrompt = `Please analyze this storytelling transcript and provide detailed feedback. The transcript is: "${transcript}"

Please provide your response in the following JSON format:
{
  "detailed_feedback": "Your main feedback paragraph (3-4 sentences providing overall assessment and key insights)",
  "strengths": ["strength 1", "strength 2", "strength 3", "strength 4"],
  "improvements": ["improvement 1", "improvement 2", "improvement 3", "improvement 4"],
  "next_steps": ["next step 1", "next step 2", "next step 3", "next step 4"],
  "score": 8
}

The score should be between 1-10 based on storytelling quality, engagement, clarity, and creativity. Focus on being constructive and helpful while maintaining your personality style. Provide specific, actionable feedback that will help the storyteller improve their skills.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1200,
        response_format: { type: 'json_object' }
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI GPT API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const feedbackContent = data.choices[0].message.content
    
    try {
      const parsedFeedback = JSON.parse(feedbackContent)
      return {
        detailed_feedback: parsedFeedback.detailed_feedback || 'Great storytelling session!',
        strengths: parsedFeedback.strengths || ['Good narrative flow'],
        improvements: parsedFeedback.improvements || ['Continue practicing'],
        next_steps: parsedFeedback.next_steps || ['Try different genres'],
        score: parsedFeedback.score || 7
      }
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError)
      throw new Error('Failed to parse AI feedback response')
    }
    
  } catch (error) {
    console.error('Error in generateFeedback:', error)
    throw new Error(`Feedback generation failed: ${error.message}`)
  }
}

async function checkAchievements(supabaseClient: any, storyId: string) {
  try {
    // Get story details
    const { data: story } = await supabaseClient
      .from('stories')
      .select('user_id, genre, duration_seconds')
      .eq('id', storyId)
      .single()

    if (!story) return

    // Get user stats
    const { data: stats } = await supabaseClient
      .from('user_stats')
      .select('*')
      .eq('user_id', story.user_id)
      .single()

    if (!stats) return

    // Check for achievements
    const achievementsToGrant = []

    // First story achievement
    if (stats.total_stories === 1) {
      achievementsToGrant.push('first_story')
    }

    // Marathon storyteller (15+ minutes)
    if (story.duration_seconds >= 900) {
      achievementsToGrant.push('marathon_storyteller')
    }

    // Century club (100 stories)
    if (stats.total_stories >= 100) {
      achievementsToGrant.push('century_club')
    }

    // Week warrior (7-day streak)
    if (stats.current_streak >= 7) {
      achievementsToGrant.push('week_warrior')
    }

    // Master storyteller (30-day streak)
    if (stats.current_streak >= 30) {
      achievementsToGrant.push('master_storyteller')
    }

    // Grant achievements
    for (const achievementId of achievementsToGrant) {
      const { error } = await supabaseClient
        .from('user_achievements')
        .insert({
          user_id: story.user_id,
          achievement_id: achievementId
        })
        .onConflict('user_id,achievement_id')
        .ignore()

      if (error) {
        console.error(`Error granting achievement ${achievementId}:`, error)
      }
    }
  } catch (error) {
    console.error('Error checking achievements:', error)
  }
}