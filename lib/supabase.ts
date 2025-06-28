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
      console.log('Attempting to sign up user:', email)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })
      console.log('Sign up result:', { user: data.user?.id, error })
      return { data, error }
    } catch (error) {
      console.error('Auth signUp error:', error)
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
      console.log('Attempting to sign in user:', email)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      console.log('Sign in result:', { user: data.user?.id, error })
      return { data, error }
    } catch (error) {
      console.error('Auth signIn error:', error)
      return { data: null, error }
    }
  },

  signOut: async () => {
    if (!isSupabaseConfigured()) {
      return { error: null } // Allow sign out even if not configured
    }

    try {
      console.log('Attempting to sign out')
      const { error } = await supabase.auth.signOut()
      console.log('Sign out result:', { error })
      return { error }
    } catch (error) {
      console.error('Auth signOut error:', error)
      return { error }
    }
  },

  getCurrentUser: async () => {
    if (!isSupabaseConfigured()) {
      return { user: null, error: null }
    }

    try {
      console.log('Getting current user...')
      const { data: { user }, error } = await supabase.auth.getUser()
      console.log('Current user result:', { user: user?.id, error })
      return { user, error }
    } catch (error) {
      console.error('Auth getCurrentUser error:', error)
      return { user: null, error }
    }
  },

  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured - auth state changes will not work')
      return { data: { subscription: { unsubscribe: () => {} } } }
    }

    console.log('Setting up auth state change listener')
    return supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change event:', event, session?.user?.id)
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
      console.log('Getting user profile for:', userId)
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()
      console.log('Get profile result:', { data: !!data, error })
      return { data, error }
    } catch (error) {
      console.error('getUserProfile error:', error)
      return { data: null, error }
    }
  },

  createUserProfile: async (profile: Partial<UserProfile>) => {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    try {
      console.log('Creating user profile:', profile.id)
      const { data, error } = await supabase
        .from('user_profiles')
        .insert(profile)
        .select()
        .single()
      console.log('Create profile result:', { data: !!data, error })
      return { data, error }
    } catch (error) {
      console.error('createUserProfile error:', error)
      return { data: null, error }
    }
  },

  updateUserProfile: async (userId: string, updates: Partial<UserProfile>) => {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    try {
      console.log('Updating user profile:', userId)
      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()
      console.log('Update profile result:', { data: !!data, error })
      return { data, error }
    } catch (error) {
      console.error('updateUserProfile error:', error)
      return { data: null, error }
    }
  },

  // Story operations
  createStory: async (story: Omit<Story, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    try {
      console.log('Creating story for user:', story.user_id)
      const { data, error } = await supabase
        .from('stories')
        .insert(story)
        .select()
        .single()
      console.log('Create story result:', { data: !!data, error })
      return { data, error }
    } catch (error) {
      console.error('createStory error:', error)
      return { data: null, error }
    }
  },

  getUserStories: async (userId: string, limit = 10) => {
    if (!isSupabaseConfigured()) {
      return { data: [], error: null }
    }

    try {
      console.log('Getting stories for user:', userId)
      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          story_feedback (*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
      console.log('Get stories result:', { count: data?.length, error })
      return { data, error }
    } catch (error) {
      console.error('getUserStories error:', error)
      return { data: null, error }
    }
  },

  updateStory: async (storyId: string, updates: Partial<Story>) => {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    try {
      console.log('Updating story:', storyId)
      const { data, error } = await supabase
        .from('stories')
        .update(updates)
        .eq('id', storyId)
        .select()
        .single()
      console.log('Update story result:', { data: !!data, error })
      return { data, error }
    } catch (error) {
      console.error('updateStory error:', error)
      return { data: null, error }
    }
  },

  // User Stats operations
  getUserStats: async (userId: string) => {
    if (!isSupabaseConfigured()) {
      return { data: null, error: null }
    }

    try {
      console.log('Getting user stats for:', userId)
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single()
      console.log('Get stats result:', { data: !!data, error })
      return { data, error }
    } catch (error) {
      console.error('getUserStats error:', error)
      return { data: null, error }
    }
  },

  // Achievements operations
  getAllAchievements: async () => {
    if (!isSupabaseConfigured()) {
      return { data: [], error: null }
    }

    try {
      console.log('Getting all achievements')
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .order('points', { ascending: true })
      console.log('Get achievements result:', { count: data?.length, error })
      return { data, error }
    } catch (error) {
      console.error('getAllAchievements error:', error)
      return { data: null, error }
    }
  },

  getUserAchievements: async (userId: string) => {
    if (!isSupabaseConfigured()) {
      return { data: [], error: null }
    }

    try {
      console.log('Getting user achievements for:', userId)
      const { data, error } = await supabase
        .from('user_achievements')
        .select(`
          *,
          achievement:achievements (*)
        `)
        .eq('user_id', userId)
        .order('earned_at', { ascending: false })
      console.log('Get user achievements result:', { count: data?.length, error })
      return { data, error }
    } catch (error) {
      console.error('getUserAchievements error:', error)
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
      console.log('Uploading audio file:', fileName)
      const { data, error } = await supabase.storage
        .from('audio_recordings')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })
      console.log('Upload result:', { data: !!data, error })
      return { data, error }
    } catch (error) {
      console.error('uploadAudio error:', error)
      return { data: null, error }
    }
  },

  getAudioUrl: (fileName: string) => {
    if (!isSupabaseConfigured()) {
      return 'placeholder-url'
    }

    const { data } = supabase.storage
      .from('audio_recordings')
      .getPublicUrl(fileName)
    console.log('Generated audio URL for:', fileName)
    return data.publicUrl
  },

  deleteAudio: async (fileName: string) => {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    try {
      console.log('Deleting audio file:', fileName)
      const { data, error } = await supabase.storage
        .from('audio_recordings')
        .remove([fileName])
      console.log('Delete result:', { data, error })
      return { data, error }
    } catch (error) {
      console.error('deleteAudio error:', error)
      return { data: null, error }
    }
  }
}

// Export configuration status
export const isConfigured = isSupabaseConfigured