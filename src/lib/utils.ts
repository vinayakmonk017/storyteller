import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Generate a complete story using OpenAI or fallback to predefined stories
export async function getRandomStory(genre: string): Promise<{ title: string; content: string }> {
  console.log('🎯 getRandomStory called with genre:', genre)
  
  // Check if we have Supabase configured
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  
  console.log('🔧 Environment check:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey,
    urlValid: supabaseUrl && !supabaseUrl.includes('placeholder')
  })

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
    console.log('⚠️ Supabase not configured, using fallback story')
    return getFallbackStory(genre)
  }

  try {
    console.log('🚀 Attempting to fetch story from edge function...')
    
    const apiUrl = `${supabaseUrl}/functions/v1/generate-story`
    console.log('📡 API URL:', apiUrl)
    
    // Try to get story from OpenAI via edge function
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        genre: genre,
        length: 'medium'
      })
    })

    console.log('📊 Edge function response status:', response.status)

    if (response.ok) {
      const data = await response.json()
      console.log('✅ Edge function response data:', data)
      
      if (data.story && data.title) {
        console.log('🎉 Successfully got story from OpenAI!')
        return {
          title: data.title,
          content: data.story
        }
      } else {
        console.warn('⚠️ Invalid response format from edge function:', data)
        return getFallbackStory(genre)
      }
    } else {
      const errorText = await response.text()
      console.warn('❌ Edge function failed:', response.status, errorText)
      return getFallbackStory(genre)
    }
  } catch (error) {
    console.error('💥 Error calling edge function:', error)
    return getFallbackStory(genre)
  }
}

// Fallback stories for when OpenAI is not available
function getFallbackStory(genre: string): { title: string; content: string } {
  console.log('🔄 Using fallback story for genre:', genre)
  
  const fallbackStories = {
    adventure: {
      title: "The Hidden Cave Discovery",
      content: `Maya had been hiking the mountain trail for hours when she noticed something unusual—a narrow opening between two large rocks that didn't appear on any map. Her curiosity got the better of her, and she squeezed through the gap.

Inside, she discovered a vast underground cavern illuminated by glowing crystals embedded in the walls. The air hummed with an otherworldly energy, and strange symbols were carved into the stone floor. As she explored deeper, she found an ancient chest containing a map of underground passages that connected to caves all around the world.

But Maya wasn't alone. She heard footsteps echoing from another tunnel. Someone else had found this place. Heart racing, she grabbed the map and searched for another way out. The footsteps grew closer as she spotted a narrow passage leading upward.

Climbing through the rocky tunnel, Maya emerged on the other side of the mountain, miles from where she'd entered. She looked back at the seemingly solid rock face, then at the map in her hands. This was just the beginning of her greatest adventure.

The ancient map revealed a network of hidden caves spanning continents, each marked with symbols that seemed to pulse with their own light. Maya realized she had stumbled upon something far greater than a simple cave—she had found the entrance to a secret world that had been waiting centuries for someone brave enough to explore it.`
    },
    mystery: {
      title: "The Locked Room Mystery",
      content: `Detective Sarah Chen stared at the impossible crime scene. The victim was found in a locked study, windows sealed from the inside, no other way in or out. Yet someone had been here—the overturned chair and scattered papers proved it.

She examined every inch of the room until she noticed something odd about the bookshelf. One book was slightly out of place. When she pulled it, the entire shelf swung inward, revealing a hidden passage.

The narrow corridor led to the house next door. Sarah's heart raced as she realized the truth—the victim's trusted neighbor had been using this secret passage for months, slowly poisoning him with small doses of arsenic hidden in his daily tea.

But as she turned to leave, she heard a click behind her. The passage had sealed shut, and footsteps echoed from the darkness ahead. The neighbor knew she was here.

Sarah reached for her radio, hoping backup would arrive before she became the next victim in this deadly game of secrets and hidden passages. The footsteps grew closer, and she realized that the neighbor had been planning this confrontation all along. The real question wasn't how the murder was committed—it was whether Sarah would live to tell anyone about it.`
    },
    fantasy: {
      title: "The Last Dragon's Gift",
      content: `Elara had always been told that dragons were dangerous, but the small creature shivering in her garden looked nothing like the monsters from the stories. No bigger than a house cat, with iridescent scales and frightened golden eyes, it was clearly just a baby.

She brought it warm milk and watched as it gratefully lapped it up. When it finished, the dragon looked up at her and spoke in a voice like tinkling bells: "Thank you, kind human. You have saved my life."

The dragon explained that it was the last of its kind, fleeing from hunters who sought its magical scales. In return for her kindness, it offered Elara a single scale that would grant her one wish.

Elara thought carefully. She could wish for wealth, power, or fame. Instead, she wished for the dragon to find a safe home where it could live without fear.

The scale glowed brightly, and suddenly the garden transformed into a lush, hidden valley. "This is now our sanctuary," the dragon said. "And you, dear friend, are always welcome here." 

Elara had found something more valuable than any treasure—a magical friendship that would last forever. As the dragon grew stronger in their secret valley, it taught her the ancient language of magic, and together they became guardians of all the forgotten creatures that needed protection from the world.`
    },
    horror: {
      title: "The Night Shift Terror",
      content: `Marcus had worked as a security guard for three months, but tonight felt different. The old office building seemed to breathe around him as he made his rounds, and the shadows moved in ways that defied the static lighting.

At 2 AM, he heard typing coming from the third floor—a floor that had been empty for years. His flashlight beam revealed nothing but dust-covered desks and disconnected computers. Yet the typing continued, growing faster and more frantic.

Following the sound, Marcus found himself in the corner office where the company's founder had died decades ago. The typing stopped abruptly. On the dusty desk, fresh words appeared on a piece of paper: "GET OUT. HE'S COMING BACK."

The elevator dinged behind him. Marcus spun around to see the doors opening, revealing a figure in an old-fashioned suit. The man's face was pale and his eyes were black holes that seemed to pull at Marcus's soul.

"You're in my office," the figure whispered, stepping forward. Marcus ran for the stairs, the sound of footsteps echoing behind him, growing closer with each floor he descended.

As he reached the ground floor, Marcus realized the building's doors were locked from the inside. He was trapped with whatever haunted these halls, and the night shift had only just begun.`
    },
    romance: {
      title: "The Coffee Shop Love Story",
      content: `Emma had been coming to the same coffee shop every Tuesday for six months, always ordering the same lavender latte. She'd noticed the barista—Jake—remembered her order and always had it ready with a warm smile. But she was too shy to do more than mumble "thank you."

One rainy Tuesday, Emma arrived to find a note tucked under her usual cup: "I've been wanting to ask—what's the story behind the lavender latte? It's not on our menu, but I make it special just for you. -Jake"

Heart racing, Emma wrote back: "My grandmother used to make lavender tea when I was sad. The latte reminds me that even difficult days can be beautiful."

The next week, Jake had prepared something new—a lavender scone to go with her latte, and another note: "For beautiful days and difficult ones. Would you like to tell me more about your grandmother over dinner?"

Emma looked up to find Jake watching her hopefully from behind the counter. For the first time in months, she smiled widely and nodded. Sometimes the best love stories begin with the smallest gestures and the courage to reach out.

Six months later, as they sat in their favorite corner of the coffee shop—now as a couple—Jake surprised Emma with a small potted lavender plant. "For all our beautiful days ahead," he said, and Emma knew she had found her forever person.`
    },
    'sci-fi': {
      title: "The Time Loop Experiment",
      content: `Dr. Sarah Kim woke up to her alarm at 7:00 AM, just like every day. But as she went through her morning routine, she had the strangest feeling that she'd lived this exact day before. The news anchor said the same words, her coffee tasted identical, and her colleague made the exact same joke.

By noon, Sarah was convinced she was trapped in a time loop. She tested her theory by doing something completely different—instead of eating lunch at her desk, she went to the roof of her building.

There, she found another scientist, Dr. Chen, who looked just as confused as she felt. "You're experiencing it too?" he asked. "The repetition?"

They discovered that their experimental quantum computer had malfunctioned, creating a temporal bubble around their building. Everyone inside was reliving the same day, but only the two of them retained their memories.

Working together, they had to solve the quantum equation that would break the loop. But they only had until midnight—when the loop reset—to figure it out. With each failed attempt, they learned more, growing closer as they raced against time itself.

Finally, as the clock struck 11:59, Sarah input the final calculation. The world shimmered, and suddenly it was 7:01 AM—a new day at last. But as Sarah looked at Dr. Chen, she realized that some connections transcend even time itself.`
    }
  }

  const story = fallbackStories[genre as keyof typeof fallbackStories] || fallbackStories.adventure
  console.log('📖 Returning fallback story:', story.title)
  return story
}

