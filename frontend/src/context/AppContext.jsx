import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { safeGet, safeSet, safeRemove } from '../utils/storage';
import { api, bgApi } from '../utils/api';

const AppContext = createContext(null);

// ── Admin credentials ──────────────────────────────────────────────────────────
// NEVER hard-code a plaintext password here — it ships in the public JS bundle
// and anyone can read it in DevTools → Sources.
// These come from .env (Vite exposes VITE_ prefix variables at build time).
// Create frontend/.env with:  VITE_ADMIN_EMAIL=you@example.com  VITE_ADMIN_KEY=yourkey
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'smuduthanapalli@gmail.com';
const ADMIN_KEY   = import.meta.env.VITE_ADMIN_KEY || '';

// ── OTP store (module-level, in-memory) ────────────────────────────────────────
const _otpStore = {};

export function generateOTP(key) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  _otpStore[key] = { code, expires: Date.now() + 10 * 60 * 1000 };
  return code;
}

export function verifyOTP(key, input) {
  const record = _otpStore[key];
  if (!record) return false;
  if (Date.now() > record.expires) { delete _otpStore[key]; return false; }
  if (record.code === input) { delete _otpStore[key]; return true; }
  return false;
}

// ── Seed shops ─────────────────────────────────────────────────────────────────
const SEED_SHOPS = [
  {
    id: 'shop-001', shopName: "Ravi's Clothing Store", ownerName: 'Ravi Kumar',
    address: '12, MG Road, Bangalore, Karnataka - 560001', gstin: '29ABCDE1234F1ZS',
    phone: '9800000000', email: 'ravi@ravisclothing.com', password: null,
    reportEmail: 'ravi@ravisclothing.com', dailyReport: true, dailyTime: '21:00',
    monthlyReport: true, lowStockLimit: 5, pdfAttachment: true,
    createdAt: '2026-01-15T10:00:00.000Z', status: 'active',
  },
  {
    id: 'shop-002', shopName: 'Meena Textiles', ownerName: 'Meena Sharma',
    address: '45, Brigade Road, Bangalore, Karnataka - 560025', gstin: '29XYZAB1234G2ZT',
    phone: '9900112233', email: 'meena@meenatextiles.com', password: null,
    reportEmail: 'meena@meenatextiles.com', dailyReport: true, dailyTime: '21:00',
    monthlyReport: true, lowStockLimit: 5, pdfAttachment: true,
    createdAt: '2026-02-20T09:30:00.000Z', status: 'active',
  },
  {
    id: 'shop-003', shopName: 'Krishna Kirana', ownerName: 'Krishna Reddy',
    address: '8, JP Nagar, Bangalore, Karnataka - 560078', gstin: '',
    phone: '9876012345', email: 'krishna@krishnakirana.com', password: null,
    reportEmail: 'krishna@krishnakirana.com', dailyReport: false, dailyTime: '21:00',
    monthlyReport: true, lowStockLimit: 3, pdfAttachment: false,
    createdAt: '2026-04-10T14:00:00.000Z', status: 'active',
  },
];

const SEED_IDS = ['shop-001', 'shop-002', 'shop-003'];

const MOCK_PRODUCTS = [
  { id: 'p1', name: 'Blue Cotton Shirt (L)', category: 'clothing', barcode: '8901234567890', mrp: 1200, sellingPrice: 1200, costPrice: 700, gstRate: 5, stockQty: 24, minStockAlert: 5, isActive: true },
  { id: 'p2', name: 'Black Slim Jeans (32)', category: 'clothing', barcode: '8901234567891', mrp: 1800, sellingPrice: 1800, costPrice: 1000, gstRate: 5, stockQty: 3, minStockAlert: 5, isActive: true },
  { id: 'p3', name: 'White Formal Shirt (M)', category: 'clothing', barcode: '8901234567892', mrp: 950, sellingPrice: 950, costPrice: 500, gstRate: 0, stockQty: 15, minStockAlert: 5, isActive: true },
  { id: 'p4', name: 'Leather Sneakers (42)', category: 'footwear', barcode: '8901234567893', mrp: 2500, sellingPrice: 2500, costPrice: 1400, gstRate: 18, stockQty: 2, minStockAlert: 3, isActive: true },
  { id: 'p5', name: 'Red Kurti (S)', category: 'clothing', barcode: '8901234567894', mrp: 799, sellingPrice: 799, costPrice: 400, gstRate: 0, stockQty: 18, minStockAlert: 5, isActive: true },
  { id: 'p6', name: 'Brown Belt', category: 'clothing', barcode: '8901234567895', mrp: 450, sellingPrice: 450, costPrice: 200, gstRate: 0, stockQty: 7, minStockAlert: 5, isActive: true },
  { id: 'p7', name: 'Denim Jacket (L)', category: 'clothing', barcode: '8901234567896', mrp: 2200, sellingPrice: 2200, costPrice: 1200, gstRate: 5, stockQty: 4, minStockAlert: 3, isActive: true },
  { id: 'p8', name: 'Cotton Saree', category: 'clothing', barcode: '8901234567897', mrp: 1500, sellingPrice: 1500, costPrice: 800, gstRate: 5, stockQty: 0, minStockAlert: 2, isActive: true },
];

