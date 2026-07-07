import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp, generateOTP, verifyOTP } from '../context/AppContext';
import { api, ApiError } from '../utils/api';
import { Phone, Mail, Lock, Eye, EyeOff, ShoppingBag, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import { auth, firebaseReady } from '../utils/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

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

  // Firebase Phone Auth refs
  const recaptchaRef    = useRef(null);
  const confirmationRef = useRef(null);

  const clearRecaptcha = () => {
    if (recaptchaRef.current) { recaptchaRef.current.clear(); recaptchaRef.current = null; }
  };

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setError('');
    if (!phone || phone.length < 10) { setError('Enter a valid 10-digit mobile number'); return; }
    setLoading(true);

    // ── Firebase path (real SMS) ─────────────────────────────────────────────
    if (firebaseReady) {
      try {
        clearRecaptcha();
        recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
        confirmationRef.current = await signInWithPhoneNumber(auth, '+91' + phone, recaptchaRef.current);
        setLoading(false);
        setOtp(['', '', '', '', '', '']);
        setDemoOtp('');
        setOfflineMode(false);
        setStep(2);
        return;
      } catch (err) {
        clearRecaptcha();
        // Firebase failed — fall through to backend OTP below
        console.warn('[Firebase] signInWithPhoneNumber failed:', err.message);
      }
    }

    // ── Backend OTP path (dev / Firebase not configured) ────────────────────
    try {
      const res = await api.post('/api/auth/send-otp', { phone });
      setDemoOtp(res.devOtp || '');
      setPendingShop(null);
      setOfflineMode(false);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 0 || err.status >= 500)) {
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

    // ── Firebase verification ────────────────────────────────────────────────
    if (confirmationRef.current) {
      try {
        const credential = await confirmationRef.current.confirm(entered);
        const idToken    = await credential.user.getIdToken();
        const res        = await api.post('/api/auth/firebase-phone-login', { idToken });
        setLoading(false);
        onSuccess(res.shop, res.token);
        return;
      } catch (err) {
        setLoading(false);
        setError(err.code === 'auth/invalid-verification-code' ? 'Incorrect OTP. Please try again.' : err.message || 'Verification failed.');
        return;
      }
    }

    // ── Offline fallback ─────────────────────────────────────────────────────
    if (offlineMode) {
      await new Promise(r => setTimeout(r, 500));
      setLoading(false);
      if (!verifyOTP(phone, entered)) { setError('Incorrect OTP. Please try again.'); return; }
      onSuccess(pendingShop, null);
      return;
    }

    // ── Backend OTP verification ─────────────────────────────────────────────
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
        {/* Invisible reCAPTCHA container required by Firebase Phone Auth */}
        <div id="recaptcha-container" />
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
// ── Feature bullets shown on the left brand panel ──────────────────────────
const FEATURES = [
  { icon: '⚡', title: 'Instant billing', body: 'Generate GST-ready bills in seconds, even offline.' },
  { icon: '📦', title: 'Smart inventory', body: 'Auto stock deduction with low-stock alerts.' },
  { icon: '📊', title: 'Daily reports', body: 'Revenue, profit & expense summaries at a glance.' },
];

export default function Login() {
  const { loginAsShop } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState('otp');

  // 3-D tilt refs for the login card
  const cardRef  = useRef(null);
  const frameRef = useRef(null);

  const handleTiltMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width  - 0.5;
    const y = (e.clientY - rect.top)  / rect.height - 0.5;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      if (cardRef.current)
        cardRef.current.style.transform =
          `perspective(900px) rotateY(${x * 7}deg) rotateX(${-y * 7}deg) translateZ(6px)`;
    });
  };

  const handleTiltLeave = () => {
    if (cardRef.current) {
      cardRef.current.style.transition = 'transform 0.55s cubic-bezier(0.23,1,0.32,1)';
      cardRef.current.style.transform  = 'perspective(900px) rotateY(0deg) rotateX(0deg) translateZ(0)';
      setTimeout(() => { if (cardRef.current) cardRef.current.style.transition = 'none'; }, 560);
    }
  };

  const handleLoginSuccess = (shop, token) => {
    loginAsShop(shop, token);
    navigate('/dashboard');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#f7f8fa' }}>

      {/* ── Left: Navy brand panel (hidden on small screens) ─────────────── */}
      <div
        className="hidden lg:flex"
        style={{
          width: 420,
          flexShrink: 0,
          background: 'linear-gradient(160deg, #0d1524 0%, #0b1220 100%)',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 44px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* subtle grid texture */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          pointerEvents: 'none',
        }} />

        {/* Top: logo */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 17, color: '#fff', letterSpacing: '-0.5px',
            }}>S</div>
            <span style={{ fontWeight: 800, fontSize: 18, color: '#fff', letterSpacing: '-0.4px' }}>ShopEase</span>
          </div>

          <div style={{ marginBottom: 48 }}>
            <h2 style={{
              fontSize: 30, fontWeight: 800, color: '#fff',
              letterSpacing: '-0.5px', lineHeight: 1.2, marginBottom: 12,
            }}>
              Built for Indian<br />retail shops
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.52)', lineHeight: 1.7, maxWidth: 280 }}>
              From kirana to fashion — fast billing, smart stock, and daily reports in one place.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: 'rgba(22,163,74,0.14)',
                  border: '1px solid rgba(22,163,74,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16,
                }}>{f.icon}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.1px', marginBottom: 2 }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{f.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: tagline */}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 32 }}>
          Trusted by kirana, fashion &amp; general stores across India
        </div>
      </div>

      {/* ── Right: login form ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 justify-center mb-8">
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 15, color: '#fff',
            }}>S</div>
            <span style={{ fontWeight: 800, fontSize: 18, color: '#12161f', letterSpacing: '-0.4px' }}>ShopEase</span>
          </div>

          {/* Tilt card */}
          <div
            ref={cardRef}
            onMouseMove={handleTiltMove}
            onMouseLeave={handleTiltLeave}
            style={{
              background: '#fff',
              border: '1px solid #e7e9ee',
              borderRadius: 16,
              padding: '32px 32px 28px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
              transformStyle: 'preserve-3d',
              willChange: 'transform',
            }}
          >
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#12161f', letterSpacing: '-0.4px', marginBottom: 4 }}>
                Welcome back
              </h1>
              <p style={{ fontSize: 13, color: '#8a93a3' }}>Sign in to your ShopEase account</p>
            </div>

            {mode !== 'forgot' && (
              <div style={{
                display: 'flex', background: '#f1f3f7', borderRadius: 10, padding: 4, marginBottom: 24, gap: 4,
              }}>
                {[
                  { key: 'otp',   Icon: Phone, label: 'Phone + OTP' },
                  { key: 'email', Icon: Mail,  label: 'Email' },
                ].map(({ key, Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '8px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: 600,
                      background: mode === key ? '#fff' : 'transparent',
                      color: mode === key ? '#16a34a' : '#8a93a3',
                      boxShadow: mode === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>
            )}

            {mode === 'otp'    && <PhoneOtpLogin onSuccess={handleLoginSuccess} />}
            {mode === 'email'  && <EmailLogin onSuccess={handleLoginSuccess} onForgotPassword={() => setMode('forgot')} />}
            {mode === 'forgot' && <ForgotPassword onBack={() => setMode('email')} />}

            {mode !== 'forgot' && (
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #f1f3f7', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#8a93a3', marginBottom: 6 }}>
                  New shop owner?{' '}
                  <Link to="/register" style={{ color: '#16a34a', fontWeight: 600, textDecoration: 'none' }}>
                    Create account
                  </Link>
                </p>
                <p style={{ fontSize: 11, color: '#a7afbe' }}>Session active for 30 days</p>
              </div>
            )}
          </div>

          {/* Admin link */}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link
              to="/admin"
              style={{ fontSize: 11, color: '#a7afbe', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              onMouseEnter={e => e.currentTarget.style.color = '#454d5e'}
              onMouseLeave={e => e.currentTarget.style.color = '#a7afbe'}
            >
              <Lock size={10} /> Admin access
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
