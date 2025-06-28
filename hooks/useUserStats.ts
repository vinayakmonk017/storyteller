import { useState, useEffect } from 'react'
import { db, UserStats, UserAchievement } from '@/lib/supabase'
import { useAuth } from './useAuth'

export function useUserStats() {
  const { user } = useAuth()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [achievements, setAchievements] = useState<UserAchievement[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      loadUserStats()
      loadUserAchievements()
    }
  }, [user])

  const loadUserStats = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const { data, error } = await db.getUserStats(user.id)
      if (error && error.code !== 'PGRST116') {
        throw error
      }
      
      // If no stats exist, create default stats
      if (!data) {
        const defaultStats: Partial<UserStats> = {
          user_id: user.id,
          total_stories: 0,
          total_minutes: 0,
          current_streak: 0,
          longest_streak: 0
        }
        
        // This will be created automatically when first story is added
        setStats(defaultStats as UserStats)
      } else {
        setStats(data)
      }
    } catch (error) {
      console.error('Error loading user stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUserAchievements = async () => {
    if (!user) return
    
    try {
      const { data, error } = await db.getUserAchievements(user.id)
      if (error) throw error
      setAchievements(data || [])
    } catch (error) {
      console.error('Error loading user achievements:', error)
    }
  }

  const refreshStats = async () => {
    await loadUserStats()
    await loadUserAchievements()
  }

  return {
    stats,
    achievements,
    loading,
    refreshStats
  }
}