const MOCK_BILLS = [
  { id: 'b1', billNumber: 'BILL-2026-00847', customerName: 'Arjun Kumar', customerPhone: '9876543210', subtotal: 2700, discountAmount: 300, taxAmount: 135, total: 2535, paymentMode: 'cash', status: 'completed', createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), items: [{ productName: 'Blue Cotton Shirt (L)', qty: 1, sellingPrice: 1200, mrp: 1200, itemTotal: 1200 }, { productName: 'Black Slim Jeans (32)', qty: 1, sellingPrice: 1500, mrp: 1800, itemTotal: 1500 }] },
  { id: 'b2', billNumber: 'BILL-2026-00846', customerName: 'Priya Singh', customerPhone: '', subtotal: 1598, discountAmount: 0, taxAmount: 0, total: 1598, paymentMode: 'upi', status: 'completed', createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), items: [{ productName: 'White Formal Shirt (M)', qty: 1, sellingPrice: 950, mrp: 950, itemTotal: 950 }, { productName: 'Red Kurti (S)', qty: 1, sellingPrice: 799, mrp: 799, itemTotal: 799 }] },
  { id: 'b3', billNumber: 'BILL-2026-00845', customerName: 'Rahul Sharma', customerPhone: '9812345678', subtotal: 2500, discountAmount: 0, taxAmount: 450, total: 2950, paymentMode: 'phonepe', status: 'completed', createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), items: [{ productName: 'Leather Sneakers (42)', qty: 1, sellingPrice: 2500, mrp: 2500, itemTotal: 2500 }] },
  { id: 'b4', billNumber: 'BILL-2026-00844', customerName: 'Meena Devi', customerPhone: '', subtotal: 4400, discountAmount: 200, taxAmount: 210, total: 4410, paymentMode: 'cash', status: 'completed', createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), items: [{ productName: 'Denim Jacket (L)', qty: 1, sellingPrice: 2200, mrp: 2200, itemTotal: 2200 }, { productName: 'Blue Cotton Shirt (L)', qty: 2, sellingPrice: 1100, mrp: 1200, itemTotal: 2200 }] },
  { id: 'b5', billNumber: 'BILL-2026-00843', customerName: 'Suresh Reddy', customerPhone: '9900112233', subtotal: 1249, discountAmount: 0, taxAmount: 0, total: 1249, paymentMode: 'googlepay', status: 'completed', createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), items: [{ productName: 'Red Kurti (S)', qty: 1, sellingPrice: 799, mrp: 799, itemTotal: 799 }, { productName: 'Brown Belt', qty: 1, sellingPrice: 450, mrp: 450, itemTotal: 450 }] },
];

const MOCK_COUPONS = [
  { id: 'c1', code: 'SAVE10', type: 'percentage', value: 10, minPurchase: 500, expiryDate: '2026-12-31', timesUsed: 23, isActive: true },
  { id: 'c2', code: 'FLAT200', type: 'flat', value: 200, minPurchase: 1000, expiryDate: '2026-09-30', timesUsed: 11, isActive: true },
  { id: 'c3', code: 'DIWALI500', type: 'flat', value: 500, minPurchase: 3000, expiryDate: '2026-10-31', timesUsed: 5, isActive: false },
];

const ago = (days, hours = 0) => new Date(Date.now() - (days * 86400 + hours * 3600) * 1000).toISOString();
const MOCK_STOCK_LEDGER = [
  // p1 — Blue Cotton Shirt (current 24)
  { id: 'sl01', productId: 'p1', type: 'opening',  qty: 50, balanceAfter: 50, date: ago(180), note: 'Opening stock',          supplierName: '',              billNumber: '', costPrice: 700 },
  { id: 'sl02', productId: 'p1', type: 'purchase', qty: 20, balanceAfter: 70, date: ago(90),  note: 'Stock refill',           supplierName: 'Textile Mart',  billNumber: '', costPrice: 680 },
  { id: 'sl03', productId: 'p1', type: 'sale',     qty: 46, balanceAfter: 24, date: ago(60),  note: 'Sales total (60 days)',  supplierName: '',              billNumber: 'Multiple', costPrice: 0 },
  // p2 — Black Slim Jeans (current 3)
  { id: 'sl04', productId: 'p2', type: 'opening',  qty: 30, balanceAfter: 30, date: ago(180), note: 'Opening stock',          supplierName: '',              billNumber: '', costPrice: 1000 },
  { id: 'sl05', productId: 'p2', type: 'purchase', qty: 15, balanceAfter: 45, date: ago(120), note: 'Restock from supplier',  supplierName: 'Fashion Hub',   billNumber: '', costPrice: 950 },
  { id: 'sl06', productId: 'p2', type: 'sale',     qty: 42, balanceAfter: 3,  date: ago(30),  note: 'Sales total (30 days)',  supplierName: '',              billNumber: 'Multiple', costPrice: 0 },
  // p3 — White Formal Shirt (current 15)
  { id: 'sl07', productId: 'p3', type: 'opening',  qty: 25, balanceAfter: 25, date: ago(180), note: 'Opening stock',          supplierName: '',              billNumber: '', costPrice: 500 },
  { id: 'sl08', productId: 'p3', type: 'sale',     qty: 10, balanceAfter: 15, date: ago(45),  note: 'Sales total',           supplierName: '',              billNumber: 'Multiple', costPrice: 0 },
  // p4 — Leather Sneakers (current 2)
  { id: 'sl09', productId: 'p4', type: 'opening',  qty: 10, balanceAfter: 10, date: ago(180), note: 'Opening stock',          supplierName: '',              billNumber: '', costPrice: 1400 },
  { id: 'sl10', productId: 'p4', type: 'sale',     qty: 8,  balanceAfter: 2,  date: ago(20),  note: 'Sales total',           supplierName: '',              billNumber: 'Multiple', costPrice: 0 },
  // p5 — Red Kurti (current 18)
  { id: 'sl11', productId: 'p5', type: 'opening',  qty: 40, balanceAfter: 40, date: ago(180), note: 'Opening stock',          supplierName: '',              billNumber: '', costPrice: 400 },
  { id: 'sl12', productId: 'p5', type: 'purchase', qty: 10, balanceAfter: 50, date: ago(60),  note: 'Festival stock',         supplierName: 'Kurti World',   billNumber: '', costPrice: 380 },
  { id: 'sl13', productId: 'p5', type: 'sale',     qty: 32, balanceAfter: 18, date: ago(15),  note: 'Sales total',           supplierName: '',              billNumber: 'Multiple', costPrice: 0 },
  // p6 — Brown Belt (current 7)
  { id: 'sl14', productId: 'p6', type: 'opening',  qty: 15, balanceAfter: 15, date: ago(180), note: 'Opening stock',          supplierName: '',              billNumber: '', costPrice: 200 },
  { id: 'sl15', productId: 'p6', type: 'sale',     qty: 8,  balanceAfter: 7,  date: ago(30),  note: 'Sales total',           supplierName: '',              billNumber: 'Multiple', costPrice: 0 },
  // p7 — Denim Jacket (current 4)
  { id: 'sl16', productId: 'p7', type: 'opening',  qty: 20, balanceAfter: 20, date: ago(180), note: 'Opening stock',          supplierName: '',              billNumber: '', costPrice: 1200 },
  { id: 'sl17', productId: 'p7', type: 'sale',     qty: 16, balanceAfter: 4,  date: ago(25),  note: 'Sales total',           supplierName: '',              billNumber: 'Multiple', costPrice: 0 },
  // p8 — Cotton Saree (current 0)
  { id: 'sl18', productId: 'p8', type: 'opening',  qty: 30, balanceAfter: 30, date: ago(180), note: 'Opening stock',          supplierName: '',              billNumber: '', costPrice: 800 },
  { id: 'sl19', productId: 'p8', type: 'sale',     qty: 30, balanceAfter: 0,  date: ago(10),  note: 'Sold out — reorder!',   supplierName: '',              billNumber: 'Multiple', costPrice: 0 },
];

