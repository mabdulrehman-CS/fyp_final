import { useEffect, useState } from 'react';
import { CandidateLayout } from '@/components/layouts/CandidateLayout';
import { GlassCard } from '@/components/shared/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { interviewAPI } from '@/lib/api';
import { 
  Search, 
  BookOpen, 
  Loader2,
  ExternalLink,
  Clock,
  GraduationCap,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const platformColors: Record<string, string> = {
  Coursera: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Udemy: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  edX: 'bg-red-500/20 text-red-400 border-red-500/30',
  freeCodeCamp: 'bg-green-500/20 text-green-400 border-green-500/30',
  LeetCode: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Educative: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  YouTube: 'bg-red-600/20 text-red-300 border-red-600/30',
};

export default function CandidateRecommendations() {
  const { isAuthenticated } = useAuth();
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sessionCount, setSessionCount] = useState(0);

  useEffect(() => {
    if (isAuthenticated) {
      fetchRecommendations();
    }
  }, [isAuthenticated]);

  const fetchRecommendations = async () => {
    setIsLoading(true);
    try {
      const history = await interviewAPI.getHistory();
      const completed = history.filter((s: any) => s.status === 'completed');
      setSessionCount(completed.length);

      const allRecs: any[] = [];

      // Extract recommendations from every completed session's final report
      completed.forEach((session: any) => {
        const recs = session.final_report?.recommendations;
        if (recs && Array.isArray(recs) && recs.length > 0) {
          recs.forEach((r: any, idx: number) => {
            // Skip stub recommendations
            if (!r.url || r.title === 'You performed well overall') return;
            allRecs.push({
              id: `${session.id}-${idx}`,
              title: r.title || 'Untitled Course',
              reason: r.reason || r.description || '',
              url: r.url,
              topic: r.topic || '',
              platform: r.platform || getPlatformFromUrl(r.url),
              estimated_hours: r.estimated_hours || null,
              resource_type: r.resource_type || 'course',
              session_id: session.id,
              session_position: session.position || 'Interview',
            });
          });
        }
      });

      // Deduplicate by URL
      const seen = new Set<string>();
      const unique = allRecs.filter(r => {
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
      });

      setRecommendations(unique);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      toast.error('Failed to load recommendations');
    } finally {
      setIsLoading(false);
    }
  };

  const getPlatformFromUrl = (url: string): string => {
    if (!url) return 'Online';
    if (url.includes('coursera')) return 'Coursera';
    if (url.includes('udemy')) return 'Udemy';
    if (url.includes('edx')) return 'edX';
    if (url.includes('freecodecamp')) return 'freeCodeCamp';
    if (url.includes('leetcode')) return 'LeetCode';
    if (url.includes('educative')) return 'Educative';
    if (url.includes('youtube')) return 'YouTube';
    if (url.includes('github')) return 'GitHub';
    return 'Online';
  };

  const filtered = recommendations.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.title?.toLowerCase().includes(q) ||
      r.reason?.toLowerCase().includes(q) ||
      r.topic?.toLowerCase().includes(q) ||
      r.platform?.toLowerCase().includes(q)
    );
  });

  return (
    <CandidateLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Course Recommendations</h1>
            <p className="text-muted-foreground mt-1">
              {sessionCount > 0
                ? `Based on your performance across ${sessionCount} interview${sessionCount > 1 ? 's' : ''}`
                : 'Complete an interview to get personalized recommendations'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRecommendations} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search courses..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
              <p className="text-muted-foreground">Loading your recommendations...</p>
            </div>
          </div>
        ) : sessionCount === 0 ? (
          <GlassCard className="p-12 text-center">
            <GraduationCap className="h-16 w-16 opacity-30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No recommendations yet</h3>
            <p className="text-muted-foreground mb-6">
              Complete at least one interview to receive personalized course recommendations based on your performance.
            </p>
            <Button onClick={() => window.location.href = '/candidate/interview'}>
              Start an Interview
            </Button>
          </GlassCard>
        ) : filtered.length === 0 ? (
          <GlassCard className="p-12 text-center">
            <BookOpen className="h-12 w-12 opacity-30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No courses found</h3>
            <p className="text-muted-foreground">
              {search ? `No results for "${search}". Try a different search.` : 'No recommendations available yet. Complete an interview to get personalized courses.'}
            </p>
          </GlassCard>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((rec, index) => {
              const platformStyle = platformColors[rec.platform] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
              return (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <GlassCard hover className="flex flex-col h-full p-5">
                    {/* Platform + resource type */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${platformStyle}`}>
                        {rec.platform}
                      </span>
                      <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-xs text-gray-400 capitalize">
                        {rec.resource_type?.replace('_', ' ') || 'Course'}
                      </span>
                    </div>

                    {/* Icon + Title */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold text-sm leading-snug line-clamp-2">{rec.title}</h3>
                    </div>

                    {/* Reason */}
                    <p className="text-sm text-muted-foreground line-clamp-3 flex-1 mb-4">
                      {rec.reason}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      {rec.estimated_hours ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          ~{rec.estimated_hours}h
                        </span>
                      ) : <span />}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => rec.url && window.open(rec.url, '_blank')}
                        disabled={!rec.url}
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        Open Course
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </CandidateLayout>
  );
}
