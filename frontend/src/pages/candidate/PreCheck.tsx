import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Mic, Monitor, CheckCircle, XCircle, Loader2, ArrowRight, Briefcase, AlertTriangle } from 'lucide-react';
import { aiInterviewAPI } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { CandidateLayout } from '@/components/layouts/CandidateLayout';

const PreCheck: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraOk, setCameraOk] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [screenOk, setScreenOk] = useState(false);
  const [position, setPosition] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [micLevel, setMicLevel] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [checkingScreen, setCheckingScreen] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Camera test
  const testCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraOk(true);
      setError('');
    } catch {
      setCameraOk(false);
      setError('Camera access denied. Please allow camera permissions.');
    }
  }, []);

  // Mic test
  const testMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setMicLevel(avg);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
      setMicOk(true);
      setError('');
    } catch {
      setMicOk(false);
      setError('Microphone access denied.');
    }
  }, []);

  // Screen share test — MUST share entire screen
  const testScreen = useCallback(async () => {
    setCheckingScreen(true);
    setError('');
    try {
      // Request screen sharing - preferring monitor (entire screen)
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: {
          // @ts-ignore
          displaySurface: 'monitor',
        },
        audio: false,
      });
      
      // We got a stream — keep it active
      screenStreamRef.current = stream;
      
      const videoTrack = stream.getVideoTracks()[0];
      
      // Listen for user stopping screen share
      videoTrack.addEventListener('ended', () => {
        setScreenOk(false);
        screenStreamRef.current = null;
        setError('Screen share stopped. You must share your screen during the interview.');
      });
      
      setScreenOk(true);
      setError('');
    } catch (err: any) {
      console.error('Screen share error:', err);
      setScreenOk(false);
      setError('Screen sharing is required. Please share your entire screen.');
    } finally {
      setCheckingScreen(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const allChecked = cameraOk && micOk && screenOk;
  // Check if CV is uploaded by checking cv_filename
  const hasCv = !!(user?.profile_info?.cv_filename || user?.profile_info?.cv_url);

  const handleStartInterview = async () => {
    if (!position.trim()) { setError('Please enter the position you are interviewing for.'); return; }
    if (!allChecked) { setError('Please complete all permission checks.'); return; }

    setStarting(true);
    setError('');
    try {
      const result = await aiInterviewAPI.startFromProfile(position.trim());
      navigate(`/interview/${result.session_id}`, { 
        state: { 
          sessionData: result,
          screenStream: screenStreamRef.current ? true : false 
        } 
      });
    } catch (e: any) {
      setError(e.message || 'Failed to start interview');
    } finally {
      setStarting(false);
    }
  };

  return (
    <CandidateLayout>
      <div className="max-w-2xl mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Pre-Interview Setup</h1>
          <p className="text-gray-400">Complete all checks before starting your AI interview</p>
          {user?.profile_info?.name && (
            <p className="text-indigo-400 text-sm mt-1">Welcome, {user.profile_info.name}</p>
          )}
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 space-y-4">
          {/* Camera Preview */}
          <div className="relative aspect-video bg-black/50 rounded-xl overflow-hidden mb-4">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            {!cameraOk && (
              <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
                <Camera className="w-12 h-12 text-gray-600" />
                <p className="text-gray-500 text-sm">Camera preview will appear here</p>
              </div>
            )}
          </div>

          {/* Camera */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${cameraOk ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <span className="text-white font-medium">Camera Access</span>
                {!cameraOk && <span className="text-red-400 text-xs ml-2">Required</span>}
              </div>
            </div>
            {cameraOk ? (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            ) : (
              <button onClick={testCamera} className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors">
                Enable
              </button>
            )}
          </div>

          {/* Microphone */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${micOk ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <span className="text-white font-medium">Microphone Access</span>
                {!micOk && <span className="text-red-400 text-xs ml-2">Required</span>}
              </div>
            </div>
            {micOk ? (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            ) : (
              <button onClick={testMic} className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors">
                Enable
              </button>
            )}
          </div>

          {micOk && (
            <div className="px-4">
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-75"
                  style={{ width: `${Math.min(micLevel * 2, 100)}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-1">Speak to test your microphone</p>
            </div>
          )}

          {/* Screen Share — Fixed button */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${screenOk ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <span className="text-white font-medium">Entire Screen Share</span>
                {!screenOk && <span className="text-red-400 text-xs ml-2">Required</span>}
              </div>
            </div>
            {screenOk ? (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            ) : (
              <button 
                onClick={testScreen}
                disabled={checkingScreen}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkingScreen ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Requesting...</span>
                ) : (
                  'Enable'
                )}
              </button>
            )}
          </div>
          {screenOk && (
            <p className="px-4 text-xs text-emerald-400">✓ Screen sharing active. Do not stop sharing during the interview.</p>
          )}

          {/* Position Input */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <label className="block text-white font-medium mb-2">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-4 h-4 text-indigo-400" />
                Interview Position / Role
              </div>
              <input
                type="text"
                value={position}
                onChange={e => setPosition(e.target.value)}
                placeholder="e.g. Frontend Developer, Data Scientist, DevOps Engineer..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 text-sm"
              />
            </label>
          </div>

          {/* CV check warning — only shown if NO CV uploaded */}
          {!hasCv && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <span className="text-yellow-300 text-sm">
                Please <a href="/candidate/profile" className="underline font-medium">upload your CV</a> on the Profile page before starting an interview.
              </span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-red-300 text-sm">{error}</span>
            </div>
          )}

          {/* Start Button */}
          <button
            onClick={handleStartInterview}
            disabled={!allChecked || !position.trim() || starting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {starting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Preparing Interview...</>
            ) : (
              <><ArrowRight className="w-5 h-5" /> Start Interview</>
            )}
          </button>
        </div>
      </div>
    </CandidateLayout>
  );
};

export default PreCheck;
