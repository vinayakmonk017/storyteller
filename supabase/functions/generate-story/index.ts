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

    let story
    let usedFallback = false

    try {
      // Try to generate story using OpenAI
      story = await generateStoryWithOpenAI(genre, length)
      console.log('Story generated successfully with OpenAI')
    } catch (openaiError) {
      console.log('OpenAI generation failed, using fallback:', openaiError.message)
      // Use fallback story if OpenAI fails
      story = getFallbackStory(genre, length)
      usedFallback = true
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        story: story.content,
        title: story.title,
        fallback: usedFallback
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in generate-story function:', error)
    
    // Always return a fallback story as last resort
    try {
      const fallbackStory = getFallbackStory('adventure', 'medium')
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          story: fallbackStory.content,
          title: fallbackStory.title,
          fallback: true,
          error: 'Used default fallback story'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    } catch (fallbackError) {
      console.error('Even fallback failed:', fallbackError)
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Story generation failed completely',
          story: 'Once upon a time, there was a brave adventurer who discovered that sometimes the greatest adventures come from unexpected challenges.',
          title: 'A Simple Tale'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }
  }
})

async function generateStoryWithOpenAI(genre: string, length: string): Promise<{
  title: string
  content: string
}> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not found in environment variables')
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

  console.log('Sending request to OpenAI API...')

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
    console.error('OpenAI API error:', response.status, errorText)
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response structure from OpenAI API')
  }
  
  const storyContent = data.choices[0].message.content
  
  try {
    const parsedStory = JSON.parse(storyContent)
    return {
      title: parsedStory.title || 'Untitled Story',
      content: parsedStory.content || parsedStory.story || ''
    }
  } catch (parseError) {
    console.error('Error parsing OpenAI response:', parseError)
    throw new Error('Failed to parse story response from OpenAI')
  }
}

