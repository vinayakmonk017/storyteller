'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/src/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { Progress } from '@/src/components/ui/progress'
import { Badge } from '@/src/components/ui/badge'
import { Mic, MicOff, Play, Pause, RotateCcw, Sparkles, Loader2, AlertCircle, Volume2, Settings, Zap } from 'lucide-react'
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
  const [selectedDuration, setSelectedDuration] = useState(120) // 2 minutes default
  const [selectedGenre, setSelectedGenre] = useState('adventure')
  const [selectedPersonality, setSelectedPersonality] = useState('encouraging')
  const [currentStory, setCurrentStory] = useState({ title: '', content: '' })
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'completed'>('idle')
  const [isLoadingStory, setIsLoadingStory] = useState(false)
  const [storyError, setStoryError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const durations = [
    { value: 120, label: '2 minutes', icon: '⚡', recommended: true },
    { value: 180, label: '3 minutes', icon: '🎯' },
    { value: 300, label: '5 minutes', icon: '⭐' },
    { value: 600, label: '10 minutes', icon: '🚀' },
    { value: 900, label: '15 minutes', icon: '👑' }
  ]

  const genres = [
    { value: 'adventure', label: 'Adventure', emoji: '🗺️', color: 'from-blue-500 to-cyan-500' },
    { value: 'mystery', label: 'Mystery', emoji: '🔍', color: 'from-purple-500 to-indigo-500' },
    { value: 'fantasy', label: 'Fantasy', emoji: '🧙‍♂️', color: 'from-emerald-500 to-teal-500' },
    { value: 'horror', label: 'Horror', emoji: '👻', color: 'from-red-500 to-orange-500' },
    { value: 'romance', label: 'Romance', emoji: '💕', color: 'from-pink-500 to-rose-500' },
    { value: 'sci-fi', label: 'Sci-Fi', emoji: '🚀', color: 'from-violet-500 to-purple-500' }
  ]

  const personalities = [
    { value: 'encouraging', label: 'Encouraging Coach', description: 'Supportive and motivating', icon: '🌟' },
    { value: 'stephen_king', label: 'Stephen King Style', description: 'Insightful with dark humor', icon: '📚' },
    { value: 'literary', label: 'Literary Critic', description: 'Sophisticated analysis', icon: '🎭' },
    { value: 'casual', label: 'Friendly Buddy', description: 'Casual and conversational', icon: '😊' },
    { value: 'professional', label: 'Writing Instructor', description: 'Detailed and structured', icon: '👨‍🏫' }
  ]

  // Load initial story when component mounts
  useEffect(() => {
    if (!isInitialized) {
      loadNewStory()
      setIsInitialized(true)
    }
  }, [isInitialized])

  // Load new story when genre or duration changes (but only after initialization)
  useEffect(() => {
    if (isInitialized && (selectedGenre || selectedDuration)) {
      loadNewStory()
    }
  }, [selectedGenre, selectedDuration, isInitialized])

  // Audio level monitoring
  useEffect(() => {
    if (isRecording && !isPaused && analyserRef.current) {
      const updateAudioLevel = () => {
        if (!analyserRef.current) return
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(dataArray)
        
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
        setAudioLevel(Math.min(average / 128, 1))
        
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
      }
      
      updateAudioLevel()
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      setAudioLevel(0)
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isRecording, isPaused])

  const loadNewStory = async () => {
    setIsLoadingStory(true)
    setStoryError(null)
    console.log({selectedDuration})
    try {
      // Calculate target word count based on duration
      // Average reading speed is about 150-200 words per minute
      // We'll use 175 words per minute as a baseline
      const targetWords = Math.round((selectedDuration/60) * 120)
      console.log({targetWords})
      const story = await getRandomStory(selectedGenre, targetWords)
      setCurrentStory(story)
    } catch (error) {
      setStoryError('Failed to load story. Please try again.')
      
      // Fallback to a simple story
      setCurrentStory({
        title: 'Practice Story',
        content: 'Once upon a time, in a land far away, there lived a brave adventurer who was about to embark on an incredible journey. The path ahead was filled with mystery and wonder, and every step would bring new discoveries and challenges to overcome.'
      })
    } finally {
      setIsLoadingStory(false)
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
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    analyserRef.current = null
    setIsRecording(false)
    setIsPaused(false)
    setAudioLevel(0)
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
      
      // Set up audio analysis for level monitoring
      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser
      
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
  const selectedGenreData = genres.find(g => g.value === selectedGenre)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Modern Settings Panel */}
      <AnimatePresence>
        {recordingState === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Quick Settings */}
            <Card className="relative overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-r ${selectedGenreData?.color || 'from-blue-500 to-purple-500'} opacity-5`} />
              <CardHeader className="relative">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      Recording Setup
                    </CardTitle>
                    <CardDescription>Configure your storytelling session</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                    className="flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    {showAdvancedSettings ? 'Simple' : 'Advanced'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="relative space-y-6">
                {/* Primary Settings Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Duration Selector */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium flex items-center gap-2">
                      ⏱️ Duration
                    </label>
                    <Select value={selectedDuration.toString()} onValueChange={(value) => setSelectedDuration(parseInt(value))}>
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {durations.map((duration) => (
                          <SelectItem key={duration.value} value={duration.value.toString()}>
                            <div className="flex items-center gap-2">
                              <span>{duration.icon}</span>
                              <span>{duration.label}</span>
                              {duration.recommended && (
                                <Badge variant="secondary" className="text-xs">Recommended</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Genre Selector */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium flex items-center gap-2">
                      🎭 Genre
                    </label>
                    <Select 
                      value={selectedGenre} 
                      onValueChange={(value) => {
                        setSelectedGenre(value)
                      }}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {genres.map((genre) => (
                          <SelectItem key={genre.value} value={genre.value}>
                            <div className="flex items-center gap-2">
                              <span>{genre.emoji}</span>
                              <span>{genre.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Feedback Style */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium flex items-center gap-2">
                      🎯 Feedback Style
                    </label>
                    <Select value={selectedPersonality} onValueChange={setSelectedPersonality}>
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {personalities.map((personality) => (
                          <SelectItem key={personality.value} value={personality.value}>
                            <div className="flex items-center gap-2">
                              <span>{personality.icon}</span>
                              <div className="flex flex-col">
                                <span className="font-medium">{personality.label}</span>
                                {showAdvancedSettings && (
                                  <span className="text-xs text-muted-foreground">{personality.description}</span>
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Advanced Settings */}
                <AnimatePresence>
                  {showAdvancedSettings && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t pt-4 space-y-4"
                    >
                      <h4 className="text-sm font-medium text-muted-foreground">Advanced Options</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span>Echo cancellation enabled</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span>Noise suppression active</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span>High quality audio (44.1kHz)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            <span>Real-time audio monitoring</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced Story Display */}
      <Card className="relative overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${selectedGenreData?.color || 'from-blue-500 to-purple-500'} opacity-5`} />
        <CardHeader className="relative">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <span className="text-2xl">{selectedGenreData?.emoji}</span>
                {currentStory.title || 'Your Practice Story'}
              </CardTitle>
              <CardDescription className="flex items-center gap-4">
                <span>Read this story aloud to practice your storytelling skills</span>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {selectedGenreData?.label}
                </Badge>
              </CardDescription>
            </div>
            {recordingState === 'idle' && !isLoadingStory && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
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
            <div className="bg-white/70 dark:bg-gray-900/70 rounded-lg p-6 mb-4 border-l-4 border-blue-500">
              <div className="prose prose-sm max-w-none">
                {currentStory.content.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="text-base leading-relaxed mb-4 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                📖 Estimated reading time: {Math.ceil(currentStory.content.length / 200)} min
              </span>
              <span className="flex items-center gap-1">
                📝 {currentStory.content.split(' ').length} words
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modern Recording Interface */}
      <Card className="text-center relative overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${
          recordingState === 'recording' 
            ? 'from-red-500/10 to-orange-500/10' 
            : recordingState === 'completed'
            ? 'from-green-500/10 to-emerald-500/10'
            : 'from-blue-500/10 to-purple-500/10'
        }`} />
        <CardContent className="pt-8 pb-8 relative">
          <AnimatePresence mode="wait">
            {recordingState === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Main Record Button */}
                <div className="relative">
                  <Button
                    onClick={startRecording}
                    size="lg"
                    disabled={isLoadingStory || !currentStory.content}
                    className="w-32 h-32 rounded-full text-lg font-semibold bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse"></div>
                    <Mic className="w-8 h-8 relative z-10" />
                  </Button>
                  
                  {/* Pulse animation rings */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-40 h-40 border-2 border-red-500/30 rounded-full animate-ping"></div>
                    <div className="absolute w-48 h-48 border-2 border-red-500/20 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-lg font-medium">
                    {isLoadingStory 
                      ? 'Generating your story...' 
                      : 'Ready to Record'
                    }
                  </p>
                  <p className="text-muted-foreground">
                    {isLoadingStory 
                      ? 'Please wait while we create your practice story' 
                      : 'Click the microphone to start recording yourself reading the story'
                    }
                  </p>
                  
                  {!isLoadingStory && currentStory.content && (
                    <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground mt-4">
                      <span className="flex items-center gap-1">
                        ⏱️ {formatTime(selectedDuration)} session
                      </span>
                      <span className="flex items-center gap-1">
                        🎭 {selectedGenreData?.label}
                      </span>
                      <span className="flex items-center gap-1">
                        🎯 {personalities.find(p => p.value === selectedPersonality)?.label}
                      </span>
                    </div>
                  )}
                </div>
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
                {/* Recording Visualization */}
                <div className="space-y-4">
                  {/* Main Recording Button with Audio Level */}
                  <div className="relative">
                    <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center transition-all duration-200 relative ${
                      isRecording && !isPaused 
                        ? 'bg-red-500 shadow-lg shadow-red-500/50' 
                        : 'bg-gray-400'
                    }`}>
                      {/* Audio level visualization */}
                      <div 
                        className="absolute inset-2 bg-white/30 rounded-full transition-all duration-100"
                        style={{ 
                          transform: `scale(${0.8 + (audioLevel * 0.4)})`,
                          opacity: isRecording && !isPaused ? 0.7 : 0
                        }}
                      ></div>
                      
                      {isPaused ? (
                        <Pause className="w-8 h-8 text-white relative z-10" />
                      ) : (
                        <Mic className="w-8 h-8 text-white relative z-10" />
                      )}
                    </div>
                    
                    {/* Audio level rings */}
                    {isRecording && !isPaused && (
                      <>
                        <div 
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                          style={{ opacity: audioLevel }}
                        >
                          <div className="w-40 h-40 border-2 border-red-500/50 rounded-full animate-pulse"></div>
                        </div>
                        <div 
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                          style={{ opacity: audioLevel * 0.7 }}
                        >
                          <div className="w-48 h-48 border-2 border-red-500/30 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Time and Progress */}
                  <div className="space-y-3">
                    <div className="text-4xl font-mono font-bold">
                      {formatTime(timeLeft)}
                    </div>
                    
                    {/* Enhanced Progress Bar */}
                    <div className="relative max-w-md mx-auto">
                      <Progress value={progress} className="w-full h-4" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-medium text-white mix-blend-difference">
                          {Math.round(progress)}%
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-center gap-4 text-sm">
                      <span className={`flex items-center gap-1 ${isPaused ? 'text-yellow-600' : 'text-green-600'}`}>
                        <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'}`}></div>
                        {isPaused ? 'Recording paused' : 'Recording in progress'}
                      </span>
                      
                      {/* Audio Level Indicator */}
                      <span className="flex items-center gap-1">
                        <Volume2 className="w-4 h-4" />
                        <div className="flex gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-1 h-3 rounded-full transition-all duration-100 ${
                                audioLevel > (i * 0.2) ? 'bg-green-500' : 'bg-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recording Controls */}
                <div className="flex justify-center gap-4">
                  <Button
                    onClick={pauseRecording}
                    variant="outline"
                    size="lg"
                    className="flex items-center gap-2 min-w-[120px]"
                  >
                    {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </Button>
                  
                  <Button
                    onClick={stopRecording}
                    variant="destructive"
                    size="lg"
                    className="flex items-center gap-2 min-w-[120px]"
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
                className="space-y-6"
              >
                <div className="relative">
                  <div className="w-32 h-32 mx-auto rounded-full bg-green-500 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse"></div>
                    <Sparkles className="w-8 h-8 text-white relative z-10" />
                  </div>
                  
                  {/* Success animation rings */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-40 h-40 border-2 border-green-500/30 rounded-full animate-ping"></div>
                    <div className="absolute w-48 h-48 border-2 border-green-500/20 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-green-700">Story Recorded!</h3>
                  <p className="text-muted-foreground">
                    Your storytelling is being analyzed and you'll receive personalized feedback shortly.
                  </p>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing your recording...</span>
                  </div>
                  <Button onClick={resetRecording} variant="outline" className="mt-4">
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