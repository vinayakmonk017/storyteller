'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/src/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { Progress } from '@/src/components/ui/progress'
import { Badge } from '@/src/components/ui/badge'
import { Mic, MicOff, Play, Pause, RotateCcw, Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { formatTime, getRandomStory } from '@/src/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface StoryRecorderProps {
  onStoryComplete: (storyData: {
    prompt: string
    genre: string
    duration: number
    audioBlob: Blob
    feedbackPersonality: string
  }) => void
}

export default function StoryRecorder({ onStoryComplete }: StoryRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [selectedDuration, setSelectedDuration] = useState(300) // 5 minutes default
  const [selectedGenre, setSelectedGenre] = useState('adventure')
  const [selectedPersonality, setSelectedPersonality] = useState('encouraging')
  const [currentStory, setCurrentStory] = useState({ title: '', content: '' })
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'completed'>('idle')
  const [isLoadingStory, setIsLoadingStory] = useState(false)
  const [storyError, setStoryError] = useState<string | null>(null)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const durations = [
    { value: 120, label: '2 minutes' },
    { value: 180, label: '3 minutes' },
    { value: 300, label: '5 minutes' },
    { value: 600, label: '10 minutes' },
    { value: 900, label: '15 minutes' }
  ]

  const genres = [
    { value: 'adventure', label: 'Adventure', emoji: '🗺️' },
    { value: 'mystery', label: 'Mystery', emoji: '🔍' },
    { value: 'fantasy', label: 'Fantasy', emoji: '🧙‍♂️' },
    { value: 'horror', label: 'Horror', emoji: '👻' },
    { value: 'romance', label: 'Romance', emoji: '💕' },
    { value: 'sci-fi', label: 'Sci-Fi', emoji: '🚀' }
  ]

  const personalities = [
    { value: 'encouraging', label: 'Encouraging Coach', description: 'Supportive and motivating' },
    { value: 'stephen_king', label: 'Stephen King Style', description: 'Insightful with dark humor' },
    { value: 'literary', label: 'Literary Critic', description: 'Sophisticated analysis' },
    { value: 'casual', label: 'Friendly Buddy', description: 'Casual and conversational' },
    { value: 'professional', label: 'Writing Instructor', description: 'Detailed and structured' }
  ]

  // Load initial story when component mounts
  useEffect(() => {
    console.log('🎬 StoryRecorder component mounted, loading initial story...')
    loadNewStory()
  }, [])

  // Load new story when genre changes
  useEffect(() => {
    if (selectedGenre) {
      console.log('🎭 Genre changed to:', selectedGenre, '- Loading new story...')
      loadNewStory()
    }
  }, [selectedGenre])

  const loadNewStory = async () => {
    console.log('📚 loadNewStory called for genre:', selectedGenre)
    setIsLoadingStory(true)
    setStoryError(null)
    
    try {
      console.log('⏳ Starting story generation...')
      const story = await getRandomStory(selectedGenre)
      console.log({story})
      // console.log('✅ Story loaded successfully:', { title: story.title, contentLength: story.content.length })
      setCurrentStory(story)
    } catch (error) {
      console.error('❌ Error loading story:', error)
      setStoryError('Failed to load story. Please try again.')
      
      // Fallback to a simple story
      setCurrentStory({
        title: 'Practice Story',
        content: 'Once upon a time, in a land far away, there lived a brave adventurer who was about to embark on an incredible journey. The path ahead was filled with mystery and wonder, and every step would bring new discoveries and challenges to overcome.'
      })
    } finally {
      setIsLoadingStory(false)
      console.log('🏁 Story loading completed')
    }
  }

  // Cleanup function to stop all tracks
  const cleanupRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop()
      })
      streamRef.current = null
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    setIsRecording(false)
    setIsPaused(false)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      })
      
      streamRef.current = stream
      
      // Check if MediaRecorder supports webm, fallback to mp4
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/mp4'
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        const actualDuration = selectedDuration - timeLeft
        
        onStoryComplete({
          prompt: currentStory.content,
          genre: selectedGenre,
          duration: actualDuration,
          audioBlob,
          feedbackPersonality: selectedPersonality
        })
        
        cleanupRecording()
        setRecordingState('completed')
      }

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        cleanupRecording()
        alert('Recording error occurred. Please try again.')
      }

      mediaRecorder.start(1000) // Collect data every second
      setIsRecording(true)
      setTimeLeft(selectedDuration)
      setRecordingState('recording')

      // Start timer
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Auto-stop when timer reaches 0
            stopRecording()
            return 0
          }
          return prev - 1
        })
      }, 1000)

    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Unable to access microphone. Please check your permissions and try again.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    // Cleanup will be handled in the onstop event
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume()
        // Restart timer
        timerRef.current = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              stopRecording()
              return 0
            }
            return prev - 1
          })
        }, 1000)
      } else {
        mediaRecorderRef.current.pause()
        // Stop timer
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }
      setIsPaused(!isPaused)
    }
  }

  const resetRecording = () => {
    cleanupRecording()
    setTimeLeft(0)
    setRecordingState('idle')
    loadNewStory()
  }

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      cleanupRecording()
    }
  }, [])

  const progress = selectedDuration > 0 ? ((selectedDuration - timeLeft) / selectedDuration) * 100 : 0

  console.log({selectedGenre, isLoadingStory})
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Settings Panel */}
      <AnimatePresence>
        {recordingState === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Duration</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedDuration.toString()} onValueChange={(value) => setSelectedDuration(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {durations.map((duration) => (
                      <SelectItem key={duration.value} value={duration.value.toString()}>
                        {duration.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Genre</CardTitle>
              </CardHeader>
              <CardContent>
                <Select 
                  value={selectedGenre} 
                  onValueChange={(value) => {
                    console.log('🎭 User selected new genre:', value)
                    setSelectedGenre(value)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {genres.map((genre) => (
                      <SelectItem key={genre.value} value={genre.value}>
                        <span className="flex items-center gap-2">
                          <span>{genre.emoji}</span>
                          {genre.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Feedback Style</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedPersonality} onValueChange={setSelectedPersonality}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {personalities.map((personality) => (
                      <SelectItem key={personality.value} value={personality.value}>
                        <div className="flex flex-col">
                          <span>{personality.label}</span>
                          <span className="text-xs text-muted-foreground">{personality.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Story Display */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20" />
        <CardHeader className="relative">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {currentStory.title || 'Your Practice Story'}
              </CardTitle>
              <CardDescription>Read this story aloud to practice your storytelling skills</CardDescription>
            </div>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {genres.find(g => g.value === selectedGenre)?.emoji} {genres.find(g => g.value === selectedGenre)?.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="relative">
          {isLoadingStory ? (
            <div className="bg-white/70 dark:bg-gray-900/70 rounded-lg p-6 mb-4 flex items-center justify-center min-h-[200px]">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating your practice story...</span>
              </div>
            </div>
          ) : storyError ? (
            <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-6 mb-4 flex items-center gap-3 min-h-[200px]">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-red-700 dark:text-red-300 font-medium">Story Loading Failed</p>
                <p className="text-red-600 dark:text-red-400 text-sm">{storyError}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadNewStory}
                  className="mt-2"
                >
                  Try Again
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-white/70 dark:bg-gray-900/70 rounded-lg p-6 mb-4">
              <p className="text-base leading-relaxed whitespace-pre-wrap">
                {currentStory.content || 'Loading story...'}
              </p>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              📖 Read this complete story aloud to practice your storytelling and pronunciation skills!
            </p>
            {recordingState === 'idle' && !isLoadingStory && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log('🔄 User clicked "New Story" button')
                  loadNewStory()
                }}
                className="flex items-center gap-2"
                disabled={isLoadingStory}
              >
                <RotateCcw className="w-4 h-4" />
                New Story
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recording Controls */}
      <Card className="text-center">
        <CardContent className="pt-6">
          <AnimatePresence mode="wait">
            {recordingState === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <Button
                  onClick={startRecording}
                  size="lg"
                  disabled={isLoadingStory || !currentStory.content}
                  className="w-32 h-32 rounded-full text-lg font-semibold bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                >
                  <Mic className="w-8 h-8" />
                </Button>
                <p className="text-muted-foreground">
                  {isLoadingStory 
                    ? 'Generating your story...' 
                    : 'Click to start recording yourself reading the story'
                  }
                </p>
              </motion.div>
            )}

            {recordingState === 'recording' && (
              <motion.div
                key="recording"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center transition-all duration-200 ${
                    isRecording && !isPaused 
                      ? 'bg-red-500 shadow-lg shadow-red-500/50 animate-pulse' 
                      : 'bg-gray-400'
                  }`}>
                    {isPaused ? (
                      <Pause className="w-8 h-8 text-white" />
                    ) : (
                      <Mic className="w-8 h-8 text-white" />
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-3xl font-mono font-bold">
                      {formatTime(timeLeft)}
                    </div>
                    <Progress value={progress} className="w-full max-w-md mx-auto h-3" />
                    <p className="text-sm text-muted-foreground">
                      {isPaused ? 'Recording paused' : 'Recording in progress...'}
                    </p>
                  </div>
                </div>

                <div className="flex justify-center gap-4">
                  <Button
                    onClick={pauseRecording}
                    variant="outline"
                    size="lg"
                    className="flex items-center gap-2"
                  >
                    {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </Button>
                  
                  <Button
                    onClick={stopRecording}
                    variant="destructive"
                    size="lg"
                    className="flex items-center gap-2"
                  >
                    <MicOff className="w-5 h-5" />
                    Stop Recording
                  </Button>
                </div>
              </motion.div>
            )}

            {recordingState === 'completed' && (
              <motion.div
                key="completed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="w-32 h-32 mx-auto rounded-full bg-green-500 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Story Recorded!</h3>
                  <p className="text-muted-foreground mb-4">
                    Your storytelling is being analyzed and you'll receive personalized feedback shortly.
                  </p>
                  <Button onClick={resetRecording} variant="outline">
                    Record Another Story
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  )
}