function getFallbackStory(genre: string, length: string = 'medium'): { title: string; content: string } {
  const fallbackStories = {
    adventure: {
      short: {
        title: "The Hidden Path",
        content: `Alex discovered a mysterious trail behind the old oak tree. Following it led to a hidden waterfall where ancient symbols were carved into the rocks. As Alex traced the symbols with a finger, they began to glow softly. Suddenly, a secret chamber opened behind the waterfall, revealing a treasure chest filled with maps of unexplored lands. Alex realized this was just the beginning of many adventures to come.`
      },
      medium: {
        title: "The Hidden Cave",
        content: `Maya had been hiking the mountain trail for hours when she noticed something unusual—a narrow opening between two large rocks that didn't appear on any map. Her curiosity got the better of her, and she squeezed through the gap.

Inside, she discovered a vast underground cavern illuminated by glowing crystals embedded in the walls. The air hummed with an otherworldly energy, and strange symbols were carved into the stone floor. As she explored deeper, she found an ancient chest containing a map of underground passages that connected to caves all around the world.

But Maya wasn't alone. She heard footsteps echoing from another tunnel. Someone else had found this place. Heart racing, she grabbed the map and searched for another way out. The footsteps grew closer as she spotted a narrow passage leading upward.

Climbing through the rocky tunnel, Maya emerged on the other side of the mountain, miles from where she'd entered. She looked back at the seemingly solid rock face, then at the map in her hands. This was just the beginning of her greatest adventure.`
      },
      long: {
        title: "The Lost Expedition",
        content: `Captain Sarah Martinez had been searching for the lost expedition for three months when her team finally found traces of their camp deep in the Amazon rainforest. The abandoned tents were covered in strange vines that seemed to pulse with their own rhythm, and the equipment was arranged in patterns that defied explanation.

As they investigated further, Sarah's team discovered journal entries describing encounters with a hidden civilization that lived in harmony with the forest itself. The final entry mentioned a great tree at the heart of the jungle that held the key to understanding the connection between all living things.

Following the journal's directions, they trekked deeper into the unexplored wilderness. The forest grew denser and more alive around them, with plants that seemed to respond to their presence and animals that watched them with unusual intelligence.

After days of difficult travel, they reached a massive clearing dominated by an enormous tree whose trunk was wide enough to house a small village. The missing expedition members were there, alive and well, living alongside the indigenous people who had become their teachers.

Sarah realized that some discoveries were too important to bring back to the outside world. Some adventures were meant to change the adventurer, not the world. She made the difficult decision to stay and learn, sending word back that the expedition had been lost to the jungle forever.`
      }
    },
    mystery: {
      short: {
        title: "The Missing Key",
        content: `Detective Kim found the locked room puzzling—no windows, one door, victim inside. The key was missing until she noticed the victim's pet parrot repeating "under the blue book." Behind the blue cookbook, she found the key and a note revealing the victim had locked himself in to protect a family secret, but his heart condition proved fatal.`
      },
      medium: {
        title: "The Midnight Visitor",
        content: `Detective Sarah Chen stared at the impossible crime scene. The victim was found in a locked study, windows sealed from the inside, no other way in or out. Yet someone had been here—the overturned chair and scattered papers proved it.

She examined every inch of the room until she noticed something odd about the bookshelf. One book was slightly out of place. When she pulled it, the entire shelf swung inward, revealing a hidden passage.

The narrow corridor led to the house next door. Sarah's heart raced as she realized the truth—the victim's trusted neighbor had been using this secret passage for months, slowly poisoning him with small doses of arsenic hidden in his daily tea.

But as she turned to leave, she heard a click behind her. The passage had sealed shut, and footsteps echoed from the darkness ahead. The neighbor knew she was here.

Sarah reached for her radio, hoping backup would arrive before she became the next victim in this deadly game of secrets and hidden passages.`
      },
      long: {
        title: "The Vanishing Artist",
        content: `When renowned artist Elena Vasquez disappeared from her locked studio, leaving behind only a half-finished painting and a room full of questions, Detective Marcus Webb thought he was dealing with a simple missing person case. But as he delved deeper into Elena's life, he discovered a web of art forgeries, stolen masterpieces, and dangerous collectors.

The painting Elena had been working on when she vanished was a copy of a famous piece that had been stolen from a museum twenty years earlier. Webb realized that Elena hadn't just been an artist—she'd been a master forger, creating perfect replicas for wealthy criminals who wanted to own stolen art without the risk.

Following a trail of gallery owners, private collectors, and underground art dealers, Webb uncovered an international network of art thieves. Elena had been trying to expose them when she disappeared, leaving clues hidden in her paintings for someone clever enough to find them.

The breakthrough came when Webb noticed that Elena's paintings contained hidden messages spelled out by the first letters of items in her still-life compositions. The messages led him to a storage facility where Elena was being held by the very criminals she'd been trying to expose.

In a dramatic confrontation in the warehouse filled with stolen masterpieces, Webb rescued Elena and brought down the entire forgery ring. Elena's artistic skills had not only made her a target but ultimately provided the key to solving one of the art world's biggest mysteries.`
      }
    },
    fantasy: {
      short: {
        title: "The Magic Seed",
        content: `Luna planted the glowing seed her grandmother had given her, not expecting much. Overnight, it grew into a tree that bore fruit of pure starlight. When she ate one, Luna could understand the language of all living things. The tree whispered that she was now the guardian of ancient magic, tasked with protecting the balance between the human and magical worlds.`
      },
      medium: {
        title: "The Dragon's Gift",
        content: `Elara had always been told that dragons were dangerous, but the small creature shivering in her garden looked nothing like the monsters from the stories. No bigger than a house cat, with iridescent scales and frightened golden eyes, it was clearly just a baby.

She brought it warm milk and watched as it gratefully lapped it up. When it finished, the dragon looked up at her and spoke in a voice like tinkling bells: "Thank you, kind human. You have saved my life."

The dragon explained that it was the last of its kind, fleeing from hunters who sought its magical scales. In return for her kindness, it offered Elara a single scale that would grant her one wish.

Elara thought carefully. She could wish for wealth, power, or fame. Instead, she wished for the dragon to find a safe home where it could live without fear.

The scale glowed brightly, and suddenly the garden transformed into a lush, hidden valley. "This is now our sanctuary," the dragon said. "And you, dear friend, are always welcome here." Elara had found something more valuable than any treasure—a magical friendship that would last forever.`
      },
      long: {
        title: "The Enchanted Library",
        content: `Mira had always loved books, but she never expected to find a library that existed between the pages of stories themselves. It happened on a rainy Thursday when she was reading in the old university library. As she turned a page in an ancient tome about magical realms, the words began to shimmer and dance off the paper.

Before she knew it, Mira was standing in a vast library where the shelves stretched impossibly high, filled with books that glowed with their own inner light. The librarian, a wise woman with silver hair and eyes like starlight, explained that this was the Repository of All Stories—the place where every tale ever told or yet to be told resided.

"You have the gift," the librarian said. "You can enter any story and help shape its outcome. But be warned—change a story here, and you change it everywhere it's ever been told."

Mira spent what felt like days exploring different stories, meeting characters she'd only read about, and discovering that many of the heroes in classic tales had been helped by previous visitors to the library. She learned that stories were living things, constantly evolving through the collective imagination of all who read them.

When it was time to return to her own world, the librarian gave Mira a special bookmark made of crystallized starlight. "You can return whenever stories need your help," she said. "Remember, every reader is a guardian of the tales they love."

Back in the university library, Mira looked at the ordinary book in her hands with new understanding. She was no longer just a reader—she was a protector of stories, keeper of the magic that lives between the lines.`
      }
    },
    horror: {
      short: {
        title: "The Last Message",
        content: `Tom's phone buzzed with a text from his deceased brother: "Don't go home tonight." Thinking it was a cruel prank, Tom ignored it and drove home anyway. As he pulled into his driveway, he saw the gas leak and the sparking electrical wire that would have killed him. Sometimes the dead find ways to protect those they love.`
      },
      medium: {
        title: "The Night Shift",
        content: `Marcus had worked as a security guard for three months, but tonight felt different. The old office building seemed to breathe around him as he made his rounds, and the shadows moved in ways that defied the static lighting.

At 2 AM, he heard typing coming from the third floor—a floor that had been empty for years. His flashlight beam revealed nothing but dust-covered desks and disconnected computers. Yet the typing continued, growing faster and more frantic.

Following the sound, Marcus found himself in the corner office where the company's founder had died decades ago. The typing stopped abruptly. On the dusty desk, fresh words appeared on a piece of paper: "GET OUT. HE'S COMING BACK."

The elevator dinged behind him. Marcus spun around to see the doors opening, revealing a figure in an old-fashioned suit. The man's face was pale and his eyes were black holes that seemed to pull at Marcus's soul.

"You're in my office," the figure whispered, stepping forward. Marcus ran for the stairs, the sound of footsteps echoing behind him, growing closer with each floor he descended.`
      },
      long: {
        title: "The Inheritance",
        content: `When Rebecca inherited her great-aunt's Victorian mansion, she thought her financial troubles were over. The house was beautiful, if a bit old-fashioned, and the small town seemed charming enough. But from the first night, she knew something was wrong.

It started with whispers in the walls—soft voices that seemed to be having conversations just out of earshot. Rebecca told herself it was old pipes or settling wood, but the whispers grew clearer each night. They were discussing her, debating whether she was "suitable" for something they wouldn't name.

The local townspeople were oddly evasive when she asked about her great-aunt. They would change the subject or suddenly remember urgent business elsewhere. The only person willing to talk was old Mr. Henley at the general store, who warned her to leave before the next new moon.

Rebecca's research revealed that her great-aunt had been the seventh in a line of women who had lived in the house, each inheriting it from the previous occupant. None of them had ever married or had children, and all had died under mysterious circumstances on the night of a new moon.

As the new moon approached, Rebecca discovered the truth in her great-aunt's hidden journal. The house was a prison for something ancient and hungry, and the women of her family were its guardians—and eventually, its food. Each generation, one woman was chosen to maintain the binding that kept the entity trapped.

On the night of the new moon, Rebecca faced a terrible choice: flee and let the entity escape to terrorize the world, or stay and accept her role as the next guardian, knowing it would eventually consume her as it had all the others. As the whispers grew to screams and the walls began to bleed, Rebecca made her decision.`
      }
    },
    romance: {
      short: {
        title: "The Love Letter",
        content: `Emma found the old love letter tucked inside a used book. The beautiful handwriting spoke of a love that transcended time. Curious, she tracked down the address mentioned in the letter and met David, the grandson of the letter's author. As they read the letter together, they realized that some love stories are meant to continue across generations.`
      },
      medium: {
        title: "The Coffee Shop Connection",
        content: `Emma had been coming to the same coffee shop every Tuesday for six months, always ordering the same lavender latte. She'd noticed the barista—Jake—remembered her order and always had it ready with a warm smile. But she was too shy to do more than mumble "thank you."

One rainy Tuesday, Emma arrived to find a note tucked under her usual cup: "I've been wanting to ask—what's the story behind the lavender latte? It's not on our menu, but I make it special just for you. -Jake"

Heart racing, Emma wrote back: "My grandmother used to make lavender tea when I was sad. The latte reminds me that even difficult days can be beautiful."

The next week, Jake had prepared something new—a lavender scone to go with her latte, and another note: "For beautiful days and difficult ones. Would you like to tell me more about your grandmother over dinner?"

Emma looked up to find Jake watching her hopefully from behind the counter. For the first time in months, she smiled widely and nodded. Sometimes the best love stories begin with the smallest gestures and the courage to reach out.`
      },
      long: {
        title: "The Wedding Planner's Dilemma",
        content: `Sophie had planned hundreds of weddings, but she'd never been more nervous than she was about planning her best friend's wedding to the man Sophie had secretly loved for years. When Mia asked her to be the wedding planner, Sophie couldn't say no, even though every detail she arranged felt like a small heartbreak.

Working closely with the groom, Alex, on the wedding preparations was torture. He was kind, thoughtful, and everything Sophie had ever wanted in a partner. But he was also completely devoted to Mia, and Sophie would never betray her best friend's trust.

As the wedding day approached, Sophie threw herself into making everything perfect. She wanted Mia to have the most beautiful day possible, even if it meant watching the man she loved marry someone else. But during the final dress fitting, Mia broke down in tears.

"I can't do this," Mia sobbed. "I love Alex, but not the way he deserves to be loved. I've been trying to convince myself that I do, but I can see the way he looks at you, Sophie. And the way you look at him when you think no one is watching."

Sophie was shocked. She'd been so careful to hide her feelings, but apparently not careful enough. Mia continued, "You two are perfect for each other. I've been too scared to admit that I'm not ready for marriage, that I've been using this engagement to avoid dealing with my own issues."

The conversation that followed was difficult but honest. Mia called off the wedding, not out of spite or drama, but out of love for both Sophie and Alex. She wanted them to be happy, even if it meant stepping aside.

Six months later, Sophie found herself planning a different wedding—her own. As she and Alex exchanged vows in the same venue she'd originally planned for him and Mia, Sophie realized that sometimes the most beautiful love stories come from the most unexpected places.`
      }
    },
    'sci-fi': {
      short: {
        title: "The Signal",
        content: `Dr. Chen detected an unusual signal from deep space—a pattern too complex to be natural. When she decoded it, the message was simple: "We've been waiting for you to develop quantum communication. Welcome to the galactic community." Earth's first contact had been initiated not by aliens finding them, but by humanity finally developing the technology to join the conversation.`
      },
      medium: {
        title: "The Time Loop",
        content: `Dr. Sarah Kim woke up to her alarm at 7:00 AM, just like every day. But as she went through her morning routine, she had the strangest feeling that she'd lived this exact day before. The news anchor said the same words, her coffee tasted identical, and her colleague made the exact same joke.

By noon, Sarah was convinced she was trapped in a time loop. She tested her theory by doing something completely different—instead of eating lunch at her desk, she went to the roof of her building.

There, she found another scientist, Dr. Chen, who looked just as confused as she felt. "You're experiencing it too?" he asked. "The repetition?"

They discovered that their experimental quantum computer had malfunctioned, creating a temporal bubble around their building. Everyone inside was reliving the same day, but only the two of them retained their memories.

Working together, they had to solve the quantum equation that would break the loop. But they only had until midnight—when the loop reset—to figure it out. With each failed attempt, they learned more, growing closer as they raced against time itself.

Finally, as the clock struck 11:59, Sarah input the final calculation. The world shimmered, and suddenly it was 7:01 AM—a new day at last.`
      },
      long: {
        title: "The Memory Merchant",
        content: `In 2087, memories had become the most valuable commodity in the world. Dr. Elena Vasquez ran a small clinic where people could sell their happiest memories to pay for basic necessities, while the wealthy bought experiences they'd never had. Elena had always believed she was helping people, until the day a young girl came to sell her memory of her mother's last words.

The girl, barely sixteen, needed money for food. Her mother had died in the plague that swept through the lower districts, and her final words had been a message of love and hope. Elena realized that by purchasing this memory, she would be taking away the girl's most precious connection to her mother.

That night, Elena couldn't sleep. She began investigating the memory trade more deeply and discovered that the wealthy weren't just buying random experiences—they were systematically purchasing the most meaningful memories from the poor, leaving entire communities emotionally hollow while the rich lived lives filled with borrowed joy and love.

Elena decided to act. Using her access to the memory storage systems, she began secretly copying memories before they were sold, creating a hidden archive of human experiences. She reached out to other memory merchants who shared her concerns, and together they formed an underground network dedicated to preserving the emotional heritage of humanity.

The plan was dangerous. If caught, Elena would face memory erasure—the complete deletion of her own identity. But she couldn't stand by while the essence of human experience was commodified and hoarded by the few.

The revolution began quietly, with memory merchants across the globe simultaneously releasing copied memories back to their original owners. The wealthy found their purchased experiences fading as the true owners reclaimed what was rightfully theirs.

Elena's clinic became a sanctuary where people could safely store their memories without fear of exploitation. She had learned that some things—love, loss, hope, and human connection—should never be for sale. In a world where everything had a price, Elena had chosen to make memories priceless once again.`
      }
    }
  }

  const selectedGenre = fallbackStories[genre as keyof typeof fallbackStories] || fallbackStories.adventure
  const selectedLength = selectedGenre[length as keyof typeof selectedGenre] || selectedGenre.medium
  
  return selectedLength
}