import { useEffect, useState } from 'react';
import { CandidateLayout } from '@/components/layouts/CandidateLayout';
import { GlassCard } from '@/components/shared/GlassCard';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { interviewAPI, InterviewSession } from '@/lib/api';
import { motion } from 'framer-motion';
import { Clock, Play, FileText, Calendar, CheckCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function CandidateSessions() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (user && isAuthenticated) {
      fetchSessions();
    }
  }, [user, isAuthenticated]);

  const fetchSessions = async () => {
    try {
      // Create endpoint in backend first /api/interview/sessions !
      // Using generic apiCall manually until added to client
      const response = await fetch('http://localhost:8000/api/interview/sessions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      const data = await response.json();
      setSessions(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = (session: InterviewSession) => {
    if (session.status === 'completed') {
      navigate(`/interview/${session.id}/report`, { state: { from: 'sessions' } });
    } else {
      // Resume the session
      navigate(`/interview/${session.id}`);
    }
  };

  return (
    <CandidateLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Interview Sessions</h1>
          <p className="text-muted-foreground mt-2">Resume an incomplete interview or view your past reports.</p>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : sessions.length === 0 ? (
          <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Sessions Found</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              You haven't started any interviews yet. Start one from the dashboard to see it here.
            </p>
            <Button onClick={() => navigate('/pre-check')}>Start New Interview</Button>
          </GlassCard>
        ) : (
          <div className="grid gap-4">
            {sessions.map((session, i) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <GlassCard className="flex flex-col sm:flex-row sm:items-center justify-between p-6 gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl border ${
                      session.status === 'completed' 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                        : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                    }`}>
                      {session.status === 'completed' ? <CheckCircle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white capitalize">{session.position || 'General'} Interview</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {session.start_time ? format(new Date(session.start_time), 'MMM d, yyyy h:mm a') : 'Unknown Date'}
                        </span>
                        {session.status === 'completed' && session.final_report && session.final_report.overall_score !== undefined && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                            Score: {session.final_report.overall_score}%
                          </span>
                        )}
                        {session.status !== 'completed' && (
                          <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300">
                            Status: {session.status.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-shrink-0">
                    <Button 
                      className={session.status === 'completed' ? 'btn-secondary' : 'btn-primary'}
                      onClick={() => handleAction(session)}
                    >
                      {session.status === 'completed' ? (
                        <span className="flex items-center gap-2">View Report <FileText className="w-4 h-4" /></span>
                      ) : (
                        <span className="flex items-center gap-2">Resume Session <Play className="w-4 h-4" /></span>
                      )}
                    </Button>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </CandidateLayout>
  );
}
