import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck, LogOut, Store, Search, Edit2, Trash2,
  ToggleLeft, ToggleRight, X, Check, Eye, EyeOff, Plus,
  ChevronDown, ChevronUp, Phone, Mail, FileText, Calendar, Activity,
  Lock, AlertCircle, AlertTriangle, TrendingUp, Database,
  IndianRupee, CheckCircle, XCircle, Clock, RefreshCw,
} from 'lucide-react';

// ─── Shared field component (outside modals to prevent re-mount on keystroke) ─
function MField({ label, value, onChange, type = 'text', placeholder, required, sub, error, upper }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(upper ? e.target.value.toUpperCase() : e.target.value)}
        placeholder={placeholder}
        className={`input-field text-sm ${error ? 'border-red-400 focus:ring-red-400' : ''} ${upper ? 'uppercase tracking-wider' : ''}`}
      />
      {error && <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1"><AlertCircle size={10} />{error}</p>}
      {sub && !error && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Add Shop Modal ───────────────────────────────────────────────────────────
function AddShopModal({ onSave, onClose, existingShops }) {
  const [form, setForm] = useState({
    ownerName: '', phone: '', email: '', password: '',
    shopName: '', address: '', gstin: '', status: 'active',
  });
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: '' })); };

  const validate = () => {
    const e = {};
    if (!form.ownerName.trim()) e.ownerName = 'Required';
    if (!form.phone || !/^\d{10}$/.test(form.phone)) e.phone = 'Valid 10-digit number required';
    if (existingShops.some(s => s.phone.replace(/\D/g, '') === form.phone)) e.phone = 'Phone already registered';
    if (!form.shopName.trim()) e.shopName = 'Required';
    if (!form.address.trim()) e.address = 'Required';
    if (!form.password || form.password.length < 6) e.password = 'Min. 6 characters';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (form.email && existingShops.some(s => s.email?.toLowerCase() === form.email.toLowerCase())) e.email = 'Email already registered';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      id: `shop-${Date.now()}`,
      ownerName: form.ownerName, phone: form.phone, email: form.email || '',
      password: form.password, shopName: form.shopName, address: form.address,
      gstin: form.gstin || '', reportEmail: form.email || '',
      dailyReport: true, dailyTime: '21:00', monthlyReport: true,
      lowStockLimit: 5, pdfAttachment: true,
      createdAt: new Date().toISOString(), status: form.status,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Add New Shop</h3>
            <p className="text-xs text-gray-500 mt-0.5">Create a shop account on behalf of an owner</p>
          </div>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Owner Details</p>
          <div className="grid grid-cols-2 gap-3">
            <MField label="Owner Name" value={form.ownerName} onChange={v => set('ownerName', v)} placeholder="Ravi Kumar" required error={errors.ownerName} />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone <span className="text-red-500">*</span></label>
              <div className="flex">
                <span className="inline-flex items-center px-2 border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 text-gray-500 text-xs font-medium select-none">+91</span>
                <input type="tel" value={form.phone} onChange={e => { set('phone', e.target.value.replace(/\D/g, '').slice(0, 10)); }}
                  placeholder="98000 00000"
                  className={`flex-1 px-3 py-2.5 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-sm ${errors.phone ? 'border-red-400' : ''}`} />
              </div>
              {errors.phone && <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1"><AlertCircle size={10} />{errors.phone}</p>}
            </div>
          </div>
          <MField label="Email" type="email" value={form.email} onChange={v => set('email', v)} placeholder="owner@shop.com" sub="Optional — for email login" error={errors.email} />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Password <span className="text-red-500">*</span></label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={form.password} onChange={e => set('password', e.target.value)}
                placeholder="Temporary password (share with owner)"
                className={`input-field pl-9 text-sm ${errors.password ? 'border-red-400' : ''}`} />
            </div>
            {errors.password && <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1"><AlertCircle size={10} />{errors.password}</p>}
            <p className="text-xs text-gray-400 mt-0.5">Owner can reset their password after first login</p>
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1">Shop Details</p>
          <MField label="Shop Name" value={form.shopName} onChange={v => set('shopName', v)} placeholder="Ravi's Clothing Store" required error={errors.shopName} />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Address <span className="text-red-500">*</span></label>
            <textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2}
              placeholder="12, MG Road, Bangalore, Karnataka - 560001"
              className={`input-field resize-none text-sm ${errors.address ? 'border-red-400' : ''}`} />
            {errors.address && <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1"><AlertCircle size={10} />{errors.address}</p>}
          </div>
          <MField label="GSTIN" value={form.gstin} onChange={v => set('gstin', v)} placeholder="29ABCDE1234F1ZS" sub="Optional" upper />

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Initial Status</label>
            <div className="flex gap-2">
              {['active', 'suspended'].map(s => (
                <button key={s} type="button" onClick={() => set('status', s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all capitalize ${form.status === s ? (s === 'active' ? 'bg-green-600 text-white border-green-600' : 'bg-red-500 text-white border-red-500') : 'border-gray-300 text-gray-500'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors flex items-center justify-center gap-2">
              <Check size={16} /> Create Shop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Shop Modal ─────────────────────────────────────────────────────────
function EditShopModal({ shop, onSave, onClose }) {
  const [form, setForm] = useState({ ...shop });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">Edit Shop — {shop.shopName}</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Owner Name</label>
              <input value={form.ownerName} onChange={e => set('ownerName', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Shop Name</label>
              <input value={form.shopName} onChange={e => set('shopName', e.target.value)} className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
            <textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2} className="input-field resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">GSTIN</label>
            <input value={form.gstin} onChange={e => set('gstin', e.target.value.toUpperCase())} className="input-field uppercase tracking-wider" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Report Email</label>
            <input type="email" value={form.reportEmail} onChange={e => set('reportEmail', e.target.value)} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">Daily Reports</span>
              <button onClick={() => set('dailyReport', !form.dailyReport)}>
                {form.dailyReport ? <ToggleRight size={24} className="text-green-500" /> : <ToggleLeft size={24} className="text-gray-400" />}
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">Monthly Reports</span>
              <button onClick={() => set('monthlyReport', !form.monthlyReport)}>
                {form.monthlyReport ? <ToggleRight size={24} className="text-green-500" /> : <ToggleLeft size={24} className="text-gray-400" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Low Stock Limit (units)</label>
            <input type="number" value={form.lowStockLimit} onChange={e => set('lowStockLimit', parseInt(e.target.value))} className="input-field w-24" min={1} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => onSave(form)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors flex items-center justify-center gap-2">
              <Check size={16} /> Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shop Row / Card ─────────────────────────────────────────────────────────
function ShopCard({ shop, onEdit, onToggle, onDelete, onViewDetails }) {
  const [expanded, setExpanded] = useState(false);
  const isActive = shop.status === 'active';

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${!isActive ? 'opacity-60 border-gray-200' : 'border-gray-200 hover:border-slate-300'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0 ${isActive ? 'bg-slate-700' : 'bg-gray-400'}`}>
              {shop.shopName?.[0] || 'S'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 truncate">{shop.shopName}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {isActive ? 'Active' : 'Suspended'}
                </span>
              </div>
              <div className="text-sm text-gray-500">{shop.ownerName}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setExpanded(p => !p)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Details">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button onClick={() => onEdit(shop)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
              <Edit2 size={15} />
            </button>
            <button onClick={() => onToggle(shop.id)} className={`p-1.5 rounded-lg ${isActive ? 'text-orange-500 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`} title={isActive ? 'Suspend' : 'Activate'}>
              {isActive ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button onClick={() => onDelete(shop.id, shop.shopName)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Quick info row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
          {shop.phone && <span className="flex items-center gap-1"><Phone size={11} />{shop.phone}</span>}
          {shop.email && <span className="flex items-center gap-1"><Mail size={11} className="shrink-0" /><span className="truncate max-w-[150px]">{shop.email}</span></span>}
          {shop.gstin && <span className="flex items-center gap-1"><FileText size={11} />{shop.gstin}</span>}
          <span className="flex items-center gap-1"><Calendar size={11} />Joined {new Date(shop.createdAt).toLocaleDateString('en-IN')}</span>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-xs text-gray-400 block">Address</span><span className="text-gray-700">{shop.address || '—'}</span></div>
            <div className="space-y-2">
              <div><span className="text-xs text-gray-400 block">Report Email</span><span className="text-gray-700">{shop.reportEmail || '—'}</span></div>
              <div><span className="text-xs text-gray-400 block">Low Stock Limit</span><span className="text-gray-700">{shop.lowStockLimit} units</span></div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ['Daily Report', shop.dailyReport],
              ['Monthly Report', shop.monthlyReport],
              ['PDF Attachment', shop.pdfAttachment],
            ].map(([label, val]) => (
              <span key={label} className={`text-xs px-2.5 py-1 rounded-full ${val ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                {val ? '✓' : '✗'} {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Usage Banner ─────────────────────────────────────────────────────────────
// Shows free-tier consumption (shops + DB size) with colour-coded progress bars.
// Calls /api/admin/usage authenticated with the admin key from .env.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || '';

function UsageBanner() {
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    if (!ADMIN_KEY) return;
    fetch(`${API_BASE}/api/admin/usage`, {
      headers: { Authorization: `Bearer ${ADMIN_KEY}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setUsage(data); })
      .catch(() => {});
  }, []);

  if (!usage) return null;

  const { shops, database, status } = usage;

  const barColor = pct =>
    pct >= 95 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-green-500';

  const bannerStyle =
    status === 'critical' ? 'bg-red-50 border-red-200' :
    status === 'warning'  ? 'bg-amber-50 border-amber-200' :
                            'bg-green-50 border-green-100';

  const textColor =
    status === 'critical' ? 'text-red-700' :
    status === 'warning'  ? 'text-amber-700' :
                            'text-green-700';

  const Icon = status === 'ok' ? TrendingUp : AlertTriangle;
  const iconColor =
    status === 'critical' ? 'text-red-500' :
    status === 'warning'  ? 'text-amber-500' :
                            'text-green-500';

  return (
    <div className={`rounded-xl border p-4 mb-6 ${bannerStyle}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={15} className={iconColor} />
          <span className={`text-sm font-semibold ${textColor}`}>
            {status === 'critical' ? 'Critical — upgrade soon to avoid interruptions' :
             status === 'warning'  ? 'Warning — approaching free tier limits (80%+)' :
                                     'Free tier usage'}
          </span>
        </div>
        {status !== 'ok' && (
          <a
            href="https://supabase.com/pricing"
            target="_blank"
            rel="noreferrer"
            className={`text-xs font-semibold px-3 py-1 rounded-full text-white ${status === 'critical' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}
          >
            Upgrade Now
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500 flex items-center gap-1"><Store size={11} /> Shops</span>
            <span className="text-xs font-semibold text-gray-700">{shops.count} / {shops.limit}</span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor(shops.pct)}`} style={{ width: `${Math.min(shops.pct, 100)}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{shops.pct}% used</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500 flex items-center gap-1"><Database size={11} /> Database</span>
            <span className="text-xs font-semibold text-gray-700">{database.mb} MB / {database.limit} MB</span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor(database.pct)}`} style={{ width: `${Math.min(database.pct, 100)}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{database.pct}% used</p>
        </div>
      </div>
    </div>
  );
}

// ─── Subscription Panel ───────────────────────────────────────────────────────
function SubscriptionPanel() {
  const [shops, setShops]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(null);
  const [filter, setFilter]   = useState('all');

  const fetchShops = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/admin/shops`, {
      headers: { Authorization: `Bearer ${ADMIN_KEY}` },
    })
      .then(r => r.ok ? r.json() : { shops: [] })
      .then(d => { setShops(d.shops || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchShops(); }, []);

  const markPaid = async (shopId, months = 1) => {
    setMarking(shopId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/shops/${shopId}/mark-paid`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ADMIN_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ months }),
      });
      const data = await res.json();
      if (res.ok) {
        setShops(prev => prev.map(s => s.id === shopId
          ? { ...s, subscriptionPaidUntil: data.subscriptionPaidUntil, subscriptionStatus: 'active', daysRemaining: data.daysRemaining }
          : s
        ));
      }
    } catch {}
    setMarking(null);
  };

  const paid     = shops.filter(s => s.subscriptionStatus === 'active').length;
  const expired  = shops.filter(s => s.subscriptionStatus === 'expired').length;
  const expiring = shops.filter(s => s.subscriptionStatus === 'active' && s.daysRemaining <= 7).length;
  const revenue  = paid * 299;

  const filtered = shops.filter(s => {
    if (filter === 'paid')    return s.subscriptionStatus === 'active';
    if (filter === 'expired') return s.subscriptionStatus === 'expired';
    if (filter === 'soon')    return s.subscriptionStatus === 'active' && s.daysRemaining <= 7;
    return true;
  });

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Subscriptions</h2>
          <p className="text-sm text-slate-500 mt-0.5">₹299/month per shop · Mark paid after collecting payment</p>
        </div>
        <button onClick={fetchShops} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 border border-gray-200 rounded-lg px-3 py-2">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Revenue stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { icon: IndianRupee, label: 'Expected / Month', value: `₹${revenue.toLocaleString('en-IN')}`, color: 'bg-green-600' },
          { icon: CheckCircle, label: 'Paid / Active',    value: paid,    color: 'bg-blue-600' },
          { icon: XCircle,     label: 'Expired',          value: expired, color: 'bg-red-500' },
          { icon: Clock,       label: 'Expiring ≤7 days', value: expiring, color: 'bg-amber-500' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center shrink-0`}>
              <Icon size={18} className="text-white" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex bg-gray-100 rounded-lg p-1 gap-1 w-fit mb-4">
        {[['all','All'],['paid','Paid'],['expired','Expired'],['soon','Expiring Soon']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${filter === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No shops in this filter</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Shop', 'Owner', 'Phone', 'Paid Until', 'Status', 'Action'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(s => {
                  const isActive  = s.subscriptionStatus === 'active';
                  const days      = parseInt(s.daysRemaining ?? 0);
                  const isExpiring = isActive && days <= 7;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-800">{s.shopName}</td>
                      <td className="px-4 py-3 text-gray-600">{s.ownerName}</td>
                      <td className="px-4 py-3 text-gray-500">{s.phone}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtDate(s.subscriptionPaidUntil)}</td>
                      <td className="px-4 py-3">
                        {isActive ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${isExpiring ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                            {isExpiring ? <Clock size={10} /> : <CheckCircle size={10} />}
                            {isExpiring ? `Expires in ${days}d` : `Active · ${days}d left`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-600">
                            <XCircle size={10} /> Expired
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => markPaid(s.id, 1)}
                          disabled={marking === s.id}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-50 transition-colors whitespace-nowrap">
                          <IndianRupee size={11} />
                          {marking === s.id ? 'Saving…' : 'Mark Paid +1 Month'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Admin Layout ─────────────────────────────────────────────────────────────
function AdminLayout({ children }) {
  const { adminLogout } = useApp();
  const navigate = useNavigate();
  const handleLogout = () => { adminLogout(); navigate('/admin'); };
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <ShieldCheck size={22} />
          <span className="font-bold text-lg">ShopEase Admin</span>
          <span className="text-slate-400 text-sm hidden sm:block">System Administration</span>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-slate-300 hover:text-white text-sm transition-colors">
          <LogOut size={16} /> Logout
        </button>
      </header>
      <main className="max-w-7xl mx-auto p-4 md:p-6">{children}</main>
    </div>
  );
}

// ─── Main Admin Dashboard ─────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { allShops, adminUpdateShop, adminToggleShop, adminDeleteShop, registerShop } = useApp();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingShop, setEditingShop] = useState(null);
  const [showAddShop, setShowAddShop] = useState(false);

  const filtered = allShops.filter(s => {
    const matchesQuery = !query || [s.shopName, s.ownerName, s.phone, s.email, s.gstin]
      .some(v => v?.toLowerCase().includes(query.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const handleDelete = (id, name) => {
    if (window.confirm(`Permanently delete shop "${name}"? This cannot be undone.`)) {
      adminDeleteShop(id);
    }
  };

  const handleSave = (updates) => {
    adminUpdateShop(editingShop.id, updates);
    setEditingShop(null);
  };

  const handleAddShop = (shopData) => {
    // Directly add to allShops (bypasses the current-shop/products logic of registerShop)
    adminUpdateShop && null; // no-op — use setAllShops via registerShop logic below
    registerShop({
      ownerName: shopData.ownerName, phone: shopData.phone, email: shopData.email,
      password: shopData.password, shopName: shopData.shopName, address: shopData.address,
      gstin: shopData.gstin,
    });
    // Override the status if admin set it to suspended
    if (shopData.status === 'suspended') {
      // We find the newly added shop by phone and toggle it
      setTimeout(() => {
        const shops = JSON.parse(localStorage.getItem('shopease_shops') || '[]');
        const added = shops.find(s => s.phone === shopData.phone);
        if (added) adminToggleShop(added.id);
      }, 100);
    }
    setShowAddShop(false);
  };

  // Stats
  const totalShops = allShops.length;
  const activeShops = allShops.filter(s => s.status === 'active').length;
  const withGST = allShops.filter(s => s.gstin).length;
  const withReports = allShops.filter(s => s.dailyReport || s.monthlyReport).length;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Shop Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">View, edit, and manage all registered shops</p>
        </div>
        <button onClick={() => setShowAddShop(true)}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm">
          <Plus size={17} /> Add Shop
        </button>
      </div>

      <UsageBanner />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { icon: Store, label: 'Total Shops', value: totalShops, color: 'bg-blue-600' },
          { icon: Activity, label: 'Active', value: activeShops, color: 'bg-green-600' },
          { icon: FileText, label: 'GST Registered', value: withGST, color: 'bg-purple-600' },
          { icon: Mail, label: 'Email Reports On', value: withReports, color: 'bg-orange-600' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center shrink-0`}>
              <Icon size={18} className="text-white" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by shop name, owner, phone, email, GSTIN..."
            className="input-field pl-10"
          />
          {query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1 self-start">
          {[['all', 'All'], ['active', 'Active'], ['suspended', 'Suspended']].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${statusFilter === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-3">{filtered.length} shop{filtered.length !== 1 ? 's' : ''} found</p>

      {/* Shop cards */}
      <div className="space-y-3">
        {filtered.map(shop => (
          <ShopCard
            key={shop.id}
            shop={shop}
            onEdit={setEditingShop}
            onToggle={adminToggleShop}
            onDelete={handleDelete}
          />
        ))}
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            <Store size={40} className="mx-auto mb-3 opacity-30" />
            <p>No shops found</p>
          </div>
        )}
      </div>

      <SubscriptionPanel />

      {editingShop && (
        <EditShopModal shop={editingShop} onSave={handleSave} onClose={() => setEditingShop(null)} />
      )}
      {showAddShop && (
        <AddShopModal existingShops={allShops} onSave={handleAddShop} onClose={() => setShowAddShop(false)} />
      )}
    </AdminLayout>
  );
}
