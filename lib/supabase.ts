import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.')
  console.error('Required variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY')
  console.error('Current values:', { 
    url: supabaseUrl ? 'Set' : 'Missing', 
    key: supabaseAnonKey ? 'Set' : 'Missing' 
  })
}

// Create a fallback client to prevent crashes during development
const createFallbackClient = () => {
  console.warn('Using fallback Supabase client - please configure your environment variables')
  return createClient('https://placeholder.supabase.co', 'placeholder-key', {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  })
}

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : createFallbackClient()

// Database types
export interface UserProfile {
  id: string
  username?: string
  full_name?: string
  avatar_url?: string
  preferred_feedback_style: string
  created_at: string
  updated_at: string
}

export interface Story {
  id: string
  user_id: string
  title: string
  genre: string
  prompt: string
  duration_seconds: number
  audio_url?: string
  transcript?: string
  feedback_personality: string
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
}

export interface StoryFeedback {
  id: string
  story_id: string
  feedback_text: string
  strengths: string[]
  improvements: string[]
  next_steps: string[]
  overall_score?: number
  created_at: string
}

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  achievement_type: string
  criteria: Record<string, any>
  points: number
  created_at: string
}

export interface UserAchievement {
  id: string
  user_id: string
  achievement_id: string
  earned_at: string
  achievement?: Achievement
}

export interface UserStats {
  user_id: string
  total_stories: number
  total_minutes: number
  current_streak: number
  longest_streak: number
  favorite_genre?: string
  last_story_date?: string
  created_at: string
  updated_at: string
}

// Check if Supabase is properly configured
const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey && 
    supabaseUrl !== 'your_supabase_project_url_here' && 
    supabaseAnonKey !== 'your_supabase_anon_key_here')
}

// Auth helpers
export const auth = {
  signUp: async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      return { 
        data: null, 
        error: new Error('Supabase is not configured. Please set up your environment variables.') 
      }
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  signIn: async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      return { 
        data: null, 
        error: new Error('Supabase is not configured. Please set up your environment variables.') 
      }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  signOut: async () => {
    if (!isSupabaseConfigured()) {
      return { error: null } // Allow sign out even if not configured
    }

    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (error) {
      return { error }
    }
  },

  getCurrentUser: async () => {
    if (!isSupabaseConfigured()) {
      return { user: null, error: null }
    }

    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      return { user, error }
    } catch (error) {
      return { user: null, error }
    }
  },

  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    if (!isSupabaseConfigured()) {
      return { data: { subscription: { unsubscribe: () => {} } } }
    }

    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session)
    })
  }
}

// Database helpers
export const db = {
  // User Profile operations
  getUserProfile: async (userId: string) => {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  createUserProfile: async (profile: Partial<UserProfile>) => {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .insert(profile)
        .select()
        .single()
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  updateUserProfile: async (userId: string, updates: Partial<UserProfile>) => {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  // Story operations
  createStory: async (story: Omit<Story, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    try {
      const { data, error } = await supabase
        .from('stories')
        .insert(story)
        .select()
        .single()
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  getUserStories: async (userId: string, limit = 10) => {
    if (!isSupabaseConfigured()) {
      return { data: [], error: null }
    }

    try {
      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          story_feedback (*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  updateStory: async (storyId: string, updates: Partial<Story>) => {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    try {
      const { data, error } = await supabase
        .from('stories')
        .update(updates)
        .eq('id', storyId)
        .select()
        .single()
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  // User Stats operations
  getUserStats: async (userId: string) => {
    if (!isSupabaseConfigured()) {
      return { data: null, error: null }
    }

    try {
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  // Achievements operations
  getAllAchievements: async () => {
    if (!isSupabaseConfigured()) {
      return { data: [], error: null }
    }

    try {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .order('points', { ascending: true })
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  getUserAchievements: async (userId: string) => {
    if (!isSupabaseConfigured()) {
      return { data: [], error: null }
    }

    try {
      const { data, error } = await supabase
        .from('user_achievements')
        .select(`
          *,
          achievement:achievements (*)
        `)
        .eq('user_id', userId)
        .order('earned_at', { ascending: false })
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  }
}

// Storage helpers
export const storage = {
  uploadAudio: async (file: File, fileName: string) => {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    try {
      const { data, error } = await supabase.storage
        .from('audio_recordings')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  getAudioUrl: (fileName: string) => {
    if (!isSupabaseConfigured()) {
      return 'placeholder-url'
    }

    try {
      const { data } = supabase.storage
        .from('audio_recordings')
        .getPublicUrl(fileName)
      
      return data.publicUrl
    } catch (error) {
      return 'placeholder-url'
    }
  },

  // Get a signed URL for private access (alternative to public URL)
  getSignedAudioUrl: async (fileName: string, expiresIn = 3600) => {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    try {
      const { data, error } = await supabase.storage
        .from('audio_recordings')
        .createSignedUrl(fileName, expiresIn)
      
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  deleteAudio: async (fileName: string) => {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    try {
      const { data, error } = await supabase.storage
        .from('audio_recordings')
        .remove([fileName])
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  }
}

// Export configuration status
export const isConfigured = isSupabaseConfigured