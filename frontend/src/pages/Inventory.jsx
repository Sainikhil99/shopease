import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  Plus, Package, TrendingUp, TrendingDown, IndianRupee,
  X, Check, Search, ArrowRight, Printer, FileText,
  CalendarDays, ChevronDown, AlertTriangle, Boxes, Sparkles,
  Pencil, Download
} from 'lucide-react';

const CATEGORIES = ['clothing', 'footwear', 'accessories', 'electronics', 'groceries', 'other'];
const GST_RATES  = [0, 5, 12, 18, 28];

// ── Period helpers ────────────────────────────────────────────────────────────
const periodRange = (period, custom) => {
  const now  = new Date();
  const eod  = new Date(now); eod.setHours(23, 59, 59, 999);
  if (period === 'today') {
    const s = new Date(now); s.setHours(0, 0, 0, 0);
    return { start: s, end: eod };
  }
  if (period === 'week') {
    const s = new Date(now); s.setDate(now.getDate() - 6); s.setHours(0, 0, 0, 0);
    return { start: s, end: eod };
  }
  if (period === 'month') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: eod };
  }
  if (period === 'custom' && custom?.from && custom?.to) {
    const s = new Date(custom.from); s.setHours(0, 0, 0, 0);
    const e = new Date(custom.to);  e.setHours(23, 59, 59, 999);
    return { start: s, end: e };
  }
  return null;
};
const inRange = (dateStr, range) => {
  if (!range) return true;
  const d = new Date(dateStr);
  return d >= range.start && d <= range.end;
};
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtDateTime = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

// ── PDF: Stock-In Slip + Full Inventory Snapshot ──────────────────────────────
function printStockInSlip(batch, allProducts, shop) {
  const now       = new Date();
  const dateStr   = fmtDateTime(now.toISOString());
  const suppliers = [...new Set(batch.map(i => i.supplier).filter(Boolean))].join(', ') || '—';
  const invoices  = [...new Set(batch.map(i => i.invoice).filter(Boolean))].join(', ') || '—';
  const totalQty  = batch.reduce((s, i) => s + i.qtyAdded, 0);
  const totalCost = batch.reduce((s, i) => s + i.qtyAdded * (parseFloat(i.costPrice) || 0), 0);

  const batchRows = batch.map(b => `
    <tr>
      <td>${b.product.name}</td>
      <td style="text-align:center">${b.product.category}</td>
      <td style="text-align:center;color:#dc2626;font-weight:bold">${b.qtyBefore}</td>
      <td style="text-align:center;color:#16a34a;font-weight:bold">+${b.qtyAdded}</td>
      <td style="text-align:center;color:#1d4ed8;font-weight:bold">${b.qtyAfter}</td>
      <td style="text-align:center">${b.costPrice ? '₹' + parseFloat(b.costPrice).toLocaleString('en-IN') : '—'}</td>
      <td style="text-align:center">${b.costPrice ? '₹' + (b.qtyAdded * parseFloat(b.costPrice)).toLocaleString('en-IN') : '—'}</td>
      <td>${b.note || '—'}</td>
    </tr>`).join('');

  const snapshotRows = allProducts.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${p.category}</td>
      <td style="text-align:center;font-weight:bold;color:${p.stockQty === 0 ? '#dc2626' : p.stockQty <= p.minStockAlert ? '#ea580c' : '#111'}">${p.stockQty}</td>
      <td style="text-align:center">₹${(p.sellingPrice || p.mrp).toLocaleString('en-IN')}</td>
      <td style="text-align:center">₹${(p.costPrice || 0).toLocaleString('en-IN')}</td>
      <td style="text-align:center">₹${(p.stockQty * (p.costPrice || 0)).toLocaleString('en-IN')}</td>
      <td style="text-align:center;font-weight:bold;color:${p.stockQty === 0 ? '#dc2626' : p.stockQty <= p.minStockAlert ? '#ea580c' : '#16a34a'}">
        ${p.stockQty === 0 ? '🔴 OUT' : p.stockQty <= p.minStockAlert ? '🟠 LOW' : '🟢 OK'}
      </td>
    </tr>`).join('');

  const totalStockValue = allProducts.reduce((s, p) => s + p.stockQty * (p.costPrice || 0), 0);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Stock-In Receipt — ${shop.shopName}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:24px;max-width:900px;margin:auto}
    .print-btn{display:block;margin:0 0 16px auto;padding:10px 28px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:bold}
    .shop-header{text-align:center;border-bottom:3px solid #1d4ed8;padding-bottom:12px;margin-bottom:20px}
    .shop-header h1{font-size:22px;color:#1d4ed8;font-weight:800}
    .shop-header p{color:#555;margin-top:3px;font-size:11px}
    .slip-badge{text-align:center;background:#eff6ff;border:2px solid #bfdbfe;border-radius:8px;padding:8px;font-size:15px;font-weight:800;color:#1e40af;margin-bottom:16px;letter-spacing:1px}
    .meta-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:20px}
    .meta-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px}
    .meta-label{font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px}
    .meta-value{font-size:13px;font-weight:bold;color:#111;margin-top:3px}
    .section{font-size:13px;font-weight:800;color:#1d4ed8;margin:20px 0 8px;padding-bottom:4px;border-bottom:2px solid #bfdbfe;text-transform:uppercase;letter-spacing:.5px}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    thead th{background:#1d4ed8;color:#fff;padding:8px 6px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.3px}
    tbody td{padding:7px 6px;border-bottom:1px solid #f3f4f6;font-size:11px}
    tbody tr:nth-child(even) td{background:#f9fafb}
    .total-row td{border-top:2px solid #1d4ed8;background:#eff6ff!important;font-weight:bold;color:#1d4ed8}
    .footer{text-align:center;margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:10px}
    @media print{.print-btn{display:none}}
  </style></head><body>
  <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  <div class="shop-header">
    <h1>${shop.shopName}</h1>
    <p>${shop.address || ''} ${shop.phone ? '· 📞 ' + shop.phone : ''} ${shop.gstin ? '· GSTIN: ' + shop.gstin : ''}</p>
  </div>
  <div class="slip-badge">📦 STOCK-IN RECEIPT</div>
  <div class="meta-grid">
    <div class="meta-box"><div class="meta-label">Date & Time</div><div class="meta-value">${dateStr}</div></div>
    <div class="meta-box"><div class="meta-label">Supplier</div><div class="meta-value">${suppliers}</div></div>
    <div class="meta-box"><div class="meta-label">Invoice No.</div><div class="meta-value">${invoices}</div></div>
    <div class="meta-box"><div class="meta-label">Products Added</div><div class="meta-value">${batch.length} item${batch.length > 1 ? 's' : ''} · ${totalQty} pieces</div></div>
  </div>
  <div class="section">Stock Addition Details</div>
  <table><thead><tr>
    <th>Product</th><th>Category</th><th>Before</th><th>Added</th><th>After</th><th>Cost/Pc</th><th>Total Cost</th><th>Note</th>
  </tr></thead><tbody>
    ${batchRows}
    <tr class="total-row"><td colspan="3" style="text-align:right;padding-right:12px">TOTAL</td>
      <td style="text-align:center">+${totalQty}</td><td></td><td></td>
      <td style="text-align:center">₹${totalCost.toLocaleString('en-IN')}</td><td></td></tr>
  </tbody></table>
  <div class="section">Full Inventory Snapshot — ${dateStr}</div>
  <table><thead><tr>
    <th>Product</th><th>Category</th><th>Stock Qty</th><th>Selling Price</th><th>Cost Price</th><th>Stock Value</th><th>Status</th>
  </tr></thead><tbody>
    ${snapshotRows}
    <tr class="total-row"><td colspan="5" style="text-align:right;padding-right:12px">TOTAL INVENTORY VALUE</td>
      <td style="text-align:center">₹${totalStockValue.toLocaleString('en-IN')}</td><td></td></tr>
  </tbody></table>
  <div class="footer">
    <p>Generated by ShopEase · ${dateStr}</p>
    <p style="margin-top:4px">This is a computer-generated stock-in receipt. Keep for your records.</p>
  </div>
  </body></html>`;

  const win = window.open('', '_blank', 'width=960,height=720');
  win.document.write(html);
  win.document.close();
}

