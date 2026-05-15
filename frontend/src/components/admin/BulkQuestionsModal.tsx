import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface BulkQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (data: any[]) => Promise<void>;
}

export function BulkQuestionsModal({ isOpen, onClose, onUpload }: BulkQuestionsModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>('');
  const [level, setLevel] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast.error('Please attach a CSV or Excel file');
      return;
    }
    if (!category) {
      toast.error('Please select a category');
      return;
    }
    if (!level) {
      toast.error('Please select a difficulty level');
      return;
    }

    setIsUploading(true);
    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });

      // jsonData is an array of arrays. 
      // We expect at least one column (question).
      // If the file has a header row, we might want to skip it if it's "question".
      // Let's just process rows that have text in the first column.
      const parsedQuestions = [];
      
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;
        
        const qText = String(row[0] || '').trim();
        if (!qText || qText.toLowerCase() === 'question' || qText.toLowerCase() === 'title') {
          continue; // Skip empty rows or header rows
        }

        // Col 2 = category, Col 3 = level (optional from file)
        const rowCat = row.length > 1 && row[1] ? String(row[1]).trim().toLowerCase() : category;
        const rowLevel = row.length > 2 && row[2] ? String(row[2]).trim().toLowerCase() : level;

        parsedQuestions.push({
          title: qText,
          description: qText,
          category: rowCat,
          difficulty: rowLevel,
          time_limit: 15, // Default time limit
        });
      }

      if (parsedQuestions.length === 0) {
        toast.error('No valid questions found in the file.');
        setIsUploading(false);
        return;
      }

      await onUpload(parsedQuestions);
      setSelectedFile(null);
      setCategory('');
      setLevel('');
      onClose();
    } catch (error) {
      console.error('Failed to parse Excel file:', error);
      toast.error('Failed to parse the file. Ensure it is a valid CSV/Excel file.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Bulk Upload Questions</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>CSV / Excel File</Label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4 text-muted-foreground" />
                {selectedFile ? selectedFile.name : 'Select file...'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Columns: 1st Question (required), 2nd Category (optional), 3rd Level (optional)
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Global Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="behavioral">Behavioral</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
                <SelectItem value="soft_skills">Soft Skills</SelectItem>
                <SelectItem value="industry">Industry Knowledge</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Global Level *</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Select level..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isUploading || !selectedFile || !category || !level}>
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload Database
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
