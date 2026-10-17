import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Truck,
  Lock,
  Mail,
  User,
  Building2,
  Phone,
  MapPin,
  ArrowRight,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';

export const AuthPages: React.FC = () => {
  const { login, register } = useAuth();

  // Check if opened via dedicated Super Admin portal URL (?admin=true, #admin, /admin)
  const checkIsAdminPortal = () => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    return (
      params.get('admin') === 'true' ||
      params.get('portal') === 'admin' ||
      params.has('admin') ||
      hash === '#admin' ||
      path.startsWith('/admin')
    );
  };

  const [isAdminPortal, setIsAdminPortal] = useState(checkIsAdminPortal);
  const [tab, setTab] = useState<'login' | 'register' | 'admin'>(() => {
    return checkIsAdminPortal() ? 'admin' : 'login';
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Password visibility toggles
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [showRegPass, setShowRegPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [showAdminPass, setShowAdminPass] = useState(false);

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Admin login form state
  const [adminIdentifier, setAdminIdentifier] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Register form state
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Registration OTP Verification Step
  const [regPendingEmail, setRegPendingEmail] = useState<string | null>(null);
  const [verificationOtp, setVerificationOtp] = useState('');
  const [regPreviewOtp, setRegPreviewOtp] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Forgot Password / Reset Password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'otp_reset'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetPreviewOtp, setResetPreviewOtp] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotCooldown, setForgotCooldown] = useState(0);

  // Cooldown timer effect
  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    let timer: any;
    if (forgotCooldown > 0) {
      timer = setInterval(() => setForgotCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [forgotCooldown]);

  // Keep portal view in sync with URL
  useEffect(() => {
    const handleUrlChange = () => {
      const isAdmin = checkIsAdminPortal();
      setIsAdminPortal(isAdmin);
      if (isAdmin) {
        setTab('admin');
      } else if (tab === 'admin') {
        setTab('login');
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, [tab]);

  // LOGIN HANDLER
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    const res = await login(identifier, loginPassword);
    if (!res.success) {
      setError(res.error || 'Login failed. Please check your credentials.');
    }
    setSubmitting(false);
  };

  // ADMIN LOGIN HANDLER
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    const res = await login(adminIdentifier, adminPassword);
    if (!res.success) {
      setError(res.error || 'Administrator login failed. Please verify credentials.');
    } else if (res.user && res.user.role !== 'admin') {
      setError('Access Denied: This account is a Transporter. Please sign in via the Transporter Sign In tab.');
    }
    setSubmitting(false);
  };

  const safeParseJson = async (res: Response): Promise<any> => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { error: `Server responded with status ${res.status}. Please try again.` };
    }
  };

  // REGISTRATION HANDLER
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (regPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await register({
        fullName,
        companyName,
        mobile,
        email,
        address,
        city,
        password: regPassword,
      });

      if (!result.success) {
        setError(result.error || 'Registration failed.');
        setSubmitting(false);
        return;
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration.');
    } finally {
      setSubmitting(false);
    }
  };

  // VERIFY REGISTRATION OTP
  const handleVerifyRegistrationOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!verificationOtp || verificationOtp.trim().length < 4) {
      setError('Please enter a valid verification code.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/verify-registration-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regPendingEmail,
          otp: verificationOtp.trim(),
        }),
      });

      const data = await safeParseJson(res);
      if (!res.ok) {
        setError(data.error || 'Verification failed. Incorrect or expired code.');
        setSubmitting(false);
        return;
      }

      localStorage.setItem('fleetbill_token', data.token);
      setSuccessMsg('Account verified successfully! Logging you in...');
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err: any) {
      setError(err.message || 'Network error verifying registration.');
    } finally {
      setSubmitting(false);
    }
  };

  // RESEND REGISTRATION OTP
  const handleResendRegistrationOtp = async () => {
    if (resendCooldown > 0 || !regPendingEmail) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/resend-registration-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regPendingEmail }),
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        setResendCooldown(60);
        if (data.previewCode) {
          setRegPreviewOtp(data.previewCode);
          setVerificationOtp(data.previewCode);
          setSuccessMsg(`New verification code: ${data.previewCode}`);
        } else {
          setSuccessMsg(`New verification code sent to ${regPendingEmail}.`);
        }
      } else {
        setError(data.error || 'Failed to resend code.');
      }
    } catch {
      setError('Failed to request new code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // FORGOT PASSWORD: REQUEST OTP
  const handleRequestPasswordResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!forgotEmail) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        setForgotStep('otp_reset');
        setForgotCooldown(60);
        if (data.previewCode) {
          setResetPreviewOtp(data.previewCode);
          setResetOtp(data.previewCode);
          setSuccessMsg(`Password reset code: ${data.previewCode}`);
        } else {
          setSuccessMsg(`Password reset OTP sent to ${forgotEmail}. Please check your inbox.`);
        }
      } else {
        setError(data.error || 'Account not found with this email.');
      }
    } catch {
      setError('Could not process reset request.');
    } finally {
      setSubmitting(false);
    }
  };

  // FORGOT PASSWORD: SUBMIT OTP & NEW PASSWORD
  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          otp: resetOtp.trim(),
          newPassword,
        }),
      });

      const data = await safeParseJson(res);
      if (res.ok) {
        setSuccessMsg('Your password has been reset successfully! You can now sign in.');
        setTimeout(() => {
          setShowForgot(false);
          setForgotStep('email');
          setIdentifier(forgotEmail);
          setLoginPassword('');
        }, 1500);
      } else {
        setError(data.error || 'Password reset failed. Invalid or expired OTP.');
      }
    } catch (err: any) {
      setError(err.message || 'Error completing password reset.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-[500px] h-[300px] bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Header Branding */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 px-4">
        {isAdminPortal ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 mx-auto flex items-center justify-center shadow-xl shadow-amber-600/30 mb-4 border border-amber-400/30">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-3xl font-black tracking-tight text-white">Super Admin HQ</h1>
              <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30">
                Restricted
              </span>
            </div>
            <p className="mt-2 text-xs sm:text-sm text-slate-400 font-medium">
              Official Transporter Oversight, Subscriptions & Pricing Control
            </p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-cyan-400 mx-auto flex items-center justify-center shadow-xl shadow-blue-600/30 mb-4 border border-blue-400/30">
              <Truck className="w-7 h-7 text-white" />
            </div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-3xl font-black tracking-tight text-white">Fleet Bill</h1>
              <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30">
                3.0
              </span>
            </div>
            <p className="mt-2 text-xs sm:text-sm text-slate-400 font-medium">
              Transporter Billing & Freight Management Portal
            </p>
          </>
        )}
      </div>

      {/* Main Authentication Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg z-10 px-4">
        <div className="bg-slate-900/90 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl rounded-2xl border border-slate-800">
          
          {/* Navigation Tabs (Only rendered on Transporter Portal - Super Admin is completely isolated) */}
          {!showForgot && !regPendingEmail && (
            isAdminPortal ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-6 flex items-center justify-between text-xs text-amber-300">
                <div className="flex items-center gap-2 font-bold">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Super Administrator Access</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminPortal(false);
                    setTab('login');
                    if (typeof window !== 'undefined') {
                      window.history.pushState({}, '', '/');
                    }
                  }}
                  className="text-[11px] text-amber-400 hover:text-amber-200 underline font-medium cursor-pointer"
                >
                  Switch to Transporter
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 rounded-xl bg-slate-950 p-1 mb-6 border border-slate-800 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-2 px-2 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                    tab === 'login'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Transporter Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-2 px-2 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                    tab === 'register'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  New Registration
                </button>
              </div>
            )
          )}

          {/* Feedback Messages */}
          {error && (
            <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ----------------- 1. TRANSPORTER LOGIN TAB ----------------- */}
          {tab === 'login' && !showForgot && !regPendingEmail && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address or Mobile Number
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. transporter@company.com or 03001234567"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgot(true);
                      setForgotStep('email');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showLoginPass ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPass(!showLoginPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{submitting ? 'Authenticating...' : 'Sign In as Transporter'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* ----------------- 2. SUPER ADMIN LOGIN TAB ----------------- */}
          {tab === 'admin' && !showForgot && !regPendingEmail && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2.5 text-amber-300 text-xs">
                <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <span className="font-bold block">Super Administrator Control Portal</span>
                  <span className="text-[11px] text-amber-200/80">Manage transporters, approve subscriptions, and configure pricing & SMTP.</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Administrator Email / Username
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={adminIdentifier}
                    onChange={(e) => setAdminIdentifier(e.target.value)}
                    placeholder="atifraza4070@gmail.com or admin@fleetbill.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-medium"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Administrator Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showAdminPass ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-medium"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPass(!showAdminPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{submitting ? 'Verifying Admin Authority...' : 'Sign In as Super Admin'}</span>
              </button>

              <div className="pt-3 text-center border-t border-slate-800/80 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminPortal(false);
                    setTab('login');
                    if (typeof window !== 'undefined') {
                      window.history.pushState({}, '', '/');
                    }
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  ← Return to Transporter Portal
                </button>
              </div>
            </form>
          )}

          {/* ----------------- 2. REGISTRATION OTP VERIFICATION ----------------- */}
          {regPendingEmail && (
            <div className="space-y-4">
              <div className="text-center space-y-1.5">
                <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto text-blue-400">
                  <Mail className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">Verify Your Email Address</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  We sent a 6-digit verification code to <span className="font-semibold text-white">{regPendingEmail}</span>.
                </p>
              </div>

              <form onSubmit={handleVerifyRegistrationOtp} className="space-y-4">
                {regPreviewOtp && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-200">Testing Code (Preview):</span>
                      <button
                        type="button"
                        onClick={() => setVerificationOtp(regPreviewOtp)}
                        className="font-mono text-sm font-black bg-amber-950/80 px-2.5 py-0.5 rounded border border-amber-500/50 text-amber-300 hover:bg-amber-900 transition-colors cursor-pointer"
                      >
                        {regPreviewOtp} (Auto-Fill)
                      </button>
                    </div>
                    <span className="text-[10px] text-amber-200/70">
                      Code auto-filled. (Configure SMTP in Super Admin Settings to deliver emails directly to real inboxes).
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 text-center">
                    Enter 6-Digit OTP Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={verificationOtp}
                    onChange={(e) => setVerificationOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="123456"
                    className="w-full py-3 text-center tracking-[0.5em] text-xl font-bold bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || verificationOtp.length < 4}
                  className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{submitting ? 'Verifying...' : 'Verify & Activate Account'}</span>
                </button>
              </form>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setRegPendingEmail(null);
                    setVerificationOtp('');
                    setError(null);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  ← Edit Registration Details
                </button>

                <button
                  type="button"
                  onClick={handleResendRegistrationOtp}
                  disabled={resendCooldown > 0 || submitting}
                  className="text-blue-400 hover:text-blue-300 font-medium disabled:opacity-50 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${resendCooldown > 0 ? '' : 'animate-none'}`} />
                  <span>{resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ----------------- 3. FORGOT / RESET PASSWORD ----------------- */}
          {showForgot && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto text-blue-400 mb-2">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">Reset Account Password</h3>
                <p className="text-xs text-slate-400">
                  {forgotStep === 'email'
                    ? 'Enter your registered email address to receive a 6-digit password reset OTP.'
                    : `Enter the 6-digit reset code sent to ${forgotEmail} and choose a new password.`}
                </p>
              </div>

              {forgotStep === 'email' ? (
                <form onSubmit={handleRequestPasswordResetOtp} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Account Registered Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="e.g. transporter@company.com"
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all"
                  >
                    {submitting ? 'Sending Code...' : 'Send Reset OTP Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleConfirmPasswordReset} className="space-y-3">
                  {resetPreviewOtp && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex flex-col gap-1.5 mb-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-amber-200">Reset Code (Preview):</span>
                        <button
                          type="button"
                          onClick={() => setResetOtp(resetPreviewOtp)}
                          className="font-mono text-sm font-black bg-amber-950/80 px-2.5 py-0.5 rounded border border-amber-500/50 text-amber-300 hover:bg-amber-900 transition-colors cursor-pointer"
                        >
                          {resetPreviewOtp} (Auto-Fill)
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      6-Digit Reset Code (OTP)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="123456"
                      className="w-full py-2.5 text-center tracking-[0.3em] font-bold text-lg bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all"
                  >
                    {submitting ? 'Updating Password...' : 'Save New Password & Sign In'}
                  </button>
                </form>
              )}

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgot(false);
                    setForgotStep('email');
                    setError(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  ← Back to Sign In
                </button>
              </div>
            </div>
          )}

          {/* ----------------- 4. REGISTRATION FORM ----------------- */}
          {tab === 'register' && !regPendingEmail && (
            <form onSubmit={handleRegister} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Tariq Mehmood"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Transport Company Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Swift Cargo & Logistics"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-semibold uppercase"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="e.g. 0300 1234567"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Official Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. info@swiftcargo.pk"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">Business Office Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Truck Stand, Circular Road"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Lahore"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showRegPass ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full px-3 pr-8 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPass(!showRegPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showRegPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full px-3 pr-8 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span>{submitting ? 'Creating Transporter Account...' : 'Register Transporter Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[11px] text-slate-400 text-center pt-2">
                New transporter accounts require Super Admin approval before accessing billing modules.
              </p>
            </form>
          )}

        </div>

        <div className="mt-6 text-center text-xs text-slate-500 flex flex-col items-center gap-1">
          <p>© {new Date().getFullYear()} Fleet Bill 3.0 · Dedicated Freight & Transport Billing</p>
        </div>
      </div>
    </div>
  );
};
