import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Plus, Trash2, X, IndianRupee, Home, Zap, Users,
  Package, Truck, MoreHorizontal, Calendar, Wallet
} from 'lucide-react';

const CATEGORIES = [
  { id: 'rent',        label: 'Rent',         icon: Home,           color: 'text-blue-600 bg-blue-50' },
  { id: 'electricity', label: 'Electricity',   icon: Zap,            color: 'text-yellow-600 bg-yellow-50' },
  { id: 'staff',       label: 'Staff / Wages', icon: Users,          color: 'text-green-600 bg-green-50' },
  { id: 'purchase',    label: 'Purchase',      icon: Package,        color: 'text-purple-600 bg-purple-50' },
  { id: 'transport',   label: 'Transport',     icon: Truck,          color: 'text-orange-600 bg-orange-50' },
  { id: 'other',       label: 'Other',         icon: MoreHorizontal, color: 'text-gray-600 bg-gray-100' },
];

const catFor = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[5];

const today = () => new Date().toISOString().split('T')[0];

export default function Expenses() {
  const { expenses, addExpense, deleteExpense } = useApp();

  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(null);
  const [dateFilter, setDateFilter] = useState('month');
  const [form, setForm]             = useState({ category: 'other', amount: '', note: '', expenseDate: today() });

  const filtered = useMemo(() => {
    const now = new Date();
    return expenses.filter(e => {
      const d = new Date((e.expenseDate || e.createdAt || '').replace('T', ' '));
      if (dateFilter === 'today') return d.toDateString() === now.toDateString();
      if (dateFilter === 'week')  return (now - d) / 86400000 <= 7;
      if (dateFilter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      return true;
    });
  }, [expenses, dateFilter]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(e => {
      const key = (e.expenseDate || (e.createdAt || '').split('T')[0]) + '';
      (map[key] = map[key] || []).push(e);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const totalFiltered = filtered.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

  const catTotal = (catId) =>
    filtered.filter(e => e.category === catId).reduce((s, e) => s + parseFloat(e.amount || 0), 0);

  const submit = async (ev) => {
    ev.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) return;
    setSaving(true);
    await addExpense({ ...form, amount: parseFloat(form.amount) });
    setForm({ category: 'other', amount: '', note: '', expenseDate: today() });
    setShowForm(false);
    setSaving(false);
  };

  const remove = async (id) => {
    setDeleting(id);
    await deleteExpense(id);
    setDeleting(null);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet size={22} className="text-red-600" /> Expenses
          </h2>
          <p className="text-gray-500 text-sm mt-0.5">Track rent, electricity, staff wages, and other costs</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Add Expense
        </button>
      </div>

      {/* Add expense modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">Add Expense</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    return (
                      <button type="button" key={cat.id}
                        onClick={() => setForm(f => ({ ...f, category: cat.id }))}
                        className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                          form.category === cat.id
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                        <Icon size={18} />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Amount (₹)</label>
                <div className="relative">
                  <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="number" min="1" step="0.01" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00" className="input-field pl-9" required autoFocus />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Note (optional)</label>
                <input type="text" value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. May rent, Electrician bill" className="input-field" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Date</label>
                <div className="relative">
                  <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="date" value={form.expenseDate}
                    onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))}
                    className="input-field pl-9" />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving || !form.amount}
                  className="btn-primary flex-1 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Date filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { id: 'today', label: 'Today' },
          { id: 'week',  label: 'This Week' },
          { id: 'month', label: 'This Month' },
          { id: 'all',   label: 'All Time' },
        ].map(f => (
          <button key={f.id} onClick={() => setDateFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              dateFilter === f.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          <div className="stat-card bg-red-50 border border-red-100 col-span-2 sm:col-span-1">
            <div className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Total Expenses</div>
            <div className="text-2xl font-black text-red-700">
              ₹{Math.round(totalFiltered).toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-red-400 mt-0.5">{filtered.length} entries</div>
          </div>
          {CATEGORIES.filter(c => catTotal(c.id) > 0).slice(0, 4).map(cat => {
            const Icon = cat.icon;
            return (
              <div key={cat.id} className="stat-card">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cat.color}`}>
                    <Icon size={14} />
                  </div>
                  <span className="text-xs text-gray-500 font-medium">{cat.label}</span>
                </div>
                <div className="text-lg font-bold text-gray-900">
                  ₹{Math.round(catTotal(cat.id)).toLocaleString('en-IN')}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Expense list grouped by date */}
      {grouped.length === 0 ? (
        <div className="card text-center py-16">
          <Wallet size={44} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-500 font-medium mb-1">No expenses recorded</p>
          <p className="text-gray-400 text-sm">Tap "Add Expense" to log rent, electricity, staff wages, etc.</p>
          <button onClick={() => setShowForm(true)} className="mt-4 btn-primary text-sm py-2 px-5">
            <Plus size={15} className="inline mr-1" /> Add Expense
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, items]) => (
            <div key={date} className="card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-600">
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-IN', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                  })}
                </span>
                <span className="text-sm font-bold text-red-600">
                  ₹{Math.round(items.reduce((s, e) => s + parseFloat(e.amount || 0), 0)).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="space-y-2">
                {items.map(exp => {
                  const cat = catFor(exp.category);
                  const Icon = cat.icon;
                  return (
                    <div key={exp.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cat.color}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800">{cat.label}</div>
                        {exp.note && <div className="text-xs text-gray-500 truncate">{exp.note}</div>}
                      </div>
                      <div className="text-sm font-bold text-gray-900 shrink-0">
                        ₹{parseFloat(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                      </div>
                      <button
                        onClick={() => remove(exp.id)}
                        disabled={deleting === exp.id}
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 shrink-0"
                        title="Delete expense"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
