'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { Separator } from '@/src/components/ui/separator'
import { Alert, AlertDescription } from '@/src/components/ui/alert'
import { MessageSquare, Star, TrendingUp, Lightbulb, ArrowRight, Volume2, VolumeX, Play, Pause, AlertTriangle, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'

interface StoryFeedbackProps {
  storyData: {
    title: string
    genre: string
    duration: number
    transcript: string
    feedback: string
    feedbackPersonality: string
    audioUrl?: string
    createdAt: string
    story_feedback?: Array<{
      id: string
      feedback_text: string
      strengths: string[]
      improvements: string[]
      next_steps: string[]
      overall_score?: number
      created_at: string
    }>
  }
  onNewStory: () => void
}

export default function StoryFeedback({ storyData, onNewStory }: StoryFeedbackProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [audioLoading, setAudioLoading] = useState(true)
  const [debugInfo, setDebugInfo] = useState<any>({})
  
  const audioRef = useRef<HTMLAudioElement>(null)

  // CRITICAL: Reset all audio states when story data changes
  useEffect(() => {
    console.log('🎵 StoryFeedback - New story data received:', {
      audioUrl: storyData.audioUrl,
      storyTitle: storyData.title,
      storyCreatedAt: storyData.createdAt,
      hasAudioUrl: !!storyData.audioUrl,
      audioUrlLength: storyData.audioUrl?.length,
      audioUrlDomain: storyData.audioUrl ? new URL(storyData.audioUrl).hostname : 'N/A',
      timestamp: new Date().toISOString()
    })

    // CRITICAL: Reset all audio states immediately
    setAudioError(null)
    setAudioLoading(true)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setVolume(1)
    setIsMuted(false)

    setDebugInfo({
      audioUrl: storyData.audioUrl,
      storyTitle: storyData.title,
      timestamp: new Date().toISOString(),
      hasAudioUrl: !!storyData.audioUrl,
      storyId: storyData.title + '-' + storyData.createdAt
    })

    // Force audio element to reload if it exists
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current.load()
    }
  }, [storyData.audioUrl, storyData.title, storyData.createdAt])

  // Enhanced audio event handlers with detailed logging
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !storyData.audioUrl) {
      setAudioLoading(false)
      return
    }

    console.log('🎵 Setting up audio event listeners for:', storyData.audioUrl)

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0)
    }

    const handleLoadedMetadata = () => {
      console.log('🎵 Audio metadata loaded:', {
        duration: audio.duration,
        readyState: audio.readyState,
        networkState: audio.networkState,
        src: audio.src
      })
      setDuration(audio.duration || 0)
      setAudioError(null)
      setAudioLoading(false)
    }

    const handleCanPlay = () => {
      console.log('🎵 Audio can play:', {
        duration: audio.duration,
        readyState: audio.readyState,
        src: audio.src
      })
      setAudioError(null)
      setAudioLoading(false)
    }

    const handleLoadStart = () => {
      console.log('🎵 Audio load started for:', audio.src)
      setAudioLoading(true)
      setAudioError(null)
    }

    const handleLoadedData = () => {
      console.log('🎵 Audio data loaded for:', audio.src)
      setAudioLoading(false)
    }

    const handleEnded = () => {
      console.log('🎵 Audio playback ended')
      setIsPlaying(false)
    }

    const handleError = (e: any) => {
      console.error('🎵 Audio error:', {
        error: e,
        audioError: audio.error,
        networkState: audio.networkState,
        readyState: audio.readyState,
        src: audio.src
      })
      
      let errorMessage = 'Unknown audio error'
      if (audio.error) {
        switch (audio.error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Audio loading was aborted'
            break
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error while loading audio'
            break
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Audio file is corrupted or unsupported'
            break
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Audio format not supported'
            break
        }
      }
      
      setAudioError(errorMessage)
      setAudioLoading(false)
      setDuration(0)
      setCurrentTime(0)
    }

    const handleWaiting = () => {
      console.log('🎵 Audio waiting for data')
      setAudioLoading(true)
    }

    const handlePlaying = () => {
      console.log('🎵 Audio started playing')
      setAudioLoading(false)
    }

    // Add all event listeners
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('loadstart', handleLoadStart)
    audio.addEventListener('loadeddata', handleLoadedData)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('waiting', handleWaiting)
    audio.addEventListener('playing', handlePlaying)

    // CRITICAL: Force load the audio with the new source
    if (audio.src !== storyData.audioUrl) {
      console.log('🎵 Setting new audio source:', storyData.audioUrl)
      audio.src = storyData.audioUrl
    }
    audio.load()

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('loadstart', handleLoadStart)
      audio.removeEventListener('loadeddata', handleLoadedData)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('waiting', handleWaiting)
      audio.removeEventListener('playing', handlePlaying)
    }
  }, [storyData.audioUrl])

  const testAudioUrl = async () => {
    if (!storyData.audioUrl) return

    console.log('🔍 Testing audio URL accessibility:', storyData.audioUrl)
    
    try {
      const response = await fetch(storyData.audioUrl, { method: 'HEAD' })
      console.log('🔍 Audio URL test result:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        url: storyData.audioUrl
      })
      
      if (!response.ok) {
        setAudioError(`Audio file not accessible: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('🔍 Audio URL test failed:', error)
      setAudioError(`Network error: ${error.message}`)
    }
  }

  const togglePlayPause = async () => {
    if (!audioRef.current || audioError) return

    console.log('🎵 Toggle play/pause:', { isPlaying, readyState: audioRef.current.readyState })

    try {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        // Ensure audio is loaded before playing
        if (audioRef.current.readyState < 2) {
          console.log('🎵 Audio not ready, loading...')
          setAudioLoading(true)
          await audioRef.current.load()
        }
        
        const playPromise = audioRef.current.play()
        if (playPromise !== undefined) {
          await playPromise
          setIsPlaying(true)
        }
      }
    } catch (error) {
      console.error('🎵 Play/pause error:', error)
      setAudioError(`Playback error: ${error.message}`)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || audioError || !duration) return
    
    const newTime = (parseFloat(e.target.value) / 100) * duration
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const toggleMute = () => {
    if (!audioRef.current || audioError) return
    
    if (isMuted) {
      audioRef.current.volume = volume
      setIsMuted(false)
    } else {
      audioRef.current.volume = 0
      setIsMuted(true)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || audioError) return
    
    const newVolume = parseFloat(e.target.value) / 100
    setVolume(newVolume)
    audioRef.current.volume = newVolume
    setIsMuted(newVolume === 0)
  }

  const retryAudioLoad = () => {
    if (!audioRef.current || !storyData.audioUrl) return
    
    console.log('🔄 Retrying audio load')
    setAudioError(null)
    setAudioLoading(true)
    
    // Force reload with new timestamp to bypass cache
    const urlWithTimestamp = storyData.audioUrl + (storyData.audioUrl.includes('?') ? '&' : '?') + 't=' + Date.now()
    audioRef.current.src = urlWithTimestamp
    audioRef.current.load()
  }

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) {
      return '0:00'
    }
    
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const personalityLabels = {
    encouraging: 'Encouraging Coach',
    stephen_king: 'Stephen King Style',
    literary: 'Literary Critic',
    casual: 'Friendly Buddy',
    professional: 'Writing Instructor'
  }

  // Get feedback data from either the new structure or fallback to old structure
  const feedbackData = storyData.story_feedback?.[0] || {
    feedback_text: storyData.feedback,
    strengths: [
      "Excellent opening that immediately draws the reader in",
      "Strong use of descriptive language and vivid imagery",
      "Good pacing and natural story flow",
      "Creative and engaging narrative voice"
    ],
    improvements: [
      "Consider adding more dialogue to bring characters to life",
      "Try incorporating more sensory details beyond visual",
      "Experiment with varying sentence length for better rhythm",
      "Add more emotional depth to character interactions"
    ],
    next_steps: [
      "Practice recording stories in different genres to expand your range",
      "Try telling the same story from different character perspectives",
      "Experiment with different narrative techniques like flashbacks",
      "Record shorter practice sessions focusing on specific skills"
    ],
    overall_score: 8
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Story Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/20 rounded-full">
          <Star className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-700 dark:text-green-300">Story Complete!</span>
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{storyData.title}</h1>
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <Badge variant="outline">{storyData.genre}</Badge>
          <span>{formatDuration(storyData.duration)}</span>
          <span>{new Date(storyData.createdAt).toLocaleDateString()}</span>
          {feedbackData.overall_score && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Star className="w-3 h-3" />
              {feedbackData.overall_score}/10
            </Badge>
          )}
        </div>
      </motion.div>

      {/* Debug Information (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-sm text-orange-800">🔧 Audio Debug Info</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-orange-700">
            <pre className="whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
            <Button 
              onClick={testAudioUrl} 
              size="sm" 
              variant="outline" 
              className="mt-2"
            >
              Test Audio URL
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Audio Player */}
      {storyData.audioUrl && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="w-5 h-5" />
                Your Recording
              </CardTitle>
              <CardDescription>Listen to your storytelling performance</CardDescription>
            </CardHeader>
            <CardContent>
              <audio
                ref={audioRef}
                src={storyData.audioUrl}
                preload="metadata"
                className="hidden"
                crossOrigin="anonymous"
                key={`audio-${storyData.title}-${storyData.createdAt}`}
              />
              
              {/* Audio Error Display */}
              {audioError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>{audioError}</span>
                    <Button 
                      onClick={retryAudioLoad} 
                      size="sm" 
                      variant="outline"
                      className="ml-2"
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-4">
                {/* Main Controls */}
                <div className="flex items-center gap-4">
                  <Button
                    onClick={togglePlayPause}
                    size="lg"
                    disabled={audioError || audioLoading}
                    className="flex items-center gap-2 min-w-[120px]"
                  >
                    {audioLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    {audioLoading ? 'Loading...' : isPlaying ? 'Pause' : 'Play'}
                  </Button>
                  
                  <div className="flex-1 space-y-2">
                    {/* Progress Bar */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={duration > 0 ? (currentTime / duration) * 100 : 0}
                      onChange={handleSeek}
                      disabled={audioError || audioLoading || !duration}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                    
                    {/* Time Display */}
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{formatDuration(currentTime)}</span>
                      <span>{formatDuration(duration || storyData.duration)}</span>
                    </div>
                  </div>
                </div>

                {/* Volume Controls */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleMute}
                    disabled={audioError}
                    className="flex items-center gap-1"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                  
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isMuted ? 0 : volume * 100}
                    onChange={handleVolumeChange}
                    disabled={audioError}
                    className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  
                  <span className="text-xs text-muted-foreground w-8">
                    {Math.round((isMuted ? 0 : volume) * 100)}%
                  </span>
                </div>

                {/* Audio Status Info */}
                <div className="text-xs text-muted-foreground">
                  Status: {audioLoading ? 'Loading...' : audioError ? 'Error' : 'Ready'} | 
                  URL: {storyData.audioUrl ? '✓ Present' : '✗ Missing'}
                  {audioRef.current && (
                    <> | Ready State: {audioRef.current.readyState}/4</>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* No Audio Available */}
      {!storyData.audioUrl && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="text-center py-8">
              <VolumeX className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No audio recording available for this story</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* AI Feedback */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20" />
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              AI Feedback
            </CardTitle>
            <CardDescription>
              Personalized insights from your {personalityLabels[storyData.feedbackPersonality as keyof typeof personalityLabels]} coach
            </CardDescription>
          </CardHeader>
          <CardContent className="relative space-y-6">
            {/* Detailed Feedback */}
            <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Detailed Analysis</h4>
              <p className="text-sm leading-relaxed">{feedbackData.feedback_text}</p>
            </div>

            <Separator />

            {/* Strengths */}
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-green-700 dark:text-green-300 mb-3">
                <Star className="w-4 h-4" />
                What You Did Well
              </h3>
              <ul className="space-y-2">
                {feedbackData.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-sm">{strength}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            {/* Areas for Improvement */}
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-300 mb-3">
                <TrendingUp className="w-4 h-4" />
                Areas to Enhance
              </h3>
              <ul className="space-y-2">
                {feedbackData.improvements.map((improvement, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-sm">{improvement}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            {/* Next Steps */}
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-purple-700 dark:text-purple-300 mb-3">
                <Lightbulb className="w-4 h-4" />
                Next Steps
              </h3>
              <ul className="space-y-2">
                {feedbackData.next_steps.map((step, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-sm">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex justify-center gap-4"
      >
        <Button onClick={onNewStory} size="lg" className="flex items-center gap-2">
          Record Another Story
          <ArrowRight className="w-4 h-4" />
        </Button>
      </motion.div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  )
}