// ── PDF: Period / Monthly Report ──────────────────────────────────────────────
function printInventoryReport(products, stockLedger, range, periodLabel, shop) {
  const entries = stockLedger.filter(e => inRange(e.date, range));
  const dateStr = fmtDateTime(new Date().toISOString());

  const rows = products.map(p => {
    const pEntries  = entries.filter(e => e.productId === p.id);
    const addedQty  = pEntries.filter(e => e.type !== 'sale').reduce((s, e) => s + e.qty, 0);
    const soldQty   = pEntries.filter(e => e.type === 'sale').reduce((s, e) => s + e.qty, 0);
    const openingQty = p.stockQty - addedQty + soldQty;
    return { p, openingQty, addedQty, soldQty, closingQty: p.stockQty };
  });

  const tableRows = rows.map(({ p, openingQty, addedQty, soldQty, closingQty }) => `
    <tr>
      <td>${p.name}</td>
      <td>${p.category}</td>
      <td style="text-align:center">${openingQty}</td>
      <td style="text-align:center;color:#16a34a;font-weight:bold">+${addedQty}</td>
      <td style="text-align:center;color:#dc2626;font-weight:bold">−${soldQty}</td>
      <td style="text-align:center;font-weight:bold;color:${closingQty === 0 ? '#dc2626' : closingQty <= p.minStockAlert ? '#ea580c' : '#1d4ed8'}">${closingQty}</td>
      <td style="text-align:center">₹${(closingQty * (p.costPrice || 0)).toLocaleString('en-IN')}</td>
    </tr>`).join('');

  const totalVal = rows.reduce((s, r) => s + r.closingQty * (r.p.costPrice || 0), 0);

  const movRows = stockLedger
    .filter(e => inRange(e.date, range))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(e => {
      const prod = products.find(p => p.id === e.productId);
      return `<tr>
        <td>${fmtDate(e.date)}</td>
        <td>${prod?.name || '—'}</td>
        <td style="text-align:center;font-weight:bold;color:${e.type === 'sale' ? '#dc2626' : '#16a34a'}">${e.type}</td>
        <td style="text-align:center;font-weight:bold;color:${e.type === 'sale' ? '#dc2626' : '#16a34a'}">${e.type === 'sale' ? '−' : '+'}${e.qty}</td>
        <td style="text-align:center">${e.balanceAfter}</td>
        <td>${e.supplierName || '—'}</td>
        <td>${e.billNumber || '—'}</td>
        <td>${e.note || '—'}</td>
      </tr>`;
    }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Inventory Report — ${periodLabel}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:24px;max-width:1000px;margin:auto}
    .print-btn{display:block;margin:0 0 16px auto;padding:10px 28px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:bold}
    .shop-header{text-align:center;border-bottom:3px solid #1d4ed8;padding-bottom:12px;margin-bottom:20px}
    .shop-header h1{font-size:20px;color:#1d4ed8;font-weight:800}
    .report-badge{text-align:center;background:#f0fdf4;border:2px solid #bbf7d0;border-radius:8px;padding:8px;font-size:14px;font-weight:800;color:#15803d;margin-bottom:16px}
    .section{font-size:12px;font-weight:800;color:#1d4ed8;margin:20px 0 8px;padding-bottom:4px;border-bottom:2px solid #bfdbfe;text-transform:uppercase}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    thead th{background:#1d4ed8;color:#fff;padding:7px 5px;text-align:left;font-size:10px;text-transform:uppercase}
    tbody td{padding:6px 5px;border-bottom:1px solid #f3f4f6;font-size:10px}
    tbody tr:nth-child(even) td{background:#f9fafb}
    .total-row td{border-top:2px solid #1d4ed8;background:#eff6ff!important;font-weight:bold;color:#1d4ed8}
    .footer{text-align:center;margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:10px}
    @media print{.print-btn{display:none}}
  </style></head><body>
  <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  <div class="shop-header">
    <h1>${shop.shopName}</h1>
    <p>${shop.address || ''} ${shop.phone ? '· 📞 ' + shop.phone : ''}</p>
  </div>
  <div class="report-badge">📊 INVENTORY REPORT — ${periodLabel.toUpperCase()}</div>
  <div class="section">Product-wise Summary (Opening → Added → Sold → Closing)</div>
  <table><thead><tr>
    <th>Product</th><th>Category</th><th>Opening Stock</th><th>Added (+)</th><th>Sold (−)</th><th>Closing Stock</th><th>Stock Value</th>
  </tr></thead><tbody>
    ${tableRows}
    <tr class="total-row"><td colspan="6" style="text-align:right;padding-right:12px">TOTAL INVENTORY VALUE</td>
      <td style="text-align:center">₹${totalVal.toLocaleString('en-IN')}</td></tr>
  </tbody></table>
  <div class="section">All Stock Movements in Period</div>
  <table><thead><tr>
    <th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Balance After</th><th>Supplier</th><th>Bill / Invoice</th><th>Note</th>
  </tr></thead><tbody>${movRows || '<tr><td colspan="8" style="text-align:center;padding:16px;color:#9ca3af">No movements in this period</td></tr>'}</tbody></table>
  <div class="footer"><p>Generated by ShopEase · ${dateStr}</p></div>
  </body></html>`;

  const win = window.open('', '_blank', 'width=1024,height=720');
  win.document.write(html);
  win.document.close();
}

// ── Print: Stock Movements only ───────────────────────────────────────────────
function printStockMovements(entries, products, periodLabel, shop) {
  const dateStr = fmtDateTime(new Date().toISOString());
  const rows = entries.map(e => {
    const prod = products.find(p => p.id === e.productId);
    return `<tr>
      <td>${fmtDate(e.date)}</td>
      <td>${prod?.name || '—'}</td>
      <td style="text-align:center;font-weight:bold;color:${e.type === 'sale' ? '#dc2626' : '#16a34a'}">${e.type}</td>
      <td style="text-align:center;font-weight:bold;color:${e.type === 'sale' ? '#dc2626' : '#16a34a'}">${e.type === 'sale' ? '−' : '+'}${e.qty}</td>
      <td style="text-align:center">${e.balanceAfter}</td>
      <td>${e.supplierName || '—'}</td>
      <td>${e.billNumber || '—'}</td>
      <td>${e.note || '—'}</td>
    </tr>`;
  }).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Stock Movements — ${periodLabel}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:24px;max-width:1000px;margin:auto}
  .print-btn{display:block;margin:0 0 16px auto;padding:10px 28px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:bold}
  h2{font-size:18px;color:#1d4ed8;font-weight:800;margin-bottom:4px}p.sub{color:#555;font-size:11px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse}thead th{background:#1d4ed8;color:#fff;padding:7px 5px;text-align:left;font-size:10px;text-transform:uppercase}
  tbody td{padding:6px 5px;border-bottom:1px solid #f3f4f6;font-size:10px}tbody tr:nth-child(even) td{background:#f9fafb}
  .footer{text-align:center;margin-top:20px;color:#9ca3af;font-size:10px}@media print{.print-btn{display:none}}</style></head><body>
  <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  <h2>${shop?.shopName || ''} — Stock Movements</h2>
  <p class="sub">Period: ${periodLabel} · Generated: ${dateStr}</p>
  <table><thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Balance</th><th>Supplier</th><th>Bill/Invoice</th><th>Note</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="8" style="text-align:center;padding:16px;color:#9ca3af">No movements</td></tr>'}</tbody></table>
  <div class="footer"><p>Generated by ShopEase · ${dateStr}</p></div>
  </body></html>`;
  const win = window.open('', '_blank', 'width=1024,height=720');
  win.document.write(html);
  win.document.close();
}

// ── 24h same-supplier batch helpers ──────────────────────────────────────────
const BATCH_KEY = (shopId) => `shopease_recent_batch_${shopId}`;

function saveRecentBatch(shopId, batch) {
  try {
    localStorage.setItem(BATCH_KEY(shopId), JSON.stringify({
      supplier:  batch[0]?.supplier || '',
      invoiceNo: batch[0]?.invoice  || '',
      savedAt:   Date.now(),
      items: batch.map(b => ({
        product:   b.product,
        qtyAdded:  b.qtyAdded,
        costPrice: b.costPrice,
        note:      b.note,
      })),
    }));
  } catch {}
}

function loadRecentBatch(shopId) {
  try {
    const raw = localStorage.getItem(BATCH_KEY(shopId));
    if (!raw) return null;
    const batch = JSON.parse(raw);
    const age = Date.now() - batch.savedAt;
    if (age > 24 * 60 * 60 * 1000) { localStorage.removeItem(BATCH_KEY(shopId)); return null; }
    return batch;
  } catch { return null; }
}

// ── Add Stock Modal ───────────────────────────────────────────────────────────
const EMPTY_NEW = { name: '', category: 'clothing', mrp: '', sellingPrice: '', costPrice: '', gstRate: '0', minStockAlert: '5', qty: '' };

function AddStockModal({ products, onSave, onClose, onCreateProduct, recentBatch }) {
  const [batch, setBatch]             = useState([]);
  const [search, setSearch]           = useState('');
  const [supplier, setSupplier]       = useState('');
  const [invoice, setInvoice]         = useState('');
  const [showDrop, setShowDrop]       = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newProd, setNewProd]         = useState(EMPTY_NEW);
  const [creating, setCreating]       = useState(false);
  const [showRecent, setShowRecent]   = useState(!!recentBatch);

  const recentHoursAgo = recentBatch
    ? Math.floor((Date.now() - recentBatch.savedAt) / (60 * 60 * 1000))
    : 0;

  const continueRecentBatch = () => {
    setSupplier(recentBatch.supplier);
    setInvoice(recentBatch.invoiceNo);
    setBatch(recentBatch.items.map(i => ({
      product:   i.product,
      qtyAdded:  String(i.qtyAdded),
      costPrice: String(i.costPrice || ''),
      note:      i.note || '',
    })));
    setShowRecent(false);
  };

  const filtered = products.filter(p =>
    p.isActive && (
      !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.includes(search)
    )
  );
  const noMatch = search.trim().length > 0 && filtered.length === 0;

  const addToBatch = (product) => {
    if (batch.find(b => b.product.id === product.id)) return;
    setBatch(prev => [...prev, {
      product, qtyAdded: '', costPrice: String(product.costPrice || ''), note: '',
    }]);
    setSearch(''); setShowDrop(false);
  };

  const handleCreateProduct = () => {
    if (!newProd.name.trim()) return;
    setCreating(true);
    const created = onCreateProduct({
      name:          newProd.name.trim(),
      category:      newProd.category,
      mrp:           parseFloat(newProd.mrp) || 0,
      sellingPrice:  parseFloat(newProd.sellingPrice) || 0,
      costPrice:     parseFloat(newProd.costPrice) || 0,
      gstRate:       parseFloat(newProd.gstRate) || 0,
      minStockAlert: parseInt(newProd.minStockAlert) || 5,
      stockQty:      0,
      barcode:       '',
    });
    // Add the freshly-created product to the batch with qty pre-filled
    setBatch(prev => [...prev, {
      product: created, qtyAdded: newProd.qty || '', costPrice: String(created.costPrice || ''), note: '',
    }]);
    setNewProd(EMPTY_NEW);
    setSearch('');
    setShowDrop(false);
    setShowNewForm(false);
    setCreating(false);
  };

  const updateItem = (idx, key, val) => {
    setBatch(prev => prev.map((b, i) => i === idx ? { ...b, [key]: val } : b));
  };

  const removeItem = (idx) => setBatch(prev => prev.filter((_, i) => i !== idx));

  const canSave = batch.length > 0 && batch.every(b => parseInt(b.qtyAdded) > 0) && supplier.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const result = batch.map(b => ({
      product:    b.product,
      qtyBefore:  b.product.stockQty,
      qtyAdded:   parseInt(b.qtyAdded),
      qtyAfter:   b.product.stockQty + parseInt(b.qtyAdded),
      supplier:   supplier.trim(),
      invoice:    invoice.trim(),
      costPrice:  b.costPrice,
      note:       b.note.trim(),
    }));
    onSave(result);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Add Stock</h3>
            <p className="text-sm text-gray-400 mt-0.5">Search existing products or create a new one</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Shared fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Supplier / Source <span className="text-red-500">*</span></label>
              <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)}
                placeholder="e.g. Textile Mart, Mumbai" className={`input-field ${!supplier.trim() ? 'border-red-300' : ''}`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Invoice Number</label>
              <input type="text" value={invoice} onChange={e => setInvoice(e.target.value)}
                placeholder="e.g. INV-2026-001" className="input-field" />
            </div>
          </div>

          {/* 24h same-supplier banner */}
          {showRecent && recentBatch && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
              <div>
                <p className="font-semibold text-amber-800">
                  Recent entry from <span className="font-black">"{recentBatch.supplier}"</span> — {recentHoursAgo === 0 ? 'less than 1 hr' : `${recentHoursAgo} hr${recentHoursAgo > 1 ? 's' : ''}`} ago
                </p>
                <p className="text-xs text-amber-600 mt-0.5">{recentBatch.items.length} product{recentBatch.items.length !== 1 ? 's' : ''} · Continue adding or start fresh</p>
              </div>
              <div className="flex gap-2 shrink-0 ml-3">
                <button type="button" onClick={continueRecentBatch}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors">
                  Continue
                </button>
                <button type="button" onClick={() => setShowRecent(false)}
                  className="px-3 py-1.5 bg-white border border-amber-300 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-50 transition-colors">
                  New Entry
                </button>
              </div>
            </div>
          )}

          {/* Product search */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Add Products</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search}
                onChange={e => { setSearch(e.target.value); setShowDrop(true); setShowNewForm(false); }}
                onFocus={() => setShowDrop(true)}
                placeholder="Search product name or barcode…"
                className="input-field pl-9 text-sm" />
              {search && <button onClick={() => { setSearch(''); setShowDrop(false); setShowNewForm(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={13} /></button>}
            </div>

            {showDrop && (
              <div className="border border-gray-200 rounded-xl mt-1 overflow-hidden shadow-md">
                <div className="max-h-44 overflow-y-auto">
                  {filtered.length > 0
                    ? filtered.map(p => {
                        const already = batch.find(b => b.product.id === p.id);
                        return (
                          <button key={p.id} type="button"
                            onClick={() => already ? null : addToBatch(p)}
                            disabled={!!already}
                            className={`w-full flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0 text-left transition-colors ${already ? 'bg-green-50 opacity-60 cursor-not-allowed' : 'hover:bg-blue-50'}`}>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                              <p className="text-xs text-gray-400 capitalize">{p.category} · Stock: {p.stockQty}</p>
                            </div>
                            <span className={`text-xs font-bold ${already ? 'text-green-600' : 'text-blue-600'}`}>
                              {already ? '✓ Added' : '+ Add'}
                            </span>
                          </button>
                        );
                      })
                    : search.trim()
                      ? <p className="text-sm text-gray-400 px-4 py-3">No products found for "{search}"</p>
                      : null
                  }
                </div>
                {/* Create new product option */}
                {noMatch && (
                  <button type="button"
                    onClick={() => { setNewProd(n => ({ ...n, name: search.trim() })); setShowNewForm(true); setShowDrop(false); }}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 font-semibold text-sm hover:bg-blue-100 transition-colors border-t border-blue-100">
                    <Sparkles size={15} />
                    Create new product "{search.trim()}"
                  </button>
                )}
                {!noMatch && (
                  <button type="button" onClick={() => setShowDrop(false)}
                    className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 border-t border-gray-100 bg-gray-50">
                    Close
                  </button>
                )}
              </div>
            )}

            {/* Inline new product form */}
            {showNewForm && (
              <div className="mt-3 border-2 border-blue-200 bg-blue-50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-blue-600" />
                    <span className="text-sm font-bold text-blue-800">Create New Product</span>
                  </div>
                  <button type="button" onClick={() => setShowNewForm(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={15} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Product Name *</label>
                    <input type="text" value={newProd.name}
                      onChange={e => setNewProd(n => ({ ...n, name: e.target.value }))}
                      className="input-field text-sm" placeholder="e.g. Blue Cotton Shirt (L)" autoFocus />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                    <select value={newProd.category}
                      onChange={e => setNewProd(n => ({ ...n, category: e.target.value }))}
                      className="input-field text-sm capitalize">
                      {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">GST Rate (%)</label>
                    <select value={newProd.gstRate}
                      onChange={e => setNewProd(n => ({ ...n, gstRate: e.target.value }))}
                      className="input-field text-sm">
                      {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">MRP (₹)</label>
                    <input type="number" min="0" value={newProd.mrp}
                      onChange={e => setNewProd(n => ({ ...n, mrp: e.target.value, sellingPrice: e.target.value }))}
                      className="input-field text-sm" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Selling Price (₹)</label>
                    <input type="number" min="0" value={newProd.sellingPrice}
                      onChange={e => setNewProd(n => ({ ...n, sellingPrice: e.target.value }))}
                      className="input-field text-sm" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Cost Price (₹)</label>
                    <input type="number" min="0" value={newProd.costPrice}
                      onChange={e => setNewProd(n => ({ ...n, costPrice: e.target.value }))}
                      className="input-field text-sm" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity Received *</label>
                    <input type="number" min="1" value={newProd.qty}
                      onChange={e => setNewProd(n => ({ ...n, qty: e.target.value }))}
                      className="input-field text-sm" placeholder="0" autoFocus />
                  </div>
                </div>

                <button type="button" onClick={handleCreateProduct}
                  disabled={creating || !newProd.name.trim() || !newProd.qty || parseInt(newProd.qty) < 1}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
                  <Check size={15} />
                  {creating ? 'Creating…' : 'Create Product & Add to Stock List'}
                </button>
                <p className="text-xs text-blue-500 text-center">Product will also appear in Products page after saving</p>
              </div>
            )}
          </div>

          {/* Batch items */}
          {batch.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400">
              <Boxes size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Search and add products above</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                {batch.length} product{batch.length > 1 ? 's' : ''} — enter qty received for each
              </p>
              {batch.map((item, idx) => {
                const added  = parseInt(item.qtyAdded) || 0;
                const after  = item.product.stockQty + added;
                return (
                  <div key={item.product.id} className="border-2 border-blue-100 bg-blue-50/40 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-gray-800">{item.product.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{item.product.category}</p>
                      </div>
                      <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 p-1">
                        <X size={15} />
                      </button>
                    </div>

                    {/* Before → Added → After */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 bg-white rounded-xl p-3 text-center border border-gray-200">
                        <p className="text-xs text-gray-400 font-semibold">BEFORE</p>
                        <p className="text-2xl font-black text-gray-700 mt-0.5">{item.product.stockQty}</p>
                        <p className="text-xs text-gray-400">pcs</p>
                      </div>
                      <div className="text-gray-300 shrink-0">
                        <ArrowRight size={20} />
                      </div>
                      <div className="flex-1 bg-white rounded-xl p-2 text-center border-2 border-green-300">
                        <p className="text-xs text-green-600 font-bold">ADD</p>
                        <input type="number" min="1" value={item.qtyAdded}
                          onChange={e => updateItem(idx, 'qtyAdded', e.target.value)}
                          placeholder="0"
                          className="w-full text-2xl font-black text-green-700 text-center bg-transparent outline-none border-none"
                          autoFocus={idx === 0}
                        />
                        <p className="text-xs text-green-500">pcs</p>
                      </div>
                      <div className="text-gray-300 shrink-0">
                        <ArrowRight size={20} />
                      </div>
                      <div className={`flex-1 rounded-xl p-3 text-center border-2 ${added > 0 ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'}`}>
                        <p className={`text-xs font-bold ${added > 0 ? 'text-blue-200' : 'text-gray-400'}`}>AFTER</p>
                        <p className={`text-2xl font-black mt-0.5 ${added > 0 ? 'text-white' : 'text-gray-300'}`}>{added > 0 ? after : '—'}</p>
                        <p className={`text-xs ${added > 0 ? 'text-blue-200' : 'text-gray-300'}`}>pcs</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Cost per Piece (₹)</label>
                        <input type="number" min="0" value={item.costPrice}
                          onChange={e => updateItem(idx, 'costPrice', e.target.value)}
                          placeholder={String(item.product.costPrice || 0)}
                          className="input-field text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Note / Remarks</label>
                        <input type="text" value={item.note}
                          onChange={e => updateItem(idx, 'note', e.target.value)}
                          placeholder="Optional note"
                          className="input-field text-sm" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 flex gap-3 shrink-0 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={!canSave}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
            <Check size={16} />
            Save & Generate PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Inventory Page ───────────────────────────────────────────────────────
export default function Inventory() {
  const { products, stockLedger, addStockPurchase, updateStockEntry, addProduct, shop } = useApp();
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [period, setPeriod]             = useState('month');
  const [custom, setCustom]             = useState({ from: '', to: '' });
  const [showCustom, setShowCustom]     = useState(false);
  const [expandedId, setExpandedId]     = useState(null);

  const range = useMemo(() => periodRange(period, custom), [period, custom]);

  const periodLabel = period === 'today' ? 'Today' :
    period === 'week' ? 'This Week' :
    period === 'month' ? `${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}` :
    period === 'custom' && custom.from ? `${fmtDate(custom.from)} – ${fmtDate(custom.to)}` :
    'Select Period';

  // Per-product stats for the period
  const productStats = useMemo(() => products.map(p => {
    const entries   = stockLedger.filter(e => e.productId === p.id && inRange(e.date, range));
    const addedQty  = entries.filter(e => e.type !== 'sale').reduce((s, e) => s + e.qty, 0);
    const soldQty   = entries.filter(e => e.type === 'sale').reduce((s, e) => s + e.qty, 0);
    const openingQty = Math.max(0, p.stockQty - addedQty + soldQty);
    return { ...p, openingQty, addedQty, soldQty, closingQty: p.stockQty };
  }), [products, stockLedger, range]);

  // Summary cards
  const totalAdded    = productStats.reduce((s, p) => s + p.addedQty, 0);
  const totalSold     = productStats.reduce((s, p) => s + p.soldQty, 0);
  const totalStockVal = products.reduce((s, p) => s + p.stockQty * (p.costPrice || 0), 0);
  const outOfStock    = products.filter(p => p.stockQty === 0).length;

  // Only ledger entries whose product belongs to this shop
  const ownProductIds = useMemo(() => new Set(products.map(p => p.id)), [products]);

  // Stock-in entries in period (for history list)
  const historyEntries = useMemo(() =>
    stockLedger
      .filter(e => ownProductIds.has(e.productId) && inRange(e.date, range))
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [stockLedger, range, ownProductIds]
  );

  // Edit entry state
  const [editingEntry, setEditingEntry]   = useState(null);
  const [editForm, setEditForm]           = useState({});
  const [editSearch, setEditSearch]       = useState('');
  const [editShowDrop, setEditShowDrop]   = useState(false);

  const is24hEditable = (e) => {
    if (e.type !== 'purchase' && e.type !== 'opening') return false;
    return Date.now() - new Date(e.date).getTime() < 24 * 60 * 60 * 1000;
  };

  const openEditEntry = (entry) => {
    const entryDate = new Date(entry.date).toDateString();
    const batchEntries = stockLedger.filter(e =>
      e.type === 'purchase' &&
      e.supplierName === entry.supplierName &&
      new Date(e.date).toDateString() === entryDate
    );
    setEditingEntry(entry);
    setEditSearch('');
    setEditShowDrop(false);
    setEditForm({
      supplierName: entry.supplierName || '',
      invoiceNo: entry.invoiceNo || '',
      items: batchEntries.map(e => {
        const p = products.find(x => x.id === e.productId);
        return { entryId: e.id, productId: e.productId, productName: p?.name || '—', qty: e.qty, costPrice: String(e.costPrice || ''), note: e.note || '' };
      }),
      newItems: [],
    });
  };

  const updateEditItem = (idx, field, val) =>
    setEditForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [field]: val } : it) }));

  const updateEditNewItem = (idx, field, val) =>
    setEditForm(f => ({ ...f, newItems: f.newItems.map((it, i) => i === idx ? { ...it, [field]: val } : it) }));

  const addNewEditItem = (product) => {
    const taken = new Set([...(editForm.items || []).map(i => i.productId), ...(editForm.newItems || []).map(i => i.productId)]);
    if (taken.has(product.id)) return;
    setEditForm(f => ({ ...f, newItems: [...f.newItems, { productId: product.id, productName: product.name, qty: '1', costPrice: String(product.costPrice || ''), note: '' }] }));
    setEditSearch('');
    setEditShowDrop(false);
  };

  const removeNewEditItem = (idx) =>
    setEditForm(f => ({ ...f, newItems: f.newItems.filter((_, i) => i !== idx) }));

  const saveEditBatch = () => {
    if (!editingEntry) return;
    (editForm.items || []).forEach(item => {
      updateStockEntry(item.entryId, {
        supplierName: editForm.supplierName.trim(),
        invoiceNo: editForm.invoiceNo.trim(),
        costPrice: parseFloat(item.costPrice) || 0,
        note: item.note.trim(),
      });
    });
    (editForm.newItems || []).forEach(item => {
      if (parseInt(item.qty) > 0) {
        addStockPurchase(
          item.productId, parseInt(item.qty),
          editForm.supplierName.trim(), item.note.trim(),
          parseFloat(item.costPrice) || 0, editForm.invoiceNo.trim()
        );
      }
    });
    setEditingEntry(null);
  };

  // Print PDF for all entries from the same supplier on the same day
  const printClientPDF = (entry) => {
    const entryDate = new Date(entry.date).toDateString();
    const supplierEntries = historyEntries.filter(e =>
      e.type === 'purchase' && e.supplierName === entry.supplierName && new Date(e.date).toDateString() === entryDate
    );
    const dateStr   = fmtDateTime(entry.date);
    const totalQty  = supplierEntries.reduce((s, e) => s + e.qty, 0);
    const totalCost = supplierEntries.reduce((s, e) => s + e.qty * (e.costPrice || 0), 0);

    const rows = supplierEntries.map(e => {
      const p = products.find(x => x.id === e.productId);
      return `<tr>
        <td>${p?.name || '—'}</td>
        <td style="text-align:center">${p?.category || '—'}</td>
        <td style="text-align:center;color:#16a34a;font-weight:bold">+${e.qty}</td>
        <td style="text-align:center">${e.costPrice ? '₹' + parseFloat(e.costPrice).toLocaleString('en-IN') : '—'}</td>
        <td style="text-align:center">${e.costPrice ? '₹' + (e.qty * parseFloat(e.costPrice)).toLocaleString('en-IN') : '—'}</td>
        <td style="text-align:center">${e.invoiceNo || '—'}</td>
        <td>${e.note || '—'}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Stock Receipt — ${entry.supplierName || 'Supplier'}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:24px;max-width:860px;margin:auto}
      .print-btn{display:block;margin:0 0 16px auto;padding:10px 28px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:bold}
      .shop-header{text-align:center;border-bottom:3px solid #1d4ed8;padding-bottom:12px;margin-bottom:20px}
      .shop-header h1{font-size:22px;color:#1d4ed8;font-weight:800}
      .meta-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px}
      .meta-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px}
      .meta-label{font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px}
      .meta-value{font-size:13px;font-weight:bold;color:#111;margin-top:3px}
      .badge{text-align:center;background:#eff6ff;border:2px solid #bfdbfe;border-radius:8px;padding:8px;font-size:15px;font-weight:800;color:#1e40af;margin-bottom:16px;letter-spacing:1px}
      table{width:100%;border-collapse:collapse}
      thead th{background:#1d4ed8;color:#fff;padding:8px 6px;text-align:left;font-size:10px;text-transform:uppercase}
      tbody td{padding:7px 6px;border-bottom:1px solid #f3f4f6;font-size:11px}
      tbody tr:nth-child(even) td{background:#f9fafb}
      .total-row td{border-top:2px solid #1d4ed8;background:#eff6ff!important;font-weight:bold;color:#1d4ed8}
      .footer{text-align:center;margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:10px}
      @media print{.print-btn{display:none}}
    </style></head><body>
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
    <div class="shop-header">
      <h1>${shop?.shopName || ''}</h1>
      <p>${shop?.address || ''} ${shop?.phone ? '· 📞 ' + shop?.phone : ''}</p>
    </div>
    <div class="badge">📦 STOCK-IN RECEIPT — ${(entry.supplierName || 'Supplier').toUpperCase()}</div>
    <div class="meta-grid">
      <div class="meta-box"><div class="meta-label">Date</div><div class="meta-value">${dateStr}</div></div>
      <div class="meta-box"><div class="meta-label">Supplier / Client</div><div class="meta-value">${entry.supplierName || '—'}</div></div>
      <div class="meta-box"><div class="meta-label">Total</div><div class="meta-value">${supplierEntries.length} items · ${totalQty} pcs · ₹${totalCost.toLocaleString('en-IN')}</div></div>
    </div>
    <table><thead><tr>
      <th>Product</th><th>Category</th><th>Qty</th><th>Cost/Pc</th><th>Total Cost</th><th>Invoice</th><th>Note</th>
    </tr></thead><tbody>
      ${rows}
      <tr class="total-row"><td colspan="2" style="text-align:right;padding-right:12px">TOTAL</td>
        <td style="text-align:center">+${totalQty}</td><td></td>
        <td style="text-align:center">₹${totalCost.toLocaleString('en-IN')}</td><td></td><td></td></tr>
    </tbody></table>
    <div class="footer"><p>Generated by ShopEase · ${dateStr}</p></div>
    </body></html>`;

    const win = window.open('', '_blank', 'width=920,height=700');
    win.document.write(html);
    win.document.close();
  };

  const handleCreateProduct = (productData) => {
    const newProduct = addProduct(productData);
    return newProduct;
  };

  const handleAddStock = (batch) => {
    batch.forEach(item => {
      addStockPurchase(
        item.product.id, item.qtyAdded, item.supplier,
        item.note, parseFloat(item.costPrice) || item.product.costPrice || 0,
        item.invoice
      );
    });
    setShowAddModal(false);

    // Compute updated snapshot — React state is async so products still has old qty
    const snapshotProducts = products.map(p => {
      const b = batch.find(b => b.product.id === p.id);
      return b ? { ...p, stockQty: (p.stockQty || 0) + parseInt(b.qtyAdded) } : p;
    });

    saveRecentBatch(shop?.id, batch);
    printStockInSlip(batch, snapshotProducts, shop);
    navigate('/products');
  };

  const PERIODS = [
    { key: 'today', label: 'Today' },
    { key: 'week',  label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'custom', label: 'Custom Range' },
  ];

  const typeStyle = {
    opening:  'bg-blue-100 text-blue-700',
    purchase: 'bg-green-100 text-green-700',
    sale:     'bg-red-100 text-red-600',
    return:   'bg-orange-100 text-orange-700',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Inventory</h2>
          <p className="text-gray-500 text-sm mt-0.5">Track stock-in, stock-out, and inventory value</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => printInventoryReport(products, stockLedger, range, periodLabel, shop)}
            className="btn-secondary flex items-center gap-2">
            <FileText size={16} /> Download Report
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Add Stock
          </button>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map(({ key, label }) => (
          <button key={key}
            onClick={() => { setPeriod(key); if (key === 'custom') setShowCustom(true); else setShowCustom(false); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              period === key ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
            }`}>
            <CalendarDays size={13} className="inline mr-1.5 -mt-0.5" />{label}
          </button>
        ))}
        {period === 'custom' && (
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <input type="date" value={custom.from} onChange={e => setCustom(p => ({ ...p, from: e.target.value }))}
              className="text-sm text-gray-700 outline-none" />
            <span className="text-gray-400">→</span>
            <input type="date" value={custom.to} onChange={e => setCustom(p => ({ ...p, to: e.target.value }))}
              className="text-sm text-gray-700 outline-none" />
          </div>
        )}
        <span className="text-sm text-gray-500 ml-2">Showing: <span className="font-semibold text-gray-700">{periodLabel}</span></span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><Package size={18} className="text-blue-600" /></div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Products</p>
          </div>
          <p className="text-3xl font-black text-gray-800">{products.length}</p>
          <p className="text-xs text-red-500 mt-1">{outOfStock} out of stock</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center"><TrendingUp size={18} className="text-green-600" /></div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Received</p>
          </div>
          <p className="text-3xl font-black text-green-700">+{totalAdded}</p>
          <p className="text-xs text-gray-400 mt-1">pieces added in period</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center"><TrendingDown size={18} className="text-red-500" /></div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sold</p>
          </div>
          <p className="text-3xl font-black text-red-600">−{totalSold}</p>
          <p className="text-xs text-gray-400 mt-1">pieces sold in period</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center"><IndianRupee size={18} className="text-purple-600" /></div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock Value</p>
          </div>
          <p className="text-3xl font-black text-purple-700">₹{Math.round(totalStockVal).toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-400 mt-1">current inventory at cost</p>
        </div>
      </div>

      {/* Product Inventory Table */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Product-wise Inventory — {periodLabel}</h3>
          <p className="text-xs text-gray-400">Click ▼ to see movements</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Product', 'Category', 'Opening Stock', 'Added (+)', 'Sold (−)', 'Current Stock', 'Stock Value', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productStats.map(p => {
                const isExp = expandedId === p.id;
                const periodMovements = stockLedger
                  .filter(e => e.productId === p.id && inRange(e.date, range))
                  .sort((a, b) => new Date(b.date) - new Date(a.date));
                return [
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800">{p.name}</p>
                      {p.barcode && <p className="text-xs text-gray-400">{p.barcode}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 capitalize text-xs">{p.category}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-gray-700">{p.openingQty}</span>
                      <span className="text-xs text-gray-400 ml-1">pcs</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-bold text-base ${p.addedQty > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                        +{p.addedQty}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">pcs</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-bold text-base ${p.soldQty > 0 ? 'text-red-500' : 'text-gray-300'}`}>
                        −{p.soldQty}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">pcs</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-black text-lg ${p.closingQty === 0 ? 'text-red-600' : p.closingQty <= p.minStockAlert ? 'text-orange-500' : 'text-gray-800'}`}>
                          {p.closingQty}
                        </span>
                        <span className="text-xs text-gray-400">pcs</span>
                        {p.closingQty === 0 && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">OUT</span>}
                        {p.closingQty > 0 && p.closingQty <= p.minStockAlert && <AlertTriangle size={12} className="text-orange-500" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-purple-700 font-semibold">
                      ₹{(p.closingQty * (p.costPrice || 0)).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setExpandedId(isExp ? null : p.id)}
                        className="text-gray-400 hover:text-gray-600 p-1">
                        <ChevronDown size={16} className={`transition-transform ${isExp ? 'rotate-180' : ''}`} />
                      </button>
                    </td>
                  </tr>,

                  isExp && (
                    <tr key={`${p.id}-detail`} className="bg-gray-50 border-b border-gray-100">
                      <td colSpan={8} className="px-6 py-4">
                        {periodMovements.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-2">No stock movements in this period</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                              Movements in {periodLabel}
                            </p>
                            {periodMovements.map(e => (
                              <div key={e.id} className="flex items-center gap-4 text-xs">
                                <span className="text-gray-500 w-32 shrink-0">{fmtDateTime(e.date)}</span>
                                <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${typeStyle[e.type] || 'bg-gray-100 text-gray-600'}`}>{e.type}</span>
                                <span className={`font-black text-sm w-12 ${e.type === 'sale' ? 'text-red-600' : 'text-green-700'}`}>
                                  {e.type === 'sale' ? `−${e.qty}` : `+${e.qty}`}
                                </span>
                                <span className="text-gray-500">bal: <span className="font-bold text-gray-700">{e.balanceAfter}</span></span>
                                {e.supplierName && <span className="text-gray-500">· {e.supplierName}</span>}
                                {e.billNumber && <span className="text-blue-500">· {e.billNumber}</span>}
                                {e.note && <span className="text-gray-400">— {e.note}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock-in History */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800">All Stock Movements — {periodLabel}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{historyEntries.length} entries</p>
          </div>
          {historyEntries.length > 0 && (
            <button
              onClick={() => printStockMovements(historyEntries, products, periodLabel, shop)}
              className="btn-secondary flex items-center gap-2 text-sm py-2">
              <Printer size={14} /> Print PDF
            </button>
          )}
        </div>
        {historyEntries.length === 0 ? (
          <div className="py-14 text-center text-gray-400">
            <Package size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No stock movements in this period</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {historyEntries.map(e => {
              const product = products.find(p => p.id === e.productId);
              const editable = is24hEditable(e);
              return (
                <div key={e.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-black ${
                    e.type === 'sale' ? 'bg-red-100 text-red-600' :
                    e.type === 'purchase' ? 'bg-green-100 text-green-700' :
                    e.type === 'opening' ? 'bg-blue-100 text-blue-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {e.type === 'sale' ? '−' : '+'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 text-sm">{product?.name || '—'}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${typeStyle[e.type] || 'bg-gray-100 text-gray-600'}`}>{e.type}</span>
                      {e.supplierName && <span className="text-xs text-gray-500">· {e.supplierName}</span>}
                      {e.billNumber && e.billNumber !== 'Multiple' && <span className="text-xs text-blue-500">· {e.billNumber}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {fmtDateTime(e.date)}
                      {e.note && <span className="ml-2">— {e.note}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {e.type === 'purchase' && (
                      <button
                        onClick={() => printClientPDF(e)}
                        title="Download PDF for this supplier"
                        className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors">
                        <Download size={15} />
                      </button>
                    )}
                    {editable && (
                      <button
                        onClick={() => openEditEntry(e)}
                        title="Edit entry details"
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                        <Pencil size={15} />
                      </button>
                    )}
                    <div className="text-right ml-1">
                      <p className={`text-xl font-black ${e.type === 'sale' ? 'text-red-600' : 'text-green-700'}`}>
                        {e.type === 'sale' ? `−${e.qty}` : `+${e.qty}`}
                      </p>
                      <p className="text-xs text-gray-400">bal: <span className="font-bold text-gray-600">{e.balanceAfter}</span></p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddStockModal
          products={products}
          onSave={handleAddStock}
          onClose={() => setShowAddModal(false)}
          onCreateProduct={handleCreateProduct}
          recentBatch={loadRecentBatch(shop?.id)}
        />
      )}

      {/* Edit Entry Modal */}
      {editingEntry && (() => {
        const editedIds = new Set([...(editForm.items || []).map(i => i.productId), ...(editForm.newItems || []).map(i => i.productId)]);
        const editFiltered = products.filter(p =>
          p.isActive !== false && !editedIds.has(p.id) &&
          (p.name.toLowerCase().includes(editSearch.toLowerCase()) || (p.barcode || '').includes(editSearch))
        ).slice(0, 12);
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 text-lg">Edit Stock Entry</h3>
                <button onClick={() => setEditingEntry(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Client name — highlighted */}
                <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4">
                  <label className="block text-xs font-bold text-amber-700 mb-1.5 uppercase tracking-wide">
                    Client / Supplier Name *
                  </label>
                  <input
                    autoFocus
                    className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2.5 font-bold text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-amber-500 transition-shadow"
                    value={editForm.supplierName || ''}
                    onChange={e => setEditForm(f => ({ ...f, supplierName: e.target.value }))}
                    placeholder="Client or supplier name" />
                </div>

                {/* Invoice */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Invoice Number</label>
                  <input className="input-field" value={editForm.invoiceNo || ''}
                    onChange={e => setEditForm(f => ({ ...f, invoiceNo: e.target.value }))}
                    placeholder="Invoice number" />
                </div>

                {/* Existing products in this batch */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Products in this entry</p>
                  <div className="space-y-2">
                    {(editForm.items || []).map((item, idx) => (
                      <div key={item.entryId} className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-sm text-gray-800">{item.productName}</p>
                          <span className="text-xs text-green-700 font-bold bg-green-100 px-2 py-0.5 rounded-full">+{item.qty} pcs (locked)</span>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-xs text-gray-500 mb-0.5 block">Cost/Pc (₹)</label>
                            <input type="number" min="0" step="0.01" className="input-field text-sm py-1.5"
                              value={item.costPrice}
                              onChange={e => updateEditItem(idx, 'costPrice', e.target.value)}
                              placeholder="0.00" />
                          </div>
                          <div className="flex-[2]">
                            <label className="text-xs text-gray-500 mb-0.5 block">Note</label>
                            <input className="input-field text-sm py-1.5"
                              value={item.note}
                              onChange={e => updateEditItem(idx, 'note', e.target.value)}
                              placeholder="Optional note" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* New items being added */}
                {(editForm.newItems || []).length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">New Products to Add</p>
                    <div className="space-y-2">
                      {editForm.newItems.map((item, idx) => (
                        <div key={idx} className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-sm text-gray-800">{item.productName}</p>
                            <button onClick={() => removeNewEditItem(idx)} className="text-red-400 hover:text-red-600 p-1"><X size={14} /></button>
                          </div>
                          <div className="flex gap-2">
                            <div className="w-20">
                              <label className="text-xs text-gray-500 mb-0.5 block">Qty</label>
                              <input type="number" min="1" className="input-field text-sm py-1.5"
                                value={item.qty}
                                onChange={e => updateEditNewItem(idx, 'qty', e.target.value)}
                                placeholder="1" />
                            </div>
                            <div className="flex-1">
                              <label className="text-xs text-gray-500 mb-0.5 block">Cost/Pc (₹)</label>
                              <input type="number" min="0" step="0.01" className="input-field text-sm py-1.5"
                                value={item.costPrice}
                                onChange={e => updateEditNewItem(idx, 'costPrice', e.target.value)}
                                placeholder="0.00" />
                            </div>
                            <div className="flex-[2]">
                              <label className="text-xs text-gray-500 mb-0.5 block">Note</label>
                              <input className="input-field text-sm py-1.5"
                                value={item.note}
                                onChange={e => updateEditNewItem(idx, 'note', e.target.value)}
                                placeholder="Note" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add more products search */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Add More Products to this Entry</p>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={editSearch}
                      onChange={e => { setEditSearch(e.target.value); setEditShowDrop(true); }}
                      onFocus={() => setEditShowDrop(true)}
                      placeholder="Search product to add…"
                      className="input-field pl-9 text-sm" />
                    {editSearch && (
                      <button onClick={() => { setEditSearch(''); setEditShowDrop(false); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={13} /></button>
                    )}
                  </div>
                  {editShowDrop && editSearch && (
                    <div className="border border-gray-200 rounded-xl mt-1 overflow-hidden shadow-md">
                      <div className="max-h-40 overflow-y-auto">
                        {editFiltered.length > 0 ? editFiltered.map(p => (
                          <button key={p.id} type="button" onClick={() => addNewEditItem(p)}
                            className="w-full flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0 text-left hover:bg-blue-50 transition-colors">
                            <span className="font-medium text-sm text-gray-800">{p.name}</span>
                            <span className="text-xs text-gray-400">{p.stockQty} in stock</span>
                          </button>
                        )) : (
                          <div className="px-4 py-3 text-sm text-gray-400 text-center">No products found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
                <button onClick={() => setEditingEntry(null)} className="flex-1 btn-secondary">Cancel</button>
                <button onClick={saveEditBatch} className="flex-1 btn-primary">Save Changes</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
