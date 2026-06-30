import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api, ApiError } from '../utils/api';
import {
  ShoppingBag, User, MapPin, FileText, ChevronRight, ChevronLeft, CheckCircle, Check, Eye, EyeOff, Store, AlertCircle
} from 'lucide-react';

const STEPS = ['Owner Info', 'Shop Details', 'Done'];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className={`flex items-center gap-2 ${i <= current ? 'text-blue-100' : 'text-blue-300'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
              i < current ? 'bg-white border-white text-blue-700' :
              i === current ? 'border-white text-white bg-blue-500' :
              'border-blue-400 text-blue-300'
            }`}>
              {i < current ? <Check size={14} /> : i + 1}
            </div>
            <span className="text-xs font-medium hidden sm:block">{step}</span>
          </div>
          {i < STEPS.length - 1 && <div className={`w-8 sm:w-16 h-0.5 mx-2 ${i < current ? 'bg-white' : 'bg-blue-400'}`} />}
        </div>
      ))}
    </div>
  );
}

// Defined OUTSIDE Register so it is a stable component type — prevents re-mount on each keystroke
function InputField({ label, value, onChange, type, placeholder, required, sub, error, prefix, showToggle, showPw, onTogglePw }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {prefix ? (
        <div className="flex">
          <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 text-gray-600 text-sm font-medium select-none">{prefix}</span>
          <input
            type={type || 'text'}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={`flex-1 px-3 py-2.5 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${error ? 'border-red-400 focus:ring-red-400' : ''}`}
          />
        </div>
      ) : (
        <div className="relative">
          <input
            type={showToggle ? (showPw ? 'text' : 'password') : (type || 'text')}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={`input-field ${showToggle ? 'pr-10' : ''} ${error ? 'border-red-400 focus:ring-red-400' : ''}`}
          />
          {showToggle && (
            <button type="button" onClick={onTogglePw} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
      {sub && !error && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function Register() {
  const { registerShop, loginAsShop, allShops } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    ownerName: '', phone: '', email: '', password: '', confirmPassword: '',
    shopName: '', address: '', gstin: '',
  });

  const set = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    setErrors(p => ({ ...p, [key]: '' }));
  };

  const validateStep0 = () => {
    const e = {};
    if (!form.ownerName.trim()) e.ownerName = 'Your name is required';
    if (!form.phone || !/^\d{10}$/.test(form.phone)) e.phone = 'Valid 10-digit mobile number required';
    const phoneExists = allShops.some(s => s.phone.replace(/\D/g, '') === form.phone);
    if (phoneExists) e.phone = 'This phone number is already registered';
    if (form.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address';
      const emailExists = allShops.some(s => s.email?.toLowerCase() === form.email.toLowerCase());
      if (emailExists) e.email = 'This email is already registered';
    }
    if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep1 = () => {
    const e = {};
    if (!form.shopName.trim()) e.shopName = 'Shop name is required';
    if (!form.address.trim()) e.address = 'Address is required (printed on bills)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 0 && !validateStep0()) return;
    if (step === 1 && !validateStep1()) return;
    setStep(s => s + 1);
  };

  const [registerError, setRegisterError] = useState('');

  const handleSubmit = async () => {
    if (!validateStep1()) return;
    setLoading(true);
    setRegisterError('');
    try {
      const res = await api.post('/api/auth/register', {
        ownerName: form.ownerName, phone: form.phone, email: form.email,
        password: form.password, shopName: form.shopName, address: form.address, gstin: form.gstin,
      });
      setLoading(false);
      loginAsShop(res.shop, res.token);
      setStep(2);
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiError && (err.status === 0 || err.status >= 500)) {
        // Backend unreachable — save locally so the shop owner can still work offline
        registerShop({
          ownerName: form.ownerName, phone: form.phone, email: form.email,
          password: form.password, shopName: form.shopName, address: form.address, gstin: form.gstin,
        });
        setStep(2);
      } else {
        setRegisterError(err.message || 'Registration failed. Please try again.');
      }
    }
  };

  const goToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl shadow-lg mb-3">
            <ShoppingBag className="text-blue-600" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white">ShopEase</h1>
          <p className="text-blue-100 text-sm mt-0.5">Create your shop account</p>
        </div>

        <StepIndicator current={step} />

        <div className="bg-white rounded-2xl shadow-xl p-7">
          {/* ── Step 0: Owner Info ── */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="mb-2">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><User size={20} className="text-blue-600" /> About You</h2>
                <p className="text-sm text-gray-500 mt-0.5">We'll use this to set up your account</p>
              </div>

              <InputField
                label="Your Full Name" value={form.ownerName}
                onChange={e => set('ownerName', e.target.value)}
                placeholder="Ravi Kumar" required error={errors.ownerName}
              />
              <InputField
                label="Mobile Number" value={form.phone}
                onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="98000 00000" required prefix="+91"
                sub="Used for OTP login" error={errors.phone}
              />
              <InputField
                label="Email Address" value={form.email}
                onChange={e => set('email', e.target.value)}
                type="email" placeholder="ravi@yourshop.com"
                sub="Optional — for email login and reports" error={errors.email}
              />
              <InputField
                label="Password" value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Min. 6 characters" required
                showToggle showPw={showPw} onTogglePw={() => setShowPw(p => !p)}
                error={errors.password}
              />
              <InputField
                label="Confirm Password" value={form.confirmPassword}
                onChange={e => set('confirmPassword', e.target.value)}
                placeholder="Re-enter password" required
                showToggle showPw={showPw} onTogglePw={() => setShowPw(p => !p)}
                error={errors.confirmPassword}
              />

              <button onClick={handleNext} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
                Next: Shop Details <ChevronRight size={16} />
              </button>
              <p className="text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link to="/login" className="text-blue-600 font-medium hover:underline">Login</Link>
              </p>
            </div>
          )}

          {/* ── Step 1: Shop Details ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="mb-2">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Store size={20} className="text-blue-600" /> Your Shop</h2>
                <p className="text-sm text-gray-500 mt-0.5">This appears on every bill you generate</p>
              </div>

              <InputField
                label="Shop Name" value={form.shopName}
                onChange={e => set('shopName', e.target.value)}
                placeholder="Ravi's Clothing Store" required
                sub="Shown on bills and dashboard" error={errors.shopName}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Shop Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-3 text-gray-400" />
                  <textarea
                    value={form.address}
                    onChange={e => set('address', e.target.value)}
                    placeholder="12, MG Road, Bangalore, Karnataka - 560001"
                    rows={3}
                    className={`input-field pl-10 resize-none ${errors.address ? 'border-red-400' : ''}`}
                  />
                </div>
                {errors.address && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.address}</p>}
                <p className="text-xs text-gray-400 mt-1">Printed on every bill</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  GSTIN <span className="text-xs text-gray-400 font-normal ml-1">Optional</span>
                </label>
                <div className="relative">
                  <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={form.gstin}
                    onChange={e => set('gstin', e.target.value.toUpperCase())}
                    placeholder="29ABCDE1234F1ZS"
                    maxLength={15}
                    className="input-field pl-10 uppercase tracking-wider"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Add later in Settings if you don't have it now.</p>
              </div>

              {registerError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
                  <AlertCircle size={15} />{registerError}
                </div>
              )}
              <div className="flex gap-3 mt-2">
                <button onClick={() => setStep(0)} className="btn-secondary flex items-center gap-1">
                  <ChevronLeft size={16} /> Back
                </button>
                <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {loading ? 'Creating account...' : <><Check size={16} /> Create Account</>}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Done ── */}
          {step === 2 && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={36} className="text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">You're all set!</h2>
              <p className="text-gray-500 mb-1">Welcome to ShopEase, <strong>{form.ownerName}</strong>!</p>
              <p className="text-sm text-gray-400 mb-6">Your shop <strong>{form.shopName}</strong> is ready to go.</p>
              <div className="bg-blue-50 rounded-xl p-4 text-left mb-6 text-sm text-blue-800 space-y-1">
                <p className="font-semibold mb-2">What's next:</p>
                <p>✓ Add your products in the Products page</p>
                <p>✓ Create your first bill for a customer</p>
                <p>✓ Set up email reports in Settings</p>
              </div>
              <button onClick={goToDashboard} className="btn-primary w-full">Go to Dashboard →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
