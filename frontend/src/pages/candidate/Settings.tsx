import { useState, useEffect } from 'react';
import { CandidateLayout } from '@/components/layouts/CandidateLayout';
import { GlassCard } from '@/components/shared/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '@/lib/api';
import { motion } from 'framer-motion';
import { 
  Lock, 
  Mail, 
  Bell, 
  Trash2, 
  Loader2,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function CandidateSettings() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading, signOut } = useAuth();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  const [emailForm, setEmailForm] = useState({
    newEmail: '',
  });

  const [notifications, setNotifications] = useState({
    email: true,
    interviewReminders: true,
    reportReady: true,
    recommendations: false,
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Load notification preferences from DB
  useEffect(() => {
    if (user && isAuthenticated) {
      loadNotificationPreferences();
    }
  }, [user, isAuthenticated]);

  const loadNotificationPreferences = async () => {
    try {
      const prefs = await userAPI.getNotificationPreferences();
      if (prefs) {
        setNotifications({
          email: prefs.email ?? true,
          interviewReminders: prefs.interviewReminders ?? true,
          reportReady: prefs.reportReady ?? true,
          recommendations: prefs.recommendations ?? false,
        });
      }
    } catch (e) {
      // Use defaults if API fails (first-time user)
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordForm.new.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (!/[A-Z]/.test(passwordForm.new)) {
      toast.error('Password must contain at least one uppercase letter');
      return;
    }

    if (!/[a-z]/.test(passwordForm.new)) {
      toast.error('Password must contain at least one lowercase letter');
      return;
    }

    if (!/[0-9]/.test(passwordForm.new)) {
      toast.error('Password must contain at least one number');
      return;
    }

    if (!/[!@#$%^&*]/.test(passwordForm.new)) {
      toast.error('Password must contain at least one special character (!@#$%^&*)');
      return;
    }

    setIsChangingPassword(true);

    try {
      await userAPI.changePassword({
        current_password: passwordForm.current,
        new_password: passwordForm.new,
        confirm_password: passwordForm.confirm,
      });

      toast.success('Password updated successfully');
      setPasswordForm({ current: '', new: '', confirm: '' });
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.message || 'Failed to update password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!emailForm.newEmail) {
      toast.error('Please enter a new email address');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForm.newEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (emailForm.newEmail.toLowerCase() === user?.email?.toLowerCase()) {
      toast.error('New email is the same as your current email');
      return;
    }

    setIsUpdatingEmail(true);

    try {
      await userAPI.updateEmail(emailForm.newEmail);
      toast.success('Email updated successfully. Please log in again with your new email.');
      setEmailForm({ newEmail: '' });
      // Sign out so user logs in with new email
      setTimeout(async () => {
        await signOut();
        navigate('/auth');
      }, 2000);
    } catch (error: any) {
      console.error('Error updating email:', error);
      toast.error(error.message || 'Failed to update email');
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleNotificationChange = async (key: string, checked: boolean) => {
    const updated = { ...notifications, [key]: checked };
    setNotifications(updated);
    setIsSavingNotifications(true);

    try {
      await userAPI.updateNotificationPreferences(updated);
      toast.success('Notification preferences saved');
    } catch (error: any) {
      // Revert on failure
      setNotifications(notifications);
      toast.error('Failed to save notification preferences');
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    
    try {
      await userAPI.deleteAccount('User requested account deletion');
      await signOut();
      toast.success('Account deleted successfully');
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
      setIsDeleting(false);
    }
  };

  return (
    <CandidateLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences.</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Password Change */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <GlassCard className="p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Change Password</h2>
                  <p className="text-sm text-muted-foreground">Update your account password</p>
                </div>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPass ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pr-10"
                      value={passwordForm.current}
                      onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                      required
                    />
                    <button type="button" tabIndex={-1} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors" onClick={() => setShowCurrentPass(!showCurrentPass)}>
                      {showCurrentPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPass ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pr-10"
                      value={passwordForm.new}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                      required
                      minLength={8}
                    />
                    <button type="button" tabIndex={-1} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors" onClick={() => setShowNewPass(!showNewPass)}>
                      {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPass ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pr-10"
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                      required
                    />
                    <button type="button" tabIndex={-1} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors" onClick={() => setShowConfirmPass(!showConfirmPass)}>
                      {showConfirmPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="btn-primary w-full"
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Update Password
                    </>
                  )}
                </Button>
              </form>
            </GlassCard>
          </motion.div>

          {/* Notifications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <GlassCard className="p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Notifications</h2>
                  <p className="text-sm text-muted-foreground">Manage your notification preferences</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive emails about your account</p>
                  </div>
                  <Switch
                    checked={notifications.email}
                    onCheckedChange={(checked) => handleNotificationChange('email', checked)}
                    disabled={isSavingNotifications}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Interview Reminders</p>
                    <p className="text-sm text-muted-foreground">Get reminded about scheduled interviews</p>
                  </div>
                  <Switch
                    checked={notifications.interviewReminders}
                    onCheckedChange={(checked) => handleNotificationChange('interviewReminders', checked)}
                    disabled={isSavingNotifications}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Report Ready</p>
                    <p className="text-sm text-muted-foreground">Notify when interview reports are available</p>
                  </div>
                  <Switch
                    checked={notifications.reportReady}
                    onCheckedChange={(checked) => handleNotificationChange('reportReady', checked)}
                    disabled={isSavingNotifications}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Course Recommendations</p>
                    <p className="text-sm text-muted-foreground">Get notified about new recommended courses</p>
                  </div>
                  <Switch
                    checked={notifications.recommendations}
                    onCheckedChange={(checked) => handleNotificationChange('recommendations', checked)}
                    disabled={isSavingNotifications}
                  />
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Email Change */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <GlassCard className="p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Email Address</h2>
                  <p className="text-sm text-muted-foreground">Update your account email</p>
                </div>
              </div>

              <form onSubmit={handleEmailChange} className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Email</Label>
                  <Input value={user?.email || ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-email">New Email Address</Label>
                  <Input
                    id="new-email"
                    type="email"
                    placeholder="newemail@example.com"
                    value={emailForm.newEmail}
                    onChange={(e) => setEmailForm({ newEmail: e.target.value })}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  You will be signed out after changing your email. Please log in again with your new email.
                </p>
                <Button 
                  type="submit" 
                  className="btn-primary w-full"
                  disabled={isUpdatingEmail}
                >
                  {isUpdatingEmail ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Update Email
                    </>
                  )}
                </Button>
              </form>
            </GlassCard>
          </motion.div>

          {/* Delete Account */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <GlassCard className="border-destructive/50 p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-lg bg-destructive/10 p-2">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-destructive">Delete your account</h2>
                  <p className="text-sm text-muted-foreground">Permanently remove your account and all data</p>
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your account
                      and remove all your data including interview history, reports, and profile information.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        'Delete Account'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </CandidateLayout>
  );
}
