// Opens a new window with a formatted receipt and triggers the browser's
// print dialog. The user can print it or "Save as PDF" from there.
// This replaces window.print() on the whole page in NewBill and SalesHistory.

export function printBill(bill, shop) {
  const date = new Date(bill.createdAt || Date.now()).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const PAYMENT_LABELS = {
    cash: 'Cash', upi: 'UPI', phonepe: 'PhonePe',
    googlepay: 'Google Pay', card: 'Card / Debit',
  };
  const payLabel = PAYMENT_LABELS[bill.paymentMode] || bill.paymentMode?.toUpperCase() || '—';

  const itemRows = (bill.items || []).map(item => {
    const name     = item.productName || item.name || '—';
    const qty      = item.qty ?? item.quantity ?? 1;
    const price    = parseFloat(item.sellingPrice ?? item.price ?? 0);
    const total    = parseFloat(item.itemTotal ?? (price * qty));
    const gst      = parseFloat(item.gstRate ?? 0);
    return `
      <tr>
        <td>${name}${gst > 0 ? `<span class="gst-badge">${gst}% GST</span>` : ''}</td>
        <td class="right">₹${price.toFixed(2)}</td>
        <td class="center">${qty}</td>
        <td class="right bold">₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>`;
  }).join('');

  const subtotal  = parseFloat(bill.subtotal ?? 0);
  const discount  = parseFloat(bill.discountAmount ?? 0);
  const tax       = parseFloat(bill.taxAmount ?? 0);
  const total     = parseFloat(bill.total ?? 0);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Bill ${bill.billNumber || ''}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:12px;color:#111;background:#fff;padding:24px;max-width:320px;margin:0 auto}
  .shop-name{font-size:16px;font-weight:bold;text-align:center;margin-bottom:2px}
  .shop-addr{font-size:10px;text-align:center;color:#444;white-space:pre-wrap;margin-bottom:2px}
  .gstin{font-size:10px;text-align:center;color:#555;margin-bottom:8px}
  .divider{border:none;border-top:1px dashed #999;margin:6px 0}
  .meta{font-size:11px;margin:4px 0}
  .meta span{float:right;font-weight:bold}
  table{width:100%;border-collapse:collapse;margin:6px 0}
  th{font-size:10px;text-align:left;border-bottom:1px solid #999;padding:3px 2px;font-weight:bold}
  td{font-size:11px;padding:4px 2px;vertical-align:top}
  .right{text-align:right}
  .center{text-align:center}
  .bold{font-weight:bold}
  .gst-badge{display:block;font-size:9px;color:#666}
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
  ${shop?.gstin ? `<div class="gstin">GSTIN: ${shop.gstin}</div>` : ''}
  ${shop?.phone ? `<div class="gstin">Ph: ${shop.phone}</div>` : ''}

  <hr class="divider">
  <div class="meta">Bill No: <span>${bill.billNumber || '—'}</span></div>
  <div class="meta">Date: <span>${date}</span></div>
  <div class="meta">Customer: <span>${bill.customerName || '—'}</span></div>
  ${bill.customerPhone ? `<div class="meta">Phone: <span>+91 ${bill.customerPhone}</span></div>` : ''}
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
    <div class="row"><span>Subtotal</span><span>₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
    ${discount > 0 ? `<div class="row"><span>Discount</span><span style="color:#16a34a">−₹${discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>` : ''}
    ${tax > 0 ? `<div class="row"><span>GST</span><span>+₹${tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>` : ''}
    <div class="row total-row"><span>TOTAL PAID</span><span>₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
    <div class="row" style="margin-top:4px"><span>Payment</span><span>${payLabel}</span></div>
    ${bill.couponCode ? `<div class="row"><span>Coupon</span><span>${bill.couponCode}</span></div>` : ''}
  </div>

  <hr class="divider">
  <div class="footer">
    <p>Thank you! Visit again.</p>
    <p style="margin-top:4px">Powered by ShopEase</p>
  </div>

  <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  <script>setTimeout(()=>window.print(),400)</script>
</body>
</html>`;

  const popup = window.open('', '_blank', 'width=400,height=600');
  if (!popup) {
    alert('Please allow popups for this site to print bills.');
    return;
  }
  popup.document.write(html);
  popup.document.close();
}
