import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { GlassCard } from '@/components/shared/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { adminAPI, Settings as SettingsType, PasswordChangeRequest } from '@/lib/api';
import { Settings as SettingsIcon, Loader2, Save, Key } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSettings() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isLoading: authLoading } = useAuth();
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [thresholds, setThresholds] = useState({
    passingThresholdCoding: 70,
    passingThresholdBehavioral: 70,
    passingThresholdTechnical: 70,
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      navigate('/admin/login');
    }
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchSettings();
    }
  }, [isAuthenticated, isAdmin]);

  const fetchSettings = async () => {
    try {
      const data = await adminAPI.getSettings();
      setSettings(data);
      setThresholds({
        passingThresholdCoding: data.passingThresholdCoding || 70,
        passingThresholdBehavioral: data.passingThresholdBehavioral || 70,
        passingThresholdTechnical: data.passingThresholdTechnical || 70,
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
      // Initialize with defaults if settings don't exist
      setThresholds({
        passingThresholdCoding: 70,
        passingThresholdBehavioral: 70,
        passingThresholdTechnical: 70,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await adminAPI.updateSettings(thresholds);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordForm.new_password.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      await adminAPI.changePassword(passwordForm as PasswordChangeRequest);
      toast.success('Password changed successfully');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('Failed to change password');
    } finally {
      setIsChangingPassword(false);
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
          <h1 className="text-3xl font-bold">Admin Settings</h1>
          <p className="text-muted-foreground">Platform configuration and account settings.</p>
        </div>

        {/* Passing Thresholds */}
        <GlassCard className="p-6">
          <h2 className="text-xl font-semibold mb-4">Passing Thresholds</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Set the minimum passing scores for each interview type.
          </p>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Coding Interview</Label>
                <span className="font-medium">{thresholds.passingThresholdCoding}%</span>
              </div>
              <Slider
                value={[thresholds.passingThresholdCoding]}
                onValueChange={([value]) => setThresholds({ ...thresholds, passingThresholdCoding: value })}
                min={0}
                max={100}
                step={5}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Behavioral Interview</Label>
                <span className="font-medium">{thresholds.passingThresholdBehavioral}%</span>
              </div>
              <Slider
                value={[thresholds.passingThresholdBehavioral]}
                onValueChange={([value]) => setThresholds({ ...thresholds, passingThresholdBehavioral: value })}
                min={0}
                max={100}
                step={5}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Technical Interview</Label>
                <span className="font-medium">{thresholds.passingThresholdTechnical}%</span>
              </div>
              <Slider
                value={[thresholds.passingThresholdTechnical]}
                onValueChange={([value]) => setThresholds({ ...thresholds, passingThresholdTechnical: value })}
                min={0}
                max={100}
                step={5}
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={handleSaveSettings} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Thresholds
            </Button>
          </div>
        </GlassCard>

        {/* Change Password */}
        <GlassCard className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Key className="h-5 w-5" />
            Change Password
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Update your admin account password.
          </p>
          <div className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="current_password">Current Password</Label>
              <Input
                id="current_password"
                type="password"
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                placeholder="Enter current password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_password">New Password</Label>
              <Input
                id="new_password"
                type="password"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm New Password</Label>
              <Input
                id="confirm_password"
                type="password"
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                placeholder="Confirm new password"
              />
            </div>
            <Button onClick={handleChangePassword} disabled={isChangingPassword} className="gap-2">
              {isChangingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Changing...
                </>
              ) : (
                'Change Password'
              )}
            </Button>
          </div>
        </GlassCard>
      </div>
    </AdminLayout>
  );
}
