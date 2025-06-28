import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { auth, db, UserProfile } from '@/lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...')
        
        // Get initial session
        const { user: initialUser, error } = await auth.getCurrentUser()
        console.log('Initial auth check:', { user: initialUser?.id, error })
        
        if (!mounted) return
        
        if (initialUser) {
          setUser(initialUser)
          await loadUserProfile(initialUser.id)
        } else {
          setUser(null)
          setProfile(null)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        if (mounted) {
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (mounted) {
          setLoading(false)
          setInitialized(true)
          console.log('Auth initialization complete')
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id)
      
      if (!mounted) return
      
      setUser(session?.user ?? null)
      
      if (session?.user) {
        await loadUserProfile(session.user.id)
      } else {
        setProfile(null)
      }
      
      if (initialized) {
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const loadUserProfile = async (userId: string) => {
    try {
      console.log('Loading profile for user:', userId)
      const { data, error } = await db.getUserProfile(userId)
      
      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create one
        console.log('Creating new profile for user:', userId)
        const { data: newProfile, error: createError } = await db.createUserProfile({
          id: userId,
          preferred_feedback_style: 'encouraging'
        })
        
        if (createError) {
          console.error('Error creating profile:', createError)
          setProfile(null)
        } else {
          console.log('Profile created successfully:', newProfile)
          setProfile(newProfile)
        }
      } else if (error) {
        console.error('Error loading profile:', error)
        setProfile(null)
      } else if (data) {
        console.log('Profile loaded successfully:', data)
        setProfile(data)
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error)
      setProfile(null)
    }
  }

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    try {
      const { data, error } = await auth.signIn(email, password)
      if (error) {
        setLoading(false)
      }
      return { data, error }
    } catch (error) {
      setLoading(false)
      throw error
    }
  }

  const signUp = async (email: string, password: string) => {
    setLoading(true)
    try {
      const { data, error } = await auth.signUp(email, password)
      setLoading(false)
      return { data, error }
    } catch (error) {
      setLoading(false)
      throw error
    }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      const { error } = await auth.signOut()
      setLoading(false)
      return { error }
    } catch (error) {
      setLoading(false)
      throw error
    }
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: new Error('No user logged in') }
    
    const { data, error } = await db.updateUserProfile(user.id, updates)
    if (data) {
      setProfile(data)
    }
    return { data, error }
  }

  return {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile
  }
}