export function getRandomPrompt(genre: string): string {
  const prompts = {
    adventure: [
      "You discover a hidden door in your basement that leads to an underground city.",
      "While hiking, you find a map that doesn't match any known geography.",
      "A mysterious package arrives at your door with coordinates and a cryptic note."
    ],
    mystery: [
      "Every morning, you find a different flower on your doorstep with no explanation.",
      "Your neighbor hasn't been seen for weeks, but their lights turn on every night at 8 PM.",
      "You receive a phone call from someone claiming to be you from the future."
    ],
    fantasy: [
      "You inherit a bookshop where the characters from the books come alive at midnight.",
      "A dragon appears in your backyard, but it's no bigger than a house cat.",
      "You discover you can understand what animals are saying, but they only complain."
    ],
    horror: [
      "Your reflection starts moving independently in mirrors.",
      "You find old photographs in your attic showing you in places you've never been.",
      "Every night at 3 AM, you hear someone walking in the apartment above you, but it's been empty for years."
    ],
    romance: [
      "You keep running into the same stranger in different cities around the world.",
      "A love letter meant for someone else gets delivered to your address.",
      "You find a diary from the 1940s that describes your life in perfect detail."
    ],
    'sci-fi': [
      "You wake up to find that gravity works differently in your house.",
      "Your smart home AI starts leaving you notes about things that haven't happened yet.",
      "You discover that your reflection in mirrors shows you living in a parallel universe."
    ]
  }
  
  const genrePrompts = prompts[genre as keyof typeof prompts] || prompts.adventure
  return genrePrompts[Math.floor(Math.random() * genrePrompts.length)]
}