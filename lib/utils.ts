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
    ]
  }
  
  const genrePrompts = prompts[genre as keyof typeof prompts] || prompts.adventure
  return genrePrompts[Math.floor(Math.random() * genrePrompts.length)]
}

export function getRandomStory(genre: string): string {
  // This function appears to be an alias for getRandomPrompt
  return getRandomPrompt(genre)
}