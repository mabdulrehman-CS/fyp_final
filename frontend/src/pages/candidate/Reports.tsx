import { useEffect, useState } from 'react';
import { CandidateLayout } from '@/components/layouts/CandidateLayout';
import { GlassCard } from '@/components/shared/GlassCard';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { interviewAPI, aiInterviewAPI } from '@/lib/api';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Download, 
  Eye, 
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2
} from 'lucide-react';
import { statusColors } from '@/lib/constants';

export default function CandidateReports() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [interviews, setInterviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (user && isAuthenticated) {
      fetchInterviews();
    }
  }, [user, isAuthenticated]);

  const fetchInterviews = async () => {
    try {
      const data = await interviewAPI.getHistory();
      setInterviews(data);
    } catch (error) {
      console.error('Error fetching interviews:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return 'N/A';
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  const getScoreColor = (score: number | undefined | null) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreIcon = (score: number | undefined | null) => {
    if (!score) return <Minus className="h-4 w-4" />;
    if (score >= 70) return <TrendingUp className="h-4 w-4" />;
    return <TrendingDown className="h-4 w-4" />;
  };

  // Navigate to full ReportView page (same view as after interview)
  const viewReport = (interview: any) => {
    navigate(`/interview/${interview.id || interview._id}/report`, {
      state: { from: 'reports' }
    });
  };

  // Download PDF from backend
  const downloadReport = (interview: any) => {
    const id = interview.id || interview._id;
    const pdfUrl = aiInterviewAPI.getReportPdfUrl(id);
    window.open(pdfUrl, '_blank');
  };

  // Extract score from interview data safely
  const getScore = (interview: any, field: string): number | null => {
    const fr = interview.final_report;
    if (fr && fr[field] !== undefined && fr[field] !== null) return fr[field];
    if (interview[field] !== undefined && interview[field] !== null) return interview[field];
    return null;
  };

  // Get position label or fallback
  const getLabel = (interview: any): string => {
    return interview.position || 'Interview Session';
  };

  return (
    <CandidateLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Interview Reports</h1>
          <p className="text-muted-foreground">View and download your interview results.</p>
        </div>

        {/* Reports Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <GlassCard className="p-0 overflow-hidden">
            {isLoading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : interviews.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
                <FileText className="mb-2 h-12 w-12 opacity-50" />
                <p>No interview reports yet</p>
                <p className="text-sm">Complete an interview to see your reports here</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Position</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Overall</TableHead>
                    <TableHead>Technical</TableHead>
                    <TableHead>Behavioral</TableHead>
                    <TableHead>Coding</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {interviews.map((interview, index) => {
                    const overall = getScore(interview, 'overall_score');
                    const technical = getScore(interview, 'technical_score');
                    const behavioral = getScore(interview, 'behavioral_score');
                    const coding = getScore(interview, 'coding_score');

                    return (
                      <motion.tr
                        key={interview.id || interview._id || index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="group"
                      >
                        <TableCell>
                          <span className="font-medium">{getLabel(interview)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDate(interview.start_time || interview.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[interview.status] || 'bg-gray-500/20 text-gray-400'}`}>
                            {(interview.status || 'unknown').replace('_', ' ')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-1 font-semibold ${getScoreColor(overall)}`}>
                            {getScoreIcon(overall)}
                            {overall !== null ? `${overall}%` : '-'}
                          </div>
                        </TableCell>
                        <TableCell className={getScoreColor(technical)}>
                          {technical !== null ? `${technical}%` : '-'}
                        </TableCell>
                        <TableCell className={getScoreColor(behavioral)}>
                          {behavioral !== null ? `${behavioral}%` : '-'}
                        </TableCell>
                        <TableCell className={getScoreColor(coding)}>
                          {coding !== null ? `${coding}%` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                            {interview.status === 'completed' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="View full report"
                                  onClick={() => viewReport(interview)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Download PDF"
                                  onClick={() => downloadReport(interview)}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </CandidateLayout>
  );
}