// ── API response normalizers (DB returns snake_case, frontend needs camelCase) ──
function normalizeProduct(p) {
  return {
    id: p.id,
    name: p.name,
    category: p.category || 'other',
    barcode: p.barcode || '',
    mrp: parseFloat(p.mrp) || 0,
    sellingPrice: parseFloat(p.selling_price ?? p.sellingPrice) || 0,
    costPrice: parseFloat(p.cost_price ?? p.costPrice) || 0,
    gstRate: parseFloat(p.gst_rate ?? p.gstRate) || 0,
    stockQty: parseInt(p.stock_qty ?? p.stockQty) || 0,
    minStockAlert: parseInt(p.min_stock_alert ?? p.minStockAlert) || 5,
    imageUrl: p.image_url || p.imageUrl || null,
    isActive: p.is_active ?? p.isActive ?? true,
    createdAt: p.created_at || p.createdAt,
  };
}

function normalizeStockEntry(e) {
  return {
    id: e.id,
    productId: e.product_id || e.productId,
    type: e.type,
    qty: parseInt(e.qty) || 0,
    balanceAfter: parseInt(e.balance_after ?? e.balanceAfter) || 0,
    supplierName: e.supplier_name || e.supplierName || '',
    invoiceNo: e.invoice_no || e.invoiceNo || '',
    billNumber: e.bill_number || e.billNumber || '',
    costPrice: parseFloat(e.cost_price ?? e.costPrice) || 0,
    note: e.note || '',
    date: e.created_at || e.createdAt || e.date,
  };
}

function normalizeBillItem(item) {
  return {
    id: item.id,
    productId: item.product_id || item.productId || null,
    productName: item.product_name || item.productName || '',
    qty: parseInt(item.quantity ?? item.qty) || 0,
    mrp: parseFloat(item.mrp) || 0,
    sellingPrice: parseFloat(item.selling_price ?? item.sellingPrice) || 0,
    discountAmount: parseFloat(item.discount_amount ?? item.discountAmount) || 0,
    gstRate: parseFloat(item.gst_rate ?? item.gstRate) || 0,
    itemTotal: parseFloat(item.item_total ?? item.itemTotal) || 0,
    costPrice: parseFloat(item.cost_price ?? item.costPrice) || 0,
    isFreeAdded: item.is_free_added || item.isFreeAdded || false,
  };
}

function normalizeBill(b) {
  return {
    id: b.id,
    billNumber: b.bill_number || b.billNumber,
    customerName: b.customer_name || b.customerName || '',
    customerPhone: b.customer_phone || b.customerPhone || '',
    subtotal: parseFloat(b.subtotal) || 0,
    discountAmount: parseFloat(b.discount_amount ?? b.discountAmount) || 0,
    taxAmount: parseFloat(b.tax_amount ?? b.taxAmount) || 0,
    total: parseFloat(b.total) || 0,
    paymentMode: b.payment_mode || b.paymentMode || 'cash',
    couponCode: b.coupon_code || b.couponCode || null,
    status: b.status || 'completed',
    items: Array.isArray(b.items) ? b.items.map(normalizeBillItem) : [],
    createdAt: b.created_at || b.createdAt,
    hasReturn: b.has_return || b.hasReturn || false,
    returnedAmount: parseFloat(b.returned_amount ?? b.returnedAmount) || 0,
  };
}

function normalizeCoupon(c) {
  return {
    id: c.id,
    code: c.code,
    type: c.type || 'flat',
    value: parseFloat(c.value) || 0,
    minPurchase: parseFloat(c.min_purchase ?? c.minPurchase) || 0,
    expiryDate: c.expiry_date || c.expiryDate,
    timesUsed: parseInt(c.times_used ?? c.timesUsed) || 0,
    isActive: c.is_active ?? c.isActive ?? true,
    buyN: c.buy_n || c.buyN,
    getFree: c.get_free || c.getFree,
  };
}

function normalizeReturn(r) {
  return {
    id: r.id,
    returnNumber: r.return_number || r.returnNumber,
    originalBillId: r.original_bill_id || r.originalBillId,
    originalBillNumber: r.original_bill_number || r.originalBillNumber,
    customerName: r.customer_name || r.customerName || '',
    refundAmount: parseFloat(r.refund_amount ?? r.refundAmount) || 0,
    refundMode: r.refund_mode || r.refundMode || 'cash',
    reason: r.reason || '',
    items: Array.isArray(r.items) ? r.items : [],
    returnedAt: r.returned_at || r.returnedAt,
    createdAt: r.created_at || r.createdAt,
  };
}

