import { useQuery, useQueryClient } from '@tanstack/react-query'
import { db, UserStats, UserAchievement } from '@/lib/supabase'
import { useAuth } from './useAuth'

export function useUserStats() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats
  } = useQuery({
    queryKey: ['user-stats', user?.id],
    queryFn: async () => {
      if (!user) return null
      
      const { data, error } = await db.getUserStats(user.id)
      if (error && error.code !== 'PGRST116') {
        throw error
      }
      
      // If no stats exist, return default stats
      if (!data) {
        return {
          user_id: user.id,
          total_stories: 0,
          total_minutes: 0,
          current_streak: 0,
          longest_streak: 0,
          favorite_genre: null,
          last_story_date: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as UserStats
      }
      
      return data
    },
    enabled: !!user,
  })

  const {
    data: achievements = [],
    isLoading: achievementsLoading,
    refetch: refetchAchievements
  } = useQuery({
    queryKey: ['user-achievements', user?.id],
    queryFn: async () => {
      if (!user) return []
      
      const { data, error } = await db.getUserAchievements(user.id)
      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })

  const refreshStats = async () => {
    await Promise.all([
      refetchStats(),
      refetchAchievements()
    ])
    
    // Also invalidate stories cache as stats might affect story display
    queryClient.invalidateQueries({ queryKey: ['stories', user?.id] })
  }

  return {
    stats,
    achievements,
    loading: statsLoading || achievementsLoading,
    refreshStats
  }
}