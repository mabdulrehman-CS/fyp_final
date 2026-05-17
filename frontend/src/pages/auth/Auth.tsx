import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, ArrowLeft, Loader2, ShieldCheck, RefreshCw, Eye, EyeOff, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { authAPI } from '@/lib/api';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '';

async function callApi(path: string, body: object) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Request failed');
  return data;
}

// ── Password Input with Show/Hide toggle (defined outside Auth to avoid re-mount on each render) ──
function PasswordInput({ 
  id, placeholder, value, onChange, show, onToggle, minLength 
}: { 
  id: string; placeholder: string; value: string; 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  show: boolean; onToggle: () => void; minLength?: number;
}) {
  return (
    <div className="relative">
      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        className="pl-10 pr-10"
        value={value}
        onChange={onChange}
        required
        minLength={minLength}
      />
      <button
        type="button"
        tabIndex={-1}
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
        onClick={onToggle}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');

  // Login form
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Signup form
  const [signupForm, setSignupForm] = useState({ email: '', password: '', fullName: '' });
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // OTP verification state (signup)
  const [showOTP, setShowOTP] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resending, setResending] = useState(false);

  // Forgot password state
  type ForgotStep = 'email' | 'otp' | 'newpass';
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPass, setShowForgotNewPass] = useState(false);
  const [showForgotConfirmPass, setShowForgotConfirmPass] = useState(false);
  const [forgotResending, setForgotResending] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(loginForm.email, loginForm.password);
    if (error) {
      toast.error(error.message || 'Failed to sign in');
      setIsLoading(false);
      return;
    }
    toast.success('Welcome back!');
    navigate('/candidate/dashboard');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (signupForm.password.length < 8) {
      toast.error('Password must be at least 8 characters'); setIsLoading(false); return;
    }
    if (!/[A-Z]/.test(signupForm.password)) {
      toast.error('Password needs at least one uppercase letter'); setIsLoading(false); return;
    }
    if (!/[a-z]/.test(signupForm.password)) {
      toast.error('Password needs at least one lowercase letter'); setIsLoading(false); return;
    }
    if (!/[0-9]/.test(signupForm.password)) {
      toast.error('Password needs at least one number'); setIsLoading(false); return;
    }
    if (!/[!@#$%^&*]/.test(signupForm.password)) {
      toast.error('Password needs at least one special character (!@#$%^&*)'); setIsLoading(false); return;
    }

    const { error } = await signUp(signupForm.email, signupForm.password, signupForm.fullName);
    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('This email is already registered. Please sign in instead.');
      } else {
        toast.error(error.message || 'Failed to create account');
      }
      setIsLoading(false);
      return;
    }

    toast.success('Account created! Check your email for a verification code.');
    setOtpEmail(signupForm.email);
    setShowOTP(true);
    setIsLoading(false);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error('Please enter the 6-digit code from your email.');
      return;
    }
    setIsLoading(true);
    try {
      const result = await callApi('/auth/verify-signup-otp', { email: otpEmail, otp });
      if (result.access_token) {
        localStorage.setItem('auth_token', result.access_token);
        window.dispatchEvent(new CustomEvent('auth:token', { detail: result.access_token }));
      }
      toast.success('Email verified! Welcome to IntraView AI 🎉');
      navigate('/candidate/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Verification failed');
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setResending(true);
    try {
      await callApi('/auth/send-signup-otp', { email: otpEmail });
      toast.success('New verification code sent to your email.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  // ── Forgot Password Handlers ──
  const handleForgotSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) { toast.error('Please enter your email'); return; }
    setIsLoading(true);
    try {
      await authAPI.forgotPassword(forgotEmail);
      toast.success('Verification code sent to your email!');
      setForgotStep('otp');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reset code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotOtp.length !== 6) { toast.error('Enter the 6-digit code'); return; }
    setIsLoading(true);
    try {
      // If the API call succeeds (no exception), the OTP is valid
      await authAPI.verifyResetOTP(forgotEmail, forgotOtp);
      toast.success('Code verified! Set your new password.');
      setForgotStep('newpass');
    } catch (err: any) {
      toast.error(err.message || 'Invalid or expired code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotNewPassword !== forgotConfirmPassword) {
      toast.error('Passwords do not match'); return;
    }
    if (forgotNewPassword.length < 8) {
      toast.error('Password must be at least 8 characters'); return;
    }
    if (!/[A-Z]/.test(forgotNewPassword)) {
      toast.error('Password needs at least one uppercase letter'); return;
    }
    if (!/[a-z]/.test(forgotNewPassword)) {
      toast.error('Password needs at least one lowercase letter'); return;
    }
    if (!/[0-9]/.test(forgotNewPassword)) {
      toast.error('Password needs at least one number'); return;
    }
    if (!/[!@#$%^&*]/.test(forgotNewPassword)) {
      toast.error('Password needs at least one special character (!@#$%^&*)'); return;
    }

    setIsLoading(true);
    try {
      await authAPI.resetPassword(forgotEmail, forgotOtp, forgotNewPassword);
      toast.success('Password reset successfully! Please sign in.');
      // Reset all forgot state
      setShowForgot(false);
      setForgotStep('email');
      setForgotEmail('');
      setForgotOtp('');
      setForgotNewPassword('');
      setForgotConfirmPassword('');
      setActiveTab('login');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotResendOTP = async () => {
    setForgotResending(true);
    try {
      await authAPI.forgotPassword(forgotEmail);
      toast.success('New code sent to your email.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend code');
    } finally {
      setForgotResending(false);
    }
  };

  const resetForgotFlow = () => {
    setShowForgot(false);
    setForgotStep('email');
    setForgotEmail('');
    setForgotOtp('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      {/* Background effects */}
      <div className="absolute inset-0 bg-hero-pattern opacity-30" />
      <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/20 blur-[128px]" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-accent/20 blur-[128px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Back button */}
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <AnimatePresence mode="wait">
          {showForgot ? (
            /* ── FORGOT PASSWORD FLOW ── */
            <motion.div
              key="forgot"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
            >
              <Card className="glass-card border-white/10">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-600/20 border border-amber-500/30">
                    <KeyRound className="h-7 w-7 text-amber-400" />
                  </div>
                  <CardTitle className="text-2xl">
                    {forgotStep === 'email' && 'Forgot Password'}
                    {forgotStep === 'otp' && 'Verify Code'}
                    {forgotStep === 'newpass' && 'New Password'}
                  </CardTitle>
                  <CardDescription>
                    {forgotStep === 'email' && 'Enter your email to receive a reset code'}
                    {forgotStep === 'otp' && (
                      <>We sent a 6-digit code to <strong>{forgotEmail}</strong></>
                    )}
                    {forgotStep === 'newpass' && 'Set your new password below'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Step 1: Enter Email */}
                  {forgotStep === 'email' && (
                    <form onSubmit={handleForgotSendOTP} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email">Email Address</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="forgot-email"
                            type="email"
                            placeholder="you@example.com"
                            className="pl-10"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            autoFocus
                            required
                          />
                        </div>
                      </div>
                      <Button type="submit" className="btn-primary w-full" disabled={isLoading}>
                        {isLoading ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                        ) : (
                          <>Send Reset Code</>
                        )}
                      </Button>
                      <button
                        type="button"
                        className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                        onClick={resetForgotFlow}
                      >
                        ← Back to Sign In
                      </button>
                    </form>
                  )}

                  {/* Step 2: Enter OTP */}
                  {forgotStep === 'otp' && (
                    <form onSubmit={handleForgotVerifyOTP} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="forgot-otp">Verification Code</Label>
                        <Input
                          id="forgot-otp"
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="• • • • • •"
                          className="text-center text-2xl tracking-[0.5em] font-mono h-14"
                          value={forgotOtp}
                          onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          autoFocus
                          required
                        />
                        <p className="text-xs text-muted-foreground text-center">Code expires in 10 minutes</p>
                      </div>
                      <Button type="submit" className="btn-primary w-full" disabled={isLoading || forgotOtp.length !== 6}>
                        {isLoading ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
                        ) : (
                          <><ShieldCheck className="mr-2 h-4 w-4" />Verify Code</>
                        )}
                      </Button>
                      <div className="flex items-center justify-between text-sm">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setForgotStep('email')}
                        >
                          ← Change email
                        </button>
                        <button
                          type="button"
                          className="text-primary hover:underline flex items-center gap-1 transition-colors"
                          onClick={handleForgotResendOTP}
                          disabled={forgotResending}
                        >
                          {forgotResending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          Resend code
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Step 3: New Password */}
                  {forgotStep === 'newpass' && (
                    <form onSubmit={handleForgotResetPassword} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="forgot-new-pass">New Password</Label>
                        <PasswordInput
                          id="forgot-new-pass"
                          placeholder="Min. 8 chars with A-z, 0-9, !@#$%^&*"
                          value={forgotNewPassword}
                          onChange={(e) => setForgotNewPassword(e.target.value)}
                          show={showForgotNewPass}
                          onToggle={() => setShowForgotNewPass(!showForgotNewPass)}
                          minLength={8}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="forgot-confirm-pass">Confirm Password</Label>
                        <PasswordInput
                          id="forgot-confirm-pass"
                          placeholder="Re-enter new password"
                          value={forgotConfirmPassword}
                          onChange={(e) => setForgotConfirmPassword(e.target.value)}
                          show={showForgotConfirmPass}
                          onToggle={() => setShowForgotConfirmPass(!showForgotConfirmPass)}
                        />
                      </div>
                      <Button type="submit" className="btn-primary w-full" disabled={isLoading}>
                        {isLoading ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting...</>
                        ) : (
                          <>Reset Password</>
                        )}
                      </Button>
                      <button
                        type="button"
                        className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                        onClick={resetForgotFlow}
                      >
                        ← Back to Sign In
                      </button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </motion.div>

          ) : showOTP ? (
            /* ── OTP Verification Screen (Signup) ── */
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
            >
              <Card className="glass-card border-white/10">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600/20 border border-indigo-500/30">
                    <ShieldCheck className="h-7 w-7 text-indigo-400" />
                  </div>
                  <CardTitle className="text-2xl">Verify Your Email</CardTitle>
                  <CardDescription>
                    We sent a 6-digit code to <strong>{otpEmail}</strong>.<br />
                    Enter it below to activate your account.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleVerifyOTP} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="otp-code">Verification Code</Label>
                      <Input
                        id="otp-code"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="• • • • • •"
                        className="text-center text-2xl tracking-[0.5em] font-mono h-14"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        autoFocus
                        required
                      />
                      <p className="text-xs text-muted-foreground text-center">Code expires in 10 minutes</p>
                    </div>

                    <Button type="submit" className="btn-primary w-full" disabled={isLoading || otp.length !== 6}>
                      {isLoading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
                      ) : (
                        <><ShieldCheck className="mr-2 h-4 w-4" />Verify & Continue</>
                      )}
                    </Button>

                    <div className="flex items-center justify-between text-sm">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => { setShowOTP(false); setOtp(''); }}
                      >
                        ← Back to signup
                      </button>
                      <button
                        type="button"
                        className="text-primary hover:underline flex items-center gap-1 transition-colors"
                        onClick={handleResendOTP}
                        disabled={resending}
                      >
                        {resending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        Resend code
                      </button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            /* ── Login / Signup Tabs ── */
            <motion.div
              key="auth"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
            >
              <Card className="glass-card border-white/10">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
                    <img src="/logo.png" alt="IntraView AI" className="h-12 w-12 rounded-xl object-contain" />
                  </div>
                  <CardTitle className="text-2xl">Welcome to IntraView AI</CardTitle>
                  <CardDescription>
                    Sign in to your account or create a new one
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="login">Sign In</TabsTrigger>
                      <TabsTrigger value="signup">Sign Up</TabsTrigger>
                    </TabsList>

                    {/* Login Tab */}
                    <TabsContent value="login" className="mt-6">
                      <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="login-email">Email</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="login-email"
                              type="email"
                              placeholder="you@example.com"
                              className="pl-10"
                              value={loginForm.email}
                              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="login-password">Password</Label>
                          <PasswordInput
                            id="login-password"
                            placeholder="••••••••"
                            value={loginForm.password}
                            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                            show={showLoginPassword}
                            onToggle={() => setShowLoginPassword(!showLoginPassword)}
                          />
                        </div>

                        {/* Forgot Password Link */}
                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="text-xs text-primary hover:underline transition-colors"
                            onClick={() => setShowForgot(true)}
                          >
                            Forgot Password?
                          </button>
                        </div>

                        <Button type="submit" className="btn-primary w-full" disabled={isLoading}>
                          {isLoading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>
                          ) : 'Sign In'}
                        </Button>
                      </form>
                    </TabsContent>

                    {/* Signup Tab */}
                    <TabsContent value="signup" className="mt-6">
                      <form onSubmit={handleSignup} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="signup-name">Full Name</Label>
                          <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="signup-name"
                              type="text"
                              placeholder="Full Name"
                              className="pl-10"
                              value={signupForm.fullName}
                              onChange={(e) => setSignupForm({ ...signupForm, fullName: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-email">Email</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="signup-email"
                              type="email"
                              placeholder="you@example.com"
                              className="pl-10"
                              value={signupForm.email}
                              onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-password">Password</Label>
                          <PasswordInput
                            id="signup-password"
                            placeholder="Min. 8 chars with A-z, 0-9, !@#$%^&*"
                            value={signupForm.password}
                            onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                            show={showSignupPassword}
                            onToggle={() => setShowSignupPassword(!showSignupPassword)}
                            minLength={8}
                          />
                        </div>
                        <Button type="submit" className="btn-primary w-full" disabled={isLoading}>
                          {isLoading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</>
                          ) : 'Create Account'}
                        </Button>
                      </form>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
