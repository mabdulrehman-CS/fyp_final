import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { GlassCard } from '@/components/shared/GlassCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { sessionsAPI, Session, SessionsResponse } from '@/lib/api';
import { PlayCircle, Loader2, Eye, Clock, CheckCircle, XCircle, Radio } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSessions() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isLoading: authLoading } = useAuth();
  const [liveSessions, setLiveSessions] = useState<Session[]>([]);
  const [historySessions, setHistorySessions] = useState<Session[]>([]);
  const [livePage, setLivePage] = useState(1);
  const [liveTotal, setLiveTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      navigate('/admin/login');
    }
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchSessions();
    }
  }, [isAuthenticated, isAdmin, livePage, historyPage]);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const [liveResponse, historyResponse] = await Promise.all([
        sessionsAPI.getLive(livePage, 10),
        sessionsAPI.getHistory(historyPage, 10),
      ]);
      setLiveSessions(liveResponse.items || []);
      setLiveTotal(liveResponse.total || 0);
      setHistorySessions(historyResponse.items || []);
      setHistoryTotal(historyResponse.total || 0);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewSession = (session: Session) => {
    setSelectedSession(session);
    setIsViewDialogOpen(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (session: Session) => {
    if (session.duration) return session.duration;
    if (session.duration_minutes) return `${session.duration_minutes}m`;
    if (session.start_time) {
      const start = new Date(session.start_time);
      const end = session.completed_at ? new Date(session.completed_at) : new Date();
      const diff = Math.floor((end.getTime() - start.getTime()) / 1000);
      const mins = Math.floor(diff / 60);
      return `${mins}m`;
    }
    return '-';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-success/20 text-success">Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-primary/20 text-primary">In Progress</Badge>;
      case 'cancelled':
        return <Badge className="bg-destructive/20 text-destructive">Cancelled</Badge>;
      default:
        return <Badge className="bg-secondary/20 text-secondary">Pending</Badge>;
    }
  };

  if (authLoading) {
    return (
      <AdminLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const SessionsTable = ({ sessions, showStatus = true }: { sessions: Session[], showStatus?: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Candidate</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Duration</TableHead>
          {showStatus && <TableHead>Status</TableHead>}
          {showStatus && <TableHead>Score</TableHead>}
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((session) => (
          <TableRow key={session.id}>
            <TableCell className="font-medium">{session.candidate_name || session.candidate_email || session.candidate_id}</TableCell>
            <TableCell className="capitalize">{session.interview_type}</TableCell>
            <TableCell>{formatDate(session.start_time || session.created_at)}</TableCell>
            <TableCell>{formatDuration(session)}</TableCell>
            {showStatus && <TableCell>{getStatusBadge(session.status)}</TableCell>}
            {showStatus && (
              <TableCell>
                {session.score !== undefined ? (
                  <span className="font-medium">{session.score}%</span>
                ) : (
                  '-'
                )}
              </TableCell>
            )}
            <TableCell className="text-right">
              <Button variant="ghost" size="icon" onClick={() => handleViewSession(session)}>
                <Eye className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Interview Sessions</h1>
            <p className="text-muted-foreground">Monitor live and past interviews.</p>
          </div>
          <Button onClick={fetchSessions} variant="outline" className="gap-2">
            <Radio className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="live">
          <TabsList>
            <TabsTrigger value="live" className="gap-2">
              <Radio className="h-4 w-4" />
              Live Sessions ({liveSessions.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <Clock className="h-4 w-4" />
              History ({historySessions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="mt-4">
            <GlassCard className="p-0 overflow-hidden">
              {isLoading ? (
                <div className="flex h-48 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : liveSessions.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
                  <PlayCircle className="mb-2 h-12 w-12 opacity-50" />
                  <p>No active sessions</p>
                  <p className="text-sm">Live sessions will appear here</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  <SessionsTable sessions={liveSessions} showStatus={false} />
                  {liveTotal > 10 && (
                    <div className="flex justify-center gap-2 p-4 border-t border-border/50 bg-muted/20">
                      <Button variant="outline" disabled={livePage === 1} onClick={() => setLivePage(p => p - 1)}>Previous</Button>
                      <span className="flex items-center px-4">Page {livePage} of {Math.ceil(liveTotal / 10)}</span>
                      <Button variant="outline" disabled={livePage * 10 >= liveTotal} onClick={() => setLivePage(p => p + 1)}>Next</Button>
                    </div>
                  )}
                </div>
              )}
            </GlassCard>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <GlassCard className="p-0 overflow-hidden">
              {isLoading ? (
                <div className="flex h-48 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : historySessions.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
                  <Clock className="mb-2 h-12 w-12 opacity-50" />
                  <p>No session history</p>
                  <p className="text-sm">Completed sessions will appear here</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  <SessionsTable sessions={historySessions} />
                  {historyTotal > 10 && (
                    <div className="flex justify-center gap-2 p-4 border-t border-border/50 bg-muted/20">
                      <Button variant="outline" disabled={historyPage === 1} onClick={() => setHistoryPage(p => p - 1)}>Previous</Button>
                      <span className="flex items-center px-4">Page {historyPage} of {Math.ceil(historyTotal / 10)}</span>
                      <Button variant="outline" disabled={historyPage * 10 >= historyTotal} onClick={() => setHistoryPage(p => p + 1)}>Next</Button>
                    </div>
                  )}
                </div>
              )}
            </GlassCard>
          </TabsContent>
        </Tabs>

        {/* View Session Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Session Details</DialogTitle>
            </DialogHeader>
            {selectedSession && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Candidate</p>
                    <p className="font-medium">{selectedSession.candidate_name || selectedSession.candidate_email || selectedSession.candidate_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Interview Type</p>
                    <p className="font-medium capitalize">{selectedSession.interview_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p>{getStatusBadge(selectedSession.status)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Started</p>
                    <p className="font-medium">{formatDate(selectedSession.start_time || selectedSession.created_at)}</p>
                  </div>
                  {selectedSession.completed_at && (
                    <div>
                      <p className="text-sm text-muted-foreground">Ended</p>
                      <p className="font-medium">{formatDate(selectedSession.completed_at)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-medium">{formatDuration(selectedSession)}</p>
                  </div>
                  {selectedSession.score !== undefined && (
                    <div>
                      <p className="text-sm text-muted-foreground">Overall Score</p>
                      <p className="font-medium text-lg">{selectedSession.score}%</p>
                    </div>
                  )}
                  {selectedSession.progress !== undefined && (
                    <div>
                      <p className="text-sm text-muted-foreground">Progress</p>
                      <p className="font-medium">{selectedSession.current_question}/{selectedSession.total_questions} questions</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
