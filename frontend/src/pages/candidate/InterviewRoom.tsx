import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Clock, Eye, Smile, AlertTriangle, Bot, User as UserIcon, Loader2, Mic, MicOff, Volume2, Camera, CameraOff, Monitor } from 'lucide-react';
import { aiInterviewAPI, InterviewWebSocket } from '@/lib/api';
import * as faceapi from 'face-api.js';
import { toast } from 'sonner';

interface ChatMessage {
  role: 'interviewer' | 'candidate' | 'system';
  text: string;
}

const InterviewRoom: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const sessionData = (location.state as any)?.sessionData;

  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(900);
  const [eyeContact, setEyeContact] = useState(0);
  const [emotion, setEmotion] = useState('neutral');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [faceDetected, setFaceDetected] = useState(true);
  const [screenSharing, setScreenSharing] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const noFaceCountRef = useRef<number>(0);
  const waitingForAnswerRef = useRef<boolean>(false);
  const currentQIndexRef = useRef<number>(0);
  const questionsRef = useRef<any[]>([]);
  const isListeningRef = useRef<boolean>(false);
  const currentTranscriptRef = useRef<string>('');
  const submittingAnswerRef = useRef<boolean>(false);
  const faceApiLoadedRef = useRef<boolean>(false);
  const noFaceTimerRef = useRef<number>(0); // counts seconds without face

  // Keep refs in sync
  useEffect(() => { currentQIndexRef.current = currentQIndex; }, [currentQIndex]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { currentTranscriptRef.current = currentTranscript; }, [currentTranscript]);
  useEffect(() => { submittingAnswerRef.current = submittingAnswer; }, [submittingAnswer]);

  // Clean up global speech synthesis to avoid speaking when navigating away
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // ── Navigation Protection: Warn on page refresh/close ──
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'You have an active interview. Are you sure you want to leave?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ── Navigation Protection: Block back/forward buttons ──
  useEffect(() => {
    // Push a dummy state so popstate fires when user hits back
    window.history.pushState({ interviewLock: true }, '');

    const handlePopState = (e: PopStateEvent) => {
      // Re-push state to keep the user on this page
      window.history.pushState({ interviewLock: true }, '');
      toast.warning('You cannot go back during an active interview.', {
        id: 'nav-block',
        duration: 3000,
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ── Session Persistence: Save state to localStorage for refresh resume ──
  useEffect(() => {
    if (!sessionId || loading) return;
    const stateToSave = {
      sessionId,
      messages,
      questions,
      currentQIndex,
      timeLeft,
      timestamp: Date.now(),
    };
    try {
      localStorage.setItem(`interview_state_${sessionId}`, JSON.stringify(stateToSave));
    } catch (e) {
      // localStorage full or unavailable — ignore
    }
  }, [sessionId, messages, questions, currentQIndex, timeLeft, loading]);

  // ── Session Persistence: Restore state from localStorage on mount ──
  useEffect(() => {
    if (!sessionId) return;
    try {
      const saved = localStorage.getItem(`interview_state_${sessionId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only restore if saved within last 30 minutes
        if (parsed.timestamp && Date.now() - parsed.timestamp < 30 * 60 * 1000) {
          if (parsed.messages?.length > 0) {
            setMessages(parsed.messages);
          }
          if (parsed.questions?.length > 0) {
            setQuestions(parsed.questions);
          }
          if (parsed.currentQIndex > 0) {
            setCurrentQIndex(parsed.currentQIndex);
          }
          if (parsed.timeLeft > 0) {
            setTimeLeft(parsed.timeLeft);
          }
        } else {
          localStorage.removeItem(`interview_state_${sessionId}`);
        }
      }
    } catch (e) {
      console.warn('[INTERVIEW] Failed to restore state:', e);
    }
  }, [sessionId]);

  // ── TTS: AI speaks and text appears in chat ──
  const speakText = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      setIsSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Enforce US English for TTS
      const voices = speechSynthesis.getVoices();
      const preferred = voices.find(v => v.lang === 'en-US' && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha')));
      if (preferred) utterance.voice = preferred;
      else {
        const fallback = voices.find(v => v.lang === 'en-US');
        if (fallback) utterance.voice = fallback;
      }

      utterance.onend = () => {
        setIsSpeaking(false);
        resolve();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        resolve();
      };
      synthRef.current = utterance;
      speechSynthesis.speak(utterance);
    });
  }, []);

  // ── STT: Candidate speaks and text appears in chat ──
  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setMessages(prev => [...prev, { role: 'system', text: '⚠️ Speech recognition not supported. Please use Chrome.' }]);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US'; // Strict US English constraint

    let finalTranscript = '';
    let lastActivityTime = Date.now();
    let silenceTimer: NodeJS.Timeout | null = null;
    let idleTimer: NodeJS.Timeout | null = null;
    let initialSilencePrompted = false;

    const checkSilenceInterval = setInterval(() => {
      if (!waitingForAnswerRef.current || !isListeningRef.current) {
        clearInterval(checkSilenceInterval);
        return;
      }
      const now = Date.now();
      const silenceDuration = now - lastActivityTime;
      
      // If candidate has not spoken at all for 5 seconds
      if (silenceDuration > 5000 && !currentTranscriptRef.current.trim() && !initialSilencePrompted) {
        initialSilencePrompted = true;
        const currentName = location.state?.sessionData?.candidate_name || "Candidate";
        
        // Stop recognition to allow AI to speak
        recognition.stop();
        
        speakText(`${currentName}, please answer the question.`).then(() => {
          // Restart listening after prompting
          if (waitingForAnswerRef.current) {
             startListening();
          }
        });
        clearInterval(checkSilenceInterval);
      }
    }, 1000);

    recognition.onresult = (event: any) => {
      lastActivityTime = Date.now(); // Update activity
      
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      
      const currentText = (finalTranscript + interim).trim();
      setCurrentTranscript(currentText);

      // Idle logic: candidate has spoken, but stopped for 5s
      if (idleTimer) clearTimeout(idleTimer);
      if (currentText.length > 0) {
        idleTimer = setTimeout(() => {
          if (waitingForAnswerRef.current && isListeningRef.current) {
            recognition.stop();
            submitCandidateAnswer(currentTranscriptRef.current || currentText);
          }
        }, 5000);
      }
    };

    recognition.onend = () => {
      // Auto restart if still waiting and not deliberately stopped
      if (waitingForAnswerRef.current && isListeningRef.current && !submittingAnswerRef.current) {
         try { recognition.start(); } catch(e) {}
      } else {
         clearInterval(checkSilenceInterval);
         if (idleTimer) clearTimeout(idleTimer);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        console.error('[STT] Error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'audio-capture') {
           setIsListening(false);
           clearInterval(checkSilenceInterval);
           if (idleTimer) clearTimeout(idleTimer);
           toast.error('Microphone access denied or not found. Please allow microphone permissions in your browser settings.', { duration: 5000 });
        } else {
           setIsListening(false);
           toast.error('Microphone issue: ' + event.error);
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    waitingForAnswerRef.current = true;
    lastActivityTime = Date.now();
  }, [location.state]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    waitingForAnswerRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
  }, []);

  const submitCandidateAnswer = async (answerText: string) => {
    if (!sessionId || submittingAnswer) return;
    
    stopListening(); // Make sure STT is off
    
    const qIdx = currentQIndexRef.current;
    const currentQ = questionsRef.current[qIdx];
    if (!currentQ) return;

    // Show candidate's answer in chat
    setMessages(prev => [...prev, { role: 'candidate', text: answerText || "No answer provided." }]);
    setSubmittingAnswer(true);
    waitingForAnswerRef.current = false;

    try {
      const result = await aiInterviewAPI.submitAnswer(sessionId, currentQ.id, answerText);

      // Move to next question (don't show score — results at end only)
      if (result.next_question_id) {
        const nextQ = { id: result.next_question_id, text: result.next_question_text, difficulty: 'adaptive', category: 'technical' };
        
        // Push the dynamically generated question into local state
        setQuestions(prev => {
          const updated = [...prev, nextQ];
          return updated;
        });

        const nextIdx = qIdx + 1;
        setCurrentQIndex(nextIdx);
        
        // AI asks next question with TTS
        setIsTyping(true);
        setTimeout(async () => {
          setMessages(prev => [...prev, { role: 'interviewer', text: nextQ.text }]);
          setIsTyping(false);
          await speakText(nextQ.text);
          // Auto-start listening for candidate's answer
          startListening();
        }, 1500);
      } else {
        // All questions done — transition to coding
        const doneMsg = "Great job! You've completed the Q&A phase. Let's move to the coding challenge.";
        setMessages(prev => [...prev, { role: 'interviewer', text: doneMsg }]);
        await speakText(doneMsg);
        setTimeout(() => {
          localStorage.removeItem(`interview_state_${sessionId}`);
          navigate(`/interview/${sessionId}/coding`);
        }, 2000);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'system', text: `Error: ${e.message}` }]);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  // ── Proctoring: Check camera and face ──
  const checkProctoring = useCallback((analysis: { face_detected: boolean; eye_contact_score: number; dominant_emotion: string }) => {
    setFaceDetected(analysis.face_detected);
    setEyeContact(analysis.eye_contact_score);
    setEmotion(analysis.dominant_emotion);

    if (!analysis.face_detected) {
      noFaceCountRef.current += 1;
      if (noFaceCountRef.current >= 3) {
        // 3 consecutive no-face detections — pause interview
        setIsPaused(true);
        setPauseReason('Face not detected. Please face the camera to continue.');
        speechSynthesis.cancel();
        if (recognitionRef.current) recognitionRef.current.stop();
      }
    } else {
      noFaceCountRef.current = 0;
      if (isPaused && pauseReason.includes('Face')) {
        setIsPaused(false);
        setPauseReason('');
      }
    }
  }, [isPaused, pauseReason]);

  // ── Initialize interview ──
  useEffect(() => {
    if (!sessionId) return;

    const init = async () => {
      try {
        // Start camera + mic
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        // Start screen share
        try {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor' } as any });
          screenStreamRef.current = screenStream;
          setScreenSharing(true);

          // Monitor screen share end
          screenStream.getVideoTracks()[0].onended = () => {
            setScreenSharing(false);
            setIsPaused(true);
            setPauseReason('Screen sharing stopped. Please re-enable screen sharing to continue.');
          };
        } catch {
          setScreenSharing(false);
          setIsPaused(true);
          setPauseReason('Screen sharing is required. Please share your entire screen.');
        }

        // Start interview on backend
        const result = await aiInterviewAPI.startInterview(sessionId);
        setQuestions(result.questions);
        setTimeLeft(result.time_limit_seconds);

        // Load voices
        speechSynthesis.getVoices();

        // AI asks the first question
        if (result.questions.length > 0) {
          const firstQ = result.questions[0];
          const greeting = `Hello! Let's begin your interview. Here is your first question. ${firstQ.text}`;
          
          setIsTyping(true);
          setTimeout(async () => {
            setMessages([{ role: 'interviewer', text: greeting }]);
            setIsTyping(false);
            await speakText(greeting);
            // Start listening for candidate's answer
            startListening();
          }, 1500);
        }

        // Load face-api.js models and start local behavioral analysis
        const loadFaceApi = async () => {
          try {
            const MODEL_URL = '/models';
            await Promise.all([
              faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
              faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
              faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
            ]);
            faceApiLoadedRef.current = true;
          } catch (err) {
            console.error('[FACE-API] Failed to load models:', err);
          }
        };
        loadFaceApi();

        // Run face-api.js detection every 5 seconds and send computed data to backend
        frameIntervalRef.current = setInterval(async () => {
          if (!faceApiLoadedRef.current || !videoRef.current) return;
          const video = videoRef.current;
          if (video.readyState < 2) return; // video not ready

          try {
            const detection = await faceapi
              .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 }))
              .withFaceLandmarks()
              .withFaceExpressions();

            if (detection) {
              // Reset no-face timer
              noFaceTimerRef.current = 0;

              // --- Eye contact from landmarks ---
              const landmarks = detection.landmarks;
              const leftEye = landmarks.getLeftEye();
              const rightEye = landmarks.getRightEye();
              const nose = landmarks.getNose();

              let eyeContactScore = 50; // default
              if (leftEye.length > 0 && rightEye.length > 0 && nose.length > 0) {
                // Calculate how centered the face is (looking at camera)
                const faceBox = detection.detection.box;
                const faceCenterX = faceBox.x + faceBox.width / 2;
                const videoWidth = video.videoWidth || 640;

                // Horizontal deviation from center (0 = perfect center)
                const horizontalDeviation = Math.abs(faceCenterX - videoWidth / 2) / (videoWidth / 2);
                // Eye openness check (if eyes are open, likely looking at screen)
                const leftEyeHeight = Math.abs(leftEye[1].y - leftEye[5].y);
                const leftEyeWidth = Math.abs(leftEye[0].x - leftEye[3].x);
                const leftEAR = leftEyeWidth > 0 ? leftEyeHeight / leftEyeWidth : 0.3;

                const rightEyeHeight = Math.abs(rightEye[1].y - rightEye[5].y);
                const rightEyeWidth = Math.abs(rightEye[0].x - rightEye[3].x);
                const rightEAR = rightEyeWidth > 0 ? rightEyeHeight / rightEyeWidth : 0.3;

                const avgEAR = (leftEAR + rightEAR) / 2;

                // Score: high when face is centered and eyes are open
                const centerScore = Math.max(0, 1 - horizontalDeviation) * 60; // up to 60
                const earScore = Math.min(avgEAR * 100, 40); // up to 40
                eyeContactScore = Math.round(Math.min(centerScore + earScore, 100));
              }

              // --- Dominant emotion ---
              const expressions = detection.expressions as any;
              let dominantEmotion = 'neutral';
              let maxScore = 0;
              const emotionScores: Record<string, number> = {};
              for (const [emotion, score] of Object.entries(expressions)) {
                const s = score as number;
                emotionScores[emotion] = Math.round(s * 100);
                if (s > maxScore) {
                  maxScore = s;
                  dominantEmotion = emotion;
                }
              }

              // Update local UI state
              setEyeContact(eyeContactScore);
              setEmotion(dominantEmotion);
              setFaceDetected(true);

              // Send pre-computed data to backend for storage
              if (sessionId) {
                aiInterviewAPI.sendBehavioralFrame(sessionId, {
                  eye_contact_score: eyeContactScore,
                  dominant_emotion: dominantEmotion,
                  emotion_scores: emotionScores,
                  face_detected: true,
                }).then(r => {
                  checkProctoring(r);
                }).catch(() => {});
              }
            } else {
              // No face detected
              noFaceTimerRef.current += 5; // interval is 5 seconds
              setFaceDetected(false);
              setEyeContact(0);

              // Send no-face data to backend
              if (sessionId) {
                aiInterviewAPI.sendBehavioralFrame(sessionId, {
                  eye_contact_score: 0,
                  dominant_emotion: 'unknown',
                  emotion_scores: {},
                  face_detected: false,
                }).then(r => {
                  checkProctoring(r);
                }).catch(() => {});
              }

              // Warning toast after 10 seconds of no face
              if (noFaceTimerRef.current >= 10) {
                toast.warning('Face not detected! Please face the camera to continue your interview.', {
                  duration: 4000,
                  id: 'no-face-warning',
                });
              }
            }
          } catch (err) {
            console.error('[FACE-API] Detection error:', err);
          }
        }, 5000);

        setLoading(false);
      } catch (e: any) {
        console.error('Init error:', e);
        setLoading(false);
      }
    };
    init();

    // Proctoring: tab switch detection
    const handleVisibility = () => {
      if (document.hidden && sessionId) {
        aiInterviewAPI.sendProctoringEvent(sessionId, 'tab_switch');
        setIsPaused(true);
        setPauseReason('Tab switch detected! Please stay on this tab during the interview.');
        setTimeout(() => {
          if (!document.hidden) {
            setIsPaused(false);
            setPauseReason('');
          }
        }, 3000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (timerRef.current) clearInterval(timerRef.current);
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (recognitionRef.current) recognitionRef.current.abort();
      if (synthRef.current) speechSynthesis.cancel();
      streamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [sessionId]);

  // Ensure Video element mounts stream reliably
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [faceDetected, loading]);
  
  // Ensure Shared Screen element mounts stream reliably
  useEffect(() => {
    const previewEl = document.getElementById('screen-preview') as HTMLVideoElement;
    if (previewEl && screenStreamRef.current) {
      previewEl.srcObject = screenStreamRef.current;
    }
  }, [faceDetected, loading, screenSharing]);

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (isPaused) return;
      setTimeLeft(prev => {
        if (prev <= 1) {
          localStorage.removeItem(`interview_state_${sessionId}`);
          navigate(`/interview/${sessionId}/coding`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionId, navigate, isPaused]);

  // Auto-scroll chat
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping, currentTranscript]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Preparing your interview...</p>
          <p className="text-gray-400 text-sm mt-1">Setting up AI interviewer and generating personalized questions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 flex flex-col">
      {/* ── PAUSE OVERLAY ── */}
      {isPaused && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center">
          <div className="bg-red-950/50 border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
            <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Interview Paused</h2>
            <p className="text-red-300 mb-6">{pauseReason}</p>
            {pauseReason.includes('Screen') && (
              <button
                onClick={async () => {
                  try {
                    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor' } as any });
                    screenStreamRef.current = stream;
                    stream.getVideoTracks()[0].onended = () => {
                      setScreenSharing(false);
                      setIsPaused(true);
                      setPauseReason('Screen sharing stopped. Please re-enable screen sharing to continue.');
                    };
                    setScreenSharing(true);
                    setIsPaused(false);
                    setPauseReason('');
                  } catch {
                    setPauseReason('Screen sharing is required to continue the interview.');
                  }
                }}
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
              >
                <Monitor className="w-5 h-5 inline mr-2" /> Share Screen
              </button>
            )}
            {pauseReason.includes('tab') && (
              <p className="text-gray-400 text-sm mt-2">Resuming automatically...</p>
            )}
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <div className="h-14 bg-black/30 border-b border-white/10 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="IntraView AI" className="h-6 w-6 rounded object-contain" />
          <span className="text-white font-semibold">IntraView AI</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">Q&A Phase</span>
          {sessionData?.position && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs">{sessionData.position}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Status indicators */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
            <span className="text-xs text-gray-400">{faceDetected ? 'Face OK' : 'No Face'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${screenSharing ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
            <span className="text-xs text-gray-400">{screenSharing ? 'Screen' : 'No Screen'}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <span className="text-xs">Interview In Progress</span>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg ${timeLeft < 120 ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-white'}`}>
            <Clock className="w-4 h-4" />
            <span className="font-mono text-sm">{formatTime(timeLeft)}</span>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left: Chat Interface ── */}
        <div className="flex-1 flex flex-col border-r border-white/10 relative min-w-0">
          <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'candidate' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : ''}`}>
                {msg.role === 'system' ? (
                  <div className="px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-sm">
                    {msg.text}
                  </div>
                ) : (
                  <>
                    {msg.role === 'interviewer' && (
                      <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-indigo-400" />
                      </div>
                    )}
                    <div className={`max-w-[80%] p-3 rounded-2xl ${
                      msg.role === 'interviewer'
                        ? 'bg-white/5 border border-white/10 text-gray-200'
                        : 'bg-indigo-600/30 border border-indigo-500/20 text-white'
                    }`}>
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                    </div>
                    {msg.role === 'candidate' && (
                      <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center flex-shrink-0">
                        <UserIcon className="w-4 h-4 text-purple-400" />
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {/* AI typing indicator */}
            {isTyping && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                  </div>
                </div>
              </div>
            )}

            {/* Live transcription of candidate's speech */}
            {isListening && currentTranscript && (
              <div className="flex gap-3 justify-end">
                <div className="max-w-[80%] p-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/10 text-gray-300 italic">
                  <p className="text-sm leading-relaxed">{currentTranscript}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                    <span className="text-xs text-gray-500">Listening...</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-4 h-4 text-purple-400" />
                </div>
              </div>
            )}
          </div>

          {/* ── Voice control bar ── */}
          <div className="p-3 border-t border-white/10">
            <div className="flex items-center justify-center gap-4">
              {isSpeaking && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/20 text-indigo-300">
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  <span className="text-sm">AI is speaking...</span>
                </div>
              )}
              <div className="text-center">
                {submittingAnswer ? (
                  <p className="text-gray-400 text-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Processing your answer...
                  </p>
                ) : isListening ? (
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-2">
                       <Mic className="w-4 h-4 text-emerald-400 animate-pulse" />
                       <span className="text-emerald-400 text-sm font-medium">Listening...</span>
                    </div>
                    <p className="text-xs text-gray-500 max-w-xs">Answer clearly. The AI will automatically submit when you pause.</p>
                  </div>
                ) : isSpeaking ? (
                  <p className="text-indigo-300 text-sm">Wait for the AI to finish speaking</p>
                ) : waitingForAnswerRef.current ? (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-red-400 text-sm">Microphone disconnected.</p>
                    <div className="flex gap-2">
                      <Button onClick={startListening} size="sm" variant="outline" className="border-emerald-500 text-emerald-500 hover:bg-emerald-500/10">
                        <Mic className="w-4 h-4 mr-1" /> Retry Mic
                      </Button>
                      <Button 
                        onClick={() => submitCandidateAnswer(currentTranscriptRef.current || 'No answer provided')} 
                        size="sm" 
                        className="bg-primary hover:bg-primary/90 text-white"
                      >
                        Submit What I Said
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Preparing next question...</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Camera + Screen Share (stacked) ── */}
        <div className="w-[420px] shrink-0 flex flex-col p-3 gap-3 overflow-y-auto bg-gray-950/20">
          
          {/* Camera Feed with Face Analysis Overlay */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1 uppercase tracking-wider font-semibold">
              <Camera className="w-3 h-3 text-cyan-400"/> Camera
            </p>
            <div className="relative rounded-xl overflow-hidden bg-black/60 border border-white/10" style={{ width: '395px', height: '350px' }}>
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Face detection warning */}
              {!faceDetected && (
                <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-red-500/80 text-white text-xs flex items-center gap-1 shadow-lg">
                  <CameraOff className="w-3 h-3" /> No face detected
                </div>
              )}

              {/* Face analysis overlay on bottom of camera */}
              <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-white font-medium">Eye: {Math.round(eyeContact)}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Smile className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-white capitalize font-medium">{emotion}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isListeningRef.current ? (
                      <><Mic className="w-3.5 h-3.5 text-red-500 animate-pulse" /><span className="text-red-400 font-bold">REC</span></>
                    ) : (
                      <><Mic className="w-3.5 h-3.5 text-gray-400" /><span className="text-gray-400">OFF</span></>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Shared Screen */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1 uppercase tracking-wider font-semibold">
               <Monitor className="w-3 h-3 text-indigo-400"/> Shared Screen
            </p>
            <div className="relative rounded-xl overflow-hidden bg-black/60 border border-white/10" style={{ width: '395px', height: '350px' }}>
               <video 
                  id="screen-preview"
                  autoPlay muted playsInline className="w-full h-full object-contain"
               />
            </div>
          </div>

          {/* Compact Behavioral Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-center">
              <p className="text-[10px] text-gray-400 mb-0.5">Eye Contact</p>
              <p className={`text-lg font-bold ${eyeContact >= 60 ? 'text-emerald-400' : 'text-yellow-400'}`}>{Math.round(eyeContact)}%</p>
            </div>
            <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-center">
              <p className="text-[10px] text-gray-400 mb-0.5">Emotion</p>
              <p className="text-lg font-bold text-cyan-400 capitalize">{emotion}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewRoom;

