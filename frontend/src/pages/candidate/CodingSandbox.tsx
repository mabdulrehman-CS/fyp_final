import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Send, Clock, CheckCircle, XCircle, Loader2, ChevronDown, Code2, AlertTriangle, Terminal, X, ArrowRight, Zap, Brain, Shield } from 'lucide-react';
import { aiInterviewAPI } from '@/lib/api';
import Editor from '@monaco-editor/react';
import { toast } from 'sonner';

const LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
];

interface RunResult {
  status: string;
  stdout: string;
  stderr: string;
  execution_time_ms: number;
}

interface TestResult {
  test_case_id: string;
  status: string;
  expected: string;
  actual: string;
  input?: string;
  hidden: boolean;
}

interface SubmitResult {
  test_results: {
    score: number;
    passed: number;
    total: number;
    pass_rate?: number;
    results: TestResult[];
    logic_correct?: boolean;
    time_complexity?: string;
    space_complexity?: string;
    code_quality_score?: number;
    logic_score?: number;
    overall_coding_score?: number;
    issues?: string[];
    suggestions?: string[];
    feedback?: string;
  };
  plagiarism_score: number;
  is_flagged: boolean;
  coding_score: number;
}

const CodingSandbox: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [problem, setProblem] = useState<any>(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes
  const [error, setError] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState('');

  // Output panel
  const [runOutput, setRunOutput] = useState<RunResult | null>(null);
  const [showOutput, setShowOutput] = useState(false);

  // Confirmation dialog
  const [showConfirm, setShowConfirm] = useState(false);



  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load problem
  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      try {
        const result = await aiInterviewAPI.transitionToCoding(sessionId);
        setProblem(result.problem);
        if (result.problem.template_code) {
          setCode(result.problem.template_code[language] || '# Write your code here\n');
        }
        setLoading(false);
      } catch (e: any) {
        setError(e.message);
        setLoading(false);
      }
    };
    load();
  }, [sessionId]);

  // Tab visibility tracking
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !submitting && !loading) {
        setIsPaused(true);
        setPauseReason('Tab switch detected! You must remain active on this tab during the interview.');
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [sessionId, submitting, loading]);

  // Update code template on language change
  useEffect(() => {
    if (problem?.template_code?.[language]) {
      setCode(problem.template_code[language]);
    }
  }, [language, problem]);

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleSubmitConfirmed();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ── Navigation Protection: Warn on page refresh/close ──
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'You have an active coding challenge. Are you sure you want to leave?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ── Navigation Protection: Block back/forward buttons ──
  useEffect(() => {
    window.history.pushState({ codingLock: true }, '');
    const handlePopState = () => {
      window.history.pushState({ codingLock: true }, '');
      toast.warning('You cannot go back during the coding challenge.', {
        id: 'coding-nav-block',
        duration: 3000,
      });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ── Code Persistence: Save code to localStorage ──
  useEffect(() => {
    if (!sessionId || loading) return;
    try {
      localStorage.setItem(`coding_state_${sessionId}`, JSON.stringify({
        code,
        language,
        timeLeft,
        timestamp: Date.now(),
      }));
    } catch (e) {
      // ignore
    }
  }, [sessionId, code, language, timeLeft, loading]);

  // ── Code Persistence: Restore code from localStorage on mount ──
  useEffect(() => {
    if (!sessionId) return;
    try {
      const saved = localStorage.getItem(`coding_state_${sessionId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.timestamp && Date.now() - parsed.timestamp < 45 * 60 * 1000) {
          if (parsed.code) setCode(parsed.code);
          if (parsed.language) setLanguage(parsed.language);
          if (parsed.timeLeft > 0) setTimeLeft(parsed.timeLeft);
        } else {
          localStorage.removeItem(`coding_state_${sessionId}`);
        }
      }
    } catch (e) {
      console.warn('[CODING] Failed to restore state:', e);
    }
  }, [sessionId]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // ── RUN: Execute code via subprocess, show stdout/stderr ──
  const handleRun = async () => {
    if (!sessionId || running) return;
    setRunning(true);
    setRunOutput(null);
    setShowOutput(true);
    setError('');
    try {
      const result = await aiInterviewAPI.runCode(sessionId, code, language);
      setRunOutput(result);
    } catch (e: any) {
      setRunOutput({
        status: 'error',
        stdout: '',
        stderr: e.message || 'Failed to execute code',
        execution_time_ms: 0,
      });
    } finally {
      setRunning(false);
    }
  };

  // ── SUBMIT: Show confirmation dialog first ──
  const handleSubmitClick = () => {
    setShowConfirm(true);
  };

  // ── SUBMIT CONFIRMED: Send to Groq for evaluation and go to report ──
  const handleSubmitConfirmed = async () => {
    if (!sessionId || submitting) return;
    setShowConfirm(false);
    setSubmitting(true);
    setError('');
    toast.info('Evaluating code and generating final report. Please wait...', { duration: 5000 });
    try {
      // 1. Submit code to backend for AI Evaluation
      await aiInterviewAPI.submitCode(sessionId, code, language);
      
      // 2. Complete the interview to generate the final report
      const report = await aiInterviewAPI.completeInterview(sessionId!);
      
      // 3. Clean up and redirect
      localStorage.removeItem(`coding_state_${sessionId}`);
      navigate(`/interview/${sessionId}/report`, { state: { reportData: report } });
    } catch (e: any) {
      setError(e.message);
      toast.error('Failed to submit code or complete interview: ' + e.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Generating your coding problem...</p>
          <p className="text-gray-400 text-sm mt-1">Tailored to your skills</p>
        </div>
      </div>
    );
  }

  const getDifficultyColor = (d: string) => {
    switch (d?.toLowerCase()) {
      case 'easy': return 'bg-emerald-500/20 text-emerald-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'hard': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };


  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 flex flex-col">
      {/* ── PAUSE OVERLAY ── */}
      {isPaused && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center">
          <div className="bg-red-950/50 border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
            <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Interview Paused</h2>
            <p className="text-red-300 mb-6">{pauseReason}</p>
            <button
               onClick={() => setIsPaused(false)}
               className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
            >
               Resume Interview
            </button>
          </div>
        </div>
      )}

      {/* ── CONFIRMATION DIALOG ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-md text-center shadow-2xl">
            <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Submit Final Code?</h2>
            <p className="text-gray-400 mb-6 text-sm">
              Your code will be sent to AI for logic evaluation. This action cannot be undone.
              The interview will end after submission.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitConfirmed}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" /> Submit & End Interview
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Top bar */}
      <div className="h-14 bg-black/30 border-b border-white/10 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Code2 className="w-5 h-5 text-indigo-400" />
          <span className="text-white font-semibold">Coding Challenge</span>
          {problem && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(problem.difficulty)}`}>
              {problem.difficulty}
            </span>
          )}
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg ${timeLeft < 300 ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-white'}`}>
          <Clock className="w-4 h-4" />
          <span className="font-mono text-sm">{formatTime(timeLeft)}</span>
        </div>
      </div>

      {/* Main split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Problem description (50%) */}
        <div className="w-1/2 border-r border-white/10 overflow-y-auto p-6">
          {problem && (
            <>
              <h2 className="text-2xl font-bold text-white mb-4">{problem.title}</h2>
              <div className="prose prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-gray-300 text-sm leading-relaxed bg-white/5 rounded-xl p-4 border border-white/10">
                  {problem.description}
                </pre>
              </div>
            </>
          )}
        </div>

        {/* Right: Code editor + output (50%) */}
        <div className="w-1/2 flex flex-col">
          {/* Language selector + buttons */}
          <div className="flex items-center justify-between p-3 border-b border-white/10 bg-black/20">
            <div className="relative">
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="appearance-none bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm pr-8 focus:outline-none focus:border-indigo-500/50"
              >
                {LANGUAGES.map(l => (
                  <option key={l.value} value={l.value} className="bg-gray-900">{l.label}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="flex gap-2">
              {/* Run Button */}
              <button
                onClick={handleRun}
                disabled={running || submitting}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white font-medium transition-colors disabled:opacity-50 text-sm"
              >
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {running ? 'Running...' : 'Run'}
              </button>
              {/* Submit Button */}
              <button
                onClick={handleSubmitClick}
                disabled={submitting || running}
                className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50 text-sm"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? 'AI Evaluating...' : 'Submit'}
              </button>
            </div>
          </div>

          {/* Code editor */}
          <div className={`relative border-b border-white/10 bg-gray-950 ${showOutput ? 'flex-1' : 'flex-1'}`} style={{ minHeight: 0, flex: showOutput ? '1 1 60%' : '1 1 100%' }}>
             <Editor
               height="100%"
               width="100%"
               language={language === 'cpp' ? 'cpp' : language}
               theme="vs-dark"
               value={code}
               onChange={(val) => setCode(val || '')}
               options={{
                 minimap: { enabled: false },
                 fontSize: 14,
                 fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                 scrollBeyondLastLine: false,
                 wordWrap: "on",
                 lineHeight: 24,
                 tabSize: 4
               }}
             />
          </div>

          {/* Output Panel */}
          {showOutput && (
            <div className="border-t border-white/10 bg-gray-950/80" style={{ flex: '0 0 40%', minHeight: '120px', maxHeight: '280px' }}>
              <div className="flex items-center justify-between px-3 py-1.5 bg-black/30 border-b border-white/10">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Terminal className="w-3.5 h-3.5" />
                  <span className="uppercase tracking-wider font-semibold">Output</span>
                  {runOutput && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${runOutput.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-400' : runOutput.status === 'TLE' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                      {runOutput.status === 'accepted' ? 'SUCCESS' : runOutput.status === 'TLE' ? 'TIMEOUT' : 'ERROR'}
                    </span>
                  )}
                  {runOutput?.execution_time_ms !== undefined && runOutput.execution_time_ms > 0 && (
                    <span className="text-gray-500">{runOutput.execution_time_ms}ms</span>
                  )}
                </div>
                <button onClick={() => setShowOutput(false)} className="text-gray-500 hover:text-gray-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-3 overflow-y-auto h-full font-mono text-sm">
                {running ? (
                  <div className="flex items-center gap-2 text-indigo-400">
                    <Loader2 className="w-4 h-4 animate-spin" /> Executing...
                  </div>
                ) : runOutput ? (
                  <>
                    {runOutput.stdout && (
                      <pre className="text-emerald-300 whitespace-pre-wrap mb-2">{runOutput.stdout}</pre>
                    )}
                    {runOutput.stderr && (
                      <pre className="text-red-400 whitespace-pre-wrap">{runOutput.stderr}</pre>
                    )}
                    {!runOutput.stdout && !runOutput.stderr && (
                      <p className="text-gray-500 italic">No output</p>
                    )}
                  </>
                ) : (
                  <p className="text-gray-500 italic">Click "Run" to execute your code</p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border-t border-red-500/20 text-red-300 text-sm">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodingSandbox;
