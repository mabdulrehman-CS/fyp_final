import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { GlassCard } from '@/components/shared/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { adminAPI } from '@/lib/api';
import { Users, Search, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface Candidate {
  id: string;
  email: string;
  full_name: string;
  status: string;
  role: string;
  created_at: string;
  profile_info?: {
    phone?: string;
    skills?: string[];
  };
  sessionsCount?: number;
  avgScore?: number;
  lastInterview?: string;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isLoading: authLoading } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      navigate('/admin/login');
    }
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchCandidates();
    }
  }, [isAuthenticated, isAdmin]);

  useEffect(() => {
    filterCandidates();
  }, [candidates, searchTerm]);

  const fetchCandidates = async () => {
    try {
      const data = await adminAPI.getCandidates();
      setCandidates(data);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      toast.error('Failed to load candidates');
    } finally {
      setIsLoading(false);
    }
  };

  const filterCandidates = () => {
    let filtered = [...candidates];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.full_name.toLowerCase().includes(term) ||
          c.email.toLowerCase().includes(term)
      );
    }

    setFilteredCandidates(filtered);
    setPage(1); // Reset page on filter change
  };

  const handleViewCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setIsViewDialogOpen(true);
  };

  const handleStatusChange = async (candidateId: string, newStatus: 'approved' | 'rejected') => {
    setIsUpdating(candidateId);
    try {
      await adminAPI.updateCandidateStatus(candidateId, newStatus);
      toast.success(`Candidate ${newStatus} successfully`);
      fetchCandidates();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setIsUpdating(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-success/20 text-success">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-destructive/20 text-destructive">Rejected</Badge>;
      default:
        return <Badge className="bg-warning/20 text-warning">Pending</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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

  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const paginatedCandidates = filteredCandidates.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage platform users and candidates.</p>
        </div>

        {/* Filters */}
        <GlassCard className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </GlassCard>

        {/* Users Table */}
        <GlassCard className="p-0 overflow-hidden">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
              <Users className="mb-2 h-12 w-12 opacity-50" />
              <p>No users found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-center">Sessions</TableHead>
                  <TableHead className="text-center">Avg Score</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCandidates.map((candidate) => (
                  <TableRow key={candidate.id}>
                    <TableCell className="font-medium">{candidate.full_name}</TableCell>
                    <TableCell>{candidate.email}</TableCell>
                    <TableCell>{formatDate(candidate.created_at)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono">
                        {candidate.sessionsCount || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {candidate.avgScore ? (
                        <span className="font-medium text-primary">{Math.round(candidate.avgScore)}%</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewCandidate(candidate)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {filteredCandidates.length > ITEMS_PER_PAGE && (
            <div className="flex justify-center gap-2 p-4 border-t border-border/50 bg-muted/20">
              <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="flex items-center px-4">Page {page} of {Math.ceil(filteredCandidates.length / ITEMS_PER_PAGE)}</span>
              <Button variant="outline" disabled={page * ITEMS_PER_PAGE >= filteredCandidates.length} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </GlassCard>

        {/* View Candidate Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Candidate Details</DialogTitle>
            </DialogHeader>
            {selectedCandidate && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{selectedCandidate.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedCandidate.email}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Joined</p>
                    <p className="font-medium">{formatDate(selectedCandidate.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Sessions</p>
                    <p className="font-medium">{selectedCandidate.sessionsCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Average Score</p>
                    <p className="font-medium">
                      {selectedCandidate.avgScore ? `${Math.round(selectedCandidate.avgScore)}%` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Interview</p>
                    <p className="font-medium">
                      {selectedCandidate.lastInterview ? formatDate(selectedCandidate.lastInterview) : 'Never'}
                    </p>
                  </div>
                  {selectedCandidate.profile_info?.phone && (
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{selectedCandidate.profile_info.phone}</p>
                    </div>
                  )}
                  {selectedCandidate.profile_info?.skills && selectedCandidate.profile_info.skills.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground mb-2">Skills</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedCandidate.profile_info.skills.map((skill, idx) => (
                          <Badge key={idx} variant="secondary">{skill}</Badge>
                        ))}
                      </div>
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
