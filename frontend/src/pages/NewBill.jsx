import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { printBill, printThermal } from '../utils/printBill';
import {
  User, Phone, Search, Mic, MicOff, ScanLine, Plus, Minus,
  Trash2, X, Check, ChevronRight, ChevronLeft, ChevronDown,
  CheckCircle, Package, Printer, Share2, Tag, ShoppingCart
} from 'lucide-react';

// ─── Step Indicator ───────────────────────────────────────────────────────────
const STEPS = ['Customer', 'Products', 'Billing', 'Done'];
function StepIndicator({ current }) {
  return (
    <div className="flex items-center mb-6">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center flex-1 last:flex-none">
          <div className={`flex items-center gap-2 ${i <= current ? 'text-blue-700' : 'text-gray-400'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
              i < current  ? 'bg-blue-600 border-blue-600 text-white' :
              i === current ? 'border-blue-600 text-blue-700 bg-blue-50' :
              'border-gray-300 text-gray-400'
            }`}>
              {i < current ? <Check size={13} /> : i + 1}
            </div>
            <span className={`text-xs font-semibold hidden sm:block ${i === current ? 'text-blue-700' : 'text-gray-400'}`}>{step}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 ${i < current ? 'bg-blue-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Customer ─────────────────────────────────────────────────────────
function CustomerStep({ data, onChange, onNext }) {
  return (
    <form onSubmit={e => { e.preventDefault(); onNext(); }} className="max-w-md mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-1">Customer Details</h2>
      <p className="text-sm text-gray-400 mb-6">Enter customer info for the bill</p>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Name <span className="text-xs text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="relative">
            <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={data.name} onChange={e => onChange({ name: e.target.value })}
              placeholder="Walk-in customer" className="input-field pl-9" autoFocus />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Phone <span className="text-xs text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="relative">
            <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <span className="absolute left-9 top-1/2 -translate-y-1/2 text-gray-400 text-sm">+91</span>
            <input type="tel" maxLength={10} value={data.phone}
              onChange={e => onChange({ phone: e.target.value.replace(/\D/g, '') })}
              placeholder="Optional" className="input-field pl-[4.5rem]" />
          </div>
        </div>
      </div>
      <button type="submit" className="btn-primary w-full mt-6 flex items-center justify-center gap-2">
        Continue to Products <ChevronRight size={16} />
      </button>
    </form>
  );
}

// ─── Step 2: Products ─────────────────────────────────────────────────────────
function ProductsStep({ cart, onCartChange, onNext, onBack }) {
  const { products } = useApp();
  const [query, setQuery] = useState('');
  const [listening, setListening] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const recognitionRef = useRef(null);
  const scanInputRef   = useRef(null);

  const filtered = query.trim()
    ? products.filter(p => p.isActive && (
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.category.toLowerCase().includes(query.toLowerCase()) ||
        p.barcode?.includes(query)
      ))
    : products.filter(p => p.isActive);

  const regularCart = cart.filter(i => !i.isFreeAdded);
  const cartQty = (id) => regularCart.find(i => i.productId === id)?.qty || 0;
  const cartTotal = regularCart.reduce((s, i) => s + i.itemTotal, 0);

  const addToCart = (product) => {
    const basePrice = (product.sellingPrice && product.sellingPrice > 0) ? product.sellingPrice : product.mrp;
    const existing = regularCart.find(i => i.productId === product.id);
    if (existing) {
      onCartChange(cart.map(i =>
        i.productId === product.id && !i.isFreeAdded
          ? { ...i, qty: i.qty + 1, itemTotal: (i.qty + 1) * i.sellingPrice }
          : i
      ));
    } else {
      onCartChange([...cart, {
        productId: product.id, productName: product.name,
        mrp: product.mrp, sellingPrice: basePrice,
        costPrice: product.costPrice || 0,
        qty: 1, itemTotal: basePrice,
        priceSetAtPOS: !product.sellingPrice || product.sellingPrice === 0,
      }]);
    }
  };

  const updateQty = (productId, delta) => {
    onCartChange(cart.map(i => {
      if (i.productId !== productId || i.isFreeAdded) return i;
      const qty = Math.max(0, i.qty + delta);
      if (qty === 0) return null;
      return { ...i, qty, itemTotal: qty * i.sellingPrice };
    }).filter(Boolean));
  };

  const startVoice = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'en-IN';
    r.onstart  = () => setListening(true);
    r.onresult = e => { setQuery(e.results[0][0].transcript); setScanMode(false); };
    r.onend    = () => setListening(false);
    r.start();
    recognitionRef.current = r;
  };

  const handleScanInput = (val) => {
    setQuery(val);
    // Barcode scanner fires full code instantly — auto-add on exact barcode match
    const match = products.find(p => p.isActive && p.barcode === val.trim());
    if (match) { addToCart(match); setQuery(''); setScanMode(false); }
  };

  const handleScanEnter = () => {
    const match = products.find(p => p.isActive && (
      p.barcode === query.trim() ||
      p.name.toLowerCase() === query.trim().toLowerCase()
    ));
    if (match) { addToCart(match); setQuery(''); setScanMode(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-gray-800">Select Products</h2>
        {regularCart.length > 0 && (
          <span className="text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
            {regularCart.length} item{regularCart.length > 1 ? 's' : ''} · ₹{cartTotal.toLocaleString('en-IN')}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-400 mb-4">Tap to add · Search, voice or scan barcode</p>

      {/* Search + Scan bar */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          {scanMode
            ? <ScanLine size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 animate-pulse" />
            : <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          }
          <input
            ref={scanInputRef}
            type="text"
            value={query}
            onChange={e => scanMode ? handleScanInput(e.target.value) : setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleScanEnter(); }}
            placeholder={scanMode ? 'Scan barcode now…' : 'Search by name, category or barcode…'}
            className={`input-field pl-9 text-sm transition-colors ${scanMode ? 'border-green-400 bg-green-50' : ''}`}
            autoComplete="off"
          />
          {query && (
            <button onClick={() => { setQuery(''); setScanMode(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Barcode scan button */}
        <button
          onClick={() => {
            const next = !scanMode;
            setScanMode(next);
            setQuery('');
            if (next) setTimeout(() => scanInputRef.current?.focus(), 50);
          }}
          title="Scan barcode"
          className={`px-3 rounded-xl border-2 transition-colors ${scanMode ? 'bg-green-50 border-green-400 text-green-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
          <ScanLine size={17} />
        </button>

        {/* Voice button */}
        <button
          onClick={listening ? () => { recognitionRef.current?.stop(); setListening(false); } : startVoice}
          title="Voice search"
          className={`px-3 rounded-xl border-2 transition-colors ${listening ? 'bg-red-50 border-red-300 text-red-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
          {listening ? <MicOff size={17} /> : <Mic size={17} />}
        </button>
      </div>

      {/* Scan mode hint */}
      {scanMode && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
          <ScanLine size={14} className="text-green-600 shrink-0 animate-pulse" />
          <p className="text-xs text-green-700 font-semibold">Scanner ready — point at barcode and scan. Product adds automatically.</p>
          <button onClick={() => { setScanMode(false); setQuery(''); }} className="ml-auto text-green-500 hover:text-green-700"><X size={13} /></button>
        </div>
      )}


      {/* Product grid */}
      <div className="grid grid-cols-2 gap-2.5 max-h-[26rem] overflow-y-auto pr-0.5 mb-4">
        {filtered.map(p => {
          const inCart = cartQty(p.id);
          const price  = p.sellingPrice && p.sellingPrice > 0 ? p.sellingPrice : p.mrp;
          return (
            <div key={p.id}
              className={`p-3 rounded-xl border-2 transition-all ${inCart > 0 ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50/50'}`}>
              <p className="text-sm font-bold text-gray-800 leading-tight truncate mb-0.5">{p.name}</p>
              <p className="text-xs text-gray-400 capitalize mb-2">{p.category}
                {p.stockQty === 0 && <span className="ml-1 text-red-500">· Out</span>}
                {p.stockQty > 0 && p.stockQty <= p.minStockAlert && <span className="ml-1 text-orange-500">· {p.stockQty} left</span>}
              </p>
              <div className="flex items-center justify-between">
                {!p.sellingPrice || p.sellingPrice === 0
                  ? <span className="text-xs text-yellow-600 font-semibold">Set at billing</span>
                  : <span className="text-sm font-black text-blue-700">₹{price.toLocaleString('en-IN')}</span>
                }
                {p.stockQty === 0 ? (
                  <span className="text-xs text-red-400 font-medium">Out</span>
                ) : inCart > 0 ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(p.id, -1)} className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 hover:bg-blue-200"><Minus size={11} /></button>
                    <span className="text-sm font-bold w-4 text-center text-blue-800">{inCart}</span>
                    <button onClick={() => addToCart(p)} className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-700"><Plus size={11} /></button>
                  </div>
                ) : (
                  <button onClick={() => addToCart(p)} className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-700 shadow-sm shadow-blue-300">
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-10 text-gray-400">
            <Package size={30} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No products found</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="btn-secondary flex items-center gap-1 px-5"><ChevronLeft size={15} /> Back</button>
        <button onClick={onNext} disabled={regularCart.length === 0}
          className="btn-primary flex-1 flex items-center justify-center gap-2">
          Go to Billing <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Billing ──────────────────────────────────────────────────────────
function BillingStep({ customer, cart, onCartChange, onComplete, onBack }) {
  const { products, coupons, validateCoupon } = useApp();

  // Price editing
  const [editingId, setEditingId]   = useState(null);
  const [tempPrice, setTempPrice]   = useState('');

  // Add product from billing
  const [addQuery, setAddQuery]     = useState('');
  const [showAddList, setShowAddList] = useState(false);
  const addRef = useRef(null);
  const [listening, setListening]   = useState(false);
  const recognitionRef              = useRef(null);

  // Coupon
  const [couponInput, setCouponInput]   = useState('');
  const [couponResult, setCouponResult] = useState(null);
  const [showCouponList, setShowCouponList] = useState(false);

  // Free item
  const [showFreeDropdown, setShowFreeDropdown] = useState(false);
  const [freeSearch, setFreeSearch]             = useState('');
  const freeScanRef                             = useRef(null);

  // Discount
  const [discount, setDiscount]         = useState('');
  const [discountType, setDiscountType] = useState('flat');

  // GST & payment
  const [gstRate, setGstRate]       = useState(0);
  const [paymentMode, setPaymentMode] = useState('cash');

  // ── Derived ──
  const regularCart    = cart.filter(i => !i.isFreeAdded);
  const freeAdded      = cart.filter(i => i.isFreeAdded);
  const isBuyGet       = couponResult?.valid && couponResult.isBuyGet;
  const freeLimit      = couponResult?.freeCount || 0;
  const totalFree      = freeAdded.reduce((s, i) => s + i.qty, 0);
  const freeLeft       = freeLimit - totalFree;
  const subtotal       = regularCart.reduce((s, i) => s + i.itemTotal, 0);
  const freeItemsValue = freeAdded.reduce((s, i) => s + i.sellingPrice * i.qty, 0);

  const couponDisc = (() => {
    if (!couponResult?.valid) return 0;
    if (isBuyGet) return freeItemsValue;
    return couponResult.discount || 0;
  })();
  const manualDisc = (() => {
    const v = parseFloat(discount) || 0;
    return discountType === 'percent' ? Math.min(subtotal * v / 100, subtotal) : Math.min(v, subtotal);
  })();
  const totalDiscount = couponDisc + manualDisc;
  const gstBase   = subtotal + (isBuyGet ? freeItemsValue : 0);
  const gstAmount = Math.round(gstBase * gstRate / 100);
  const total     = Math.round(Math.max(0, subtotal + gstAmount - totalDiscount));

  // ── Product search for "add more" ──
  const addResults = addQuery.trim().length > 0
    ? products.filter(p => p.isActive && (
        p.name.toLowerCase().includes(addQuery.toLowerCase()) ||
        p.barcode?.includes(addQuery)
      )).slice(0, 8)
    : products.filter(p => p.isActive).slice(0, 8);

  const addToCart = (product) => {
    const basePrice = (product.sellingPrice && product.sellingPrice > 0) ? product.sellingPrice : product.mrp;
    const existing  = regularCart.find(i => i.productId === product.id);
    if (existing) {
      onCartChange(cart.map(i =>
        i.productId === product.id && !i.isFreeAdded
          ? { ...i, qty: i.qty + 1, itemTotal: (i.qty + 1) * i.sellingPrice }
          : i
      ));
    } else {
      onCartChange([...cart, {
        productId: product.id, productName: product.name,
        mrp: product.mrp, sellingPrice: basePrice,
        costPrice: product.costPrice || 0,
        qty: 1, itemTotal: basePrice,
        priceSetAtPOS: !product.sellingPrice || product.sellingPrice === 0,
      }]);
    }
    setAddQuery('');
    setShowAddList(false);
  };

  const updateQty = (productId, delta) => {
    onCartChange(cart.map(i => {
      if (i.productId !== productId || i.isFreeAdded) return i;
      const qty = Math.max(0, i.qty + delta);
      if (qty === 0) return null;
      return { ...i, qty, itemTotal: qty * i.sellingPrice };
    }).filter(Boolean));
  };

  const removeItem = (productId) => {
    onCartChange(cart.filter(i => !(i.productId === productId && !i.isFreeAdded)));
  };

  const commitPrice = (item) => {
    const p = parseFloat(tempPrice);
    if (!p || p <= 0) { setEditingId(null); return; }
    onCartChange(cart.map(i =>
      i.productId === item.productId && !i.isFreeAdded
        ? { ...i, sellingPrice: p, itemTotal: i.qty * p, priceSetAtPOS: false }
        : i
    ));
    setEditingId(null);
  };

  // ── Free item helpers ──
  const clearFree = () => onCartChange(cart.filter(i => !i.isFreeAdded));

  const updateFreeQty = (productId, delta) => {
    if (delta > 0 && freeLeft <= 0) return;
    const item = freeAdded.find(i => i.productId === productId);
    if (!item) return;
    const newQty = item.qty + delta;
    if (newQty <= 0) { onCartChange(cart.filter(i => !(i.productId === productId && i.isFreeAdded))); return; }
    onCartChange(cart.map(i =>
      i.productId === productId && i.isFreeAdded ? { ...i, qty: newQty, itemTotal: newQty * i.sellingPrice } : i
    ));
  };

  const addFreeProduct = (product) => {
    if (freeLeft <= 0) return;
    if (freeAdded.some(i => i.productId === product.id)) { updateFreeQty(product.id, 1); return; }
    const price = product.sellingPrice || product.mrp;
    onCartChange([...cart, {
      productId: product.id, productName: product.name,
      mrp: product.mrp, sellingPrice: price, costPrice: product.costPrice || 0,
      qty: 1, itemTotal: price, isFreeAdded: true,
    }]);
  };

  const removeFreeAdded = (productId) => onCartChange(cart.filter(i => !(i.productId === productId && i.isFreeAdded)));

  // ── Coupon ──
  const applyCode = (code) => {
    clearFree();
    const r = validateCoupon((code || couponInput).trim(), subtotal);
    setCouponResult(r);
  };

  // ── Voice scan ──
  const startVoice = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'en-IN';
    r.onstart  = () => setListening(true);
    r.onresult = e => { setAddQuery(e.results[0][0].transcript); setShowAddList(true); };
    r.onend    = () => setListening(false);
    r.start();
    recognitionRef.current = r;
  };

  const payments = [
    { id: 'cash',      label: 'Cash',    emoji: '💵' },
    { id: 'upi',       label: 'UPI',     emoji: '📲' },
    { id: 'phonepe',   label: 'PhonePe', emoji: '🟣' },
    { id: 'googlepay', label: 'GPay',    emoji: '🔵' },
    { id: 'card',      label: 'Card',    emoji: '💳' },
  ];

  const activeCoupons = coupons.filter(c => c.isActive && new Date(c.expiryDate) >= new Date());

  return (
    <div className="max-w-lg mx-auto space-y-4">

      {/* ── Header ── */}
      <div>
        <h2 className="text-xl font-bold text-gray-800">Bill — {customer.name || 'Walk-in'}</h2>
        {customer.phone && <p className="text-sm text-gray-400">+91 {customer.phone}</p>}
      </div>

      {/* ── Add / Scan Products ── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
          <ShoppingCart size={15} className="text-gray-500 shrink-0" />
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex-1">Add / Scan Products</p>
        </div>
        <div className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={addRef}
                type="text"
                value={addQuery}
                onChange={e => { setAddQuery(e.target.value); setShowAddList(true); }}
                onFocus={() => setShowAddList(true)}
                placeholder="Search product or scan barcode…"
                className="input-field pl-9 text-sm"
              />
              {addQuery && <button onClick={() => { setAddQuery(''); setShowAddList(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={13} /></button>}
            </div>
            <button onClick={listening ? () => { recognitionRef.current?.stop(); setListening(false); } : startVoice}
              className={`px-3 rounded-xl border-2 transition-colors ${listening ? 'bg-red-50 border-red-300 text-red-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
              title="Voice search">
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button className="px-3 rounded-xl border-2 border-gray-200 text-gray-500 hover:border-gray-300" title="Barcode scan">
              <ScanLine size={16} />
            </button>
          </div>

          {/* Product list dropdown */}
          {showAddList && (
            <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              {addResults.length === 0
                ? <p className="text-sm text-gray-400 px-4 py-3">No products found</p>
                : addResults.map(p => {
                    const inCart = regularCart.find(i => i.productId === p.id);
                    return (
                      <button key={p.id} type="button" onClick={() => addToCart(p)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0 text-left hover:bg-blue-50 transition-colors ${inCart ? 'bg-blue-50' : ''}`}>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                          <p className="text-xs text-gray-400 capitalize">{p.category}
                            {p.stockQty === 0 && <span className="text-red-400 ml-1">· Out of stock</span>}
                          </p>
                        </div>
                        <div className="text-right ml-4 shrink-0">
                          <p className="text-sm font-bold text-blue-700">₹{(p.sellingPrice || p.mrp).toLocaleString('en-IN')}</p>
                          {inCart
                            ? <p className="text-xs text-blue-600 font-semibold">In cart ×{inCart.qty}</p>
                            : <p className="text-xs text-green-600 font-semibold">+ Add</p>}
                        </div>
                      </button>
                    );
                  })
              }
              <button type="button" onClick={() => setShowAddList(false)}
                className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 border-t border-gray-100 bg-gray-50">
                Close
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Cart Items ── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          <div className="grid grid-cols-12 text-xs font-bold text-gray-400 uppercase tracking-wide">
            <span className="col-span-5">Item</span>
            <span className="col-span-4 text-center">Qty × Price</span>
            <span className="col-span-3 text-right">Total</span>
          </div>
        </div>
        {cart.length === 0 ? (
          <div className="py-10 text-center text-gray-400">
            <Package size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No items added yet</p>
          </div>
        ) : (
          cart.map((item, idx) => (
            <div key={item.productId + (item.isFreeAdded ? '_free' : '')}
              className={`px-4 py-3 grid grid-cols-12 items-center gap-1 ${idx < cart.length - 1 ? 'border-b border-gray-100' : ''} ${item.isFreeAdded ? 'bg-orange-50' : item.priceSetAtPOS && editingId !== item.productId ? 'bg-yellow-50' : ''}`}>

              {/* Name */}
              <div className="col-span-5">
                <p className="text-sm font-semibold text-gray-800 leading-tight">{item.productName}</p>
                {item.isFreeAdded && <p className="text-xs text-orange-600 font-bold mt-0.5">FREE</p>}
                {!item.isFreeAdded && item.priceSetAtPOS && editingId !== item.productId && (
                  <p className="text-xs text-yellow-600 mt-0.5">Tap price →</p>
                )}
              </div>

              {/* Qty × Price */}
              <div className="col-span-4 text-center">
                {item.isFreeAdded ? (
                  <span className="text-orange-600 font-bold text-sm">{item.qty} × ₹{item.sellingPrice.toLocaleString('en-IN')}</span>
                ) : (
                  <div className="flex items-center justify-center gap-1.5">
                    <button onClick={() => updateQty(item.productId, -1)}
                      className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-200">
                      <Minus size={11} />
                    </button>
                    <span className="font-bold text-gray-800 w-5 text-center">{item.qty}</span>
                    <button onClick={() => updateQty(item.productId, 1)}
                      className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700">
                      <Plus size={11} />
                    </button>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="col-span-3 text-right">
                {item.isFreeAdded ? (
                  <p className="text-orange-500 line-through text-sm font-semibold">₹{item.itemTotal.toLocaleString('en-IN')}</p>
                ) : item.priceSetAtPOS && editingId !== item.productId ? (
                  <button onClick={() => { setEditingId(item.productId); setTempPrice(String(item.sellingPrice)); }}
                    className="text-yellow-600 font-bold text-sm underline decoration-dashed">
                    ₹{item.sellingPrice.toLocaleString('en-IN')}
                  </button>
                ) : editingId === item.productId ? (
                  <div className="flex items-center justify-end gap-1">
                    <input type="number" value={tempPrice} onChange={e => setTempPrice(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') commitPrice(item); if (e.key === 'Escape') setEditingId(null); }}
                      className="w-20 border-2 border-blue-400 rounded-lg px-1.5 py-0.5 text-sm text-right font-bold"
                      autoFocus />
                    <button onClick={() => commitPrice(item)} className="text-green-600"><Check size={13} /></button>
                  </div>
                ) : (
                  <p className="text-gray-900 font-semibold text-sm">₹{item.itemTotal.toLocaleString('en-IN')}</p>
                )}
                {!item.isFreeAdded && (
                  <button onClick={() => removeItem(item.productId)} className="mt-1 text-red-400 hover:text-red-600 block ml-auto">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Coupon ── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
          <Tag size={15} className="text-gray-500 shrink-0" />
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Coupon</p>
        </div>
        <div className="p-4 space-y-3">
          {/* Available coupons */}
          {activeCoupons.length > 0 && (
            <div>
              <button type="button" onClick={() => setShowCouponList(p => !p)}
                className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 w-full text-left">
                <ChevronDown size={15} className={`transition-transform ${showCouponList ? 'rotate-180' : ''}`} />
                {showCouponList ? 'Hide coupons' : `${activeCoupons.length} coupon${activeCoupons.length > 1 ? 's' : ''} available — tap to apply`}
              </button>
              {showCouponList && (
                <div className="mt-2 space-y-1.5">
                  {activeCoupons.map(c => {
                    const isApplied = couponResult?.valid && couponInput === c.code;
                    const label = c.type === 'percentage' ? `${c.value}% off`
                      : c.type === 'flat' ? `₹${c.value} off`
                      : `Buy ${c.buyN} Get ${c.getFree ?? c.buyN} Free`;
                    return (
                      <button key={c.id} type="button"
                        onClick={() => {
                          clearFree(); setCouponInput(c.code); setShowCouponList(false);
                          const r = validateCoupon(c.code, subtotal); setCouponResult(r);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 transition-all text-left ${
                          isApplied ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        }`}>
                        <div>
                          <p className="text-sm font-bold text-gray-800">{c.code}</p>
                          <p className="text-xs text-gray-500">{label}{c.minPurchase > 0 ? ` · min ₹${c.minPurchase.toLocaleString('en-IN')}` : ''}</p>
                        </div>
                        {isApplied
                          ? <span className="text-xs font-bold text-green-600 shrink-0">✓ Applied</span>
                          : <span className="text-xs font-semibold text-blue-500 shrink-0">Tap to apply</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Manual code */}
          <div className="flex gap-2">
            <input type="text" value={couponInput}
              onChange={e => { clearFree(); setCouponInput(e.target.value.toUpperCase()); setCouponResult(null); }}
              placeholder="Or type code manually…"
              className="input-field flex-1 uppercase text-sm" />
            <button onClick={() => applyCode()}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-bold rounded-xl transition-colors">
              Apply
            </button>
          </div>

          {couponResult && !isBuyGet && (
            <p className={`text-sm font-semibold ${couponResult.valid ? 'text-green-700' : 'text-red-600'}`}>
              {couponResult.valid ? `✓ Coupon applied — saving ₹${Math.round(couponDisc).toLocaleString('en-IN')}` : `✗ ${couponResult.message}`}
            </p>
          )}

          {/* Buy N Get N — free item picker */}
          {isBuyGet && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-orange-800">
                    {couponResult.coupon?.code} — Buy {couponResult.coupon?.buyN} Get {freeLimit} Free
                  </p>
                  <p className="text-xs text-orange-600 mt-0.5">
                    Select {freeLimit} free item{freeLimit > 1 ? 's' : ''} from products
                  </p>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-sm font-black shrink-0 ${totalFree >= freeLimit ? 'bg-green-500 text-white' : 'bg-orange-200 text-orange-800'}`}>
                  {totalFree}/{freeLimit}
                </div>
              </div>

              {/* Added free items */}
              {freeAdded.length > 0 && (
                <div className="space-y-2">
                  {freeAdded.map(item => (
                    <div key={item.productId}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 border-orange-400 bg-white">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{item.productName}</p>
                        <p className="text-xs text-green-700 font-semibold">FREE × {item.qty} = −₹{(item.sellingPrice * item.qty).toLocaleString('en-IN')}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button type="button" onClick={() => updateFreeQty(item.productId, -1)}
                          className="w-7 h-7 rounded-full border-2 border-orange-300 flex items-center justify-center text-orange-700 font-bold hover:bg-orange-100">−</button>
                        <span className="text-base font-black text-orange-700 w-5 text-center">{item.qty}</span>
                        <button type="button" onClick={() => updateFreeQty(item.productId, 1)}
                          disabled={freeLeft <= 0}
                          className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold disabled:opacity-30 hover:bg-orange-600">+</button>
                      </div>
                      <button type="button" onClick={() => removeFreeAdded(item.productId)}
                        className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-red-500 hover:bg-red-200 shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Free product — inline search + barcode scan */}
              {freeLeft > 0 ? (
                <div className="space-y-2">
                  {/* Search / Scan bar */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400" />
                      <input
                        ref={freeScanRef}
                        type="text"
                        value={freeSearch}
                        onChange={e => {
                          const v = e.target.value;
                          setFreeSearch(v);
                          // barcode scanner fires many chars then Enter — auto-match on barcode
                          const byBarcode = products.find(p => p.isActive && p.barcode === v.trim());
                          if (byBarcode) { addFreeProduct(byBarcode); setFreeSearch(''); }
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const match = products.find(p => p.isActive && (
                              p.barcode === freeSearch.trim() ||
                              p.name.toLowerCase() === freeSearch.trim().toLowerCase()
                            ));
                            if (match) { addFreeProduct(match); setFreeSearch(''); }
                          }
                        }}
                        placeholder="Search name or scan barcode…"
                        className="w-full pl-9 pr-8 py-2.5 rounded-xl border-2 border-orange-300 focus:border-orange-500 focus:outline-none text-sm bg-white"
                        autoComplete="off"
                      />
                      {freeSearch && (
                        <button type="button" onClick={() => setFreeSearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <button type="button"
                      onClick={() => { setFreeSearch(''); freeScanRef.current?.focus(); }}
                      className="px-3 rounded-xl border-2 border-orange-300 text-orange-600 hover:bg-orange-50 hover:border-orange-500 transition-colors"
                      title="Click then scan barcode with scanner">
                      <ScanLine size={17} />
                    </button>
                  </div>

                  {/* Inline product list — no overflow clipping issue */}
                  <div className="rounded-xl border-2 border-orange-200 bg-white overflow-hidden max-h-52 overflow-y-auto">
                    {(() => {
                      const list = products.filter(p => p.isActive && (
                        !freeSearch.trim() ||
                        p.name.toLowerCase().includes(freeSearch.toLowerCase()) ||
                        p.barcode?.includes(freeSearch.trim())
                      ));
                      if (list.length === 0) return (
                        <p className="text-sm text-gray-400 px-4 py-3 text-center">No products found</p>
                      );
                      return list.map(p => {
                        const alreadyFree = freeAdded.find(i => i.productId === p.id);
                        return (
                          <button key={p.id} type="button"
                            onClick={() => { addFreeProduct(p); setFreeSearch(''); }}
                            className={`w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 text-left hover:bg-orange-50 active:bg-orange-100 transition-colors ${alreadyFree ? 'bg-orange-50' : ''}`}>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                              <p className="text-xs text-gray-400 capitalize">{p.category}
                                {p.barcode && <span className="ml-1 text-gray-300">· {p.barcode}</span>}
                              </p>
                            </div>
                            <div className="text-right ml-3 shrink-0">
                              <p className="text-sm font-bold text-orange-700">₹{(p.sellingPrice || p.mrp).toLocaleString('en-IN')}</p>
                              <p className={`text-xs font-bold ${alreadyFree ? 'text-orange-600' : 'text-green-600'}`}>
                                {alreadyFree ? `×${alreadyFree.qty} added` : '+ Add free'}
                              </p>
                            </div>
                          </button>
                        );
                      });
                    })()}
                  </div>
                  <p className="text-xs text-orange-500 text-center">
                    {freeLeft} more free item{freeLeft > 1 ? 's' : ''} to select · tap or scan barcode
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                  <p className="text-sm font-bold text-green-800">
                    ✓ All {freeLimit} item{freeLimit > 1 ? 's' : ''} assigned — saving ₹{Math.round(couponDisc).toLocaleString('en-IN')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Manual Discount ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Manual Discount</p>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-xl p-1 shrink-0">
            <button onClick={() => setDiscountType('flat')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${discountType === 'flat' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>
              ₹ Flat
            </button>
            <button onClick={() => setDiscountType('percent')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${discountType === 'percent' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>
              % Off
            </button>
          </div>
          <input type="number" value={discount} onChange={e => setDiscount(e.target.value)}
            placeholder="0" min="0"
            className="input-field w-28 text-center text-xl font-bold" />
          {manualDisc > 0 && (
            <span className="text-green-600 font-bold text-sm whitespace-nowrap">= −₹{Math.round(manualDisc).toLocaleString('en-IN')}</span>
          )}
        </div>
      </div>

      {/* ── GST ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">GST on Products</p>
        <div className="flex gap-2 flex-wrap">
          {[0, 5, 12, 18, 28].map(r => (
            <button key={r} type="button" onClick={() => setGstRate(r)}
              className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all ${
                gstRate === r ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
              {r === 0 ? 'No GST' : `${r}%`}
            </button>
          ))}
        </div>
        {gstRate > 0 && (
          <p className="text-xs text-gray-500 mt-2">
            {gstRate}% on ₹{gstBase.toLocaleString('en-IN')} = +₹{gstAmount.toLocaleString('en-IN')}
          </p>
        )}
      </div>

      {/* ── Total ── */}
      <div className="bg-gray-900 rounded-2xl p-5 text-white">
        <div className="space-y-2 mb-4 text-sm">
          <div className="flex justify-between text-gray-300">
            <span>Items ({regularCart.length})</span>
            <span>₹{subtotal.toLocaleString('en-IN')}</span>
          </div>
          {gstAmount > 0 && (
            <div className="flex justify-between text-blue-300">
              <span>GST ({gstRate}%)</span>
              <span>+ ₹{gstAmount.toLocaleString('en-IN')}</span>
            </div>
          )}
          {couponDisc > 0 && (
            <div className="flex justify-between text-orange-300">
              <span>Coupon ({couponInput})</span>
              <span>− ₹{Math.round(couponDisc).toLocaleString('en-IN')}</span>
            </div>
          )}
          {manualDisc > 0 && (
            <div className="flex justify-between text-green-400 font-semibold">
              <span>Manual Discount</span>
              <span>− ₹{Math.round(manualDisc).toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>
        <div className="border-t border-gray-700 pt-4 flex items-end justify-between">
          <div>
            <p className="text-gray-400 text-sm">Customer pays</p>
            {totalDiscount > 0 && <p className="text-green-400 text-xs mt-0.5">Saved ₹{Math.round(totalDiscount).toLocaleString('en-IN')}</p>}
          </div>
          <span className="text-5xl font-black tracking-tight">₹{total.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* ── Payment Mode ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Payment Mode</p>
        <div className="grid grid-cols-5 gap-2">
          {payments.map(({ id, label, emoji }) => (
            <button key={id} onClick={() => setPaymentMode(id)}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-bold transition-all ${
                paymentMode === id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
              <span className="text-2xl leading-none">{emoji}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-3 pb-4">
        <button onClick={onBack} className="btn-secondary flex items-center gap-1 px-5">
          <ChevronLeft size={15} /> Back
        </button>
        <button
          onClick={() => onComplete({ paymentMode, total, subtotal, discountAmount: totalDiscount, taxAmount: gstAmount, gstRate, couponCode: couponResult?.valid ? couponInput : '', manualDiscount: manualDisc })}
          disabled={regularCart.length === 0}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-black py-4 rounded-2xl transition-colors text-base flex items-center justify-center gap-2 shadow-lg shadow-green-200">
          <Check size={18} /> Complete Sale — ₹{total.toLocaleString('en-IN')}
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Receipt ──────────────────────────────────────────────────────────
function ReceiptStep({ bill, customer, onNewBill }) {
  const navigate = useNavigate();
  const { shop } = useApp();
  const shopForPrint = { shopName: bill.shopName, address: bill.shopAddress, gstin: bill.gstin, phone: bill.shopPhone, upiId: shop?.upiId, paymentPhone: shop?.paymentPhone };
  return (
    <div className="max-w-md mx-auto text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle size={36} className="text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Sale Complete!</h2>
      <p className="text-gray-400 mb-6">Bill #{bill.billNumber} saved</p>

      <div id="receipt" className="bg-white border border-gray-200 rounded-xl p-5 text-left font-mono text-xs mb-6 shadow-sm">
        <div className="text-center border-b border-dashed border-gray-300 pb-3 mb-3">
          <div className="font-bold text-sm uppercase">{bill.shopName}</div>
          {bill.shopAddress && <div>{bill.shopAddress}</div>}
          {bill.gstin && <div>GSTIN: {bill.gstin}</div>}
          {bill.shopPhone && <div>Ph: {bill.shopPhone}</div>}
        </div>
        <div className="border-b border-dashed border-gray-300 pb-3 mb-3">
          <div>Bill No : {bill.billNumber}</div>
          <div>Date    : {new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
          <div>Customer: {customer.name || 'Walk-in'}</div>
          {customer.phone && <div>Phone   : +91 {customer.phone}</div>}
        </div>
        <div className="border-b border-dashed border-gray-300 pb-3 mb-3 space-y-1">
          {bill.items.map((item, i) => (
            <div key={i}>
              <div className="flex justify-between">
                <span className="truncate max-w-[60%]">{item.productName}{item.isFreeAdded ? ' [FREE]' : ''}</span>
                <span>{item.isFreeAdded ? 'FREE' : `₹${item.itemTotal.toLocaleString('en-IN')}`}</span>
              </div>
              <div className="text-gray-400 pl-2">{item.qty} × ₹{item.sellingPrice.toLocaleString('en-IN')}</div>
            </div>
          ))}
        </div>
        <div className="border-b border-dashed border-gray-300 pb-3 mb-3 space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>₹{bill.subtotal.toLocaleString('en-IN')}</span></div>
          {bill.taxAmount > 0 && <div className="flex justify-between"><span>GST</span><span>+₹{Math.round(bill.taxAmount).toLocaleString('en-IN')}</span></div>}
          {bill.discountAmount > 0 && <div className="flex justify-between"><span>Discount</span><span>-₹{Math.round(bill.discountAmount).toLocaleString('en-IN')}</span></div>}
        </div>
        <div className="flex justify-between font-bold text-sm mb-1">
          <span>TOTAL PAID</span><span>₹{bill.total.toLocaleString('en-IN')}</span>
        </div>
        <div>Payment : {bill.paymentMode?.toUpperCase()}</div>
        <div className="text-center mt-3 border-t border-dashed border-gray-300 pt-3 text-gray-400">
          Thank you! Visit again.
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <button onClick={() => printBill(bill, shopForPrint)} className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-sm">
          <Printer size={14} /> A4 / PDF
        </button>
        <button onClick={() => printThermal(bill, shopForPrint)} className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-sm">
          <Printer size={14} /> Thermal Slip
        </button>
      </div>
      <div className="flex gap-3">
        <button onClick={onNewBill} className="btn-primary flex-1">New Bill</button>
        <button onClick={() => navigate('/dashboard')} className="btn-secondary flex-1">Dashboard</button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function NewBill() {
  const { addBill, shop } = useApp();
  const [step, setStep]         = useState(0);
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [cart, setCart]         = useState([]);
  const [savedBill, setSavedBill] = useState(null);

  const resetAll = () => {
    setStep(0); setCustomer({ name: '', phone: '' });
    setCart([]); setSavedBill(null);
  };

  const handleComplete = (billingData) => {
    const bill = addBill({
      customerName: customer.name,
      customerPhone: customer.phone,
      items: cart,
      ...billingData,
      shopName: shop?.shopName,
      shopAddress: shop?.address,
      gstin: shop?.gstin,
      shopPhone: shop?.phone,
    });
    setSavedBill(bill);
    setStep(3);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <StepIndicator current={step} />
      {step === 0 && (
        <CustomerStep
          data={customer}
          onChange={u => setCustomer(p => ({ ...p, ...u }))}
          onNext={() => setStep(1)}
        />
      )}
      {step === 1 && (
        <ProductsStep
          cart={cart}
          onCartChange={setCart}
          onNext={() => setStep(2)}
          onBack={() => setStep(0)}
        />
      )}
      {step === 2 && (
        <BillingStep
          customer={customer}
          cart={cart}
          onCartChange={setCart}
          onComplete={handleComplete}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && savedBill && (
        <ReceiptStep bill={savedBill} customer={customer} onNewBill={resetAll} />
      )}
    </div>
  );
}
