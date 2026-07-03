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
  ${(shop?.upiId || shop?.paymentPhone) ? `
  <div style="text-align:center;margin:8px 0">
    <p style="font-size:10px;font-weight:bold;color:#555;margin-bottom:4px">PAY VIA UPI</p>
    ${shop.upiId ? `<img
      src="https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(`upi://pay?pa=${shop.upiId}&pn=${encodeURIComponent(shop.shopName || 'Shop')}&am=${total}&cu=INR`)}"
      alt="UPI QR" style="width:110px;height:110px;display:block;margin:0 auto 4px"
    />
    <p style="font-size:9px;color:#666">Scan to pay ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
    <p style="font-size:10px;font-weight:bold;color:#333;margin-top:2px">${shop.upiId}</p>` : ''}
    ${shop.paymentPhone ? `<p style="font-size:10px;color:#555;margin-top:3px">GPay / PhonePe: <b>${shop.paymentPhone}</b></p>` : ''}
  </div>
  <hr class="divider">` : ''}
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

// 58mm thermal receipt — compact monospace layout for counter printers
export function printThermal(bill, shop) {
  const date = new Date(bill.createdAt || Date.now()).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const PAYMENT_LABELS = {
    cash: 'Cash', upi: 'UPI', phonepe: 'PhonePe',
    googlepay: 'Google Pay', card: 'Card',
  };
  const payLabel = PAYMENT_LABELS[bill.paymentMode] || bill.paymentMode?.toUpperCase() || '—';

  const subtotal = parseFloat(bill.subtotal ?? 0);
  const discount = parseFloat(bill.discountAmount ?? 0);
  const tax      = parseFloat(bill.taxAmount ?? 0);
  const total    = parseFloat(bill.total ?? 0);

  const itemLines = (bill.items || []).map(item => {
    const name   = item.productName || item.name || '—';
    const qty    = item.qty ?? item.quantity ?? 1;
    const price  = parseFloat(item.sellingPrice ?? item.price ?? 0);
    const itotal = parseFloat(item.itemTotal ?? (price * qty));
    const gst    = parseFloat(item.gstRate ?? 0);
    return `
      <div class="iname">${name}${gst > 0 ? `<span class="gst"> [${gst}%]</span>` : ''}</div>
      <div class="icalc"><span>${qty} &times; &#8377;${price.toFixed(2)}</span><span class="ibold">&#8377;${itotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>`;
  }).join('<div class="igap"></div>');

  const upiQr = shop?.upiId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(`upi://pay?pa=${shop.upiId}&pn=${encodeURIComponent(shop.shopName || 'Shop')}&am=${total}&cu=INR`)}`
    : null;

  const shopMeta = [
    shop?.address,
    shop?.gstin ? 'GSTIN: ' + shop.gstin : '',
    shop?.phone  ? 'Ph: ' + shop.phone  : '',
  ].filter(Boolean).join('<br>');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Slip ${bill.billNumber || ''}</title>
<style>
  @page { size: 58mm auto; margin: 2mm 1mm; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:10px;color:#000;background:#fff;width:56mm}
  .sname{font-size:13px;font-weight:bold;text-align:center;margin-bottom:2px}
  .ssub{font-size:8.5px;text-align:center;line-height:1.5;color:#222}
  .dashed{border-top:1px dashed #000;margin:4px 0}
  .solid{border-top:1px solid #000;margin:4px 0}
  .mrow{display:flex;justify-content:space-between;font-size:9.5px;margin:1.5px 0}
  .iname{font-size:10px;font-weight:bold;margin-top:4px;word-break:break-word}
  .gst{font-size:8px;font-weight:normal;color:#555}
  .icalc{display:flex;justify-content:space-between;font-size:9px;padding-left:5px;margin-bottom:1px}
  .ibold{font-weight:bold}
  .igap{height:3px}
  .trow{display:flex;justify-content:space-between;font-size:9.5px;margin:2px 0}
  .grand{display:flex;justify-content:space-between;font-size:13px;font-weight:bold;margin:3px 0}
  .footer{text-align:center;font-size:9px;margin-top:6px;line-height:1.7;color:#222}
  .pbtn{display:block;margin:10px auto 4px;padding:5px 18px;background:#111;color:#fff;border:none;cursor:pointer;font-size:11px;font-family:sans-serif;border-radius:3px}
  @media print{.pbtn{display:none}}
</style>
</head>
<body>
  <div class="sname">${shop?.shopName || 'ShopEase'}</div>
  ${shopMeta ? `<div class="ssub">${shopMeta}</div>` : ''}

  <div class="dashed"></div>
  <div class="mrow"><span>Bill#</span><span>${bill.billNumber || '—'}</span></div>
  <div class="mrow"><span>Date</span><span>${date}</span></div>
  <div class="mrow"><span>Customer</span><span>${(bill.customerName || '—').substring(0, 14)}</span></div>
  ${bill.customerPhone ? `<div class="mrow"><span>Phone</span><span>+91 ${bill.customerPhone}</span></div>` : ''}

  <div class="dashed"></div>
  ${itemLines}

  <div class="solid"></div>
  <div class="trow"><span>Subtotal</span><span>&#8377;${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
  ${discount > 0 ? `<div class="trow"><span>Discount</span><span>-&#8377;${discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>` : ''}
  ${tax > 0 ? `<div class="trow"><span>GST</span><span>+&#8377;${tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>` : ''}
  <div class="solid"></div>
  <div class="grand"><span>TOTAL</span><span>&#8377;${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
  <div class="trow"><span>Payment</span><span>${payLabel}</span></div>
  ${bill.couponCode ? `<div class="trow"><span>Coupon</span><span>${bill.couponCode}</span></div>` : ''}

  ${upiQr || shop?.paymentPhone ? `
  <div class="dashed"></div>
  <div style="text-align:center;font-size:9px;font-weight:bold;margin-bottom:3px">PAY VIA UPI</div>
  ${upiQr ? `
    <img src="${upiQr}" style="width:24mm;height:24mm;display:block;margin:2px auto" alt="UPI QR">
    <div style="text-align:center;font-size:8.5px;margin-top:2px">${shop.upiId}</div>` : ''}
  ${shop?.paymentPhone ? `<div style="text-align:center;font-size:8.5px;margin-top:2px">GPay/PhonePe: ${shop.paymentPhone}</div>` : ''}
  ` : ''}

  <div class="dashed"></div>
  <div class="footer">Thank you! Visit again.<br>Powered by ShopEase</div>

  <button class="pbtn" onclick="window.print()">Print</button>
  <script>setTimeout(()=>window.print(),300)</script>
</body>
</html>`;

  const popup = window.open('', '_blank', 'width=280,height=500');
  if (!popup) {
    alert('Please allow popups for this site to print thermal slips.');
    return;
  }
  popup.document.write(html);
  popup.document.close();
}
