import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Edit2, Trash2, Tag, ToggleLeft, ToggleRight, X, Check, Info } from 'lucide-react';

const COUPON_TYPES = [
  {
    value: 'percentage',
    label: '% Off Bill',
    icon: '%',
    hint: 'A fixed % is deducted from the total bill.',
    fieldLabel: 'Discount %',
    fieldPlaceholder: '10',
    hasValueField: true,
  },
  {
    value: 'flat',
    label: '₹ Off Bill',
    icon: '₹',
    hint: 'A fixed rupee amount is deducted from the total bill.',
    fieldLabel: 'Discount ₹',
    fieldPlaceholder: '200',
    hasValueField: true,
  },
  {
    value: 'buyget',
    label: 'Buy N Get N',
    icon: '🎁',
    hint: 'Customer buys N items and gets N items free. You choose the rule below.',
    hasValueField: false,
  },
];


const EMPTY_FORM = {
  code: '', type: 'percentage', value: '', minPurchase: '', expiryDate: '', isActive: true, buyN: 1, getFree: 1,
};

function couponDescription(coupon) {
  if (coupon.type === 'percentage') return `${coupon.value}% off the bill`;
  if (coupon.type === 'flat') return `₹${coupon.value} off the bill`;
  if (coupon.type === 'buyget') return `Buy ${coupon.buyN} Get ${coupon.getFree ?? coupon.buyN} Free — cashier picks free items at billing`;
  return `₹${coupon.value} off the bill`;
}

function couponPreview(form) {
  if (form.type === 'buyget') return null;
  const v = parseFloat(form.value);
  if (!v || v <= 0) return null;
  const exampleBill = form.minPurchase ? Math.max(parseFloat(form.minPurchase) * 1.5, 1000) : 1000;
  if (form.type === 'percentage') {
    if (v > 100) return { warn: true, text: 'Percentage cannot be more than 100' };
    const save = Math.round(exampleBill * v / 100);
    return { warn: false, text: `Example: on a ₹${exampleBill.toLocaleString('en-IN')} bill → customer saves ₹${save.toLocaleString('en-IN')} and pays ₹${(exampleBill - save).toLocaleString('en-IN')}` };
  }
  if (form.type === 'flat') {
    return { warn: false, text: `₹${v.toLocaleString('en-IN')} will be deducted from the customer's total` };
  }
  return null;
}

