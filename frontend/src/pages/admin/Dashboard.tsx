import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { StatsCard, GlassCard } from '@/components/shared/GlassCard';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { adminAPI, DashboardStats } from '@/lib/api';
import { Users, Video, HelpCircle, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      navigate('/admin/login');
    }
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchStats();
    }
  }, [isAuthenticated, isAdmin]);

  const fetchStats = async () => {
    try {
      const data = await adminAPI.getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('Failed to load dashboard stats');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <AdminLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Platform overview and statistics.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard 
            title="Total Users" 
            value={stats?.totalCandidates?.toString() || '0'} 
            icon={<Users className="h-6 w-6" />} 
          />
          <StatsCard 
            title="Live Interviews" 
            value={stats?.activeSessions?.toString() || '0'} 
            icon={<Video className="h-6 w-6" />} 
          />
          <StatsCard 
            title="Total Questions" 
            value={stats?.totalQuestions?.toString() || '0'} 
            icon={<HelpCircle className="h-6 w-6" />} 
          />
          <StatsCard 
            title="Completed Interviews" 
            value={stats?.completedInterviews?.toString() || '0'} 
            icon={<CheckCircle className="h-6 w-6" />} 
          />
        </div>

        {/* Recent Activity */}
        {stats?.recentActivity && stats.recentActivity.length > 0 && (
          <GlassCard className="p-6">
            <h3 className="mb-4 text-lg font-semibold">Recent Activity</h3>
            <div className="space-y-3">
              {stats.recentActivity.slice(0, 5).map((activity, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <div>
                    <p className="font-medium">{activity.action}</p>
                    <p className="text-sm text-muted-foreground">{activity.admin_email}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(activity.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
    </AdminLayout>
  );
}
