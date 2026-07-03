import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useDebounce } from '../hooks/useDebounce';
import {
  Plus, Edit2, Trash2, Search, X, AlertTriangle, Package,
  Check, History, TrendingUp, TrendingDown, ArrowUpCircle,
  ArrowDownCircle, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';

const CATEGORIES = ['clothing', 'footwear', 'grocery', 'electronics', 'other'];

function Field({ label, value, onChange, type = 'text', required, error, children, ...rest }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children || (
        <input type={type} value={value ?? ''} onChange={onChange}
          className={`input-field ${error ? 'border-red-400' : ''}`} {...rest} />
      )}
      {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
    </div>
  );
}

// ─── Add / Edit Product Modal ─────────────────────────────────────────────────
function ProductModal({ product, onSave, onClose }) {
  const [form, setForm] = useState(product || {
    name: '', category: 'clothing', barcode: '', mrp: '', sellingPrice: '',
    costPrice: '', stockQty: '', minStockAlert: 5, imageUrl: '', isActive: true,
  });
  const [errors, setErrors] = useState({});
  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Product name is required';
    if (!form.mrp || Number(form.mrp) <= 0) e.mrp = 'Valid MRP required';
    if (form.stockQty === '' || form.stockQty === null) e.stockQty = 'Stock quantity required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      ...form,
      mrp: parseFloat(form.mrp),
      sellingPrice: parseFloat(form.sellingPrice) || 0,
      costPrice: parseFloat(form.costPrice) || 0,
      stockQty: parseInt(form.stockQty),
      minStockAlert: parseInt(form.minStockAlert) || 5,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">{product ? 'Edit Product' : 'Add New Product'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Product Name" required value={form.name}
            onChange={e => set('name', e.target.value)} placeholder="e.g. Blue Cotton Shirt (L)" error={errors.name} />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category <span className="text-red-500">*</span></label>
            <select value={form.category} onChange={e => set('category', e.target.value)} className="input-field capitalize">
              {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
          </div>
          <Field label="Barcode Number" value={form.barcode}
            onChange={e => set('barcode', e.target.value)} placeholder="Scan or type barcode (optional)" />
          <div className="grid grid-cols-3 gap-3">
            <Field label="MRP (₹)" type="number" required value={form.mrp}
              onChange={e => set('mrp', e.target.value)} placeholder="1200" error={errors.mrp} min="0" />
            <Field label="Selling Price (₹)" type="number" value={form.sellingPrice}
              onChange={e => set('sellingPrice', e.target.value)} placeholder="Leave 0 for POS" min="0" />
            <Field label="Cost Price (₹)" type="number" value={form.costPrice}
              onChange={e => set('costPrice', e.target.value)} placeholder="700" min="0" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Opening Stock Qty" type="number" required value={form.stockQty}
              onChange={e => set('stockQty', e.target.value)} placeholder="100" error={errors.stockQty} min="0" />
            <Field label="Low Stock Alert (units)" type="number" value={form.minStockAlert}
              onChange={e => set('minStockAlert', e.target.value)} placeholder="5" min="0" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id="isActive" checked={form.isActive}
              onChange={e => set('isActive', e.target.checked)} className="rounded" />
            <label htmlFor="isActive" className="text-sm text-gray-700">Active (visible during billing)</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Check size={16} /> {product ? 'Update Product' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Stock (Purchase) Modal ───────────────────────────────────────────────
function AddStockModal({ product, onSave, onClose }) {
  const [qty, setQty]           = useState('');
  const [supplier, setSupplier] = useState('');
  const [note, setNote]         = useState('');
  const [mrp, setMrp]           = useState(String(product.mrp || ''));
  const [cost, setCost]         = useState(String(product.costPrice || ''));
  const [error, setError]       = useState('');

  const handleSave = () => {
    const q = parseInt(qty);
    if (!q || q <= 0) { setError('Enter a valid quantity'); return; }
    onSave(q, supplier.trim(), note.trim(), parseFloat(cost) || product.costPrice || 0, parseFloat(mrp) || 0);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Add Stock</h3>
            <p className="text-sm text-gray-500 mt-0.5">{product.name} · current: <span className="font-bold text-blue-700">{product.stockQty} pcs</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Quantity to Add <span className="text-red-500">*</span></label>
            <input type="number" min="1" value={qty} onChange={e => { setQty(e.target.value); setError(''); }}
              placeholder="e.g. 50" className={`input-field text-2xl font-bold text-center ${error ? 'border-red-400' : ''}`} autoFocus />
            {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
            {qty && parseInt(qty) > 0 && (
              <p className="text-sm text-green-700 font-semibold mt-1 text-center">
                {product.stockQty} + {parseInt(qty)} = <span className="text-lg font-black">{product.stockQty + parseInt(qty)} pcs</span>
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Supplier / Source</label>
            <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)}
              placeholder="e.g. Textile Mart, Mumbai" className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">MRP (₹)</label>
            <input type="number" min="0" value={mrp} onChange={e => setMrp(e.target.value)}
              placeholder={String(product.mrp || 0)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cost Price per Piece (₹)</label>
            <input type="number" min="0" value={cost} onChange={e => setCost(e.target.value)}
              placeholder={String(product.costPrice || 0)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Note / Remarks</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="e.g. Summer collection batch" className="input-field" />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <ArrowUpCircle size={16} /> Add Stock
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stock History (Ledger) Modal ─────────────────────────────────────────────
function StockHistoryModal({ product, ledger, onClose }) {
  const entries = [...ledger]
    .filter(e => e.productId === product.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalIn  = entries.filter(e => e.type !== 'sale').reduce((s, e) => s + e.qty, 0);
  const totalOut = entries.filter(e => e.type === 'sale').reduce((s, e) => s + e.qty, 0);
  const openingEntry = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date))[0];

  const typeConfig = {
    opening:  { label: 'Opening Stock', icon: Package,        color: 'text-blue-700',  bg: 'bg-blue-50',   border: 'border-blue-200',   sign: '+' },
    purchase: { label: 'Purchase',      icon: ArrowUpCircle,  color: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-200',  sign: '+' },
    sale:     { label: 'Sale',          icon: ArrowDownCircle,color: 'text-red-600',   bg: 'bg-red-50',    border: 'border-red-200',    sign: '−' },
    return:   { label: 'Return',        icon: RefreshCw,       color: 'text-orange-700',bg: 'bg-orange-50', border: 'border-orange-200', sign: '+' },
  };

  const fmt = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-800">{product.name}</h3>
            <p className="text-sm text-gray-500 capitalize">{product.category} · barcode: {product.barcode || '—'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3 p-5 shrink-0">
          <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
            <p className="text-xs text-blue-500 font-semibold mb-1">Opening Stock</p>
            <p className="text-2xl font-black text-blue-700">{openingEntry?.qty ?? '—'}</p>
            <p className="text-xs text-blue-400 mt-0.5">units</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
            <p className="text-xs text-green-600 font-semibold mb-1">Total Added</p>
            <p className="text-2xl font-black text-green-700">+{totalIn}</p>
            <p className="text-xs text-green-400 mt-0.5">units purchased</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center border border-red-100">
            <p className="text-xs text-red-500 font-semibold mb-1">Total Sold</p>
            <p className="text-2xl font-black text-red-600">−{totalOut}</p>
            <p className="text-xs text-red-400 mt-0.5">units sold</p>
          </div>
          <div className={`rounded-xl p-3 text-center border ${product.stockQty === 0 ? 'bg-red-50 border-red-200' : product.stockQty <= product.minStockAlert ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
            <p className={`text-xs font-semibold mb-1 ${product.stockQty === 0 ? 'text-red-500' : product.stockQty <= product.minStockAlert ? 'text-orange-600' : 'text-gray-500'}`}>Current Stock</p>
            <p className={`text-2xl font-black ${product.stockQty === 0 ? 'text-red-600' : product.stockQty <= product.minStockAlert ? 'text-orange-600' : 'text-gray-800'}`}>{product.stockQty}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {product.stockQty === 0 ? 'OUT OF STOCK' : product.stockQty <= product.minStockAlert ? 'LOW STOCK' : 'available'}
            </p>
          </div>
        </div>

        {/* Ledger table */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Full Stock History</p>
          {entries.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <History size={30} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No stock history yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map(entry => {
                const cfg = typeConfig[entry.type] || typeConfig.purchase;
                const Icon = cfg.icon;
                return (
                  <div key={entry.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${cfg.bg} border ${cfg.border}`}>
                      <Icon size={16} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        {entry.supplierName && <span className="text-xs text-gray-500">· {entry.supplierName}</span>}
                        {entry.billNumber && entry.billNumber !== 'Multiple' && (
                          <span className="text-xs text-gray-400">· {entry.billNumber}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {fmt(entry.date)}
                        {entry.note && <span className="ml-2 text-gray-400">— {entry.note}</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-lg font-black ${entry.type === 'sale' ? 'text-red-600' : 'text-green-700'}`}>
                        {cfg.sign}{entry.qty}
                      </p>
                      <p className="text-xs text-gray-400">bal: <span className="font-bold text-gray-700">{entry.balanceAfter}</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Products Page ───────────────────────────────────────────────────────
export default function Products() {
  const { products, addProduct, updateProduct, deleteProduct, addStockPurchase, stockLedger } = useApp();
  const [query, setQuery]             = useState('');
  const [filter, setFilter]           = useState('all');
  const [showModal, setShowModal]     = useState(false);
  const [modalProduct, setModalProduct] = useState(null);
  const [addStockFor, setAddStockFor] = useState(null);
  const [historyFor, setHistoryFor]   = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);

  const debouncedQuery = useDebounce(query, 200);

  const filtered = useMemo(() => products.filter(p => {
    const q = debouncedQuery.toLowerCase();
    const matchesQuery = !debouncedQuery || p.name.toLowerCase().includes(q) || p.category.includes(q) || p.barcode?.includes(debouncedQuery);
    const matchesFilter =
      filter === 'all' ? true :
      filter === 'low_stock' ? (p.stockQty > 0 && p.stockQty <= p.minStockAlert) :
      filter === 'out_of_stock' ? p.stockQty === 0 : true;
    return matchesQuery && matchesFilter;
  }), [products, debouncedQuery, filter]);

  const handleSave = (data) => {
    if (modalProduct?.id) updateProduct(modalProduct.id, data);
    else addProduct(data);
    setShowModal(false); setModalProduct(null);
  };

  const handleAddStock = (qty, supplier, note, cost, mrp) => {
    addStockPurchase(addStockFor.id, qty, supplier, note, cost);
    if (mrp > 0) updateProduct(addStockFor.id, { mrp, sellingPrice: mrp });
    setAddStockFor(null);
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`Delete "${name}"? This will also remove its stock history.`)) deleteProduct(id);
  };

  const productLedger = (product) => {
    const entries = stockLedger.filter(e => e.productId === product.id);
    const totalIn  = entries.filter(e => e.type !== 'sale').reduce((s, e) => s + e.qty, 0);
    const totalOut = entries.filter(e => e.type === 'sale').reduce((s, e) => s + e.qty, 0);
    return { totalIn, totalOut };
  };

  const lowCount = products.filter(p => p.stockQty > 0 && p.stockQty <= p.minStockAlert).length;
  const outCount = products.filter(p => p.stockQty === 0).length;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Products</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {products.length} total · {lowCount} low stock · {outCount} out of stock
          </p>
        </div>
        <button onClick={() => { setModalProduct(null); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Add Product
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search products..." className="input-field pl-10" />
          {query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {[['all', 'All'], ['low_stock', `Low Stock (${lowCount})`], ['out_of_stock', `Out of Stock (${outCount})`]].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filter === val ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Product', 'Category', 'MRP', 'Selling Price', 'Cost', 'Stock', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const { totalIn, totalOut } = productLedger(p);
                const isExpanded = expandedRow === p.id;
                return [
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    {/* Product */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{p.name}</div>
                      {p.barcode && <div className="text-xs text-gray-400">{p.barcode}</div>}
                    </td>
                    {/* Category */}
                    <td className="px-4 py-3 capitalize text-gray-600">{p.category}</td>
                    {/* MRP */}
                    <td className="px-4 py-3 font-medium">₹{p.mrp.toLocaleString('en-IN')}</td>
                    {/* Selling Price */}
                    <td className="px-4 py-3">
                      {(!p.sellingPrice || p.sellingPrice === 0)
                        ? <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Set at POS</span>
                        : <span className="text-blue-700 font-medium">₹{p.sellingPrice.toLocaleString('en-IN')}</span>}
                    </td>
                    {/* Cost */}
                    <td className="px-4 py-3 text-gray-500">₹{(p.costPrice || 0).toLocaleString('en-IN')}</td>
                    {/* Stock */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="flex items-center gap-1">
                            <span className={`font-bold text-base ${p.stockQty === 0 ? 'text-red-600' : p.stockQty <= p.minStockAlert ? 'text-orange-500' : 'text-gray-800'}`}>
                              {p.stockQty}
                            </span>
                            <span className="text-xs text-gray-400">pcs</span>
                            {p.stockQty <= p.minStockAlert && p.stockQty > 0 && <AlertTriangle size={12} className="text-orange-500" />}
                            {p.stockQty === 0 && <span className="text-xs bg-red-100 text-red-700 px-1 rounded font-semibold">OUT</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-green-600 font-medium">+{totalIn} in</span>
                            <span className="text-xs text-red-500 font-medium">−{totalOut} sold</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* Add Stock */}
                        <button onClick={() => setAddStockFor(p)}
                          title="Add stock"
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg flex items-center gap-0.5 text-xs font-semibold">
                          <ArrowUpCircle size={15} />
                        </button>
                        {/* History */}
                        <button onClick={() => setHistoryFor(p)}
                          title="Stock history"
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg">
                          <History size={15} />
                        </button>
                        {/* Expand mini-ledger */}
                        <button onClick={() => setExpandedRow(isExpanded ? null : p.id)}
                          title="Quick view"
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        {/* Edit */}
                        <button onClick={() => { setModalProduct(p); setShowModal(true); }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Edit2 size={15} />
                        </button>
                        {/* Delete */}
                        <button onClick={() => handleDelete(p.id, p.name)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>,

                  /* Expanded quick-ledger row */
                  isExpanded && (
                    <tr key={`${p.id}-expanded`} className="bg-gray-50 border-b border-gray-100">
                      <td colSpan={7} className="px-6 py-3">
                        <div className="flex items-center gap-6 text-sm">
                          <div className="flex items-center gap-1.5 text-blue-700">
                            <Package size={13} />
                            <span className="font-semibold">Opening:</span>
                            <span>{stockLedger.find(e => e.productId === p.id && e.type === 'opening')?.qty ?? '—'} pcs</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-green-700">
                            <TrendingUp size={13} />
                            <span className="font-semibold">Total Added:</span>
                            <span>+{totalIn} pcs</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-red-600">
                            <TrendingDown size={13} />
                            <span className="font-semibold">Total Sold:</span>
                            <span>−{totalOut} pcs</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-bold text-gray-800">
                            <span>Current:</span>
                            <span className={p.stockQty === 0 ? 'text-red-600' : p.stockQty <= p.minStockAlert ? 'text-orange-600' : 'text-gray-900'}>
                              {p.stockQty} pcs
                            </span>
                          </div>
                          <button onClick={() => setHistoryFor(p)}
                            className="ml-auto text-xs text-purple-600 font-semibold hover:text-purple-800 flex items-center gap-1">
                            <History size={12} /> Full History →
                          </button>
                        </div>
                        {/* Last 3 entries */}
                        <div className="mt-2 space-y-1">
                          {stockLedger
                            .filter(e => e.productId === p.id)
                            .sort((a, b) => new Date(b.date) - new Date(a.date))
                            .slice(0, 3)
                            .map(e => (
                              <div key={e.id} className="flex items-center gap-3 text-xs text-gray-500">
                                <span className={`font-bold w-16 ${e.type === 'sale' ? 'text-red-500' : 'text-green-600'}`}>
                                  {e.type === 'sale' ? `−${e.qty}` : `+${e.qty}`}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                                  e.type === 'opening' ? 'bg-blue-100 text-blue-700' :
                                  e.type === 'purchase' ? 'bg-green-100 text-green-700' :
                                  e.type === 'sale' ? 'bg-red-100 text-red-600' :
                                  'bg-orange-100 text-orange-700'
                                }`}>{e.type}</span>
                                <span>{new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                {e.supplierName && <span>· {e.supplierName}</span>}
                                {e.billNumber && e.billNumber !== 'Multiple' && <span>· {e.billNumber}</span>}
                                {e.note && <span className="text-gray-400">— {e.note}</span>}
                                <span className="ml-auto text-gray-400">bal: <span className="font-bold text-gray-700">{e.balanceAfter}</span></span>
                              </div>
                            ))}
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  <Package size={36} className="mx-auto mb-2 opacity-30" />
                  <p>No products found</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showModal && (
        <ProductModal product={modalProduct} onSave={handleSave}
          onClose={() => { setShowModal(false); setModalProduct(null); }} />
      )}
      {addStockFor && (
        <AddStockModal product={addStockFor} onSave={handleAddStock} onClose={() => setAddStockFor(null)} />
      )}
      {historyFor && (
        <StockHistoryModal product={historyFor} ledger={stockLedger} onClose={() => setHistoryFor(null)} />
      )}
    </div>
  );
}
