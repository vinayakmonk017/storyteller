'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import { Progress } from '@/src/components/ui/progress'
import { Calendar, Trophy, Target, TrendingUp, Book, Clock, Award, Flame, Eye } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { useStories } from '@/hooks/useStories'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { db } from '@/lib/supabase'
import StoryDetailModal from './StoryDetailModal'

interface DashboardProps {
  userStats: {
    totalStories: number
    currentStreak: number
    longestStreak: number
    totalMinutes: number
    favoriteGenre: string
    achievements: Array<{
      id: string
      title: string
      description: string
      earned_at: string
      achievement_type: string
    }>
  }
}

interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  achievement_type: string
  criteria: Record<string, any>
  points: number
  earned: boolean
  earned_at: string | null
  progress?: number
  progressText?: string
}

export default function Dashboard({ userStats }: DashboardProps) {
  const { stories } = useStories()
  const queryClient = useQueryClient()
  const [progressData, setProgressData] = useState<Array<{ day: string; stories: number; minutes: number }>>([])
  const [genreData, setGenreData] = useState<Array<{ genre: string; count: number; color: string }>>([])
  const [recentStories, setRecentStories] = useState<Array<{
    id: string
    title: string
    genre: string
    duration: string
    date: string
    feedback: string
    processing_status: string
  }>>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null)
  const [showStoryModal, setShowStoryModal] = useState(false)
  const [loadingAchievements, setLoadingAchievements] = useState(true)

  // Generate weekly progress data from real stories
  useEffect(() => {
    if (stories.length > 0) {
      generateWeeklyProgress()
      generateGenreDistribution()
      generateRecentStories()
    }
  }, [stories])

  // Load achievements data with real calculations
  useEffect(() => {
    loadRealAchievements()
  }, [userStats, stories])

  const generateWeeklyProgress = () => {
    const today = new Date()
    const weekData = []
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    
    // Generate data for the last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      const dayName = dayNames[date.getDay()]
      
      // Filter stories for this day
      const dayStories = stories.filter(story => {
        const storyDate = new Date(story.created_at)
        return storyDate.toDateString() === date.toDateString()
      })
      
      const totalMinutes = dayStories.reduce((sum, story) => 
        sum + Math.ceil(story.duration_seconds / 60), 0
      )
      
      weekData.push({
        day: dayName,
        stories: dayStories.length,
        minutes: totalMinutes
      })
    }
    
    setProgressData(weekData)
  }

  const generateGenreDistribution = () => {
    const genreCounts: { [key: string]: number } = {}
    const genreColors: { [key: string]: string } = {
      'adventure': '#3B82F6',
      'mystery': '#8B5CF6', 
      'fantasy': '#10B981',
      'horror': '#EF4444',
      'romance': '#F59E0B',
      'sci-fi': '#06B6D4'
    }
    
    // Count stories by genre
    stories.forEach(story => {
      genreCounts[story.genre] = (genreCounts[story.genre] || 0) + 1
    })
    
    // Convert to chart data
    const chartData = Object.entries(genreCounts).map(([genre, count]) => ({
      genre: genre.charAt(0).toUpperCase() + genre.slice(1).replace('-', '-'),
      count,
      color: genreColors[genre] || '#6B7280'
    }))
    
    // Sort by count descending
    chartData.sort((a, b) => b.count - a.count)
    
    setGenreData(chartData)
  }

  const generateRecentStories = () => {
    // Get the 5 most recent stories
    const recentCompleted = stories
      .slice(0, 5)
      .map(story => {
        const createdDate = new Date(story.created_at)
        const now = new Date()
        const diffTime = Math.abs(now.getTime() - createdDate.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        
        let timeAgo = ''
        if (diffDays === 1) {
          timeAgo = '1 day ago'
        } else if (diffDays < 7) {
          timeAgo = `${diffDays} days ago`
        } else {
          timeAgo = createdDate.toLocaleDateString()
        }
        
        // Get feedback summary
        const feedback = story.story_feedback?.[0]?.feedback_text || ''
        const feedbackSummary = feedback.length > 80 
          ? feedback.substring(0, 80) + '...'
          : feedback || 'No feedback available'
        
        return {
          id: story.id,
          title: story.title,
          genre: story.genre.charAt(0).toUpperCase() + story.genre.slice(1),
          duration: `${Math.ceil(story.duration_seconds / 60)} min`,
          date: timeAgo,
          feedback: feedbackSummary,
          processing_status: story.processing_status
        }
      })
    
    setRecentStories(recentCompleted)
  }

  const loadRealAchievements = async () => {
    setLoadingAchievements(true)
    
    try {
      // Get all available achievements from database
      const { data: allAchievements, error } = await db.getAllAchievements()
      if (error) {
        console.error('Error loading achievements:', error)
        return
      }

      // Get earned achievement IDs
      const earnedAchievementIds = userStats.achievements.map(a => a.id)
      const earnedAchievementsMap = new Map(
        userStats.achievements.map(a => [a.id, a.earned_at])
      )

      // Calculate unique genres from stories
      const uniqueGenres = new Set(stories.map(story => story.genre))
      
      // Find longest story duration
      const longestStoryDuration = stories.reduce((max, story) => 
        Math.max(max, story.duration_seconds), 0
      )

      // Process each achievement with real data
      const processedAchievements: Achievement[] = (allAchievements || []).map(achievement => {
        const isEarned = earnedAchievementIds.includes(achievement.id)
        let progress = 0
        let progressText = ''

        // Calculate progress based on achievement type and criteria
        switch (achievement.id) {
          case 'first_story':
            progress = userStats.totalStories > 0 ? 100 : 0
            progressText = userStats.totalStories > 0 ? 'Completed!' : 'Record your first story'
            break

          case 'week_warrior':
            progress = Math.min((userStats.currentStreak / 7) * 100, 100)
            progressText = `${userStats.currentStreak}/7 days`
            break

          case 'genre_explorer':
            progress = Math.min((uniqueGenres.size / 6) * 100, 100)
            progressText = `${uniqueGenres.size}/6 genres explored`
            break

          case 'marathon_storyteller':
            const targetDuration = 900 // 15 minutes
            progress = Math.min((longestStoryDuration / targetDuration) * 100, 100)
            const longestMinutes = Math.ceil(longestStoryDuration / 60)
            progressText = `${longestMinutes}/15 minutes (longest story)`
            break

          case 'century_club':
            progress = Math.min((userStats.totalStories / 100) * 100, 100)
            progressText = `${userStats.totalStories}/100 stories`
            break

          case 'master_storyteller':
            progress = Math.min((userStats.currentStreak / 30) * 100, 100)
            progressText = `${userStats.currentStreak}/30 days`
            break

          default:
            progress = isEarned ? 100 : 0
            progressText = isEarned ? 'Completed!' : 'In progress'
        }

        return {
          id: achievement.id,
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          achievement_type: achievement.achievement_type,
          criteria: achievement.criteria,
          points: achievement.points,
          earned: isEarned,
          earned_at: earnedAchievementsMap.get(achievement.id) || null,
          progress: Math.round(progress),
          progressText
        }
      })

      // Sort achievements: earned first, then by progress
      processedAchievements.sort((a, b) => {
        if (a.earned && !b.earned) return -1
        if (!a.earned && b.earned) return 1
        if (a.earned && b.earned) return 0
        return (b.progress || 0) - (a.progress || 0)
      })

      setAchievements(processedAchievements)
      
    } catch (error) {
      console.error('Error loading achievements:', error)
      
      // Fallback to basic achievements if database fails
      setAchievements([
        {
          id: 'first_story',
          title: 'First Story',
          description: 'Recorded your very first story',
          icon: '🎯',
          achievement_type: 'milestone',
          criteria: { stories_count: 1 },
          points: 10,
          earned: userStats.totalStories > 0,
          earned_at: userStats.totalStories > 0 ? new Date().toISOString() : null,
          progress: userStats.totalStories > 0 ? 100 : 0,
          progressText: userStats.totalStories > 0 ? 'Completed!' : 'Record your first story'
        }
      ])
    } finally {
      setLoadingAchievements(false)
    }
  }

  const handleStoryClick = (storyId: string) => {
    setSelectedStoryId(storyId)
    setShowStoryModal(true)
  }

  // Mutation for handling story deletion with proper cache invalidation
  const deleteStoryMutation = useMutation({
    mutationFn: async (storyId: string) => {
      // This will be handled by the StoryDetailModal
      return storyId
    },
    onSuccess: () => {
      // Invalidate and refetch all related queries
      queryClient.invalidateQueries({ queryKey: ['stories'] })
      queryClient.invalidateQueries({ queryKey: ['user-stats'] })
      queryClient.invalidateQueries({ queryKey: ['user-achievements'] })
      
      // Close modal
      setShowStoryModal(false)
      setSelectedStoryId(null)
    }
  })

  const handleStoryDelete = (storyId: string) => {
    deleteStoryMutation.mutate(storyId)
  }

  const formatDuration = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const getAverageStoryLength = () => {
    if (userStats.totalStories === 0) return '0 min'
    const avgMinutes = Math.round(userStats.totalMinutes / userStats.totalStories)
    return `${avgMinutes} min`
  }

  const getWeeklyGrowth = () => {
    const thisWeekStories = progressData.reduce((sum, day) => sum + day.stories, 0)
    const lastWeekStories = Math.max(0, userStats.totalStories - thisWeekStories)
    
    if (lastWeekStories === 0) return '+100%'
    const growth = Math.round(((thisWeekStories - lastWeekStories) / lastWeekStories) * 100)
    return growth > 0 ? `+${growth}%` : `${growth}%`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'processing': return 'bg-blue-100 text-blue-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatAchievementDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stories</CardTitle>
            <Book className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold">{userStats.totalStories}</div>
            <p className="text-xs text-muted-foreground">
              {getWeeklyGrowth()} from last week
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
            <Flame className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold">{userStats.currentStreak} days</div>
            <p className="text-xs text-muted-foreground">
              Best: {userStats.longestStreak} days
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Time</CardTitle>
            <Clock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold">{formatDuration(userStats.totalMinutes)}</div>
            <p className="text-xs text-muted-foreground">
              Average: {getAverageStoryLength()}/story
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Favorite Genre</CardTitle>
            <Target className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold">
              {userStats.favoriteGenre || 'None yet'}
            </div>
            <p className="text-xs text-muted-foreground">
              {genreData.find(g => g.genre.toLowerCase() === userStats.favoriteGenre?.toLowerCase())?.count || 0} stories recorded
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Weekly Progress
            </CardTitle>
            <CardDescription>Your storytelling activity this week</CardDescription>
          </CardHeader>
          <CardContent>
            {progressData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={progressData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      value, 
                      name === 'stories' ? 'Stories' : 'Minutes'
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="stories" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                    name="stories"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Book className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No stories recorded yet</p>
                  <p className="text-sm">Start recording to see your progress!</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Book className="h-5 w-5" />
              Genre Distribution
            </CardTitle>
            <CardDescription>Your favorite story genres</CardDescription>
          </CardHeader>
          <CardContent>
            {genreData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={genreData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="genre" 
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar 
                    dataKey="count" 
                    fill="#8884d8" 
                    radius={[4, 4, 0, 0]}
                    name="Stories"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No genre data yet</p>
                  <p className="text-sm">Try different genres to see your preferences!</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Achievements
          </CardTitle>
          <CardDescription>Your storytelling milestones and badges</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAchievements ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-4 rounded-lg border-2 border-gray-200 bg-gray-50 animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-300 rounded"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-300 rounded mb-2"></div>
                      <div className="h-3 bg-gray-300 rounded mb-2"></div>
                      <div className="h-2 bg-gray-300 rounded"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                    achievement.earned
                      ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
                      : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`text-2xl ${achievement.earned ? '' : 'grayscale opacity-50'}`}>
                      {achievement.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{achievement.title}</h3>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{achievement.description}</p>
                      
                      {achievement.earned ? (
                        <div className="space-y-1">
                          <Badge variant="secondary" className="text-xs">
                            <Award className="w-3 h-3 mr-1" />
                            Earned
                          </Badge>
                          {achievement.earned_at && (
                            <p className="text-xs text-muted-foreground">
                              {formatAchievementDate(achievement.earned_at)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Progress</span>
                            <span className="text-xs font-medium">{achievement.progress}%</span>
                          </div>
                          <Progress value={achievement.progress} className="h-1" />
                          <p className="text-xs text-muted-foreground">{achievement.progressText}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recent Stories
          </CardTitle>
          <CardDescription>Your latest storytelling sessions - click to view details</CardDescription>
        </CardHeader>
        <CardContent>
          {recentStories.length > 0 ? (
            <div className="space-y-4">
              {recentStories.map((story) => (
                <div 
                  key={story.id} 
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors group"
                  onClick={() => handleStoryClick(story.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium group-hover:text-blue-600 transition-colors">{story.title}</h4>
                      <Badge className={getStatusColor(story.processing_status)}>
                        {story.processing_status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mb-2">
                      <Badge variant="outline" className="text-xs">{story.genre}</Badge>
                      <span className="text-xs text-muted-foreground">{story.duration}</span>
                      <span className="text-xs text-muted-foreground">{story.date}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{story.feedback}</p>
                  </div>
                  <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Eye className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No stories yet</p>
              <p className="text-sm">Record your first story to see it here!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Story Detail Modal */}
      {selectedStoryId && (
        <StoryDetailModal
          storyId={selectedStoryId}
          isOpen={showStoryModal}
          onClose={() => {
            setShowStoryModal(false)
            setSelectedStoryId(null)
          }}
          onDelete={handleStoryDelete}
        />
      )}
    </div>
  )
}