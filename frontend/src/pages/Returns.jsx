import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Search, RotateCcw, Check, X, ChevronLeft, Package, AlertTriangle, Printer, PackagePlus, PackageX } from 'lucide-react';

const PAYMENT_LABELS = { cash: 'Cash', upi: 'UPI', phonepe: 'PhonePe', googlepay: 'Google Pay', card: 'Card' };
const PAYMENT_EMOJI  = { cash: '💵', upi: '📲', phonepe: '🟣', googlepay: '🔵', card: '💳' };

const REASONS = ['Customer not satisfied', 'Wrong size / colour', 'Defective / damaged', 'Duplicate purchase', 'Other'];

function printReturnBill(ret, shop) {
  const PAYMENT_LABELS = { cash: 'Cash', upi: 'UPI', phonepe: 'PhonePe', googlepay: 'Google Pay', card: 'Card / Debit' };
  const payLabel = PAYMENT_LABELS[ret.paymentMode] || ret.paymentMode?.toUpperCase() || '—';
  const date = new Date(ret.returnedAt || Date.now()).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const refund = parseFloat(ret.refundAmount ?? 0);

  const itemRows = (ret.items || []).map(item => {
    const qty   = item.returnQty || item.qty || 0;
    const price = parseFloat(item.sellingPrice ?? 0);
    const total = price * qty;
    return `
      <tr>
        <td>${item.productName || '—'}</td>
        <td class="right">₹${price.toFixed(2)}</td>
        <td class="center">${qty}</td>
        <td class="right bold">₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Return ${ret.returnNumber || ''}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:12px;color:#111;background:#fff;padding:24px;max-width:320px;margin:0 auto}
  .shop-name{font-size:16px;font-weight:bold;text-align:center;margin-bottom:2px}
  .shop-addr{font-size:10px;text-align:center;color:#444;white-space:pre-wrap;margin-bottom:2px}
  .gstin{font-size:10px;text-align:center;color:#555;margin-bottom:8px}
  .divider{border:none;border-top:1px dashed #999;margin:6px 0}
  .ret-badge{text-align:center;font-size:13px;font-weight:bold;letter-spacing:2px;margin:4px 0 6px;border:1px solid #999;padding:3px 0}
  .meta{font-size:11px;margin:4px 0}
  .meta span{float:right;font-weight:bold}
  table{width:100%;border-collapse:collapse;margin:6px 0}
  th{font-size:10px;text-align:left;border-bottom:1px solid #999;padding:3px 2px;font-weight:bold}
  td{font-size:11px;padding:4px 2px;vertical-align:top}
  .right{text-align:right}
  .center{text-align:center}
  .bold{font-weight:bold}
  .totals{margin-top:6px}
  .totals .row{display:flex;justify-content:space-between;font-size:11px;padding:2px 0}
  .totals .total-row{font-size:14px;font-weight:bold;border-top:1px solid #999;margin-top:4px;padding-top:4px}
  .footer{text-align:center;font-size:10px;color:#666;margin-top:10px}
  .print-btn{display:block;margin:16px auto 0;padding:8px 24px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;font-family:sans-serif}
  @media print{.print-btn{display:none}body{padding:8px}}
</style>
</head>
<body>
  <div class="shop-name">${shop?.shopName || 'ShopEase'}</div>
  <div class="shop-addr">${shop?.address || ''}</div>
  ${shop?.gstin  ? `<div class="gstin">GSTIN: ${shop.gstin}</div>` : ''}
  ${shop?.phone  ? `<div class="gstin">Ph: ${shop.phone}</div>`    : ''}

  <hr class="divider">
  <div class="ret-badge">*** RETURN RECEIPT ***</div>
  <hr class="divider">

  <div class="meta">Return No: <span>${ret.returnNumber || '—'}</span></div>
  <div class="meta">Date: <span>${date}</span></div>
  <div class="meta">Customer: <span>${ret.customerName || 'Walk-in'}</span></div>
  ${ret.customerPhone ? `<div class="meta">Phone: <span>+91 ${ret.customerPhone}</span></div>` : ''}
  <div class="meta">Orig. Bill: <span>${ret.originalBillNumber || '—'}</span></div>
  ${ret.reason ? `<div class="meta">Reason: <span>${ret.reason}</span></div>` : ''}
  <hr class="divider">

  <table>
    <thead><tr>
      <th>Item</th>
      <th class="right">Price</th>
      <th class="center">Qty</th>
      <th class="right">Total</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>

  <hr class="divider">
  <div class="totals">
    <div class="row total-row"><span>REFUND AMOUNT</span><span>₹${refund.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
    <div class="row" style="margin-top:4px"><span>Refund via</span><span>${payLabel}</span></div>
  </div>

  <hr class="divider">
  <div class="footer">
    <p>${ret.restoreStock !== false ? 'Stock restored for returned items.' : 'Items not returned to stock.'}</p>
    <p style="margin-top:2px">Thank you! Visit again.</p>
    <p style="margin-top:4px">Powered by ShopEase</p>
  </div>

  <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  <script>setTimeout(()=>window.print(),400)</script>
</body>
</html>`;

  const popup = window.open('', '_blank', 'width=400,height=600');
  if (!popup) { alert('Please allow popups to print return bills.'); return; }
  popup.document.write(html);
  popup.document.close();
}

export default function Returns() {
  const { bills, returns, addReturn, shop } = useApp();
  const location = useLocation();

  const [query, setQuery]               = useState('');

  // Auto-fill search when navigated from SalesHistory "Return" button
  useEffect(() => {
    if (location.state?.billNumber) {
      setQuery(location.state.billNumber);
    }
  }, [location.state?.billNumber]);
  const [selectedBill, setSelectedBill] = useState(null);
  const [returnItems, setReturnItems]   = useState({});   // key = productName
  const [reason, setReason]             = useState('');
  const [step, setStep]                 = useState(1);    // 1 search · 2 items · 3 confirm · 4 done
  const [restoreStock, setRestoreStock] = useState(true);  // owner decides
  const [done, setDone]                 = useState(null);

  // ── Step 1: filter bills ──────────────────────────────────────────────────
  const q = query.trim().toLowerCase();
  const matchedBills = q.length >= 2
    ? bills.filter(b =>
        b.billNumber.toLowerCase().includes(q) ||
        (b.customerName || '').toLowerCase().includes(q)
      )
    : bills.slice(0, 8);  // show 8 recent bills when no query

  // ── How much has already been returned for a bill ─────────────────────────
  const returnedQtyFor = (billId, productName) =>
    returns
      .filter(r => r.originalBillId === billId)
      .flatMap(r => r.items)
      .filter(i => i.productName === productName)
      .reduce((s, i) => s + (i.returnQty || i.qty || 0), 0);

  // ── Step 2: select bill ───────────────────────────────────────────────────
  const chooseBill = (bill) => {
    const init = {};
    bill.items.forEach(item => {
      const alreadyBack = returnedQtyFor(bill.id, item.productName);
      const remaining   = item.qty - alreadyBack;
      if (remaining > 0) {
        init[item.productName] = {
          ...item,
          returnQty:  remaining,
          maxQty:     remaining,
          selected:   false,
        };
      }
    });
    setSelectedBill(bill);
    setReturnItems(init);
    setStep(2);
    setQuery('');
  };

  const toggle = (name) =>
    setReturnItems(p => ({ ...p, [name]: { ...p[name], selected: !p[name].selected } }));

  const setQty = (name, val) => {
    const max = returnItems[name].maxQty;
    const v   = Math.max(1, Math.min(parseInt(val) || 1, max));
    setReturnItems(p => ({ ...p, [name]: { ...p[name], returnQty: v } }));
  };

  const selected = Object.values(returnItems).filter(i => i.selected);

  // ── Refund calculation: proportional to item's share of total ─────────────
  const billSubtotal = Math.max(
    1,
    selectedBill?.subtotal ||
    selectedBill?.items.reduce((s, i) => s + (i.itemTotal || (i.sellingPrice || 0) * (i.qty || 0)), 0) ||
    1
  );

  const rawRefund = selected.reduce((sum, item) => {
    const itemBase   = (item.sellingPrice || 0) * (item.returnQty || 0);
    const proportion = itemBase / billSubtotal;
    return sum + proportion * (selectedBill?.total || 0);
  }, 0);
  // Clamp to bill total so rounding never produces an over-refund
  const refundAmount = Math.min(
    selectedBill?.total || 0,
    Math.round(rawRefund)
  );

  // ── Step 4: process ───────────────────────────────────────────────────────
  const processReturn = () => {
    const ret = addReturn({
      originalBillId:     selectedBill.id,
      originalBillNumber: selectedBill.billNumber,
      customerName:       selectedBill.customerName,
      customerPhone:      selectedBill.customerPhone,
      paymentMode:        selectedBill.paymentMode,
      items:              selected,
      refundAmount,
      reason,
      restoreStock,
    });
    setDone(ret);
    setStep(4);
    printReturnBill(ret, shop);
  };

  const reset = () => {
    setQuery(''); setSelectedBill(null); setReturnItems({});
    setReason(''); setRestoreStock(true); setStep(1); setDone(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <RotateCcw size={22} className="text-orange-600" /> Returns & Refunds
        </h2>
        <p className="text-gray-500 text-sm mt-0.5">Search a bill → select items → process refund</p>
      </div>

      {/* ── STEP 1: Search ── */}
      {step === 1 && (
        <div>
          <div className="relative mb-4">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Enter bill number or customer name…"
              className="input-field pl-10 text-sm"
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={15} />
              </button>
            )}
          </div>

          {!q && <p className="text-xs text-gray-400 mb-2">Showing recent bills</p>}

          {matchedBills.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Package size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No bills found for "{query}"</p>
            </div>
          ) : (
            <div className="space-y-2">
              {matchedBills.map(bill => {
                const fullyReturned = bill.items.every(
                  item => returnedQtyFor(bill.id, item.productName) >= item.qty
                );
                return (
                  <button
                    key={bill.id}
                    onClick={() => !fullyReturned && chooseBill(bill)}
                    disabled={fullyReturned}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      fullyReturned
                        ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                        : 'bg-white border-gray-200 hover:border-blue-400 hover:shadow-sm cursor-pointer'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-sm text-gray-800">{bill.billNumber}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {bill.customerName || 'Walk-in'} · {new Date(bill.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {bill.items.length} item{bill.items.length !== 1 ? 's' : ''} · {PAYMENT_EMOJI[bill.paymentMode]} {PAYMENT_LABELS[bill.paymentMode]}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-gray-900">₹{bill.total.toLocaleString('en-IN')}</div>
                        {fullyReturned
                          ? <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Returned</span>
                          : bill.hasReturn
                            ? <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Partial return</span>
                            : null
                        }
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Select items ── */}
      {step === 2 && selectedBill && (
        <div>
          {/* Bill info */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold text-gray-800">{selectedBill.billNumber}</div>
                <div className="text-sm text-gray-500">{selectedBill.customerName || 'Walk-in'}{selectedBill.customerPhone ? ` · +91 ${selectedBill.customerPhone}` : ''}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {new Date(selectedBill.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-900">₹{selectedBill.total.toLocaleString('en-IN')}</div>
                <div className="text-xs text-gray-500">{PAYMENT_EMOJI[selectedBill.paymentMode]} {PAYMENT_LABELS[selectedBill.paymentMode]}</div>
              </div>
            </div>
          </div>

          {/* Items */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Select items to return</p>

          {Object.keys(returnItems).length === 0 ? (
            <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl">
              <AlertTriangle size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">All items in this bill have already been returned.</p>
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {Object.entries(returnItems).map(([name, item]) => (
                <div
                  key={name}
                  onClick={() => toggle(name)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    item.selected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                      item.selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                    }`}>
                      {item.selected && <Check size={12} className="text-white" />}
                    </div>

                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-800">{name}</div>
                      <div className="text-xs text-gray-500">
                        ₹{item.sellingPrice.toLocaleString('en-IN')} × max {item.maxQty}
                      </div>
                    </div>

                    {/* Qty selector */}
                    {item.selected && (
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setQty(name, item.returnQty - 1)}
                          className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-700"
                        >−</button>
                        <span className="w-6 text-center font-bold text-sm">{item.returnQty}</span>
                        <button
                          onClick={() => setQty(name, item.returnQty + 1)}
                          className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-700"
                        >+</button>
                      </div>
                    )}

                    <div className="text-sm font-bold text-gray-700 w-16 text-right">
                      ₹{(item.sellingPrice * (item.selected ? item.returnQty : item.maxQty)).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Refund preview */}
          {selected.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm font-semibold text-orange-800">Refund to customer</div>
                  <div className="text-xs text-orange-600">{PAYMENT_EMOJI[selectedBill.paymentMode]} via {PAYMENT_LABELS[selectedBill.paymentMode]} · {selected.length} item{selected.length !== 1 ? 's' : ''} returned</div>
                </div>
                <div className="text-2xl font-black text-orange-700">₹{refundAmount.toLocaleString('en-IN')}</div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={reset} className="btn-secondary flex items-center gap-1 px-4">
              <ChevronLeft size={16} /> Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={selected.length === 0}
              className="flex-1 btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Confirm ── */}
      {step === 3 && selectedBill && (
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-4">Confirm Return</h3>

          {/* Items being returned */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Items being returned
            </div>
            {selected.map(item => (
              <div key={item.productName} className="px-4 py-3 flex justify-between items-center border-b border-gray-50 last:border-0">
                <div>
                  <div className="text-sm font-semibold text-gray-800">{item.productName}</div>
                  <div className="text-xs text-gray-400">{item.returnQty} × ₹{item.sellingPrice.toLocaleString('en-IN')}</div>
                </div>
                <div className="text-sm font-bold text-gray-700">₹{(item.sellingPrice * item.returnQty).toLocaleString('en-IN')}</div>
              </div>
            ))}
          </div>

          {/* Refund box */}
          <div className="bg-orange-600 text-white rounded-2xl p-5 mb-4">
            <p className="text-orange-200 text-sm mb-1">Refund to {selectedBill.customerName || 'Walk-in Customer'}</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-orange-200 text-xs mt-2">Return via</p>
                <p className="text-white font-bold text-lg">{PAYMENT_EMOJI[selectedBill.paymentMode]} {PAYMENT_LABELS[selectedBill.paymentMode]}</p>
              </div>
              <div className="text-5xl font-black">₹{refundAmount.toLocaleString('en-IN')}</div>
            </div>
          </div>

          {/* Stock restore toggle */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Add items back to stock?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setRestoreStock(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                  restoreStock
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                <PackagePlus size={16} />
                Yes, restore stock
              </button>
              <button
                onClick={() => setRestoreStock(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                  !restoreStock
                    ? 'border-red-400 bg-red-50 text-red-600'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                <PackageX size={16} />
                No, discard items
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {restoreStock
                ? 'Returned quantities will be added back to product inventory.'
                : 'Items will not be added back — stock stays as-is.'}
            </p>
          </div>

          {/* Reason */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Return Reason (optional)</p>
            <div className="flex flex-wrap gap-2">
              {REASONS.map(r => (
                <button
                  key={r}
                  onClick={() => setReason(r === reason ? '' : r)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                    reason === r
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="btn-secondary flex items-center gap-1 px-4">
              <ChevronLeft size={16} /> Back
            </button>
            <button
              onClick={processReturn}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={17} /> Process Return — ₹{refundAmount.toLocaleString('en-IN')} Refund
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Done ── */}
      {step === 4 && done && (
        <div className="text-center py-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={40} className="text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">Return Processed!</h3>
          <p className="text-gray-500 text-sm mb-6">{done.returnNumber}</p>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 text-left mb-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Customer</span>
              <span className="font-semibold">{done.customerName || 'Walk-in'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Original Bill</span>
              <span className="font-semibold">{done.originalBillNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Items Returned</span>
              <span className="font-semibold">{done.items.length} item{done.items.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Refund Mode</span>
              <span className="font-semibold">{PAYMENT_EMOJI[done.paymentMode]} {PAYMENT_LABELS[done.paymentMode]}</span>
            </div>
            {done.reason && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Reason</span>
                <span className="font-semibold">{done.reason}</span>
              </div>
            )}
            <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
              <span className="text-gray-700 font-semibold">Refund Amount</span>
              <span className="text-2xl font-black text-orange-600">₹{done.refundAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {done.restoreStock !== false ? (
            <div className="bg-green-50 border border-green-100 rounded-xl p-3 mb-6 text-sm text-green-700 flex items-center gap-2">
              <PackagePlus size={15} /> Stock has been restored for all returned items.
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-6 text-sm text-gray-500 flex items-center gap-2">
              <PackageX size={15} /> Items were not added back to stock.
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => printReturnBill(done, shop)}
              className="flex-1 btn-secondary flex items-center justify-center gap-2">
              <Printer size={16} /> Print Return Bill
            </button>
            <button onClick={reset} className="flex-1 btn-primary">
              Process Another Return
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