function loadShops() {
  try {
    const s = localStorage.getItem('shopease_shops');
    return s ? JSON.parse(s) : SEED_SHOPS;
  } catch { return SEED_SHOPS; }
}

function loadCurrentShop() {
  try {
    const s = localStorage.getItem('shopease_current_shop');
    return s ? JSON.parse(s) : SEED_SHOPS[0];
  } catch { return SEED_SHOPS[0]; }
}

function loadStockLedger(shopId) {
  if (!shopId) return MOCK_STOCK_LEDGER;
  try {
    const s = localStorage.getItem(`shopease_stock_${shopId}`);
    if (s) return JSON.parse(s);
  } catch { /* ignore */ }
  return SEED_IDS.includes(shopId) ? MOCK_STOCK_LEDGER : [];
}

export function AppProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!sessionStorage.getItem('shopease_token'));
  const [isAdmin, setIsAdmin]       = useState(() => !!sessionStorage.getItem('shopease_admin'));

  // Prevents double-submission if the user taps "Complete Sale" twice quickly
  const _billInFlight = useRef(false);

  const [isLoading, setIsLoading] = useState(false);

  const [allShops, setAllShops] = useState(loadShops);

  const currentSavedShop = loadCurrentShop();
  const [shop, setShop] = useState(currentSavedShop);

  // ── Startup data loader — isolated per shop, self-healing ─────────────────
  // All 5 states are loaded here with cross-account validation:
  // returns are kept only if their bill exists in this shop's bills;
  // ledger entries are kept only if their product exists in this shop's products.
  const [products, setProducts] = useState(() => {
    const id = currentSavedShop?.id;
    if (!id || !sessionStorage.getItem('shopease_token')) return MOCK_PRODUCTS;
    try {
      const saved = localStorage.getItem(`shopease_products_${id}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return SEED_IDS.includes(id) ? MOCK_PRODUCTS : [];
  });
  const [bills, setBills] = useState(() => {
    const id = currentSavedShop?.id;
    if (!id || !sessionStorage.getItem('shopease_token')) return MOCK_BILLS;
    try {
      const saved = localStorage.getItem(`shopease_bills_${id}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return SEED_IDS.includes(id) ? MOCK_BILLS : [];
  });
  const [coupons, setCoupons] = useState(() => {
    const id = currentSavedShop?.id;
    if (!id || !sessionStorage.getItem('shopease_token')) return MOCK_COUPONS;
    try {
      const saved = localStorage.getItem(`shopease_coupons_${id}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return SEED_IDS.includes(id) ? MOCK_COUPONS : [];
  });
  const [returns, setReturns] = useState(() => {
    const id = currentSavedShop?.id;
    if (!id || !sessionStorage.getItem('shopease_token')) return [];
    try {
      // Build the valid bill ID set for this shop to filter out foreign returns
      const billsRaw = localStorage.getItem(`shopease_bills_${id}`);
      const shopBills = billsRaw ? JSON.parse(billsRaw) : (SEED_IDS.includes(id) ? MOCK_BILLS : []);
      const validBillIds = new Set(shopBills.map(b => b.id));
      const saved = localStorage.getItem(`shopease_returns_${id}`);
      if (!saved) return [];
      return JSON.parse(saved).filter(r => !r.originalBillId || validBillIds.has(r.originalBillId));
    } catch { return []; }
  });
  const [stockLedger, setStockLedger] = useState(() => {
    const id = currentSavedShop?.id;
    if (!id || !sessionStorage.getItem('shopease_token')) return [];
    try {
      // Build valid product ID set to filter out foreign ledger entries
      const prodsRaw = localStorage.getItem(`shopease_products_${id}`);
      const shopProds = prodsRaw ? JSON.parse(prodsRaw) : (SEED_IDS.includes(id) ? MOCK_PRODUCTS : []);
      const validProdIds = new Set(shopProds.map(p => p.id));
      const saved = localStorage.getItem(`shopease_stock_${id}`);
      if (saved) return JSON.parse(saved).filter(e => validProdIds.has(e.productId));
      return SEED_IDS.includes(id) ? MOCK_STOCK_LEDGER : [];
    } catch { return SEED_IDS.includes(id) ? MOCK_STOCK_LEDGER : []; }
  });

  const [expenses, setExpenses] = useState(() => {
    const id = currentSavedShop?.id;
    if (!id || !sessionStorage.getItem('shopease_token')) return [];
    try {
      const saved = localStorage.getItem(`shopease_expenses_${id}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Persist shops to localStorage whenever they change
  useEffect(() => {
    safeSet('shopease_shops', allShops);
  }, [allShops]);

  // Persist per-shop data — only while logged in so logout's state wipe never
  // overwrites real data in localStorage with empty arrays.
  // Uses safeSet so QuotaExceededError never crashes the app or silently drops data.
  useEffect(() => {
    if (isLoggedIn && shop?.id) safeSet(`shopease_products_${shop.id}`, products);
  }, [isLoggedIn, products, shop?.id]);
  useEffect(() => {
    if (isLoggedIn && shop?.id) safeSet(`shopease_bills_${shop.id}`, bills);
  }, [isLoggedIn, bills, shop?.id]);
  useEffect(() => {
    if (isLoggedIn && shop?.id) safeSet(`shopease_coupons_${shop.id}`, coupons);
  }, [isLoggedIn, coupons, shop?.id]);
  useEffect(() => {
    if (isLoggedIn && shop?.id) safeSet(`shopease_returns_${shop.id}`, returns);
  }, [isLoggedIn, returns, shop?.id]);
  useEffect(() => {
    if (isLoggedIn && shop?.id) safeSet(`shopease_stock_${shop.id}`, stockLedger);
  }, [isLoggedIn, stockLedger, shop?.id]);
  useEffect(() => {
    if (isLoggedIn && shop?.id) safeSet(`shopease_expenses_${shop.id}`, expenses);
  }, [isLoggedIn, expenses, shop?.id]);

  // ── Auth validation ────────────────────────────────────────────────────────
  const validatePhoneLogin = (phone) => {
    const clean = phone.replace(/\D/g, '');
    const found = allShops.find(s => s.phone.replace(/\D/g, '') === clean);
    if (!found) return { success: false, reason: 'not_registered', message: 'This phone number is not registered. Please create an account first.' };
    if (found.status === 'suspended') return { success: false, reason: 'suspended', message: 'Your account has been suspended. Contact ShopEase support to reactivate.' };
    return { success: true, shop: found };
  };

  const validateEmailLogin = (email, password) => {
    const found = allShops.find(s => s.email?.toLowerCase() === email.toLowerCase());
    if (!found) return { success: false, reason: 'not_registered', message: 'This email is not registered. Please create an account first.' };
    if (found.status === 'suspended') return { success: false, reason: 'suspended', message: 'Your account has been suspended. Contact ShopEase support to reactivate.' };
    // If shop has a stored password, verify it; demo/seed shops have null password (any accepted)
    if (found.password && found.password !== password) return { success: false, reason: 'wrong_password', message: 'Incorrect password.' };
    return { success: true, shop: found };
  };

  const resetPassword = (email, newPassword) => {
    const found = allShops.find(s => s.email?.toLowerCase() === email.toLowerCase());
    if (!found) return false;
    setAllShops(prev => prev.map(s => s.id === found.id ? { ...s, password: newPassword } : s));
    return true;
  };

  // ── Login / Logout ─────────────────────────────────────────────────────────
  // token is a real JWT from the backend (passed when Login/Register calls the API).
  // When token is absent (admin panel, demo mode), we skip the API refresh.
  const loginAsShop = useCallback((shopData, token) => {
    const authToken = token || `demo-${shopData.id}-${Date.now()}`;
    sessionStorage.setItem('shopease_token', authToken);
    safeSet('shopease_current_shop', shopData);
    setShop(shopData);
    // Set isLoggedIn immediately so protected routes render without redirect
    setIsLoggedIn(true);

    const isSeed = SEED_IDS.includes(shopData.id);
    const sid    = shopData.id;

    // Step 1 — load from localStorage cache instantly (snappy UX even on slow connections)
    const cachedProducts = safeGet(`shopease_products_${sid}`, isSeed ? MOCK_PRODUCTS : []);
    const cachedBills    = safeGet(`shopease_bills_${sid}`,    isSeed ? MOCK_BILLS : []);
    const cachedCoupons  = safeGet(`shopease_coupons_${sid}`,  isSeed ? MOCK_COUPONS : []);
    const cachedReturns  = safeGet(`shopease_returns_${sid}`,  []);
    const cachedStock    = safeGet(`shopease_stock_${sid}`,    isSeed ? MOCK_STOCK_LEDGER : []);
    const cachedExpenses = safeGet(`shopease_expenses_${sid}`, []);
    const validBillIds   = new Set(cachedBills.map(b => b.id));
    const validProdIds   = new Set(cachedProducts.map(p => p.id));

    setProducts(cachedProducts);
    setBills(cachedBills);
    setCoupons(cachedCoupons);
    setReturns(cachedReturns.filter(r => !r.originalBillId || validBillIds.has(r.originalBillId)));
    setStockLedger(cachedStock.filter(e => validProdIds.has(e.productId)));
    setExpenses(cachedExpenses);

    // Step 2 — refresh from backend in background (only when we have a real JWT)
    if (token) {
      setIsLoading(true);
      Promise.all([
        api.get('/api/products?limit=200'),
        api.get('/api/bills?limit=500'),
        api.get('/api/coupons'),
        api.get('/api/returns?limit=200'),
        api.get('/api/stock?limit=2000'),
        api.get('/api/expenses?limit=500'),
      ]).then(([prodsRes, billsRes, couponsRes, retsRes, stockRes, expsRes]) => {
        const prods = (prodsRes.products  || []).map(normalizeProduct);
        const bills = (billsRes.bills     || []).map(normalizeBill);
        const cpns  = (Array.isArray(couponsRes) ? couponsRes : (couponsRes.coupons || [])).map(normalizeCoupon);
        const rets  = (retsRes.returns    || []).map(normalizeReturn);
        const exps  = expsRes.expenses    || [];
        const stockEntries = (stockRes.entries || []).map(normalizeStockEntry);
        setProducts(prods);
        setBills(bills);
        setCoupons(cpns);
        setReturns(rets);
        setStockLedger(stockEntries);
        setExpenses(exps);
        // Update localStorage cache with fresh data
        safeSet(`shopease_products_${sid}`, prods);
        safeSet(`shopease_bills_${sid}`,    bills);
        safeSet(`shopease_coupons_${sid}`,  cpns);
        safeSet(`shopease_returns_${sid}`,  rets);
        safeSet(`shopease_stock_${sid}`,    stockEntries);
        safeSet(`shopease_expenses_${sid}`, exps);
      }).catch(() => {
        // Backend unreachable — cached data already in state, no action needed
      }).finally(() => setIsLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('shopease_token');
    safeRemove('shopease_current_shop');
    // Wipe all in-memory state so no data leaks to the next login session
    setProducts([]);
    setBills([]);
    setCoupons([]);
    setReturns([]);
    setStockLedger([]);
    setExpenses([]);
    setIsLoggedIn(false);
  }, []);

  // Kept for backward compatibility (Register still calls this)
  const login = (token) => {
    sessionStorage.setItem('shopease_token', token);
    setIsLoggedIn(true);
  };

  // Pure check — no side effects. Use this on step-1 credential form.
  const checkAdminCredentials = (email, password) =>
    email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && !!ADMIN_KEY && password === ADMIN_KEY;

  // Full login — call this only AFTER OTP is confirmed.
  const adminLogin = useCallback((email, password) => {
    if (checkAdminCredentials(email, password)) {
      sessionStorage.setItem('shopease_admin', 'true');
      setIsAdmin(true);
      return true;
    }
    return false;
  }, [checkAdminCredentials]);

  const adminLogout = useCallback(() => {
    sessionStorage.removeItem('shopease_admin');
    setIsAdmin(false);
  }, []);

  // ── Registration ───────────────────────────────────────────────────────────
  const registerShop = ({ ownerName, phone, email, password, shopName, address, gstin }) => {
    const newShop = {
      id: `shop-${Date.now()}`, shopName, ownerName, address,
      gstin: gstin || '', phone, email: email || '', password: password || null,
      reportEmail: email || '', dailyReport: true, dailyTime: '21:00',
      monthlyReport: true, lowStockLimit: 5, pdfAttachment: true,
      createdAt: new Date().toISOString(), status: 'active',
    };
    setAllShops(prev => [...prev, newShop]);
    setShop(newShop);
    localStorage.setItem('shopease_current_shop', JSON.stringify(newShop));
    setProducts([]);
    setBills([]);
    setCoupons([]);
    setReturns([]);
    setStockLedger([]);
    return newShop;
  };

  // ── Admin shop management ──────────────────────────────────────────────────
  const adminUpdateShop = (id, updates) => {
    setAllShops(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    if (shop.id === id) setShop(prev => ({ ...prev, ...updates }));
  };

  const adminToggleShop = (id) => {
    setAllShops(prev => prev.map(s =>
      s.id === id ? { ...s, status: s.status === 'active' ? 'suspended' : 'active' } : s
    ));
  };

  const adminDeleteShop = (id) => {
    setAllShops(prev => prev.filter(s => s.id !== id));
  };

  // ── Products ───────────────────────────────────────────────────────────────
  // All mutations use optimistic UI: apply locally first, sync to backend in background.
  // If the backend is offline, localStorage persistence (via the useEffect below) keeps data safe.
  const addProduct = (product) => {
    const id = `p${Date.now()}`;
    const newProduct = { ...product, id, isActive: true };
    setProducts(prev => [...prev, newProduct]);
    if (product.stockQty > 0) {
      const entry = {
        id: `sl${Date.now()}`, productId: id, type: 'opening',
        qty: product.stockQty, balanceAfter: product.stockQty,
        date: new Date().toISOString(), note: 'Opening stock',
        supplierName: '', billNumber: '', invoiceNo: '', costPrice: product.costPrice || 0,
      };
      setStockLedger(prev => [...prev, entry]);
      // Sync to backend once the product is created so we have a real product UUID
      bgApi.post('/api/products', product).then(res => {
        const realId = res?.id;
        if (realId) {
          bgApi.post('/api/stock', {
            productId: realId, type: 'opening', qty: product.stockQty,
            balanceAfter: product.stockQty, costPrice: product.costPrice || 0,
            note: 'Opening stock',
          }).catch(() => {});
        }
      }).catch(() => {});
    } else {
      bgApi.post('/api/products', product).catch(() => {});
    }
    return newProduct;
  };
  const updateProduct = (id, updates) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    bgApi.put(`/api/products/${id}`, updates).catch(() => {});
  };
  const deleteProduct = (id) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    setStockLedger(prev => prev.filter(e => e.productId !== id));
    bgApi.delete(`/api/products/${id}`).catch(() => {});
  };

  const addStockPurchase = (productId, qty, supplierName, note, costPrice, invoiceNo) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const newBalance = product.stockQty + qty;
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, stockQty: newBalance } : p));
    bgApi.put(`/api/products/${productId}`, { stockQty: newBalance }).catch(() => {});
    const entry = {
      id: `sl${Date.now()}`, productId, type: 'purchase',
      qty, balanceAfter: newBalance,
      date: new Date().toISOString(),
      note: note || 'Stock added',
      supplierName: supplierName || '',
      invoiceNo: invoiceNo || '',
      billNumber: '', costPrice: costPrice || product.costPrice || 0,
    };
    setStockLedger(prev => [...prev, entry]);
    // Persist to backend — only if productId is a real UUID (not a local temp id)
    if (/^[0-9a-f]{8}-/i.test(productId)) {
      bgApi.post('/api/stock', {
        productId, type: 'purchase', qty, balanceAfter: newBalance,
        supplierName: supplierName || null, invoiceNo: invoiceNo || null,
        costPrice: costPrice || product.costPrice || 0, note: note || 'Stock added',
      }).catch(() => {});
    }
  };

  const updateStockEntry = (id, updates) => {
    setStockLedger(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const adjustEntryQty = (entryId, productId, newQty, oldQty) => {
    const delta = newQty - oldQty;
    if (delta === 0) return;
    setStockLedger(prev => {
      const sorted = prev.filter(e => e.productId === productId).sort((a, b) => new Date(a.date) - new Date(b.date));
      const fromIdx = sorted.findIndex(e => e.id === entryId);
      const affectedIds = new Set(sorted.slice(fromIdx).map(e => e.id));
      return prev.map(e => {
        if (!affectedIds.has(e.id)) return e;
        return { ...e, qty: e.id === entryId ? newQty : e.qty, balanceAfter: e.balanceAfter + delta };
      });
    });
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      const updated = Math.max(0, p.stockQty + delta);
      bgApi.put(`/api/products/${p.id}`, { stockQty: updated }).catch(() => {});
      return { ...p, stockQty: updated };
    }));
  };

  // ── Bills ──────────────────────────────────────────────────────────────────
  const addBill = (bill) => {
    // Guard against double-tap / double-click submitting the same bill twice
    if (_billInFlight.current) return null;
    _billInFlight.current = true;
    setTimeout(() => { _billInFlight.current = false; }, 2000);

    // Create bill locally with a temporary ID — UI gets the receipt instantly.
    const newBill = {
      ...bill, id: `b${Date.now()}`,
      billNumber: `BILL-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
      createdAt: new Date().toISOString(), status: 'completed',
    };
    setBills(prev => [newBill, ...prev]);

    // Batch all stock updates into one setProducts call (avoids stale closure issues)
    const stockUpdates = {};
    const ledgerEntries = [];
    bill.items.forEach(item => {
      if (item.productId && !item.isFreeAdded) {
        const product = products.find(p => p.id === item.productId);
        const newQty = Math.max(0, (product?.stockQty || 0) - item.qty);
        stockUpdates[item.productId] = newQty;
        ledgerEntries.push({
          id: `sl${Date.now()}-${item.productId}-${Math.random().toString(36).slice(2,7)}`,
          productId: item.productId, type: 'sale',
          qty: item.qty, balanceAfter: newQty,
          date: newBill.createdAt, note: `Sold to ${bill.customerName}`,
          supplierName: '', billNumber: newBill.billNumber, costPrice: 0,
        });
      }
    });
    if (Object.keys(stockUpdates).length)
      setProducts(prev => prev.map(p => stockUpdates[p.id] !== undefined ? { ...p, stockQty: stockUpdates[p.id] } : p));
    if (ledgerEntries.length) setStockLedger(prev => [...prev, ...ledgerEntries]);

    // Sync sale ledger entries for products with real UUIDs
    const stockApiEntries = ledgerEntries.filter(e => /^[0-9a-f]{8}-/i.test(e.productId));
    if (stockApiEntries.length) {
      bgApi.post('/api/stock/batch', {
        entries: stockApiEntries.map(e => ({
          productId: e.productId, type: 'sale', qty: e.qty,
          balanceAfter: e.balanceAfter, billNumber: e.billNumber, note: e.note,
        })),
      }).catch(() => {});
    }

    // Persist bill to backend in background — doesn't block the UI
    bgApi.post('/api/bills', bill).catch(() => {
      setBills(prev => prev.map(b => b.id === newBill.id ? { ...b, _offline: true } : b));
    });

    return newBill;
  };

  // ── Returns ────────────────────────────────────────────────────────────────
  const addReturn = (returnData) => {
    const newReturn = {
      ...returnData,
      id: `ret-${Date.now()}`,
      returnNumber: `RET-${new Date().getFullYear()}-${String(returns.length + 1).padStart(5, '0')}`,
      returnedAt: new Date().toISOString(),
    };
    setReturns(prev => [newReturn, ...prev]);

    // Update stock ledger based on owner's choice
    const stockRestore = {};
    const retLedger = [];
    if (returnData.restoreStock !== false) {
      // YES — add items back to stock
      returnData.items.forEach(item => {
        if (item.productId) {
          const product = products.find(p => p.id === item.productId);
          const newBal = (product?.stockQty || 0) + item.returnQty;
          stockRestore[item.productId] = newBal;
          retLedger.push({
            id: `sl${Date.now()}-ret-${item.productId}`, productId: item.productId, type: 'return',
            qty: item.returnQty, balanceAfter: newBal,
            date: new Date().toISOString(),
            note: returnData.reason ? `Return from ${returnData.customerName} — ${returnData.reason}` : `Return from ${returnData.customerName}`,
            supplierName: '', billNumber: returnData.originalBillNumber || '', costPrice: 0,
          });
        }
      });
      if (Object.keys(stockRestore).length)
        setProducts(prev => prev.map(p => stockRestore[p.id] !== undefined ? { ...p, stockQty: stockRestore[p.id] } : p));
      if (retLedger.length) setStockLedger(prev => [...prev, ...retLedger]);
    } else {
      // NO — record discarded return without changing stock
      returnData.items.forEach(item => {
        if (item.productId) {
          const product = products.find(p => p.id === item.productId);
          retLedger.push({
            id: `sl${Date.now()}-disc-${item.productId}`, productId: item.productId, type: 'return-discarded',
            qty: item.returnQty, balanceAfter: product?.stockQty || 0,
            date: new Date().toISOString(),
            note: returnData.discardReason || 'Discarded — not restocked',
            supplierName: '', billNumber: returnData.originalBillNumber || '', costPrice: 0,
          });
        }
      });
      if (retLedger.length) setStockLedger(prev => [...prev, ...retLedger]);
    }
    setBills(prev => prev.map(b =>
      b.id === returnData.originalBillId
        ? { ...b, hasReturn: true, returnedAmount: (b.returnedAmount || 0) + returnData.refundAmount }
        : b
    ));

    // Sync return ledger entries for products with real UUIDs
    const retApiEntries = retLedger.filter(e => /^[0-9a-f]{8}-/i.test(e.productId));
    if (retApiEntries.length) {
      bgApi.post('/api/stock/batch', {
        entries: retApiEntries.map(e => ({
          productId: e.productId, type: 'return', qty: e.qty,
          balanceAfter: e.balanceAfter, billNumber: e.billNumber, note: e.note,
        })),
      }).catch(() => {});
    }

    // Persist to backend in background
    bgApi.post('/api/returns', returnData).catch(() => {});

    return newReturn;
  };

  // ── Coupons ────────────────────────────────────────────────────────────────
  const addCoupon = (coupon) => {
    const id = `c${Date.now()}`;
    setCoupons(prev => [...prev, { ...coupon, id, timesUsed: 0 }]);
    bgApi.post('/api/coupons', coupon).catch(() => {});
  };
  const updateCoupon = (id, updates) => {
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    bgApi.put(`/api/coupons/${id}`, updates).catch(() => {});
  };
  const deleteCoupon = (id) => {
    setCoupons(prev => prev.filter(c => c.id !== id));
    bgApi.delete(`/api/coupons/${id}`).catch(() => {});
  };

  const updateShop = (updates) => {
    setShop(prev => ({ ...prev, ...updates }));
    setAllShops(prev => prev.map(s => s.id === shop.id ? { ...s, ...updates } : s));
    bgApi.put('/api/settings', updates).catch(() => {});
  };

  const validateCoupon = (code, total) => {
    if (!code) return { valid: false, message: 'Enter a coupon code' };
    const coupon = coupons.find(c => c.code.toUpperCase() === code.toUpperCase());
    if (!coupon) return { valid: false, message: `Coupon code "${code}" not found` };
    if (!coupon.isActive) return { valid: false, message: 'This coupon is currently paused' };
    if (new Date(coupon.expiryDate) < new Date()) return { valid: false, message: 'This coupon has expired' };
    if (coupon.minPurchase > 0 && total < coupon.minPurchase) {
      return { valid: false, message: `Minimum bill of ₹${coupon.minPurchase.toLocaleString('en-IN')} required to use this coupon` };
    }
    if (coupon.type === 'buyget') {
      return { valid: true, discount: 0, isBuyGet: true, freeCount: coupon.getFree ?? coupon.buyN ?? 1, coupon };
    }
    let discount = 0;
    if (coupon.type === 'percentage') discount = (total * Math.min(coupon.value, 100)) / 100;
    else discount = coupon.value;
    return { valid: true, discount: Math.min(discount, total), coupon };
  };

  // ── Derived (memoised — recalculate only when the source arrays change) ─────
  const todaysBills = useMemo(
    () => bills.filter(b => new Date(b.createdAt).toDateString() === new Date().toDateString()),
    [bills]
  );
  // Revenue = total collected minus GST (GST belongs to govt, not shop income)
  const todaysSales = useMemo(
    () => todaysBills.reduce((sum, b) => sum + (b.total - (b.taxAmount || 0)), 0),
    [todaysBills]
  );
  // Profit = Revenue (after discounts, excl. GST) − Cost of goods sold
  const todaysProfit = useMemo(
    () => todaysBills.reduce((sum, b) => {
      const revenue = b.total - (b.taxAmount || 0);
      const cost = b.items.reduce((s, item) => s + (item.costPrice || 0) * item.qty, 0);
      return sum + revenue - cost;
    }, 0),
    [todaysBills]
  );
  const lowStockProducts = useMemo(
    () => products.filter(p => p.stockQty <= p.minStockAlert && p.isActive),
    [products]
  );

  const todaysExpenses = useMemo(() => {
    const todayStr = new Date().toDateString();
    return expenses.filter(e => {
      const d = new Date((e.expenseDate || (e.createdAt || '')).replace('T', ' '));
      return d.toDateString() === todayStr;
    });
  }, [expenses]);

  const todaysExpenseTotal = useMemo(
    () => todaysExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0),
    [todaysExpenses]
  );

  const addExpense = async (expense) => {
    const tempId = `exp-${Date.now()}`;
    const temp   = {
      ...expense, id: tempId, createdAt: new Date().toISOString(),
      expenseDate: expense.expenseDate || new Date().toISOString().split('T')[0],
    };
    setExpenses(prev => [temp, ...prev]);
    try {
      const res = await api.post('/api/expenses', expense);
      setExpenses(prev => prev.map(e => e.id === tempId ? res : e));
    } catch { /* keep optimistic */ }
  };

  const deleteExpense = async (id) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    bgApi.delete(`/api/expenses/${id}`).catch(() => {});
  };

  // Force logout when any API call gets a 401 (expired token in another tab, etc.)
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('shopease:session-expired', handler);
    return () => window.removeEventListener('shopease:session-expired', handler);
  }, [logout]);

  // Keep Render free-tier server warm — ping /health every 9 minutes so the
  // server never goes to sleep (Render sleeps after 15 min of inactivity).
  // This prevents the 30-60s cold-start delay when switching pages.
  useEffect(() => {
    if (!isLoggedIn && !isAdmin) return;
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const ping = () => fetch(`${base}/health`).catch(() => {});
    ping();
    const id = setInterval(ping, 9 * 60 * 1000);
    return () => clearInterval(id);
  }, [isLoggedIn, isAdmin]);

  // Auto-logout after 10 minutes of inactivity OR when the tab is closed
  // (tab-close is handled by sessionStorage — tokens clear automatically).
  // Here we handle the inactivity case with an event-driven timer.
  const _doLogout = useRef(null);
  _doLogout.current = isAdmin ? adminLogout : logout;

  useEffect(() => {
    if (!isLoggedIn && !isAdmin) return;
    let timer;
    const IDLE = 10 * 60 * 1000; // 10 minutes
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => _doLogout.current?.(), IDLE);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset(); // start the clock
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [isLoggedIn, isAdmin]);

  return (
    <AppContext.Provider value={{
      isLoggedIn, isLoading, login, loginAsShop, logout,
      isAdmin, adminLogin, checkAdminCredentials, adminLogout,
      shop, updateShop,
      allShops, adminUpdateShop, adminToggleShop, adminDeleteShop,
      registerShop,
      validatePhoneLogin, validateEmailLogin, resetPassword,
      products, addProduct, updateProduct, deleteProduct,
      bills, addBill,
      returns, addReturn,
      stockLedger, addStockPurchase, updateStockEntry, adjustEntryQty,
      coupons, addCoupon, updateCoupon, deleteCoupon, validateCoupon,
      expenses, addExpense, deleteExpense,
      todaysBills, todaysSales, todaysProfit, lowStockProducts,
      todaysExpenses, todaysExpenseTotal,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
