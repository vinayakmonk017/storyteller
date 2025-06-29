'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { Separator } from '@/src/components/ui/separator'
import { MessageSquare, Star, TrendingUp, Lightbulb, ArrowRight, Volume2, VolumeX, Play, Pause } from 'lucide-react'
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
  
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleLoadedMetadata = () => setDuration(audio.duration)
    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  const togglePlayPause = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return
    
    const newTime = (parseFloat(e.target.value) / 100) * duration
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const toggleMute = () => {
    if (!audioRef.current) return
    
    if (isMuted) {
      audioRef.current.volume = volume
      setIsMuted(false)
    } else {
      audioRef.current.volume = 0
      setIsMuted(true)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return
    
    const newVolume = parseFloat(e.target.value) / 100
    setVolume(newVolume)
    audioRef.current.volume = newVolume
    setIsMuted(newVolume === 0)
  }

  const formatDuration = (seconds: number) => {
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

      {/* Audio Player */}
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
              />
              
              <div className="space-y-4">
                {/* Main Controls */}
                <div className="flex items-center gap-4">
                  <Button
                    onClick={togglePlayPause}
                    size="lg"
                    className="flex items-center gap-2 min-w-[120px]"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isPlaying ? 'Pause' : 'Play'}
                  </Button>
                  
                  <div className="flex-1 space-y-2">
                    {/* Progress Bar */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={duration > 0 ? (currentTime / duration) * 100 : 0}
                      onChange={handleSeek}
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
                    className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  
                  <span className="text-xs text-muted-foreground w-8">
                    {Math.round((isMuted ? 0 : volume) * 100)}%
                  </span>
                </div>
              </div>
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