function CouponModal({ coupon, onSave, onClose }) {
  const safeType = COUPON_TYPES.find(t => t.value === coupon?.type) ? coupon.type : 'percentage';
  const [form, setForm] = useState({ ...EMPTY_FORM, ...(coupon || {}), type: safeType, buyN: coupon?.buyN || 1, getFree: coupon?.getFree ?? coupon?.buyN ?? 1 });
  const [errors, setErrors] = useState({});

  const typeInfo = COUPON_TYPES.find(t => t.value === form.type) || COUPON_TYPES[0];

  const validate = () => {
    const e = {};
    if (!form.code.trim()) e.code = 'Coupon code is required';
    if (typeInfo.hasValueField) {
      if (!form.value || parseFloat(form.value) <= 0) e.value = 'Enter a valid value';
      if (form.type === 'percentage' && parseFloat(form.value) > 100) e.value = 'Cannot be more than 100%';
    }
    if (!form.expiryDate) e.expiryDate = 'Expiry date is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      ...form,
      code: form.code.trim().toUpperCase(),
      value: typeInfo.hasValueField ? parseFloat(form.value) : 0,
      minPurchase: parseFloat(form.minPurchase) || 0,
      buyN: form.type === 'buyget' ? form.buyN : undefined,
      getFree: form.type === 'buyget' ? form.getFree : undefined,
    });
  };

  const preview = couponPreview(form);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <h3 className="text-lg font-bold text-gray-800">{coupon ? 'Edit Coupon' : 'Create Coupon'}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">

          {/* Coupon Code */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Coupon Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.code}
              onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase().replace(/\s/g, '') }))}
              placeholder="e.g. SAVE10, DIWALI50, FREEGIFT"
              className={`input-field uppercase font-mono tracking-widest text-lg ${errors.code ? 'border-red-400' : ''}`}
            />
            {errors.code && <p className="text-xs text-red-600 mt-1">{errors.code}</p>}
            <p className="text-xs text-gray-400 mt-1">Customer types this code at billing</p>
          </div>

          {/* Offer Type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Offer Type</label>
            <div className="grid grid-cols-3 gap-2">
              {COUPON_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, type: t.value, value: '' }))}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-xs font-bold transition-all ${
                    form.type === t.value
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <span className="text-xl">{t.icon}</span>
                  <span className="text-center leading-tight">{t.label}</span>
                </button>
              ))}
            </div>

            {/* Hint */}
            <div className="mt-2 flex items-start gap-1.5 bg-blue-50 rounded-lg px-3 py-2.5">
              <Info size={13} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700">{typeInfo.hint}</p>
            </div>
          </div>

          {/* Buy N Get M — free number inputs */}
          {form.type === 'buyget' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Customer Buys (N) <span className="text-red-500">*</span></label>
                  <input
                    type="number" min="1" max="99"
                    value={form.buyN}
                    onChange={e => setForm(p => ({ ...p, buyN: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="input-field text-center text-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Gets Free (M) <span className="text-red-500">*</span></label>
                  <input
                    type="number" min="1" max="99"
                    value={form.getFree}
                    onChange={e => setForm(p => ({ ...p, getFree: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="input-field text-center text-lg font-bold"
                  />
                </div>
              </div>
              {form.buyN >= 1 && form.getFree >= 1 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                  <p className="text-sm font-bold text-orange-800">
                    Buy any {form.buyN} item{form.buyN > 1 ? 's' : ''} → get any {form.getFree} item{form.getFree > 1 ? 's' : ''} free
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Discount value — only for % and ₹ types */}
          {typeInfo.hasValueField && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {typeInfo.fieldLabel} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={form.value}
                  min="0"
                  max={form.type === 'percentage' ? 100 : undefined}
                  onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                  placeholder={typeInfo.fieldPlaceholder}
                  className={`input-field ${errors.value ? 'border-red-400' : ''}`}
                />
                {errors.value && <p className="text-xs text-red-600 mt-1">{errors.value}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Min. Bill (₹) — optional</label>
                <input
                  type="number"
                  value={form.minPurchase}
                  min="0"
                  onChange={e => setForm(p => ({ ...p, minPurchase: e.target.value }))}
                  placeholder="0"
                  className="input-field"
                />
              </div>
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs ${preview.warn ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              <Info size={13} className="mt-0.5 shrink-0" />
              <span className="font-medium">{preview.text}</span>
            </div>
          )}

          {/* Expiry date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Valid Until <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.expiryDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))}
              className={`input-field ${errors.expiryDate ? 'border-red-400' : ''}`}
            />
            {errors.expiryDate && <p className="text-xs text-red-600 mt-1">{errors.expiryDate}</p>}
            <p className="text-xs text-gray-400 mt-1">Coupon stops working after this date</p>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
            <input
              type="checkbox"
              id="active"
              checked={form.isActive}
              onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
              className="w-4 h-4 accent-blue-600 rounded"
            />
            <label htmlFor="active" className="text-sm text-gray-700 cursor-pointer select-none">
              <span className="font-medium">Active</span>
              <span className="text-gray-400 text-xs ml-1">— uncheck to pause this coupon anytime</span>
            </label>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Check size={16} /> {coupon ? 'Update' : 'Create Coupon'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Coupons() {
  const { coupons, addCoupon, updateCoupon, deleteCoupon } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editCoupon, setEditCoupon] = useState(null);

  const handleSave = (data) => {
    if (editCoupon?.id) updateCoupon(editCoupon.id, data);
    else addCoupon(data);
    setShowModal(false);
    setEditCoupon(null);
  };

  const handleDelete = (id, code) => {
    if (window.confirm(`Delete coupon "${code}"?`)) deleteCoupon(id);
  };

  const isExpired = (date) => new Date(date) < new Date();

  const typeChip = (coupon) => {
    if (coupon.type === 'percentage') return { label: `${coupon.value}% off`, color: 'bg-purple-50 text-purple-700' };
    if (coupon.type === 'buyget') return { label: `Buy ${coupon.buyN} Get ${coupon.getFree ?? coupon.buyN} Free`, color: 'bg-orange-50 text-orange-700' };
    return { label: `₹${coupon.value} off`, color: 'bg-blue-50 text-blue-700' };
  };

  const activeCoupons = coupons.filter(c => c.isActive && !isExpired(c.expiryDate));
  const inactiveCoupons = coupons.filter(c => !c.isActive || isExpired(c.expiryDate));

  const CouponCard = ({ coupon, faded }) => {
    const chip = typeChip(coupon);
    const expired = isExpired(coupon.expiryDate);
    return (
      <div className={`card flex flex-col gap-3 ${faded ? 'opacity-55' : ''}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-xl text-gray-800 tracking-widest">{coupon.code}</span>
              {!faded && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>}
              {faded && expired && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Expired</span>}
              {faded && !expired && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Paused</span>}
            </div>
            <p className="text-sm text-gray-600 mt-0.5">{couponDescription(coupon)}</p>
            {coupon.minPurchase > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">Min. bill ₹{coupon.minPurchase.toLocaleString('en-IN')}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!faded && (
              <button onClick={() => updateCoupon(coupon.id, { isActive: false })} className="text-green-500 hover:opacity-70" title="Pause">
                <ToggleRight size={26} />
              </button>
            )}
            {faded && !expired && (
              <button onClick={() => updateCoupon(coupon.id, { isActive: true })} className="text-gray-400 hover:text-green-500" title="Resume">
                <ToggleLeft size={26} />
              </button>
            )}
            <button onClick={() => { setEditCoupon(coupon); setShowModal(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
              <Edit2 size={15} />
            </button>
            <button onClick={() => handleDelete(coupon.id, coupon.code)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
              <Trash2 size={15} />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`px-2.5 py-1 rounded-full font-semibold ${chip.color}`}>{chip.label}</span>
          <span className={`px-2.5 py-1 rounded-full ${expired ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
            {expired ? 'Expired' : 'Valid till'} {new Date(coupon.expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          {!faded && (
            <span className="bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full">
              Used {coupon.timesUsed} time{coupon.timesUsed !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Coupons & Offers</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {activeCoupons.length} active · {coupons.length} total
          </p>
        </div>
        <button onClick={() => { setEditCoupon(null); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> New Coupon
        </button>
      </div>

      {coupons.length > 0 && (
        <div className="mb-5 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
          <Info size={16} className="shrink-0 mt-0.5" />
          <span>
            At billing, the cashier enters the coupon code and clicks <strong>Apply</strong>.
            For Free Item coupons, the owner picks which item is free in front of the customer.
          </span>
        </div>
      )}

      {activeCoupons.length > 0 && (
        <>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Active</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {activeCoupons.map(c => <CouponCard key={c.id} coupon={c} faded={false} />)}
          </div>
        </>
      )}

      {inactiveCoupons.length > 0 && (
        <>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Paused / Expired</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inactiveCoupons.map(c => <CouponCard key={c.id} coupon={c} faded={true} />)}
          </div>
        </>
      )}

      {coupons.length === 0 && (
        <div className="card text-center py-14">
          <Tag size={44} className="mx-auto mb-3 text-gray-200" />
          <p className="font-semibold text-gray-500 mb-1">No coupons yet</p>
          <p className="text-sm text-gray-400 mb-5">Create your first coupon in 30 seconds</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mx-auto">
            <Plus size={16} className="inline mr-1" /> Create Coupon
          </button>
        </div>
      )}

      {showModal && (
        <CouponModal coupon={editCoupon} onSave={handleSave} onClose={() => { setShowModal(false); setEditCoupon(null); }} />
      )}
    </div>
  );
}
