import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { Separator } from '@/src/components/ui/separator'
import { Alert, AlertDescription } from '@/src/components/ui/alert'
import { 
  X, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Clock, 
  Calendar, 
  User, 
  MessageSquare,
  Star,
  TrendingUp,
  Lightbulb,
  Trash2,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface StoryDetailModalProps {
  storyId: string
  isOpen: boolean
  onClose: () => void
  onDelete: (storyId: string) => void
}

interface StoryDetail {
  id: string
  title: string
  genre: string
  prompt: string
  duration_seconds: number
  audio_url?: string
  transcript?: string
  feedback_personality: string
  processing_status: string
  created_at: string
  updated_at: string
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

export default function StoryDetailModal({ storyId, isOpen, onClose, onDelete }: StoryDetailModalProps) {
  const [story, setStory] = useState<StoryDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (isOpen && storyId) {
      fetchStoryDetails()
    }
  }, [isOpen, storyId])

  const fetchStoryDetails = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-story`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storyId })
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch story: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      setStory(data.story)
    } catch (err: any) {
      console.error('Error fetching story details:', err)
      setError(err.message || 'Failed to load story details')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteStory = async () => {
    setDeleting(true)
    
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-story`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storyId })
      })

      if (!response.ok) {
        throw new Error(`Failed to delete story: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      onDelete(storyId)
      onClose()
    } catch (err: any) {
      console.error('Error deleting story:', err)
      setError(err.message || 'Failed to delete story')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const togglePlayPause = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const personalityLabels = {
    encouraging: 'Encouraging Coach',
    stephen_king: 'Stephen King Style',
    literary: 'Literary Critic',
    casual: 'Friendly Buddy',
    professional: 'Writing Instructor'
  }

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Story Details</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-600 hover:text-red-700"
              disabled={deleting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Loading story details...</span>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {story && (
            <>
              {/* Story Header */}
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">{story.title}</h1>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <Badge variant="outline">{story.genre}</Badge>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatTime(story.duration_seconds)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(story.created_at)}
                      </span>
                    </div>
                  </div>
                  <Badge className={statusColors[story.processing_status as keyof typeof statusColors]}>
                    {story.processing_status}
                  </Badge>
                </div>

                {/* Metadata */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Story Metadata</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Feedback Style</label>
                        <p className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          {personalityLabels[story.feedback_personality as keyof typeof personalityLabels]}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Processing Status</label>
                        <p className="capitalize">{story.processing_status}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Created</label>
                        <p>{formatDate(story.created_at)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                        <p>{formatDate(story.updated_at)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Story Prompt */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Story Prompt</CardTitle>
                  <CardDescription>The original prompt that inspired this story</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed bg-gray-50 p-4 rounded-lg">
                    {story.prompt}
                  </p>
                </CardContent>
              </Card>

              {/* Audio Player */}
              {story.audio_url && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Volume2 className="w-5 h-5" />
                      Audio Recording
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <audio
                        ref={audioRef}
                        src={story.audio_url}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onEnded={() => setIsPlaying(false)}
                        className="hidden"
                      />
                      
                      <div className="flex items-center gap-4">
                        <Button
                          onClick={togglePlayPause}
                          size="lg"
                          className="flex items-center gap-2"
                        >
                          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          {isPlaying ? 'Pause' : 'Play'}
                        </Button>
                        
                        <div className="flex-1">
                          <div className="h-2 bg-gray-200 rounded-full">
                            <div 
                              className="h-2 bg-blue-500 rounded-full transition-all duration-200"
                              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                        
                        <span className="text-sm text-muted-foreground">
                          {formatTime(currentTime)} / {formatTime(duration || story.duration_seconds)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Transcript */}
              {story.transcript && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Transcript</CardTitle>
                    <CardDescription>AI-generated transcript of your recording</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {story.transcript}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Feedback */}
              {story.story_feedback && story.story_feedback.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      AI Feedback
                    </CardTitle>
                    <CardDescription>
                      Personalized insights from your {personalityLabels[story.feedback_personality as keyof typeof personalityLabels]} coach
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {story.story_feedback.map((feedback) => (
                      <div key={feedback.id} className="space-y-4">
                        {/* Overall Score */}
                        {feedback.overall_score && (
                          <div className="flex items-center gap-2">
                            <Star className="w-5 h-5 text-yellow-500" />
                            <span className="font-medium">Overall Score: {feedback.overall_score}/10</span>
                          </div>
                        )}

                        {/* Detailed Feedback */}
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <h4 className="font-medium mb-2">Detailed Analysis</h4>
                          <p className="text-sm leading-relaxed">{feedback.feedback_text}</p>
                        </div>

                        <Separator />

                        {/* Strengths */}
                        {feedback.strengths && feedback.strengths.length > 0 && (
                          <div>
                            <h4 className="flex items-center gap-2 font-medium text-green-700 mb-3">
                              <Star className="w-4 h-4" />
                              What You Did Well
                            </h4>
                            <ul className="space-y-2">
                              {feedback.strengths.map((strength, index) => (
                                <li key={index} className="flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                                  <span className="text-sm">{strength}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <Separator />

                        {/* Improvements */}
                        {feedback.improvements && feedback.improvements.length > 0 && (
                          <div>
                            <h4 className="flex items-center gap-2 font-medium text-blue-700 mb-3">
                              <TrendingUp className="w-4 h-4" />
                              Areas to Enhance
                            </h4>
                            <ul className="space-y-2">
                              {feedback.improvements.map((improvement, index) => (
                                <li key={index} className="flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                                  <span className="text-sm">{improvement}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <Separator />

                        {/* Next Steps */}
                        {feedback.next_steps && feedback.next_steps.length > 0 && (
                          <div>
                            <h4 className="flex items-center gap-2 font-medium text-purple-700 mb-3">
                              <Lightbulb className="w-4 h-4" />
                              Next Steps
                            </h4>
                            <ul className="space-y-2">
                              {feedback.next_steps.map((step, index) => (
                                <li key={index} className="flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0" />
                                  <span className="text-sm">{step}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground">
                          Feedback generated on {formatDate(feedback.created_at)}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* No Feedback Available */}
              {story.processing_status === 'completed' && (!story.story_feedback || story.story_feedback.length === 0) && (
                <Card>
                  <CardContent className="text-center py-8">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">No feedback available for this story</p>
                  </CardContent>
                </Card>
              )}

              {/* Processing Status */}
              {story.processing_status !== 'completed' && (
                <Card>
                  <CardContent className="text-center py-8">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      {story.processing_status === 'processing' && <Loader2 className="w-6 h-6 animate-spin" />}
                      <span className="font-medium">
                        {story.processing_status === 'pending' && 'Story is pending processing'}
                        {story.processing_status === 'processing' && 'Story is being processed'}
                        {story.processing_status === 'failed' && 'Story processing failed'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {story.processing_status === 'pending' && 'Your story will be processed shortly'}
                      {story.processing_status === 'processing' && 'AI is analyzing your recording and generating feedback'}
                      {story.processing_status === 'failed' && 'There was an error processing your story. Please try recording again.'}
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-lg p-6 max-w-md w-full"
              >
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                  <h3 className="text-lg font-semibold">Delete Story</h3>
                </div>
                <p className="text-muted-foreground mb-6">
                  Are you sure you want to delete this story? This action cannot be undone and will permanently remove the story, recording, and all feedback.
                </p>
                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleDeleteStory}
                    disabled={deleting}
                  >
                    {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Delete Story
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}