'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import { Progress } from '@/src/components/ui/progress'
import { Calendar, Trophy, Target, TrendingUp, Book, Clock, Award, Flame } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { useStories } from '@/hooks/useStories'
import { db } from '@/lib/supabase'

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

export default function Dashboard({ userStats }: DashboardProps) {
  const { stories } = useStories()
  const [progressData, setProgressData] = useState<Array<{ day: string; stories: number; minutes: number }>>([])
  const [genreData, setGenreData] = useState<Array<{ genre: string; count: number; color: string }>>([])
  const [recentStories, setRecentStories] = useState<Array<{
    title: string
    genre: string
    duration: string
    date: string
    feedback: string
  }>>([])
  const [achievements, setAchievements] = useState<Array<{
    id: string
    title: string
    description: string
    icon: string
    earned: boolean
    earned_at: string | null
  }>>([])

  // Generate weekly progress data from real stories
  useEffect(() => {
    if (stories.length > 0) {
      generateWeeklyProgress()
      generateGenreDistribution()
      generateRecentStories()
    }
  }, [stories])

  // Load achievements data
  useEffect(() => {
    loadAchievements()
  }, [userStats.achievements])

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
    // Get the 3 most recent completed stories
    const recentCompleted = stories
      .filter(story => story.processing_status === 'completed')
      .slice(0, 3)
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
        const feedback = story.story_feedback?.[0]?.feedback_text || 'Processing feedback...'
        const feedbackSummary = feedback.length > 80 
          ? feedback.substring(0, 80) + '...'
          : feedback
        
        return {
          title: story.title,
          genre: story.genre.charAt(0).toUpperCase() + story.genre.slice(1),
          duration: `${Math.ceil(story.duration_seconds / 60)} min`,
          date: timeAgo,
          feedback: feedbackSummary
        }
      })
    
    setRecentStories(recentCompleted)
  }

  const loadAchievements = async () => {
    try {
      // Get all available achievements
      const { data: allAchievements, error } = await db.getAllAchievements()
      if (error) throw error
      
      const earnedAchievementIds = userStats.achievements.map(a => a.id)
      
      const achievementsList = [
        {
          id: 'first_story',
          title: 'First Story',
          description: 'Recorded your very first story',
          icon: '🎯',
          earned: earnedAchievementIds.includes('first_story'),
          earned_at: userStats.achievements.find(a => a.id === 'first_story')?.earned_at || null
        },
        {
          id: 'week_warrior',
          title: 'Week Warrior',
          description: 'Maintained a 7-day streak',
          icon: '🔥',
          earned: earnedAchievementIds.includes('week_warrior'),
          earned_at: userStats.achievements.find(a => a.id === 'week_warrior')?.earned_at || null
        },
        {
          id: 'genre_explorer',
          title: 'Genre Explorer',
          description: 'Tried all 6 story genres',
          icon: '🗺️',
          earned: genreData.length >= 6,
          earned_at: genreData.length >= 6 ? new Date().toISOString() : null
        },
        {
          id: 'marathon_storyteller',
          title: 'Marathon Storyteller',
          description: 'Recorded a 15-minute story',
          icon: '⏰',
          earned: stories.some(story => story.duration_seconds >= 900),
          earned_at: stories.some(story => story.duration_seconds >= 900) ? new Date().toISOString() : null
        },
        {
          id: 'century_club',
          title: 'Century Club',
          description: 'Recorded 100 stories',
          icon: '💯',
          earned: userStats.totalStories >= 100,
          earned_at: userStats.totalStories >= 100 ? new Date().toISOString() : null
        },
        {
          id: 'master_storyteller',
          title: 'Master Storyteller',
          description: 'Achieved 30-day streak',
          icon: '👑',
          earned: userStats.currentStreak >= 30,
          earned_at: userStats.currentStreak >= 30 ? new Date().toISOString() : null
        }
      ]
      
      setAchievements(achievementsList)
    } catch (error) {
      console.error('Error loading achievements:', error)
      // Fallback to basic achievements
      setAchievements([
        {
          id: 'first_story',
          title: 'First Story',
          description: 'Recorded your very first story',
          icon: '🎯',
          earned: userStats.totalStories > 0,
          earned_at: userStats.totalStories > 0 ? new Date().toISOString() : null
        }
      ])
    }
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  achievement.earned
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
                    : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/20 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{achievement.icon}</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{achievement.title}</h3>
                    <p className="text-xs text-muted-foreground mb-2">{achievement.description}</p>
                    {achievement.earned ? (
                      <Badge variant="secondary" className="text-xs">
                        <Award className="w-3 h-3 mr-1" />
                        Earned
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Locked
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recent Stories
          </CardTitle>
          <CardDescription>Your latest storytelling sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {recentStories.length > 0 ? (
            <div className="space-y-4">
              {recentStories.map((story, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex-1">
                    <h4 className="font-medium">{story.title}</h4>
                    <div className="flex items-center gap-4 mt-1">
                      <Badge variant="outline" className="text-xs">{story.genre}</Badge>
                      <span className="text-xs text-muted-foreground">{story.duration}</span>
                      <span className="text-xs text-muted-foreground">{story.date}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{story.feedback}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No completed stories yet</p>
              <p className="text-sm">Record your first story to see it here!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}