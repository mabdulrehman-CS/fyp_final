import { useEffect, useState, useCallback } from 'react';
import { CandidateLayout } from '@/components/layouts/CandidateLayout';
import { GlassCard } from '@/components/shared/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { userAPI, User } from '@/lib/api';
import { motion } from 'framer-motion';
import { 
  User as UserIcon, 
  Mail, 
  Phone, 
  Upload, 
  FileText, 
  Loader2,
  Check,
  Sparkles,
  GraduationCap,
  Briefcase,
  FolderGit2,
  Wrench,
  MapPin,
  Linkedin,
  Github
} from 'lucide-react';
import { toast } from 'sonner';

export default function CandidateProfile() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading, refreshUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    bio: '',
    location: '',
    linkedin: '',
    github: '',
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (user && isAuthenticated) {
      setForm({
        full_name: user.profile_info?.name || '',
        phone: user.profile_info?.phone || '',
        bio: user.profile_info?.bio || '',
        location: user.profile_info?.location || '',
        linkedin: user.profile_info?.linkedin || '',
        github: user.profile_info?.github || '',
      });
      setIsLoading(false);
    }
  }, [user, isAuthenticated]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await userAPI.updateMe({
        profile_info: {
          ...user?.profile_info,
          name: form.full_name,
          phone: form.phone,
          bio: form.bio,
          location: form.location,
          linkedin: form.linkedin,
          github: form.github,
        },
      });
      toast.success('Profile updated successfully!');
      await refreshUser();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    await handleFileUpload(file);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFileUpload(file);
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.includes('pdf') && !file.type.includes('document')) {
      toast.error('Please upload a PDF or Word document');
      return;
    }
    setIsParsing(true);
    toast.info('Uploading and parsing your CV with AI...');
    try {
      const result = await userAPI.uploadCV(file);
      if (result.parsed && result.parsed_data) {
        const pd = result.parsed_data;
        const summary = [
          pd.name ? `Name: ${pd.name}` : '',
          pd.skills?.length ? `${pd.skills.length} skills` : '',
          pd.education?.length ? `${pd.education.length} education entries` : '',
          pd.work_experience?.length ? `${pd.work_experience.length} experiences` : '',
          pd.projects?.length ? `${pd.projects.length} projects` : '',
        ].filter(Boolean).join(', ');
        toast.success(`CV parsed! ${summary}`);
      } else {
        toast.success('CV uploaded successfully!');
      }
      await refreshUser();
    } catch (error: any) {
      console.error('Error parsing CV:', error);
      toast.error(error?.message || 'Failed to parse CV');
    } finally {
      setIsParsing(false);
    }
  };

  if (isLoading || authLoading) {
    return (
      <CandidateLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </CandidateLayout>
    );
  }

  const p = user?.profile_info;
  const skills = p?.skills || [];
  const education = p?.education || [];
  const workExperience = p?.work_experience || [];
  const projects = p?.projects || [];
  const hasCv = !!p?.cv_filename;

  return (
    <CandidateLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground">Manage your personal information and CV. Upload your CV to auto-fill.</p>
        </div>

        {/* CV Upload — top priority */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard className="p-6">
            <h2 className="mb-4 text-xl font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              CV / Resume
              {hasCv && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Uploaded</span>}
            </h2>
            {hasCv && (
              <div className="mb-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>{p?.cv_original_name || 'CV uploaded'}</span>
                <span className="text-xs">— {p?.cv_uploaded_at ? new Date(p.cv_uploaded_at).toLocaleDateString() : ''}</span>
              </div>
            )}
            <div
              className={`relative rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                isDragging ? 'border-primary bg-primary/10' : 'border-muted hover:border-muted-foreground/50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
            >
              {isParsing ? (
                <div className="space-y-3">
                  <Sparkles className="mx-auto h-10 w-10 animate-pulse text-primary" />
                  <p className="font-medium">AI is parsing your CV...</p>
                  <p className="text-sm text-muted-foreground">Extracting skills, education, experience, and projects</p>
                  <div className="mx-auto h-2 w-48 overflow-hidden rounded-full bg-muted">
                    <motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 3 }} />
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="mb-1 font-medium">{hasCv ? 'Upload a new CV to replace' : 'Upload your CV'}</p>
                  <p className="mb-3 text-sm text-muted-foreground">PDF or Word — AI will extract all sections</p>
                  <input type="file" accept=".pdf,.doc,.docx" className="absolute inset-0 cursor-pointer opacity-0" onChange={handleFileSelect} />
                  <Button variant="outline" className="pointer-events-none">
                    <FileText className="mr-2 h-4 w-4" /> Select File
                  </Button>
                </>
              )}
            </div>
          </GlassCard>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Personal Info */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <GlassCard className="p-6">
              <h2 className="mb-6 text-xl font-semibold flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-primary" /> Personal Information
              </h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="name" placeholder="Your full name" className="pl-10" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" className="pl-10" value={user?.email || ''} disabled />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="phone" type="tel" placeholder="+1 555 000" className="pl-10" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="location" placeholder="City, Country" className="pl-10" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="linkedin">LinkedIn</Label>
                    <div className="relative">
                      <Linkedin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="linkedin" placeholder="linkedin.com/in/..." className="pl-10" value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="github">GitHub</Label>
                    <div className="relative">
                      <Github className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="github" placeholder="github.com/..." className="pl-10" value={form.github} onChange={(e) => setForm({ ...form, github: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea id="bio" placeholder="Professional summary..." rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
                </div>
                <Button className="btn-primary w-full" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Check className="mr-2 h-4 w-4" /> Save Changes</>}
                </Button>
              </div>
            </GlassCard>
          </motion.div>

          {/* Skills Section */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <GlassCard className="p-6">
              <h2 className="mb-4 text-xl font-semibold flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" /> Skills
                {skills.length > 0 && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{skills.length}</span>}
              </h2>
              {skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill: string, i: number) => (
                    <motion.span key={skill + i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
                      className="rounded-full bg-primary/15 border border-primary/20 px-3 py-1.5 text-sm font-medium text-primary">
                      {skill}
                    </motion.span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Upload your CV to auto-extract skills.</p>
              )}
            </GlassCard>

            {/* Education Section */}
            <GlassCard className="p-6 mt-6">
              <h2 className="mb-4 text-xl font-semibold flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" /> Education
                {education.length > 0 && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{education.length}</span>}
              </h2>
              {education.length > 0 ? (
                <div className="space-y-3">
                  {education.map((edu: any, i: number) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                      className="p-3 rounded-lg bg-muted/30 border border-muted">
                      <p className="font-medium text-sm">{edu.degree || ''} {edu.field ? `in ${edu.field}` : ''}</p>
                      <p className="text-sm text-muted-foreground">{edu.institution || ''}</p>
                      {(edu.start_date || edu.end_date) && (
                        <p className="text-xs text-muted-foreground mt-1">{edu.start_date || ''} — {edu.end_date || 'Present'}</p>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Upload your CV to auto-extract education.</p>
              )}
            </GlassCard>
          </motion.div>
        </div>

        {/* Experience & Projects — full width */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Work Experience */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <GlassCard className="p-6">
              <h2 className="mb-4 text-xl font-semibold flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" /> Work Experience
                {workExperience.length > 0 && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{workExperience.length}</span>}
              </h2>
              {workExperience.length > 0 ? (
                <div className="space-y-3">
                  {workExperience.map((exp: any, i: number) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                      className="p-3 rounded-lg bg-muted/30 border border-muted">
                      <p className="font-medium text-sm">{exp.title || 'Position'}</p>
                      <p className="text-sm text-muted-foreground">{exp.company || ''} {exp.location ? `· ${exp.location}` : ''}</p>
                      {exp.description && <p className="text-xs text-muted-foreground mt-1">{exp.description}</p>}
                      {(exp.start_date || exp.end_date) && (
                        <p className="text-xs text-muted-foreground mt-1">{exp.start_date || ''} — {exp.end_date || 'Present'}</p>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Upload your CV to auto-extract work experience.</p>
              )}
            </GlassCard>
          </motion.div>

          {/* Projects */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <GlassCard className="p-6">
              <h2 className="mb-4 text-xl font-semibold flex items-center gap-2">
                <FolderGit2 className="h-5 w-5 text-primary" /> Projects
                {projects.length > 0 && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{projects.length}</span>}
              </h2>
              {projects.length > 0 ? (
                <div className="space-y-3">
                  {projects.map((proj: any, i: number) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                      className="p-3 rounded-lg bg-muted/30 border border-muted">
                      <p className="font-medium text-sm">{proj.title || 'Project'}</p>
                      {proj.description && <p className="text-xs text-muted-foreground mt-1">{proj.description}</p>}
                      {proj.technologies && <p className="text-xs text-primary mt-1">Tech: {proj.technologies}</p>}
                      {proj.github_url && (
                        <a href={proj.github_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline mt-1 block">{proj.github_url}</a>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Upload your CV to auto-extract projects.</p>
              )}
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </CandidateLayout>
  );
}
