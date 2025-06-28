'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { MessageSquare, Star, TrendingUp, Target, Lightbulb, ArrowRight, Volume2, VolumeX } from 'lucide-react'
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
  }
  onNewStory: () => void
}

export default function StoryFeedback({ storyData, onNewStory }: StoryFeedbackProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const personalityLabels = {
    encouraging: 'Encouraging Coach',
    stephen_king: 'Stephen King Style',
    literary: 'Literary Critic',
    casual: 'Friendly Buddy',
    professional: 'Writing Instructor'
  }

  // Parse feedback into sections (this would be enhanced based on actual AI response structure)
  const feedbackSections = {
    strengths: [
      "Excellent opening that immediately draws the reader in",
      "Strong character voice and personality",
      "Good use of descriptive language"
    ],
    improvements: [
      "Consider adding more sensory details to enhance immersion",
      "The pacing could be varied more in the middle section",
      "Try incorporating more dialogue to break up narrative"
    ],
    nextSteps: [
      "Experiment with different narrative perspectives",
      "Practice building tension through shorter sentences",
      "Try recording a story in a different genre to expand your range"
    ]
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
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Button
                  variant={isPlaying ? "secondary" : "default"}
                  size="lg"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex items-center gap-2"
                >
                  {isPlaying ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  {isPlaying ? 'Pause' : 'Play Recording'}
                </Button>
                <div className="flex-1">
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div className="h-2 bg-blue-500 rounded-full w-1/3"></div>
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">2:34 / {formatDuration(storyData.duration)}</span>
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
            {/* Strengths */}
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-green-700 dark:text-green-300 mb-3">
                <Star className="w-4 h-4" />
                What You Did Well
              </h3>
              <ul className="space-y-2">
                {feedbackSections.strengths.map((strength, index) => (
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
                {feedbackSections.improvements.map((improvement, index) => (
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
                {feedbackSections.nextSteps.map((step, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-sm">{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Full AI Feedback */}
            <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Detailed Analysis</h4>
              <p className="text-sm leading-relaxed">{storyData.feedback}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Transcript */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Story Transcript
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTranscript(!showTranscript)}
              >
                {showTranscript ? 'Hide' : 'Show'} Transcript
              </Button>
            </div>
          </CardHeader>
          {showTranscript && (
            <CardContent>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {storyData.transcript}
                </p>
              </div>
            </CardContent>
          )}
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
    </div>
  )
}