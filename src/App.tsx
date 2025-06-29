'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/src/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import StoryRecorder from '@/src/components/StoryRecorder'
import Dashboard from '@/src/components/Dashboard'
import StoryFeedback from '@/src/components/StoryFeedback'
import AuthModal from '@/src/components/AuthModal'
import { BookOpen, BarChart3, Mic, User, Settings, LogOut, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { useStories } from '@/hooks/useStories'
import { useUserStats } from '@/hooks/useUserStats'
import { isConfigured } from '@/lib/supabase'

type AppState = 'dashboard' | 'record' | 'feedback'

export default function App() {
  const [currentView, setCurrentView] = useState<AppState>('dashboard')
  const [currentStory, setCurrentStory] = useState<any>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)

  const { user, profile, loading: authLoading, signOut } = useAuth()
  const { 
    stories, 
    createStory, 
    isCreatingStory,
    getStoryById, 
    loading: storiesLoading, 
    processingStoryId,
    setProcessingStoryId
  } = useStories()
  const { stats, achievements, loading: statsLoading, refreshStats } = useUserStats()

  // Show auth modal if user is not logged in and Supabase is configured
  useEffect(() => {
    if (!authLoading && !user && isConfigured()) {
      setShowAuthModal(true)
    }
  }, [authLoading, user])

  // IMPROVED: Watch for story completion with better debugging
  useEffect(() => {
    console.log('🔍 App.tsx: Checking for completed stories', {
      processingStoryId,
      storiesCount: stories.length,
      stories: stories.map(s => ({ id: s.id, status: s.processing_status, title: s.title }))
    })

    if (processingStoryId && stories.length > 0) {
      const processingStory = stories.find(s => s.id === processingStoryId)
      
      console.log('📖 Found processing story:', {
        story: processingStory,
        status: processingStory?.processing_status,
        hasFeedback: processingStory?.story_feedback?.length > 0
      })
      
      if (processingStory?.processing_status === 'completed') {
        console.log('✅ Story processing completed, switching to feedback view')
        
        // Ensure we have the story with feedback
        if (processingStory.story_feedback && processingStory.story_feedback.length > 0) {
          console.log('📋 Story has feedback, showing feedback screen')
          setCurrentStory(processingStory)
          setCurrentView('feedback')
          setProcessingStoryId(null)
          refreshStats()
        } else {
          console.log('⏳ Story completed but no feedback yet, waiting...')
          // Don't clear processingStoryId yet, wait for feedback to load
        }
      } else if (processingStory?.processing_status === 'failed') {
        console.log('❌ Story processing failed')
        alert('Story processing failed. Please try again.')
        setProcessingStoryId(null)
        setCurrentView('record')
      }
    }
  }, [stories, processingStoryId, setProcessingStoryId, refreshStats])

  const handleStoryComplete = async (storyData: any) => {
    if (!user) {
      alert('Please sign in to save your stories')
      return
    }
    
    if (!isConfigured()) {
      // In demo mode, just show mock feedback
      const mockStory = {
        title: generateStoryTitle(storyData.genre),
        genre: storyData.genre,
        duration: storyData.duration,
        transcript: generateMockTranscript(storyData.prompt, storyData.genre),
        feedback: generateMockFeedback(storyData.feedbackPersonality),
        feedbackPersonality: storyData.feedbackPersonality,
        audioUrl: URL.createObjectURL(storyData.audioBlob),
        createdAt: new Date().toISOString()
      }
      
      setCurrentStory(mockStory)
      setCurrentView('feedback')
      return
    }
    
    try {
      console.log('🎬 Starting story creation process...')
      
      createStory({
        title: generateStoryTitle(storyData.genre),
        genre: storyData.genre,
        prompt: storyData.prompt,
        duration_seconds: storyData.duration,
        feedback_personality: storyData.feedbackPersonality,
        audioBlob: storyData.audioBlob
      })

      console.log('📡 Story creation initiated, real-time updates will handle completion')
      
    } catch (error) {
      console.error('💥 Error processing story:', error)
      alert('There was an error processing your story. Please try again.')
      setProcessingStoryId(null)
    }
  }

  const generateMockTranscript = (prompt: string, genre: string) => {
    const continuations = {
      adventure: "I took a deep breath and stepped through the doorway. The air was different here—thicker, charged with an energy I couldn't identify. As my eyes adjusted to the dim light, I could see ancient stone corridors stretching in multiple directions. Each path seemed to whisper promises of discovery and danger in equal measure.",
      mystery: "I decided to investigate further, but carefully. Something about this whole situation felt orchestrated, like pieces of a puzzle I was meant to solve. I started keeping a journal, documenting every detail—the time, the weather, any sounds I heard.",
      fantasy: "The moment I acknowledged their presence, everything changed. The garden came alive with colors I'd never seen before, and the small creatures revealed themselves to be guardians of something far more important than I'd ever imagined.",
      horror: "I tried to convince myself it was just my imagination, but deep down I knew something was terribly wrong. The feeling of being watched grew stronger each day, and I started noticing small changes in my house.",
      romance: "I couldn't stop thinking about our conversation, the way they laughed, the genuine interest in their eyes when I talked about my dreams. There was something magical about that unexpected connection.",
      'sci-fi': "The implications were staggering. If the message was true, it meant everything we thought we knew about our origins was wrong. I spent the next several hours analyzing the data, cross-referencing it with historical records."
    }
    
    return prompt + " " + (continuations[genre as keyof typeof continuations] || continuations.adventure)
  }

  const generateMockFeedback = (personality: string) => {
    const feedbacks = {
      encouraging: "What a fantastic storytelling session! Your narrative voice is engaging and draws listeners in from the very beginning. I love how you built tension gradually and used descriptive language to paint vivid scenes. Your pacing was excellent—you gave listeners time to absorb each detail while maintaining momentum.",
      stephen_king: "Well, well. You've got the makings of a storyteller, I'll give you that. Your opening grabbed me by the throat and didn't let go—that's the mark of someone who understands that the first few seconds are everything. You've got good instincts for building dread and atmosphere.",
      literary: "Your narrative demonstrates a sophisticated understanding of story structure and atmospheric development. The way you layered descriptive elements to build your fictional world shows real literary sensibility. Your prose has a natural rhythm that suggests an intuitive grasp of language flow.",
      casual: "Dude, that was awesome! You totally had me hooked from the start. I love how you just went with the flow and let the story take you where it wanted to go. Your descriptions were so vivid I could picture everything happening.",
      professional: "Your storytelling demonstrates strong foundational skills in several key areas. Your narrative structure follows a clear progression with effective use of exposition and rising action. Your descriptive language creates vivid imagery that engages the listener's senses."
    }
    
    return feedbacks[personality as keyof typeof feedbacks] || feedbacks.encouraging
  }

  const generateStoryTitle = (genre: string) => {
    const titles = {
      adventure: ['The Hidden Path', 'Journey to the Unknown', 'The Lost Expedition', 'Secrets of the Underground', 'The Mysterious Discovery'],
      mystery: ['The Vanishing Act', 'Secrets in the Shadows', 'The Missing Clue', 'Whispers in the Dark', 'The Unsolved Case'],
      fantasy: ['The Enchanted Realm', 'Dragons and Dreams', 'The Magic Within', 'Guardians of the Garden', 'The Ancient Responsibility'],
      horror: ['Whispers in the Dark', 'The Haunted Hour', 'Shadows of Fear', 'The Watching Eyes', 'Footsteps in the Attic'],
      romance: ['Hearts Entwined', 'Love\'s Sweet Journey', 'The Perfect Match', 'Unexpected Connections', 'Destined Encounters'],
      'sci-fi': ['Beyond the Stars', 'Future Echoes', 'The Time Paradox', 'Messages from Tomorrow', 'The Hidden Truth']
    }
    
    const genreTitles = titles[genre as keyof typeof titles] || titles.adventure
    return genreTitles[Math.floor(Math.random() * genreTitles.length)]
  }

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'record', label: 'Record Story', icon: Mic },
  ]

  const handleSignOut = async () => {
    await signOut()
    setShowAuthModal(true)
    setCurrentView('dashboard')
  }

  // Show loading screen while auth is loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950 flex items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Loading StoryTeller</h3>
                <p className="text-muted-foreground">
                  Preparing your storytelling experience...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show welcome screen if not authenticated
  if (!user) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950 flex items-center justify-center">
          <Card className="w-full max-w-md text-center">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Welcome to StoryTeller
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Your AI-powered storytelling companion
                  </p>
                  
                  {!isConfigured() && (
                    <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center gap-2 text-orange-700 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Running in demo mode - Supabase not configured</span>
                      </div>
                    </div>
                  )}
                  
                  <Button onClick={() => setShowAuthModal(true)}>
                    {isConfigured() ? 'Get Started' : 'Try Demo'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">StoryTeller</h1>
              {!isConfigured() && (
                <Badge variant="outline" className="text-xs">
                  Demo Mode
                </Badge>
              )}
            </div>
            
            <nav className="hidden md:flex items-center gap-1">
              {navigationItems.map((item) => (
                <Button
                  key={item.id}
                  variant={currentView === item.id ? "default" : "ghost"}
                  onClick={() => setCurrentView(item.id as AppState)}
                  className="flex items-center gap-2"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Button>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              {stats && (
                <Badge variant="secondary" className="hidden sm:flex items-center gap-1">
                  🔥 {stats.current_streak} day streak
                </Badge>
              )}
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="md:hidden border-b bg-white">
        <div className="flex">
          {navigationItems.map((item) => (
            <Button
              key={item.id}
              variant={currentView === item.id ? "default" : "ghost"}
              onClick={() => setCurrentView(item.id as AppState)}
              className="flex-1 flex items-center gap-2 rounded-none"
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {(isCreatingStory || processingStoryId) && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center min-h-[400px]"
            >
              <Card className="w-full max-w-md text-center">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Processing Your Story</h3>
                      <p className="text-muted-foreground">
                        Our AI is transcribing your recording and preparing personalized feedback...
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        ⚡ Real-time updates enabled - no need to refresh!
                      </p>
                      {processingStoryId && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Processing ID: {processingStoryId.substring(0, 8)}...
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {!isCreatingStory && !processingStoryId && currentView === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2">
                  Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}!
                </h2>
                <p className="text-muted-foreground">
                  Ready to continue your storytelling journey? 
                  {stats && stats.current_streak > 0 && ` You're on a ${stats.current_streak}-day streak!`}
                </p>
              </div>
              {stats ? (
                <Dashboard 
                  userStats={{
                    totalStories: stats.total_stories,
                    currentStreak: stats.current_streak,
                    longestStreak: stats.longest_streak,
                    totalMinutes: stats.total_minutes,
                    favoriteGenre: stats.favorite_genre || 'Adventure',
                    achievements: achievements.map(a => ({
                      id: a.achievement_id,
                      title: a.achievement?.title || '',
                      description: a.achievement?.description || '',
                      earned_at: a.earned_at,
                      achievement_type: a.achievement?.achievement_type || ''
                    }))
                  }}
                />
              ) : (
                <Dashboard 
                  userStats={{
                    totalStories: 0,
                    currentStreak: 0,
                    longestStreak: 0,
                    totalMinutes: 0,
                    favoriteGenre: 'Adventure',
                    achievements: []
                  }}
                />
              )}
            </motion.div>
          )}

          {!isCreatingStory && !processingStoryId && currentView === 'record' && (
            <motion.div
              key="record"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2">Record Your Story</h2>
                <p className="text-muted-foreground">
                  Choose your settings, read the story beginning, and continue the tale in your own unique way!
                </p>
              </div>
              <StoryRecorder onStoryComplete={handleStoryComplete} />
            </motion.div>
          )}

          {!isCreatingStory && !processingStoryId && currentView === 'feedback' && currentStory && (
            <motion.div
              key="feedback"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <StoryFeedback
                storyData={{
                  title: currentStory.title,
                  genre: currentStory.genre,
                  duration: currentStory.duration_seconds || currentStory.duration,
                  transcript: currentStory.transcript || '',
                  feedback: currentStory.story_feedback?.[0]?.feedback_text || currentStory.feedback || '',
                  feedbackPersonality: currentStory.feedback_personality || currentStory.feedbackPersonality,
                  audioUrl: currentStory.audio_url || currentStory.audioUrl,
                  createdAt: currentStory.created_at || currentStory.createdAt
                }}
                onNewStory={() => {
                  setCurrentView('record')
                  setCurrentStory(null)
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/50 backdrop-blur-sm mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>© 2024 StoryTeller. Empowering storytellers with AI-driven feedback.</p>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  )
}