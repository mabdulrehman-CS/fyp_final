import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { GlassCard } from '@/components/shared/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
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
import { adminAPI, Rubric } from '@/lib/api';
import { Sliders, Plus, Edit, Trash2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminRubrics() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isLoading: authLoading } = useAuth();
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRubric, setEditingRubric] = useState<Rubric | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [form, setForm] = useState({
    name: '',
    weight: 1,
    description: '',
  });

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      navigate('/admin/login');
    }
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchRubrics();
    }
  }, [isAuthenticated, isAdmin]);

  const fetchRubrics = async () => {
    try {
      const data = await adminAPI.getRubrics();
      setRubrics(data);
    } catch (error) {
      console.error('Error fetching rubrics:', error);
      toast.error('Failed to load rubrics');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingRubric(null);
    setEditingIndex(null);
    setForm({ name: '', weight: 1, description: '' });
    setIsDialogOpen(true);
  };

  const handleEdit = (rubric: Rubric, index: number) => {
    setEditingRubric(rubric);
    setEditingIndex(index);
    setForm({
      name: rubric.name,
      weight: rubric.weight,
      description: rubric.description || '',
    });
    setIsDialogOpen(true);
  };

  const handleSaveRubric = () => {
    if (!form.name) {
      toast.error('Please enter a rubric name');
      return;
    }

    const newRubric: Rubric = {
      id: editingRubric?.id || `rubric_${Date.now()}`,
      name: form.name,
      weight: form.weight,
      description: form.description,
    };

    let updatedRubrics: Rubric[];
    if (editingIndex !== null) {
      updatedRubrics = [...rubrics];
      updatedRubrics[editingIndex] = newRubric;
    } else {
      updatedRubrics = [...rubrics, newRubric];
    }

    setRubrics(updatedRubrics);
    setIsDialogOpen(false);
    toast.success(editingRubric ? 'Rubric updated' : 'Rubric added');
  };

  const handleDelete = (index: number) => {
    const updatedRubrics = rubrics.filter((_, i) => i !== index);
    setRubrics(updatedRubrics);
    toast.success('Rubric removed');
  };

  const totalWeight = rubrics.reduce((sum, r) => sum + r.weight, 0);

  const handleSaveAll = async () => {
    if (totalWeight !== 100) {
      toast.error(`Total weight must be exactly 100%. Current: ${totalWeight}%`);
      return;
    }

    setIsSaving(true);
    try {
      await adminAPI.updateRubrics(rubrics);
      toast.success('Rubrics saved successfully');
    } catch (error) {
      console.error('Error saving rubrics:', error);
      toast.error('Failed to save rubrics');
    } finally {
      setIsSaving(false);
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

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Rubrics</h1>
            <p className="text-muted-foreground">Configure scoring rubrics for interviews.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Rubric
            </Button>
            <Button onClick={handleSaveAll} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        {/* Weight Summary */}
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Weight:</span>
            <span className={`font-medium ${totalWeight !== 100 ? 'text-warning' : 'text-success'}`}>
              {totalWeight}% {totalWeight !== 100 && '(Recommended: 100%)'}
            </span>
          </div>
        </GlassCard>

        {/* Rubrics Table */}
        <GlassCard className="p-0 overflow-hidden">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : rubrics.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
              <Sliders className="mb-2 h-12 w-12 opacity-50" />
              <p>No rubrics configured</p>
              <p className="text-sm">Add your first scoring rubric</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rubrics.map((rubric, index) => (
                  <TableRow key={rubric.id}>
                    <TableCell className="font-medium">{rubric.name}</TableCell>
                    <TableCell>{rubric.weight}%</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {rubric.description || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(rubric, index)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </GlassCard>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRubric ? 'Edit Rubric' : 'Add New Rubric'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Problem Solving"
                />
              </div>
              <div className="space-y-2">
                <Label>Weight: {form.weight}%</Label>
                <Slider
                  value={[form.weight]}
                  onValueChange={([value]) => setForm({ ...form, weight: value })}
                  min={1}
                  max={100}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe what this rubric evaluates..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRubric}>
                {editingRubric ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
