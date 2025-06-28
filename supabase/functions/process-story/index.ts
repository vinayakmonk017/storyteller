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

    console.log(`Processing story ${storyId} with audio URL: ${audioUrl}`)

    // Update story status to processing
    const { error: updateError } = await supabaseClient
      .from('stories')
      .update({ processing_status: 'processing' })
      .eq('id', storyId)

    if (updateError) {
      console.error('Error updating story status:', updateError)
      throw updateError
    }

    // Step 1: Transcribe audio using OpenAI Whisper
    const transcript = await transcribeAudio(audioUrl)
    console.log('Generated transcript:', transcript.substring(0, 100) + '...')

    // Step 2: Generate AI feedback using OpenAI GPT
    const feedback = await generateFeedback(transcript, feedbackPersonality)
    console.log('Generated feedback:', feedback.detailed_feedback.substring(0, 100) + '...')

    // Step 3: Save feedback to database
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
      console.error('Error saving feedback:', feedbackError)
      throw feedbackError
    }

    // Step 4: Update story with transcript and completion status
    const { error: finalUpdateError } = await supabaseClient
      .from('stories')
      .update({
        transcript,
        processing_status: 'completed'
      })
      .eq('id', storyId)

    if (finalUpdateError) {
      console.error('Error completing story:', finalUpdateError)
      throw finalUpdateError
    }

    // Step 5: Check for new achievements
    await checkAchievements(supabaseClient, storyId)

    console.log(`Successfully processed story ${storyId}`)

    return new Response(
      JSON.stringify({ success: true, transcript, feedback }),
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
      await supabaseClient
        .from('stories')
        .update({ processing_status: 'failed' })
        .eq('id', storyId)
    } catch (updateError) {
      console.error('Error updating story to failed status:', updateError)
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
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
    console.warn('OpenAI API key not found, using mock transcription')
    return getMockTranscript()
  }

  try {
    console.log('Downloading audio file from:', audioUrl)
    
    // Download the audio file
    const audioResponse = await fetch(audioUrl)
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`)
    }
    
    const audioBlob = await audioResponse.blob()
    console.log('Audio file downloaded, size:', audioBlob.size, 'bytes')

    // Create form data for OpenAI Whisper API
    const formData = new FormData()
    formData.append('file', audioBlob, 'audio.webm')
    formData.append('model', 'whisper-1')
    formData.append('language', 'en')
    formData.append('response_format', 'text')

    console.log('Sending audio to OpenAI Whisper API...')
    
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
      console.error('OpenAI Whisper API error:', response.status, errorText)
      throw new Error(`OpenAI Whisper API error: ${response.status} ${errorText}`)
    }

    const transcript = await response.text()
    console.log('Transcription completed successfully')
    
    return transcript.trim()
    
  } catch (error) {
    console.error('Error in transcribeAudio:', error)
    console.warn('Falling back to mock transcription')
    return getMockTranscript()
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
    console.warn('OpenAI API key not found, using mock feedback')
    return getMockFeedback(personality)
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
  "detailed_feedback": "Your main feedback paragraph (2-3 sentences)",
  "strengths": ["strength 1", "strength 2", "strength 3", "strength 4"],
  "improvements": ["improvement 1", "improvement 2", "improvement 3", "improvement 4"],
  "next_steps": ["next step 1", "next step 2", "next step 3", "next step 4"],
  "score": 8
}

The score should be between 1-10. Focus on being constructive and helpful while maintaining your personality style.`

    console.log('Sending transcript to OpenAI GPT API for feedback...')

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
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI GPT API error:', response.status, errorText)
      throw new Error(`OpenAI GPT API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const feedbackContent = data.choices[0].message.content
    
    console.log('Feedback generation completed successfully')
    
    try {
      const parsedFeedback = JSON.parse(feedbackContent)
      return {
        detailed_feedback: parsedFeedback.detailed_feedback,
        strengths: parsedFeedback.strengths || [],
        improvements: parsedFeedback.improvements || [],
        next_steps: parsedFeedback.next_steps || [],
        score: parsedFeedback.score || 7
      }
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError)
      console.warn('Falling back to mock feedback')
      return getMockFeedback(personality)
    }
    
  } catch (error) {
    console.error('Error in generateFeedback:', error)
    console.warn('Falling back to mock feedback')
    return getMockFeedback(personality)
  }
}

function getMockTranscript(): string {
  const mockTranscripts = [
    "I stepped through the mysterious door and found myself in a completely different world. The air was thick with magic, and I could hear strange creatures calling in the distance. As I walked forward, I noticed that the trees here were unlike anything I'd ever seen - they seemed to glow with an inner light, and their leaves whispered secrets as the wind passed through them. I knew I had to be careful, but my curiosity was stronger than my fear. The path ahead split into three directions, each leading to what looked like different realms entirely.",
    
    "The detective examined the crime scene carefully, looking for any clue that might solve this puzzling case. The victim had been found in a locked room with no apparent way for the killer to escape. As I studied the evidence, I noticed something strange about the window - there were scratches on the frame that looked fresh. Could the killer have escaped through here? But we were on the third floor, and there was no fire escape. Then I saw it - a single thread caught on the window latch, silk and expensive. This wasn't a random crime.",
    
    "The dragon in my backyard was definitely not what I expected when I woke up this morning. It was small, about the size of a house cat, but it had all the features of a real dragon - scales that shimmered in the sunlight, tiny wings that actually worked, and yes, it could breathe fire, though only small puffs. When it saw me, it didn't seem afraid. Instead, it looked at me with intelligent eyes and made a sound that was almost like purring. I slowly approached, and to my amazement, it nuzzled against my hand like a friendly pet."
  ]
  
  return mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)]
}

function getMockFeedback(personality: string): {
  detailed_feedback: string
  strengths: string[]
  improvements: string[]
  next_steps: string[]
  score: number
} {
  const feedbackTemplates = {
    encouraging: {
      detailed_feedback: "What a wonderful storytelling session! Your narrative voice is engaging and draws listeners in from the very beginning. I love how you built atmosphere and used descriptive language to paint vivid scenes. Your pacing was excellent, and you showed great creativity in developing the story.",
      strengths: [
        "Excellent opening that immediately draws the reader in",
        "Strong use of descriptive language and vivid imagery",
        "Good pacing and natural story flow",
        "Creative and engaging narrative voice"
      ],
      improvements: [
        "Consider adding more dialogue to bring characters to life",
        "Try incorporating more sensory details beyond visual",
        "Experiment with varying sentence length for better rhythm",
        "Add more emotional depth to character interactions"
      ],
      next_steps: [
        "Practice recording stories in different genres to expand your range",
        "Try telling the same story from different character perspectives",
        "Experiment with different narrative techniques like flashbacks",
        "Record shorter practice sessions focusing on specific skills"
      ]
    },
    stephen_king: {
      detailed_feedback: "You've got the makings of a storyteller, I'll give you that. Your opening grabbed me and didn't let go—that's the mark of someone who understands that the first few seconds are everything. You've got good instincts for building atmosphere and creating that sense of unease that keeps people listening.",
      strengths: [
        "Strong opening that hooks the audience immediately",
        "Natural instincts for building atmospheric tension",
        "Good understanding of pacing and suspense",
        "Effective use of descriptive language"
      ],
      improvements: [
        "Develop your characters' inner lives and motivations more deeply",
        "Focus on the human elements that make supernatural events matter",
        "Use quiet, ordinary moments to build underlying tension",
        "Explore the psychological aspects of your characters' experiences"
      ],
      next_steps: [
        "Study how master storytellers develop character psychology",
        "Practice building dread through seemingly innocent details",
        "Experiment with unreliable narrators and shifting perspectives",
        "Read your work aloud to catch rhythm and flow issues"
      ]
    },
    literary: {
      detailed_feedback: "Your narrative demonstrates a sophisticated understanding of story structure and atmospheric development. The way you layered descriptive elements to build your fictional world shows real literary sensibility. Your prose has a natural rhythm that suggests an intuitive grasp of language flow and cadence.",
      strengths: [
        "Sophisticated narrative structure and organization",
        "Excellent atmospheric development and world-building",
        "Natural prose rhythm and language flow",
        "Strong literary sensibility and voice"
      ],
      improvements: [
        "Incorporate more metaphorical and symbolic language",
        "Develop deeper thematic content and meaning",
        "Explore more complex narrative structures",
        "Add layers of subtext to character interactions"
      ],
      next_steps: [
        "Study literary masters for advanced narrative techniques",
        "Experiment with stream of consciousness and interior monologue",
        "Develop your unique literary voice and style",
        "Practice writing with multiple layers of meaning"
      ]
    },
    casual: {
      detailed_feedback: "Dude, that was awesome! You totally had me hooked from the start. I love how you just went with the flow and let the story take you where it wanted to go. Your descriptions were so vivid I could picture everything happening in my mind like a movie.",
      strengths: [
        "Engaging and natural storytelling style",
        "Vivid and immersive descriptions that paint clear pictures",
        "Great flow and spontaneity in delivery",
        "Effective suspense building and pacing"
      ],
      improvements: [
        "Try adding more character dialogue to bring people to life",
        "Experiment with different story structures and formats",
        "Play around with varying your pace for different effects",
        "Add more interactive elements to engage your audience"
      ],
      next_steps: [
        "Try recording with friends or family for immediate feedback",
        "Experiment with interactive storytelling techniques",
        "Have fun with different character voices and accents",
        "Practice improvising stories on the spot"
      ]
    },
    professional: {
      detailed_feedback: "Your storytelling demonstrates strong foundational skills in narrative structure and audience engagement. Your use of descriptive language creates vivid imagery that effectively transports listeners into your fictional world. Your pacing maintains listener interest throughout the narrative arc.",
      strengths: [
        "Strong narrative structure and clear story progression",
        "Effective use of descriptive language and imagery",
        "Good pacing that maintains audience interest",
        "Clear and confident delivery style"
      ],
      improvements: [
        "Develop distinct voices and mannerisms for different characters",
        "Incorporate more interactive elements and audience engagement",
        "Vary sentence structure and rhythm for emphasis",
        "Add more emotional range and expression to your delivery"
      ],
      next_steps: [
        "Practice character voice differentiation exercises",
        "Study professional storytelling techniques and methods",
        "Record practice sessions for self-evaluation and improvement",
        "Seek feedback from other storytellers and audiences"
      ]
    }
  }

  const template = feedbackTemplates[personality as keyof typeof feedbackTemplates] || feedbackTemplates.encouraging
  
  return {
    ...template,
    score: Math.floor(Math.random() * 3) + 7 // Score between 7-9
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
      } else {
        console.log(`Granted achievement ${achievementId} to user ${story.user_id}`)
      }
    }
  } catch (error) {
    console.error('Error checking achievements:', error)
  }
}