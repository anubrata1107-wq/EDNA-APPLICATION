import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthViewsProps {
  initialMode: 'login' | 'register';
  onBackHome: () => void;
  onSuccess: () => void;
}

const USER_CATEGORIES = [
  'Student',
  'Research Scholar',
  'Professor',
  'Scientist',
  'Laboratory Researcher',
  'Environmental Consultant',
  'Other',
];

function formatFirebaseAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('auth/operation-not-allowed')) {
    return 'Email/Password sign-in is not yet enabled in Firebase Console for this project. Use "Continue with Google" below, or enable Email/Password in Firebase Console > Authentication > Sign-in method.';
  }
  if (msg.includes('auth/email-already-in-use')) {
    return 'An account with this email address already exists. Please sign in instead.';
  }
  if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
    return 'Invalid email address or password.';
  }
  if (msg.includes('auth/user-not-found')) {
    return 'No account found with this email address.';
  }
  if (msg.includes('auth/too-many-requests')) {
    return 'Too many failed login attempts. Please wait briefly or reset your password.';
  }
  return msg;
}

export const AuthViews: React.FC<AuthViewsProps> = ({
  initialMode,
  onBackHome,
  onSuccess,
}) => {
  const { loginWithEmail, registerWithEmail, loginWithGoogle, sendResetPassword } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showLoginPw, setShowLoginPw] = useState(false);

  // Registration fields
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [institution, setInstitution] = useState('');
  const [department, setDepartment] = useState('');
  const [researchField, setResearchField] = useState('');
  const [country, setCountry] = useState('');
  const [userCategory, setUserCategory] = useState('Scientist');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showRegPw, setShowRegPw] = useState(false);

  // Forgot password field
  const [resetEmail, setResetEmail] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!loginPassword) {
      setError('Password is required.');
      return;
    }
    setBusy(true);
    try {
      await loginWithEmail(loginEmail, loginPassword, rememberMe);
      onSuccess();
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (fullName.trim().length < 2) {
      setError('Full Name is required.');
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,28}$/.test(username.trim())) {
      setError('Username must be 3–28 alphanumeric or underscore characters.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (
      regPassword.length < 8 ||
      !/[A-Z]/.test(regPassword) ||
      !/[a-z]/.test(regPassword) ||
      !/[0-9]/.test(regPassword)
    ) {
      setError(
        'Password must be at least 8 characters and include uppercase, lowercase, and numeric characters.'
      );
      return;
    }
    if (regPassword !== confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }
    if (!institution.trim() || !department.trim() || !researchField.trim() || !country.trim()) {
      setError('Institution, Department, Research Field, and Country are required.');
      return;
    }
    if (!acceptTerms) {
      setError('Please accept the Terms and Conditions and Privacy Policy to continue.');
      return;
    }

    setBusy(true);
    try {
      await registerWithEmail({
        fullName,
        username,
        email: regEmail,
        password: regPassword,
        institution,
        department,
        researchField,
        country,
        userCategory,
      });
      onSuccess();
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setInfoMessage(null);
    setBusy(true);
    try {
      await loginWithGoogle(
        mode === 'register'
          ? {
              fullName: fullName || undefined,
              username: username || undefined,
              institution,
              department,
              researchField,
              country,
              userCategory,
            }
          : undefined
      );
      onSuccess();
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      await sendResetPassword(resetEmail);
      setInfoMessage('Password reset email dispatched. Check your inbox and spam folder.');
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6FAF7] flex flex-col justify-center py-10 px-4 sm:px-6">
      <div className="max-w-2xl w-full mx-auto">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#174D35] hover:text-[#269B68] mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        <div className="bg-white rounded-xl border border-[#174D35]/15 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#174D35]/10">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#174D35]">
                {mode === 'login'
                  ? 'Researcher Sign In'
                  : mode === 'register'
                    ? 'Researcher Account Registration'
                    : 'Reset Account Password'}
              </h1>
              <p className="mt-1 text-sm text-[#25332C]/75">
                {mode === 'login'
                  ? 'Access your eDNA projects, taxonomic analyses, and biodiversity dashboards.'
                  : mode === 'register'
                    ? 'Create an institutional researcher profile to upload and analyze eDNA datasets.'
                    : 'Enter your registered email address to receive a password reset link.'}
              </p>
            </div>
            {mode !== 'forgot' && (
              <div className="flex items-center gap-1 p-1 bg-[#F6FAF7] rounded-lg border border-[#174D35]/10 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    mode === 'login'
                      ? 'bg-[#174D35] text-white'
                      : 'text-[#25332C]/75 hover:text-[#174D35]'
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    mode === 'register'
                      ? 'bg-[#174D35] text-white'
                      : 'text-[#25332C]/75 hover:text-[#174D35]'
                  }`}
                >
                  Register
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="mt-5 p-3.5 rounded-lg bg-[#269B68]/10 border border-[#269B68]/30 text-sm text-[#174D35]">
              {infoMessage}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#25332C] mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#25332C]/45 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="researcher@university.edu"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-[#174D35]/20 rounded-lg focus:outline-none focus:border-[#18A999]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#25332C] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#25332C]/45 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showLoginPw ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-9 pr-10 py-2.5 text-sm border border-[#174D35]/20 rounded-lg focus:outline-none focus:border-[#18A999]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPw((v) => !v)}
                    aria-label={showLoginPw ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#25332C]/50 hover:text-[#174D35] cursor-pointer"
                  >
                    {showLoginPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="inline-flex items-center gap-2 text-[#25332C]/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-[#174D35]/30 text-[#174D35]"
                  />
                  Remember me on this workstation
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError(null);
                  }}
                  className="font-medium text-[#18A999] hover:text-[#174D35] cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 px-4 bg-[#174D35] hover:bg-[#269B68] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {busy ? 'Authenticating...' : 'Sign In'}
              </button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#174D35]/10" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-[#25332C]/55">or</span>
                </div>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleGoogleAuth}
                className="w-full py-2.5 px-4 bg-white hover:bg-[#F6FAF7] border border-[#174D35]/20 text-[#25332C] text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Continue with Google
              </button>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="mt-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#25332C] mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. Elena Rostova"
                    className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg focus:outline-none focus:border-[#18A999]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#25332C] mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="elena_rostova"
                    className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg focus:outline-none focus:border-[#18A999]"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#25332C] mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="erostova@marine-inst.org"
                    className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg focus:outline-none focus:border-[#18A999]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#25332C] mb-1">
                    User Category *
                  </label>
                  <select
                    value={userCategory}
                    onChange={(e) => setUserCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg bg-white focus:outline-none focus:border-[#18A999]"
                  >
                    {USER_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#25332C] mb-1">
                    Password * (8+ chars, A-Z, a-z, 0-9)
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPw ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Create strong password"
                      className="w-full px-3 pr-9 py-2 text-sm border border-[#174D35]/20 rounded-lg focus:outline-none focus:border-[#18A999]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPw((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#25332C]/50 cursor-pointer"
                    >
                      {showRegPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#25332C] mb-1">
                    Confirm Password *
                  </label>
                  <input
                    type={showRegPw ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg focus:outline-none focus:border-[#18A999]"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#25332C] mb-1">
                    Institution / University *
                  </label>
                  <input
                    type="text"
                    required
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="National Marine Research Institute"
                    className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg focus:outline-none focus:border-[#18A999]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#25332C] mb-1">
                    Department *
                  </label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Department of Molecular Ecology"
                    className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg focus:outline-none focus:border-[#18A999]"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#25332C] mb-1">
                    Research Field *
                  </label>
                  <input
                    type="text"
                    required
                    value={researchField}
                    onChange={(e) => setResearchField(e.target.value)}
                    placeholder="Aquatic eDNA Metabarcoding"
                    className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg focus:outline-none focus:border-[#18A999]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#25332C] mb-1">
                    Country *
                  </label>
                  <input
                    type="text"
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Singapore"
                    className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg focus:outline-none focus:border-[#18A999]"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 text-xs text-[#25332C]/80 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 rounded border-[#174D35]/30"
                />
                <span>
                  I agree to the Terms and Conditions and Privacy Policy for scientific eDNA dataset
                  processing and account registration.
                </span>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 px-4 bg-[#174D35] hover:bg-[#269B68] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {busy ? 'Creating Account...' : 'Create Researcher Account'}
              </button>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#174D35]/10" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-[#25332C]/55">or</span>
                </div>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleGoogleAuth}
                className="w-full py-2.5 px-4 bg-white hover:bg-[#F6FAF7] border border-[#174D35]/20 text-[#25332C] text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Register with Google
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#25332C] mb-1.5">
                  Registered Email Address
                </label>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="researcher@university.edu"
                  className="w-full px-3 py-2.5 text-sm border border-[#174D35]/20 rounded-lg focus:outline-none focus:border-[#18A999]"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2.5 bg-[#174D35] hover:bg-[#269B68] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  {busy ? 'Sending...' : 'Send Password Reset Link'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className="px-4 py-2.5 text-sm font-medium text-[#25332C]/75 hover:text-[#174D35] cursor-pointer"
                >
                  Return to Login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
