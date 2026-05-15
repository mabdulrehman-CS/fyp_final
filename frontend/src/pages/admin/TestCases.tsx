import React, { useEffect, useState, useRef } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { GlassCard } from '@/components/shared/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { testCasesAPI, questionsAPI, TestCase, Question } from '@/lib/api';
import { FileCode, Plus, Edit, Trash2, Loader2, Search, Upload } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminTestCases() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isLoading: authLoading } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<string>('');
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [form, setForm] = useState({
    input: '',
    output: '',
    is_hidden: false,
  });

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      navigate('/admin/login');
    }
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchQuestions();
    }
  }, [isAuthenticated, isAdmin]);

  useEffect(() => {
    if (selectedQuestion) {
      setPage(1); // Reset page on question change
      fetchTestCases();
    }
  }, [selectedQuestion]);

  const fetchQuestions = async () => {
    try {
      // Fetch coding problems (test cases are linked to coding problems, not questions)
      const problems = await testCasesAPI.listCodingProblems();
      // Map to Question interface for dropdown compatibility
      const mapped = problems.map((p: any) => ({
        id: p.id,
        title: p.title || p.description?.substring(0, 80) || 'Unnamed Problem',
        category: 'Coding',
        difficulty: p.difficulty || 'medium',
        description: p.description || '',
        created_at: p.created_at || '',
      }));
      setQuestions(mapped);
      if (mapped.length > 0) {
        setSelectedQuestion(mapped[0].id);
      }
    } catch (error) {
      console.error('Error fetching coding problems:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTestCases = async () => {
    try {
      const data = await testCasesAPI.listForQuestion(selectedQuestion);
      setTestCases(data);
    } catch (error) {
      console.error('Error fetching test cases:', error);
    }
  };

  const handleCreate = () => {
    setEditingTestCase(null);
    setForm({ input: '', output: '', is_hidden: false });
    setIsDialogOpen(true);
  };

  const handleEdit = (testCase: TestCase) => {
    setEditingTestCase(testCase);
    setForm({
      input: testCase.input,
      output: testCase.output,
      is_hidden: testCase.is_hidden,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.input || !form.output) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      if (editingTestCase) {
        await testCasesAPI.update(editingTestCase.id, form);
        toast.success('Test case updated successfully');
      } else {
        await testCasesAPI.create({
          question_id: selectedQuestion,
          ...form,
        });
        toast.success('Test case created successfully');
      }
      setIsDialogOpen(false);
      fetchTestCases();
    } catch (error) {
      console.error('Error saving test case:', error);
      toast.error('Failed to save test case');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    try {
      await testCasesAPI.delete(id);
      toast.success('Test case deleted successfully');
      fetchTestCases();
    } catch (error) {
      console.error('Error deleting test case:', error);
      toast.error('Failed to delete test case');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedQuestion) {
      toast.error('Please select a question first');
      return;
    }

    setIsUploading(true);
    try {
      const text = await file.text();
      let data: any[];
      try {
        data = JSON.parse(text);
        if (!Array.isArray(data)) throw new Error('Root must be an array');
      } catch (err) {
        toast.error('Invalid JSON file format. Must be an array of test cases.');
        return;
      }

      const payload = data.map(tc => ({
        question_id: selectedQuestion,
        input: tc.input || '',
        output: tc.output || tc.expected_output || '',
        is_hidden: tc.is_hidden || false
      }));

      await testCasesAPI.createBulk(payload);
      toast.success(`Successfully uploaded ${payload.length} test cases`);
      fetchTestCases();
    } catch (error) {
      console.error('Error uploading test cases:', error);
      toast.error('Failed to upload test cases');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const paginatedTestCases = testCases.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Test Cases</h1>
            <p className="text-muted-foreground">Manage coding test cases.</p>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              accept=".json"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || !selectedQuestion}
              className="gap-2"
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Bulk Upload
            </Button>
            <Button onClick={handleCreate} disabled={!selectedQuestion} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Test Case
            </Button>
          </div>
        </div>

        {/* Question Selector */}
        <GlassCard className="p-4">
          <div className="flex items-center gap-4">
            <Label className="whitespace-nowrap">Select Question:</Label>
            <Select value={selectedQuestion} onValueChange={setSelectedQuestion}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select a question" />
              </SelectTrigger>
              <SelectContent>
                {questions.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </GlassCard>

        {/* Test Cases Table */}
        <GlassCard className="p-0 overflow-hidden">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !selectedQuestion ? (
            <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
              <FileCode className="mb-2 h-12 w-12 opacity-50" />
              <p>Select a question to view test cases</p>
            </div>
          ) : testCases.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
              <FileCode className="mb-2 h-12 w-12 opacity-50" />
              <p>No test cases found</p>
              <p className="text-sm">Add your first test case for this question</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Input</TableHead>
                  <TableHead>Expected Output</TableHead>
                  <TableHead>Hidden</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTestCases.map((tc) => (
                  <TableRow key={tc.id}>
                    <TableCell className="font-mono text-sm max-w-xs truncate">
                      {tc.input}
                    </TableCell>
                    <TableCell className="font-mono text-sm max-w-xs truncate">
                      {tc.output}
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                        tc.is_hidden ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'
                      }`}>
                        {tc.is_hidden ? 'Hidden' : 'Visible'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(tc)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(tc.id)}
                        disabled={isDeleting === tc.id}
                      >
                        {isDeleting === tc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {testCases.length > ITEMS_PER_PAGE && (
            <div className="flex justify-center gap-2 p-4 border-t border-border/50 bg-muted/20">
              <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="flex items-center px-4">Page {page} of {Math.ceil(testCases.length / ITEMS_PER_PAGE)}</span>
              <Button variant="outline" disabled={page * ITEMS_PER_PAGE >= testCases.length} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </GlassCard>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTestCase ? 'Edit Test Case' : 'Add New Test Case'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="input">Input *</Label>
                <Textarea
                  id="input"
                  value={form.input}
                  onChange={(e) => setForm({ ...form, input: e.target.value })}
                  placeholder="Test input"
                  rows={3}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="output">Expected Output *</Label>
                <Textarea
                  id="output"
                  value={form.output}
                  onChange={(e) => setForm({ ...form, output: e.target.value })}
                  placeholder="Expected output"
                  rows={3}
                  className="font-mono"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Hidden Test Case</Label>
                  <p className="text-sm text-muted-foreground">
                    Hidden test cases are not shown to candidates
                  </p>
                </div>
                <Switch
                  checked={form.is_hidden}
                  onCheckedChange={(checked) => setForm({ ...form, is_hidden: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingTestCase ? 'Update' : 'Create'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
