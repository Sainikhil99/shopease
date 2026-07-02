import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Save, Store, Mail, Bell, Shield, Check, CreditCard, IndianRupee, Clock, CheckCircle, XCircle, Copy, MessageCircle } from 'lucide-react';

const ADMIN_UPI       = import.meta.env.VITE_ADMIN_UPI_ID          || '';
const ADMIN_PHONE     = import.meta.env.VITE_ADMIN_PAYMENT_PHONE   || '';
const RAZORPAY_LINK   = import.meta.env.VITE_RAZORPAY_PAYMENT_LINK || '';

function Section({ title, icon: Icon, children }) {
  return (
    <div className="card mb-4">
      <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
          <Icon size={16} className="text-blue-600" />
        </div>
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const { shop, updateShop } = useApp();
  const [form, setForm]   = useState({ ...shop });
  const [saved, setSaved] = useState(false);
  const [sub, setSub]     = useState(null);
  const [payTab, setPayTab] = useState('upi'); // 'upi' | 'card'
  const [copied, setCopied] = useState('');   // which field was just copied

  // Sync form when shop changes (e.g. after login/account switch)
  useEffect(() => { setForm({ ...shop }); }, [shop?.id]);

  // Fetch full settings (includes subscription status + UPI fields not in JWT).
  // Uses raw fetch() — NOT the api helper — so a 401 here never triggers the
  // global session-expired logout handler and causes an infinite login loop.
  useEffect(() => {
    const token = sessionStorage.getItem('shopease_token');
    if (!token || token.startsWith('demo-')) return;
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    fetch(`${base}/api/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setSub({
          paidUntil: data.subscriptionPaidUntil,
          status:    data.subscriptionStatus,
          daysLeft:  parseInt(data.daysRemaining ?? 0),
        });
        setForm(prev => ({
          ...prev,
          upiId:        data.upiId        || '',
          paymentPhone: data.paymentPhone || '',
        }));
      })
      .catch(() => {});
  }, [shop?.id]);

  const copy = (text, label) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  const handleSave = (e) => {
    e.preventDefault();
    updateShop(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const Field = ({ label, name, type = 'text', placeholder, sub, disabled }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={form[name] || ''}
        onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
        placeholder={placeholder}
        disabled={disabled}
        className="input-field disabled:bg-gray-50 disabled:text-gray-400"
      />
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );

  const Toggle = ({ label, name, sub }) => (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm font-medium text-gray-700">{label}</div>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
      <button
        type="button"
        onClick={() => setForm(p => ({ ...p, [name]: !p[name] }))}
        className={`relative w-11 h-6 rounded-full transition-colors ${form[name] ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form[name] ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <p className="text-gray-500 text-sm mt-0.5">Manage your shop configuration</p>
        </div>
        {saved && (
          <div className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-lg text-sm font-medium">
            <Check size={16} /> Settings saved!
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-0">
        {/* Shop Info */}
        <Section title="Shop Information" icon={Store}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Shop Name" name="shopName" placeholder="Ravi's Clothing Store" />
              <Field label="Owner Name" name="ownerName" placeholder="Ravi Kumar" />
            </div>
            <Field label="Shop Address" name="address" placeholder="12, MG Road, Bangalore, Karnataka" sub="Printed on every bill" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="GSTIN" name="gstin" placeholder="29ABCDE1234F1ZS" sub="GST registration number" />
              <Field label="Phone Number" name="phone" placeholder="+91 98000 00000" />
            </div>
            <Field label="Login Email" name="email" type="email" placeholder="ravi@yourshop.com" disabled sub="Contact support to change login credentials" />
          </div>
        </Section>

        {/* Email Reports */}
        <Section title="Email Reports" icon={Mail}>
          <div className="space-y-4">
            <Field
              label="Report Email Address"
              name="reportEmail"
              type="email"
              placeholder="ravi@yourshop.com"
              sub="Reports will be sent to this address. Can be different from login email."
            />

            <div className="divide-y divide-gray-100">
              <Toggle label="Daily Sales Report" name="dailyReport" sub="Sent every night with today's summary" />
              {form.dailyReport && (
                <div className="py-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Daily Report Send Time</label>
                  <input
                    type="time"
                    value={form.dailyTime || '21:00'}
                    onChange={e => setForm(p => ({ ...p, dailyTime: e.target.value }))}
                    className="input-field w-auto"
                  />
                  <p className="text-xs text-gray-400 mt-1">Default: 9:00 PM</p>
                </div>
              )}
              <Toggle label="Monthly Report" name="monthlyReport" sub="Sent on the 1st of every month at 8:00 AM" />
              <Toggle label="Attach PDF to Monthly Report" name="pdfAttachment" sub="Full PDF report attached to monthly email" />
            </div>
          </div>
        </Section>

        {/* Stock Alerts */}
        <Section title="Stock Alerts" icon={Bell}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Alert Threshold</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={form.lowStockLimit || 5}
                min={1}
                max={100}
                onChange={e => setForm(p => ({ ...p, lowStockLimit: parseInt(e.target.value) }))}
                className="input-field w-24"
              />
              <span className="text-sm text-gray-500">units</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Products with stock below this number will show a red alert on the dashboard and in daily reports. Default: 5 units.</p>
          </div>
        </Section>

        {/* My Subscription */}
        <Section title="My Subscription" icon={IndianRupee}>
          <div className="space-y-4">

            {/* Status banner */}
            {sub ? (
              <div className={`rounded-xl p-4 border flex items-center gap-4 ${
                sub.status === 'active' && sub.daysLeft > 7  ? 'bg-green-50 border-green-200' :
                sub.status === 'active' && sub.daysLeft <= 7 ? 'bg-amber-50 border-amber-200' :
                                                                'bg-red-50 border-red-200'
              }`}>
                <div className={`shrink-0 ${
                  sub.status === 'active' && sub.daysLeft > 7  ? 'text-green-500' :
                  sub.status === 'active' && sub.daysLeft <= 7 ? 'text-amber-500' : 'text-red-500'
                }`}>
                  {sub.status === 'active' && sub.daysLeft > 7  ? <CheckCircle size={28} /> :
                   sub.status === 'active' && sub.daysLeft <= 7 ? <Clock size={28} /> :
                                                                   <XCircle size={28} />}
                </div>
                <div>
                  <p className={`font-bold text-sm ${
                    sub.status === 'active' && sub.daysLeft > 7  ? 'text-green-800' :
                    sub.status === 'active' && sub.daysLeft <= 7 ? 'text-amber-800' : 'text-red-800'
                  }`}>
                    {sub.status === 'active'
                      ? sub.daysLeft > 7
                        ? `Active — ${sub.daysLeft} days remaining`
                        : `Expiring soon — only ${sub.daysLeft} days left!`
                      : 'Subscription Expired'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {sub.paidUntil
                      ? `Valid until ${new Date(sub.paidUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`
                      : 'No active subscription'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-16 bg-gray-50 border border-gray-200 rounded-xl animate-pulse" />
            )}

            {/* ─── Renew / Pay card ─────────────────────────────────────────── */}
            {(ADMIN_UPI || ADMIN_PHONE || RAZORPAY_LINK) && (
              <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">

                {/* Card header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4">
                  <p className="text-white font-bold text-base">Renew your plan</p>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-white text-2xl font-extrabold">₹299</span>
                    <span className="text-blue-200 text-sm">/ month</span>
                  </div>
                  <p className="text-blue-100 text-xs mt-1">First month is free — no card required</p>
                </div>

                {/* Payment method tabs */}
                <div className="flex border-b border-gray-200 bg-gray-50">
                  {(ADMIN_UPI || ADMIN_PHONE) && (
                    <button
                      type="button"
                      onClick={() => setPayTab('upi')}
                      className={`flex-1 py-3 text-sm font-semibold transition-all ${
                        payTab === 'upi'
                          ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      UPI / Google Pay
                    </button>
                  )}
                  {RAZORPAY_LINK && (
                    <button
                      type="button"
                      onClick={() => setPayTab('card')}
                      className={`flex-1 py-3 text-sm font-semibold transition-all ${
                        payTab === 'card'
                          ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Credit / Debit Card
                    </button>
                  )}
                </div>

                <div className="p-5 space-y-5">

                  {/* ── UPI Tab ── */}
                  {payTab === 'upi' && (ADMIN_UPI || ADMIN_PHONE) && (
                    <div className="space-y-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Step 1 — Pay ₹299 via UPI</p>

                      <div className="flex gap-5 items-start">
                        {/* QR code */}
                        {ADMIN_UPI && (
                          <div className="shrink-0 text-center">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`upi://pay?pa=${ADMIN_UPI}&pn=ShopEase&am=299&cu=INR`)}`}
                              alt="UPI QR"
                              className="w-28 h-28 rounded-xl border-2 border-gray-200"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Scan to pay ₹299</p>
                          </div>
                        )}

                        {/* UPI details */}
                        <div className="flex-1 space-y-3 min-w-0">
                          {ADMIN_UPI && (
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">UPI ID</p>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-semibold text-gray-800 break-all flex-1">{ADMIN_UPI}</span>
                                <button
                                  type="button"
                                  onClick={() => copy(ADMIN_UPI, 'upi')}
                                  className={`shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-semibold transition-colors ${
                                    copied === 'upi' ? 'bg-green-100 text-green-700' : 'bg-white border border-gray-300 text-gray-500 hover:text-blue-600 hover:border-blue-300'
                                  }`}
                                >
                                  {copied === 'upi' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                                </button>
                              </div>
                            </div>
                          )}
                          {ADMIN_PHONE && (
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Google Pay / PhonePe / Paytm</p>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-semibold text-gray-800 flex-1">{ADMIN_PHONE}</span>
                                <button
                                  type="button"
                                  onClick={() => copy(ADMIN_PHONE, 'phone')}
                                  className={`shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-semibold transition-colors ${
                                    copied === 'phone' ? 'bg-green-100 text-green-700' : 'bg-white border border-gray-300 text-gray-500 hover:text-blue-600 hover:border-blue-300'
                                  }`}
                                >
                                  {copied === 'phone' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Card Tab ── */}
                  {payTab === 'card' && RAZORPAY_LINK && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Step 1 — Pay ₹299 via Card</p>
                      <p className="text-sm text-gray-600">
                        Click below to open our secure payment page. You can pay with any credit card, debit card, or net banking.
                      </p>
                      <a
                        href={RAZORPAY_LINK}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                      >
                        <CreditCard size={16} /> Pay ₹299 via Card / Net Banking
                      </a>
                      <p className="text-[10px] text-gray-400 text-center">Powered by Razorpay · 256-bit SSL · All major cards accepted</p>
                    </div>
                  )}

                  {/* ── After payment — always shown ── */}
                  <div className="border-t border-gray-100 pt-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Step 2 — Confirm your payment</p>
                    <p className="text-sm text-gray-600">Send a screenshot of your payment on WhatsApp. We'll activate your account within a few hours.</p>
                    {ADMIN_PHONE ? (
                      <a
                        href={`https://wa.me/91${ADMIN_PHONE.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ShopEase! I've paid ₹299 for my subscription renewal.\nShop: ${shop?.shopName || ''}\nPhone: ${shop?.phone || ''}\n\n[Attach your payment screenshot]`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
                      >
                        <MessageCircle size={16} /> Send Screenshot on WhatsApp
                      </a>
                    ) : (
                      <p className="text-xs text-gray-400">Contact ShopEase support with your payment confirmation.</p>
                    )}
                  </div>

                </div>
              </div>
            )}

          </div>
        </Section>

        {/* Security */}
        <Section title="Security & Session" icon={Shield}>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <div>
                <div className="font-medium text-gray-700">Session Duration</div>
                <div className="text-xs text-gray-400">You stay logged in for 8 hours without re-entering OTP</div>
              </div>
              <span className="font-semibold text-gray-800">8 hours</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <div>
                <div className="font-medium text-gray-700">Authentication Method</div>
                <div className="text-xs text-gray-400">Mobile OTP (primary) or email + password</div>
              </div>
              <span className="font-semibold text-gray-800">OTP / Email</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <div>
                <div className="font-medium text-gray-700">Data Backup</div>
                <div className="text-xs text-gray-400">PostgreSQL backed up daily to AWS S3</div>
              </div>
              <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">Daily</span>
            </div>
          </div>
        </Section>

        <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
          <Save size={18} /> Save Settings
        </button>
      </form>
    </div>
  );
}
