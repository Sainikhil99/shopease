import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, ADMIN_EMAIL, generateOTP, verifyOTP } from '../../context/AppContext';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';

function DemoOtpBox({ code }) {
  return (
    <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2">
      <span className="text-amber-500 text-xs font-bold mt-0.5">DEMO</span>
      <div>
        <p className="text-xs text-amber-800 font-medium">OTP (replace with real email in production)</p>
        <p className="text-xl font-mono font-bold text-amber-900 tracking-widest mt-0.5">{code}</p>
      </div>
    </div>
  );
}

export default function AdminLogin() {
  const { adminLogin, checkAdminCredentials, isAdmin } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1=credentials, 2=otp
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [demoOtp, setDemoOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAdmin) {
    navigate('/admin/dashboard', { replace: true });
    return null;
  }

  const handleCredentials = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Enter your email and password'); return; }
    // Pure credential check — no state change. State is set only after OTP is confirmed.
    if (!checkAdminCredentials(email, password)) {
      setError('Invalid admin credentials');
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    setLoading(false);
    const code = generateOTP('admin_login');
    setDemoOtp(code);
    setOtp(['', '', '', '', '', '']);
    setStep(2);
  };

  const handleOtpChange = (val, idx) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 5) document.getElementById(`adm-otp-${idx + 1}`)?.focus();
  };

  const handleOtpKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) document.getElementById(`adm-otp-${idx - 1}`)?.focus();
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    const entered = otp.join('');
    if (entered.length < 6) { setError('Enter the complete 6-digit OTP'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    setLoading(false);
    if (!verifyOTP('admin_login', entered)) { setError('Incorrect OTP. Please try again.'); return; }
    adminLogin(email, password);
    navigate('/admin/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-xl mb-4">
            <ShieldCheck className="text-slate-700" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-slate-400 text-sm mt-1">ShopEase System Administration</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-7">
          {step === 1 ? (
            <>
              <h2 className="text-lg font-bold text-gray-800 mb-5 text-center">Admin Login</h2>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
                  <AlertCircle size={15} /> {error}
                </div>
              )}
              <form onSubmit={handleCredentials} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="Enter admin email" className="input-field pl-10" autoFocus autoComplete="email" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Enter admin password" className="input-field pl-10 pr-10" autoComplete="current-password" />
                    <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors disabled:opacity-50 mt-2">
                  {loading ? 'Verifying...' : 'Continue'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <button type="button" onClick={() => setStep(1)} className="text-slate-600 hover:text-slate-800"><ArrowLeft size={16} /></button>
                <h2 className="text-lg font-bold text-gray-800">Verify Identity</h2>
              </div>
              <p className="text-sm text-gray-500 mb-4">OTP sent to your admin email</p>
              {demoOtp && <DemoOtpBox code={demoOtp} />}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
                  <AlertCircle size={15} /> {error}
                </div>
              )}
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Enter 6-digit OTP</label>
                  <div className="flex gap-2 justify-between">
                    {otp.map((digit, i) => (
                      <input key={i} id={`adm-otp-${i}`} type="text" inputMode="numeric" maxLength={1} value={digit}
                        onChange={e => handleOtpChange(e.target.value, i)} onKeyDown={e => handleOtpKeyDown(e, i)}
                        className="w-11 h-12 text-center text-lg font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500" />
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors disabled:opacity-50">
                  {loading ? 'Verifying...' : 'Sign in as Admin'}
                </button>
              </form>
            </>
          )}

          <p className="text-center text-xs text-gray-400 mt-5">
            Not an admin?{' '}
            <a href="/login" className="text-blue-600 hover:underline">Go to shop login</a>
          </p>
        </div>
      </div>
    </div>
  );
}
