import { useEffect, useState } from 'react';
import { CandidateLayout } from '@/components/layouts/CandidateLayout';
import { GlassCard, StatsCard } from '@/components/shared/GlassCard';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { interviewAPI, InterviewSession } from '@/lib/api';
import { motion } from 'framer-motion';
import { 
  Video, 
  FileText, 
  Trophy, 
  Clock, 
  Play,
  ArrowRight,
  Calendar
} from 'lucide-react';
import { DashboardStats } from '@/types';
import { StaggerContainer, StaggerItem } from '@/components/shared/PageTransition';

export default function CandidateDashboard() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalInterviews: 0,
    recentInterviews: 0,
    averageScore: 0,
    completedInterviews: 0,
  });
  const [recentActivity, setRecentActivity] = useState<InterviewSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (user && isAuthenticated) {
      fetchDashboardData();
    }
  }, [user, isAuthenticated]);

  const fetchDashboardData = async () => {
    try {
      // Fetch interview history from FastAPI
      const interviews = await interviewAPI.getHistory();

      const completed = interviews?.filter(i => i.status === 'completed') || [];
      const recent = interviews?.slice(0, 5) || [];
      const avgScore = completed.length > 0
        ? completed.reduce((acc, i) => acc + (i.final_report?.overall_score || i.overall_score || 0), 0) / completed.length
        : 0;

      setStats({
        totalInterviews: interviews?.length || 0,
        recentInterviews: recent.length,
        averageScore: Math.round(avgScore),
        completedInterviews: completed.length,
      });

      setRecentActivity(recent);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: string) => {
    if (!date) return 'N/A';
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <CandidateLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Welcome</h1>
        </div>

        {/* Stats Cards */}
        <StaggerContainer className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StaggerItem>
            <StatsCard
              title="Total Interviews"
              value={stats.totalInterviews}
              icon={<Video className="h-6 w-6" />}
            />
          </StaggerItem>
          <StaggerItem>
            <StatsCard
              title="Completed"
              value={stats.completedInterviews}
              icon={<FileText className="h-6 w-6" />}
            />
          </StaggerItem>
          <StaggerItem>
            <StatsCard
              title="Average Score"
              value={`${stats.averageScore}%`}
              icon={<Trophy className="h-6 w-6" />}
            />
          </StaggerItem>
          <StaggerItem>
            <StatsCard
              title="Recent"
              value={stats.recentInterviews}
              icon={<Clock className="h-6 w-6" />}
            />
          </StaggerItem>
        </StaggerContainer>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Start Interview Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1"
          >
            <GlassCard glow className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/20">
                <Play className="h-10 w-10 text-primary" />
              </div>
              <h2 className="mb-2 text-2xl font-bold">Ready for an Interview?</h2>
              <p className="mb-6 text-muted-foreground">
                Start a new AI-powered interview session and showcase your skills.
              </p>
              <Button 
                size="lg" 
                className="btn-primary gap-2"
                onClick={() => navigate('/pre-check')}
              >
                Start Interview
                <ArrowRight className="h-5 w-5" />
              </Button>
            </GlassCard>
          </motion.div>

          {/* My Sessions Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-1"
          >
            <GlassCard glow className="flex h-full flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-purple-500/20">
                <FileText className="h-10 w-10 text-purple-400" />
              </div>
              <h2 className="mb-2 text-2xl font-bold">My Interview Sessions</h2>
              <p className="mb-6 text-muted-foreground">
                Resume paused interviews or review your detailed AI feedback reports.
              </p>
              <Button 
                size="lg" 
                className="btn-secondary gap-2 border-purple-500/20 hover:bg-purple-500/10"
                onClick={() => navigate('/candidate/sessions')}
              >
                View History
                <ArrowRight className="h-5 w-5" />
              </Button>
            </GlassCard>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <GlassCard className="h-full p-6">
              <h3 className="mb-4 text-lg font-semibold">Recent Activity</h3>
              {isLoading ? (
                <div className="flex h-48 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
                  <Calendar className="mb-2 h-12 w-12 opacity-50" />
                  <p>No interviews yet</p>
                  <p className="text-sm">Start your first interview to see activity here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((interview, index) => (
                    <motion.div
                      key={interview.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between rounded-lg bg-muted/50 p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`rounded-full p-2 ${
                          interview.status === 'completed' 
                            ? 'bg-success/20 text-success' 
                            : interview.status === 'in_progress'
                            ? 'bg-warning/20 text-warning'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          <Video className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">Interview Session</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(interview.start_time || interview.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          interview.status === 'completed' 
                            ? 'bg-success/20 text-success' 
                            : interview.status === 'in_progress'
                            ? 'bg-warning/20 text-warning'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {interview.status.replace('_', ' ')}
                        </span>
                        {interview.overall_score && (
                          <p className="mt-1 text-sm font-semibold text-primary">
                            {interview.final_report?.overall_score || interview.overall_score}%
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </CandidateLayout>
  );
}
