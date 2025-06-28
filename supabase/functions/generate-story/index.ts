import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface GenerateStoryRequest {
  genre: string
  length?: 'short' | 'medium' | 'long'
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { genre, length = 'medium' }: GenerateStoryRequest = await req.json()

    console.log(`Generating ${length} ${genre} story...`)

    // Generate story using OpenAI
    const story = await generateStoryWithOpenAI(genre, length)
    
    console.log('Story generated successfully')

    return new Response(
      JSON.stringify({ 
        success: true, 
        story: story.content,
        title: story.title 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error generating story:', error)
    
    // Fallback to predefined stories
    const fallbackStory = getFallbackStory(genre)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        story: fallbackStory.content,
        title: fallbackStory.title,
        fallback: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  }
})

async function generateStoryWithOpenAI(genre: string, length: string): Promise<{
  title: string
  content: string
}> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not found')
  }

  const lengthInstructions = {
    short: 'Write a complete short story in 150-200 words',
    medium: 'Write a complete story in 250-350 words', 
    long: 'Write a complete story in 400-500 words'
  }

  const genrePrompts = {
    adventure: 'an exciting adventure story with exploration, discovery, and thrilling challenges',
    mystery: 'a compelling mystery story with clues, suspense, and a satisfying resolution',
    fantasy: 'a magical fantasy story with fantastical creatures, magic, and wonder',
    horror: 'a suspenseful horror story that builds tension and creates an eerie atmosphere',
    romance: 'a heartwarming romance story with emotional connection and meaningful relationships',
    'sci-fi': 'a thought-provoking science fiction story with futuristic elements and technology'
  }

  const systemPrompt = `You are a master storyteller who creates engaging, complete stories for English language practice. Your stories should be:

1. Complete narratives with beginning, middle, and end
2. Engaging and well-paced
3. Appropriate for language learners
4. Rich in descriptive language and dialogue
5. Suitable for oral storytelling practice

Always respond with a JSON object containing:
- "title": A compelling story title
- "content": The complete story text

The story should be ready for someone to read aloud and practice their storytelling skills.`

  const userPrompt = `${lengthInstructions[length as keyof typeof lengthInstructions]} about ${genrePrompts[genre as keyof typeof genrePrompts]}. 

The story should:
- Have a clear protagonist and conflict
- Include vivid descriptions and dialogue
- Be engaging from start to finish
- End with a satisfying conclusion
- Be perfect for oral storytelling practice

Please make it original, creative, and compelling.`

  console.log('Sending request to OpenAI GPT API...')

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
      temperature: 0.8,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('OpenAI GPT API error:', response.status, errorText)
    throw new Error(`OpenAI GPT API error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const storyContent = data.choices[0].message.content
  
  try {
    const parsedStory = JSON.parse(storyContent)
    return {
      title: parsedStory.title || 'Untitled Story',
      content: parsedStory.content || parsedStory.story || ''
    }
  } catch (parseError) {
    console.error('Error parsing OpenAI response:', parseError)
    throw new Error('Failed to parse story response')
  }
}

function getFallbackStory(genre: string): { title: string; content: string } {
  const fallbackStories = {
    adventure: {
      title: "The Hidden Cave",
      content: `Maya had been hiking the mountain trail for hours when she noticed something unusual—a narrow opening between two large rocks that didn't appear on any map. Her curiosity got the better of her, and she squeezed through the gap.

Inside, she discovered a vast underground cavern illuminated by glowing crystals embedded in the walls. The air hummed with an otherworldly energy, and strange symbols were carved into the stone floor. As she explored deeper, she found an ancient chest containing a map of underground passages that connected to caves all around the world.

But Maya wasn't alone. She heard footsteps echoing from another tunnel. Someone else had found this place. Heart racing, she grabbed the map and searched for another way out. The footsteps grew closer as she spotted a narrow passage leading upward.

Climbing through the rocky tunnel, Maya emerged on the other side of the mountain, miles from where she'd entered. She looked back at the seemingly solid rock face, then at the map in her hands. This was just the beginning of her greatest adventure.`
    },
    mystery: {
      title: "The Midnight Visitor",
      content: `Detective Sarah Chen stared at the impossible crime scene. The victim was found in a locked study, windows sealed from the inside, no other way in or out. Yet someone had been here—the overturned chair and scattered papers proved it.

She examined every inch of the room until she noticed something odd about the bookshelf. One book was slightly out of place. When she pulled it, the entire shelf swung inward, revealing a hidden passage.

The narrow corridor led to the house next door. Sarah's heart raced as she realized the truth—the victim's trusted neighbor had been using this secret passage for months, slowly poisoning him with small doses of arsenic hidden in his daily tea.

But as she turned to leave, she heard a click behind her. The passage had sealed shut, and footsteps echoed from the darkness ahead. The neighbor knew she was here.

Sarah reached for her radio, hoping backup would arrive before she became the next victim in this deadly game of secrets and hidden passages.`
    },
    fantasy: {
      title: "The Dragon's Gift",
      content: `Elara had always been told that dragons were dangerous, but the small creature shivering in her garden looked nothing like the monsters from the stories. No bigger than a house cat, with iridescent scales and frightened golden eyes, it was clearly just a baby.

She brought it warm milk and watched as it gratefully lapped it up. When it finished, the dragon looked up at her and spoke in a voice like tinkling bells: "Thank you, kind human. You have saved my life."

The dragon explained that it was the last of its kind, fleeing from hunters who sought its magical scales. In return for her kindness, it offered Elara a single scale that would grant her one wish.

Elara thought carefully. She could wish for wealth, power, or fame. Instead, she wished for the dragon to find a safe home where it could live without fear.

The scale glowed brightly, and suddenly the garden transformed into a lush, hidden valley. "This is now our sanctuary," the dragon said. "And you, dear friend, are always welcome here." Elara had found something more valuable than any treasure—a magical friendship that would last forever.`
    },
    horror: {
      title: "The Night Shift",
      content: `Marcus had worked as a security guard for three months, but tonight felt different. The old office building seemed to breathe around him as he made his rounds, and the shadows moved in ways that defied the static lighting.

At 2 AM, he heard typing coming from the third floor—a floor that had been empty for years. His flashlight beam revealed nothing but dust-covered desks and disconnected computers. Yet the typing continued, growing faster and more frantic.

Following the sound, Marcus found himself in the corner office where the company's founder had died decades ago. The typing stopped abruptly. On the dusty desk, fresh words appeared on a piece of paper: "GET OUT. HE'S COMING BACK."

The elevator dinged behind him. Marcus spun around to see the doors opening, revealing a figure in an old-fashioned suit. The man's face was pale and his eyes were black holes that seemed to pull at Marcus's soul.

"You're in my office," the figure whispered, stepping forward. Marcus ran for the stairs, the sound of footsteps echoing behind him, growing closer with each floor he descended.`
    },
    romance: {
      title: "The Coffee Shop Connection",
      content: `Emma had been coming to the same coffee shop every Tuesday for six months, always ordering the same lavender latte. She'd noticed the barista—Jake—remembered her order and always had it ready with a warm smile. But she was too shy to do more than mumble "thank you."

One rainy Tuesday, Emma arrived to find a note tucked under her usual cup: "I've been wanting to ask—what's the story behind the lavender latte? It's not on our menu, but I make it special just for you. -Jake"

Heart racing, Emma wrote back: "My grandmother used to make lavender tea when I was sad. The latte reminds me that even difficult days can be beautiful."

The next week, Jake had prepared something new—a lavender scone to go with her latte, and another note: "For beautiful days and difficult ones. Would you like to tell me more about your grandmother over dinner?"

Emma looked up to find Jake watching her hopefully from behind the counter. For the first time in months, she smiled widely and nodded. Sometimes the best love stories begin with the smallest gestures and the courage to reach out.`
    },
    'sci-fi': {
      title: "The Time Loop",
      content: `Dr. Sarah Kim woke up to her alarm at 7:00 AM, just like every day. But as she went through her morning routine, she had the strangest feeling that she'd lived this exact day before. The news anchor said the same words, her coffee tasted identical, and her colleague made the exact same joke.

By noon, Sarah was convinced she was trapped in a time loop. She tested her theory by doing something completely different—instead of eating lunch at her desk, she went to the roof of her building.

There, she found another scientist, Dr. Chen, who looked just as confused as she felt. "You're experiencing it too?" he asked. "The repetition?"

They discovered that their experimental quantum computer had malfunctioned, creating a temporal bubble around their building. Everyone inside was reliving the same day, but only the two of them retained their memories.

Working together, they had to solve the quantum equation that would break the loop. But they only had until midnight—when the loop reset—to figure it out. With each failed attempt, they learned more, growing closer as they raced against time itself.

Finally, as the clock struck 11:59, Sarah input the final calculation. The world shimmered, and suddenly it was 7:01 AM—a new day at last.`
    }
  }

  return fallbackStories[genre as keyof typeof fallbackStories] || fallbackStories.adventure
}