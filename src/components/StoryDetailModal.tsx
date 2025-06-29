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
  Loader2,
  RefreshCw
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'

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
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [generatingFeedback, setGeneratingFeedback] = useState(false)
  
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (isOpen && storyId) {
      fetchStoryDetails()
    }
  }, [isOpen, storyId])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleLoadedMetadata = () => setDuration(audio.duration)
    const handleEnded = () => setIsPlaying(false)
    const handleError = (e: any) => {
      console.error('Audio error:', e)
      setError('Failed to load audio file')
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [story?.audio_url])

  const fetchStoryDetails = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        throw new Error(`Authentication error: ${sessionError.message}`)
      }
      
      if (!session) {
        throw new Error('No active session found. Please sign in again.')
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-story`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
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

  const handleGenerateFeedback = async () => {
    if (!story) return
    
    setGeneratingFeedback(true)
    setError(null)
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        throw new Error(`Authentication error: ${sessionError.message}`)
      }
      
      if (!session) {
        throw new Error('No active session found. Please sign in again.')
      }

      // Call the process-story edge function to generate feedback
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-story`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storyId: story.id,
          audioUrl: story.audio_url,
          feedbackPersonality: story.feedback_personality
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to generate feedback: ${response.status} ${errorText}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate feedback')
      }

      // Refresh the story details to get the new feedback
      await fetchStoryDetails()
      
    } catch (err: any) {
      console.error('Error generating feedback:', err)
      setError(err.message || 'Failed to generate feedback')
    } finally {
      setGeneratingFeedback(false)
    }
  }

  const handleDeleteStory = async () => {
    setDeleting(true)
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        throw new Error(`Authentication error: ${sessionError.message}`)
      }
      
      if (!session) {
        throw new Error('No active session found. Please sign in again.')
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-story`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
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
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[story.processing_status as keyof typeof statusColors]}>
                      {story.processing_status}
                    </Badge>
                    {(story.processing_status === 'failed' || story.processing_status === 'processing') && (
                      <Button
                        onClick={handleGenerateFeedback}
                        disabled={generatingFeedback}
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        {generatingFeedback ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        Give me Feedback
                      </Button>
                    )}
                  </div>
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
                    <CardDescription>Listen to your storytelling performance</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <audio
                      ref={audioRef}
                      src={story.audio_url}
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
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration || story.duration_seconds)}</span>
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
              )}

              {/* AI Feedback */}
              {story.story_feedback && story.story_feedback.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      Feedback
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
                    <p className="text-muted-foreground mb-4">No feedback available for this story</p>
                    <Button
                      onClick={handleGenerateFeedback}
                      disabled={generatingFeedback}
                      className="flex items-center gap-2"
                    >
                      {generatingFeedback ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Generate Feedback
                    </Button>
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
                    <p className="text-sm text-muted-foreground mb-4">
                      {story.processing_status === 'pending' && 'Your story will be processed shortly'}
                      {story.processing_status === 'processing' && 'AI is analyzing your recording and generating feedback'}
                      {story.processing_status === 'failed' && 'There was an error processing your story. You can try generating feedback again.'}
                    </p>
                    {(story.processing_status === 'failed' || story.processing_status === 'processing') && (
                      <Button
                        onClick={handleGenerateFeedback}
                        disabled={generatingFeedback}
                        className="flex items-center gap-2"
                      >
                        {generatingFeedback ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        {story.processing_status === 'failed' ? 'Retry Feedback Generation' : 'Generate Feedback Now'}
                      </Button>
                    )}
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
      </motion.div>
    </div>
  )
}