import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp, generateOTP, verifyOTP } from '../context/AppContext';
import { api, ApiError } from '../utils/api';
import { Phone, Mail, Lock, Eye, EyeOff, ShoppingBag, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';

// Shown in demo mode so the developer can test OTP without a real SMS service
function DemoOtpBox({ code }) {
  return (
    <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2">
      <span className="text-amber-500 text-xs font-bold mt-0.5">DEMO</span>
      <div>
        <p className="text-xs text-amber-800 font-medium">OTP (replace with real SMS in production)</p>
        <p className="text-xl font-mono font-bold text-amber-900 tracking-widest mt-0.5">{code}</p>
      </div>
    </div>
  );
}

function OtpBoxes({ otp, onChange, onKeyDown }) {
  return (
    <div className="flex gap-2 justify-between">
      {otp.map((digit, i) => (
        <input
          key={i}
          id={`otp-${i}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={e => onChange(e.target.value, i)}
          onKeyDown={e => onKeyDown(e, i)}
          className="w-11 h-12 text-center text-lg font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ))}
    </div>
  );
}

// ─── Phone + OTP tab ──────────────────────────────────────────────────────────
function PhoneOtpLogin({ onSuccess }) {
  const { validatePhoneLogin } = useApp();
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [demoOtp, setDemoOtp] = useState('');
  const [pendingShop, setPendingShop] = useState(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setError('');
    if (!phone || phone.length < 10) { setError('Enter a valid 10-digit mobile number'); return; }
    setLoading(true);
    try {
      // Try backend first — sends real SMS, returns dev OTP in non-production
      const res = await api.post('/api/auth/send-otp', { phone });
      setDemoOtp(res.devOtp || '');
      setPendingShop(null); // shop comes from verify-otp response
      setOfflineMode(false);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 0 || err.status >= 500)) {
        // Backend unreachable or DB down — fall back to localStorage demo mode
        const result = validatePhoneLogin(phone);
        if (!result.success) { setLoading(false); setError(result.message); return; }
        const code = generateOTP(phone);
        setDemoOtp(code);
        setPendingShop(result.shop);
        setOfflineMode(true);
      } else {
        setLoading(false);
        setError(err.message || 'Could not send OTP. Please try again.');
        return;
      }
    }
    setLoading(false);
    setOtp(['', '', '', '', '', '']);
    setStep(2);
  };

  const handleChange = (val, idx) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 5) document.getElementById(`otp-${idx + 1}`)?.focus();
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) document.getElementById(`otp-${idx - 1}`)?.focus();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    const entered = otp.join('');
    if (entered.length < 6) { setError('Enter the complete 6-digit OTP'); return; }
    setLoading(true);
    if (offlineMode) {
      // Offline — verify against in-memory OTP store
      await new Promise(r => setTimeout(r, 500));
      setLoading(false);
      if (!verifyOTP(phone, entered)) { setError('Incorrect OTP. Please try again.'); return; }
      onSuccess(pendingShop, null); // no token in offline mode
      return;
    }
    try {
      const res = await api.post('/api/auth/verify-otp', { phone, otp: entered });
      setLoading(false);
      onSuccess(res.shop, res.token);
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Invalid OTP. Please try again.');
    }
  };

  if (step === 1) {
    return (
      <form onSubmit={handleSendOtp} className="space-y-5">
        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2"><AlertCircle size={15} />{error}</div>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Mobile Number</label>
          <div className="flex">
            <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 text-gray-600 text-sm font-medium select-none">+91</span>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="98000 00000"
              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              autoFocus
            />
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Sending OTP...' : 'Send OTP via SMS'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerify} className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <button type="button" onClick={() => setStep(1)} className="text-blue-600 hover:text-blue-700"><ArrowLeft size={16} /></button>
        <p className="text-sm text-gray-600">OTP sent to <strong>+91 {phone}</strong></p>
      </div>
      {demoOtp && <DemoOtpBox code={demoOtp} />}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2"><AlertCircle size={15} />{error}</div>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Enter 6-digit OTP</label>
        <OtpBoxes otp={otp} onChange={handleChange} onKeyDown={handleKeyDown} />
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Verifying...' : 'Verify & Login'}
      </button>
      <p className="text-xs text-center text-gray-500">
        Didn't receive?{' '}
        <button type="button" onClick={handleSendOtp} className="text-blue-600 hover:underline">Resend OTP</button>
      </p>
    </form>
  );
}

// ─── Email + Password tab ────────────────────────────────────────────────────
function EmailLogin({ onSuccess, onForgotPassword }) {
  const { validateEmailLogin } = useApp();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [demoOtp, setDemoOtp] = useState('');
  const [pendingShop, setPendingShop] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckCredentials = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Enter both email and password'); return; }
    setLoading(true);
    try {
      // Backend validates and returns token directly — no OTP step for email
      const res = await api.post('/api/auth/login', { email, password });
      setLoading(false);
      onSuccess(res.shop, res.token);
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiError && (err.status === 0 || err.status >= 500)) {
        // Backend unreachable or DB down — fall back to localStorage OTP mode
        const result = validateEmailLogin(email, password);
        if (!result.success) { setError(result.message); return; }
        const code = generateOTP(email.toLowerCase());
        setDemoOtp(code);
        setPendingShop(result.shop);
        setOtp(['', '', '', '', '', '']);
        setStep(2);
      } else {
        setError(err.message || 'Invalid email or password');
      }
    }
  };

  const handleChange = (val, idx) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 5) document.getElementById(`otp-${idx + 1}`)?.focus();
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) document.getElementById(`otp-${idx - 1}`)?.focus();
  };

  // Step 2 is only shown in offline fallback mode (backend unreachable)
  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    const entered = otp.join('');
    if (entered.length < 6) { setError('Enter the complete 6-digit OTP'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 500));
    setLoading(false);
    if (!verifyOTP(email.toLowerCase(), entered)) { setError('Incorrect OTP. Please try again.'); return; }
    onSuccess(pendingShop, null); // no token in offline mode
  };

  if (step === 1) {
    return (
      <form onSubmit={handleCheckCredentials} className="space-y-4">
        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2"><AlertCircle size={15} />{error}</div>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ravi@yourshop.com" className="input-field pl-10" autoFocus />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <button type="button" onClick={onForgotPassword} className="text-xs text-blue-600 hover:underline">Forgot password?</button>
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" className="input-field pl-10 pr-10" />
            <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Verifying...' : 'Login'}
        </button>
      </form>
    );
  }

  // Offline OTP fallback
  return (
    <form onSubmit={handleVerify} className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <button type="button" onClick={() => setStep(1)} className="text-blue-600 hover:text-blue-700"><ArrowLeft size={16} /></button>
        <p className="text-sm text-gray-600">OTP sent to <strong>{email}</strong></p>
      </div>
      {demoOtp && <DemoOtpBox code={demoOtp} />}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2"><AlertCircle size={15} />{error}</div>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Enter 6-digit OTP</label>
        <OtpBoxes otp={otp} onChange={handleChange} onKeyDown={handleKeyDown} />
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Verifying...' : 'Verify & Login'}
      </button>
    </form>
  );
}

// ─── Forgot Password flow ─────────────────────────────────────────────────────
function ForgotPassword({ onBack }) {
  const { validateEmailLogin, resetPassword } = useApp();
  const [step, setStep] = useState(1); // 1=email, 2=otp, 3=new password, 4=done
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [demoOtp, setDemoOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('Enter your registered email address'); return; }
    // Check email exists
    let allShopsRaw = [];
    try { allShopsRaw = JSON.parse(localStorage.getItem('shopease_shops') || '[]'); } catch {}
    const exists = allShopsRaw.find(s => s.email?.toLowerCase() === email.toLowerCase());
    if (!exists) { setError('No account found with this email address.'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    const code = generateOTP('reset_' + email.toLowerCase());
    setDemoOtp(code);
    setOtp(['', '', '', '', '', '']);
    setStep(2);
  };

  const handleChange = (val, idx) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 5) document.getElementById(`fp-otp-${idx + 1}`)?.focus();
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) document.getElementById(`fp-otp-${idx - 1}`)?.focus();
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    const entered = otp.join('');
    if (entered.length < 6) { setError('Enter the complete 6-digit OTP'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    setLoading(false);
    if (!verifyOTP('reset_' + email.toLowerCase(), entered)) { setError('Incorrect OTP.'); return; }
    setStep(3);
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    setLoading(false);
    resetPassword(email, newPassword);
    setStep(4);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <button type="button" onClick={onBack} className="text-blue-600 hover:text-blue-700"><ArrowLeft size={16} /></button>
        <h3 className="font-semibold text-gray-800">Reset Password</h3>
      </div>

      {step === 1 && (
        <form onSubmit={handleSendOtp} className="space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2"><AlertCircle size={15} />{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Registered Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ravi@yourshop.com" className="input-field pl-10" autoFocus />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Sending...' : 'Send OTP'}</button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <p className="text-sm text-gray-600">OTP sent to <strong>{email}</strong></p>
          {demoOtp && <DemoOtpBox code={demoOtp} />}
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2"><AlertCircle size={15} />{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Enter 6-digit OTP</label>
            <div className="flex gap-2 justify-between">
              {otp.map((digit, i) => (
                <input key={i} id={`fp-otp-${i}`} type="text" inputMode="numeric" maxLength={1} value={digit}
                  onChange={e => handleChange(e.target.value, i)} onKeyDown={e => handleKeyDown(e, i)}
                  className="w-11 h-12 text-center text-lg font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              ))}
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Verifying...' : 'Verify OTP'}</button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleSetPassword} className="space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2"><AlertCircle size={15} />{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type={showPw ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 characters" className="input-field pl-10 pr-10" autoFocus />
              <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type={showPw ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" className="input-field pl-10" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Saving...' : 'Set New Password'}</button>
        </form>
      )}

      {step === 4 && (
        <div className="text-center py-4 space-y-3">
          <CheckCircle size={40} className="text-green-500 mx-auto" />
          <p className="font-semibold text-gray-800">Password updated!</p>
          <p className="text-sm text-gray-500">You can now login with your new password.</p>
          <button onClick={onBack} className="btn-primary w-full">Back to Login</button>
        </div>
      )}
    </div>
  );
}

// ─── Main Login page ──────────────────────────────────────────────────────────
export default function Login() {
  const { loginAsShop } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState('otp'); // 'otp' | 'email' | 'forgot'

  const handleLoginSuccess = (shop, token) => {
    loginAsShop(shop, token);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <ShoppingBag className="text-blue-600" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white">ShopEase</h1>
          <p className="text-blue-100 mt-1">Billing & POS for Indian Shop Owners</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {mode !== 'forgot' && (
            <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
              <button onClick={() => setMode('otp')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${mode === 'otp' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>
                <Phone size={14} className="inline mr-1.5" />Phone + OTP
              </button>
              <button onClick={() => setMode('email')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${mode === 'email' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>
                <Mail size={14} className="inline mr-1.5" />Email
              </button>
            </div>
          )}

          {mode === 'otp' && <PhoneOtpLogin onSuccess={handleLoginSuccess} />}
          {mode === 'email' && <EmailLogin onSuccess={handleLoginSuccess} onForgotPassword={() => setMode('forgot')} />}
          {mode === 'forgot' && <ForgotPassword onBack={() => setMode('email')} />}

          {mode !== 'forgot' && (
            <div className="mt-6 pt-5 border-t border-gray-100 text-center space-y-2">
              <p className="text-sm text-gray-600">
                New shop owner?{' '}
                <Link to="/register" className="text-blue-600 font-medium hover:underline">Create account</Link>
              </p>
              <p className="text-xs text-gray-400">Session stays active for 8 hours</p>
            </div>
          )}
        </div>

        {/* Admin quick-access */}
        <div className="mt-4 text-center">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-blue-200 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
          >
            <Lock size={11} /> Admin Login
          </Link>
        </div>
      </div>
    </div>
  );
}
