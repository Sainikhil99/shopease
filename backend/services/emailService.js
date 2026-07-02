const nodemailer = require('nodemailer');
const { query } = require('../db');
const { sendEmail: resendEmail } = require('./resendEmail');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  family: 4, // force IPv4 — Render free tier has no IPv6 route
});

async function getDailyReportData(shopId, date) {
  const d = date || new Date().toISOString().split('T')[0];
  const [shop, summary, paymentBreakdown, itemsSold, lowStock, stockIn] = await Promise.all([
    query('SELECT * FROM shops WHERE id=$1', [shopId]),
    query(`SELECT COALESCE(SUM(total),0) as revenue, COALESCE(SUM(discount_amount),0) as discounts,
                  COALESCE(SUM(tax_amount),0) as gst, COUNT(*) as bill_count
           FROM bills WHERE shop_id=$1 AND DATE(created_at)=$2 AND status='completed'`, [shopId, d]),
    query(`SELECT payment_mode, SUM(total) as amount FROM bills WHERE shop_id=$1 AND DATE(created_at)=$2 GROUP BY payment_mode`, [shopId, d]),
    query(`SELECT bi.product_name, SUM(bi.quantity) as qty, SUM(bi.item_total) as revenue
           FROM bill_items bi JOIN bills b ON bi.bill_id=b.id
           WHERE b.shop_id=$1 AND DATE(b.created_at)=$2 GROUP BY bi.product_name ORDER BY qty DESC`, [shopId, d]),
    query(`SELECT name, stock_qty, min_stock_alert FROM products WHERE shop_id=$1 AND stock_qty<=min_stock_alert AND is_active=true ORDER BY stock_qty ASC`, [shopId]),
    query(`SELECT sl.type, COALESCE(p.name, sl.note, 'Unknown') as product_name,
                  sl.qty, sl.supplier_name, sl.invoice_no, sl.cost_price, sl.balance_after
           FROM stock_ledger sl LEFT JOIN products p ON sl.product_id = p.id
           WHERE sl.shop_id=$1 AND DATE(sl.created_at)=$2 AND sl.type IN ('purchase','return')
           ORDER BY sl.created_at DESC`, [shopId, d]),
  ]);
  return {
    shop: shop.rows[0], date: d, ...summary.rows[0],
    paymentBreakdown: paymentBreakdown.rows, itemsSold: itemsSold.rows,
    lowStock: lowStock.rows, stockIn: stockIn.rows,
  };
}

function buildDailyEmailHTML(data) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;color:#333;margin:0;padding:0;background:#f5f5f5}
.container{max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden}
.header{background:#2563eb;color:white;padding:24px;text-align:center}
.header h1{margin:0;font-size:24px}
.body{padding:24px}
.stat{display:inline-block;background:#eff6ff;border-radius:8px;padding:12px 20px;margin:8px;text-align:center}
.stat-value{font-size:22px;font-weight:bold;color:#1d4ed8}
.stat-label{font-size:12px;color:#64748b;margin-top:4px}
table{width:100%;border-collapse:collapse;margin-top:16px}
th{background:#f8fafc;padding:10px;text-align:left;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0}
td{padding:10px;border-bottom:1px solid #f1f5f9;font-size:14px}
.alert{background:#fef2f2;border:1px solid #fee2e2;border-radius:8px;padding:12px;margin-top:16px}
.footer{background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8}
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>${data.shop.shop_name}</h1>
    <p style="margin:4px 0 0">Daily Sales Report — ${new Date(data.date).toLocaleDateString('en-IN', {weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
  </div>
  <div class="body">
    <div style="text-align:center;margin-bottom:16px">
      <div class="stat"><div class="stat-value">₹${parseFloat(data.revenue).toLocaleString('en-IN')}</div><div class="stat-label">Total Sales</div></div>
      <div class="stat"><div class="stat-value">${data.bill_count}</div><div class="stat-label">Bills Generated</div></div>
      <div class="stat"><div class="stat-value">₹${parseFloat(data.discounts).toLocaleString('en-IN')}</div><div class="stat-label">Discounts Given</div></div>
      <div class="stat"><div class="stat-value">₹${Math.round(parseFloat(data.gst)).toLocaleString('en-IN')}</div><div class="stat-label">GST Collected</div></div>
    </div>

    <h3 style="color:#334155">Payment Breakdown</h3>
    <table>
      <tr><th>Payment Mode</th><th>Amount</th></tr>
      ${data.paymentBreakdown.map(p => `<tr><td style="text-transform:capitalize">${p.payment_mode}</td><td>₹${parseFloat(p.amount).toLocaleString('en-IN')}</td></tr>`).join('')}
    </table>

    ${data.itemsSold.length > 0 ? `
    <h3 style="color:#334155;margin-top:20px">Products Sold Today</h3>
    <table>
      <tr><th>Product</th><th>Qty</th><th>Revenue</th></tr>
      ${data.itemsSold.map(i => `<tr><td>${i.product_name}</td><td>${i.qty}</td><td>₹${parseFloat(i.revenue).toLocaleString('en-IN')}</td></tr>`).join('')}
    </table>` : ''}

    ${data.stockIn.length > 0 ? `
    <h3 style="color:#334155;margin-top:20px">Stock Received Today</h3>
    <table>
      <tr><th>Product</th><th>Type</th><th>Qty In</th><th>Supplier</th><th>Balance</th></tr>
      ${data.stockIn.map(s => `<tr>
        <td>${s.product_name}</td>
        <td style="text-transform:capitalize;color:${s.type==='return'?'#d97706':'#16a34a'}">${s.type}</td>
        <td>${s.qty}</td>
        <td>${s.supplier_name || '—'}</td>
        <td>${s.balance_after}</td>
      </tr>`).join('')}
    </table>` : ''}

    ${data.lowStock.length > 0 ? `
    <div class="alert">
      <strong style="color:#dc2626">⚠ Low Stock Alert — ${data.lowStock.length} product${data.lowStock.length > 1 ? 's' : ''} need restocking</strong>
      <table style="margin-top:8px">
        <tr><th>Product</th><th>Current Stock</th><th>Alert Level</th></tr>
        ${data.lowStock.map(p => `<tr>
          <td>${p.name}</td>
          <td style="color:#dc2626;font-weight:bold">${p.stock_qty} units</td>
          <td>${p.min_stock_alert} units</td>
        </tr>`).join('')}
      </table>
    </div>` : '<p style="color:#16a34a;font-size:13px;margin-top:12px">✓ All products have healthy stock levels.</p>'}
  </div>
  <div class="footer">ShopEase · Automated Daily Report · ${data.shop.shop_name}</div>
</div>
</body>
</html>`;
}

async function sendDailyReport(shopId) {
  const data = await getDailyReportData(shopId);
  if (!data.shop.daily_report || !data.shop.report_email) return;
  const html = buildDailyEmailHTML(data);
  await transporter.sendMail({
    from: process.env.FROM_EMAIL || `"ShopEase Reports" <${process.env.SMTP_USER}>`,
    to: data.shop.report_email,
    subject: `Daily Sales Report — ${data.date} | ${data.shop.shop_name}`,
    html,
  });
  await query('INSERT INTO email_logs (shop_id, type, status) VALUES ($1,$2,$3)', [shopId, 'daily', 'sent']);
}

async function sendMonthlyReport(shopId) {
  const shop = (await query('SELECT * FROM shops WHERE id=$1', [shopId])).rows[0];
  if (!shop.monthly_report || !shop.report_email) return;
  // Monthly report content would be built here (similar to daily but for full month)
  await transporter.sendMail({
    from: process.env.FROM_EMAIL || `"ShopEase Reports" <${process.env.SMTP_USER}>`,
    to: shop.report_email,
    subject: `Monthly Report — ${new Date().toLocaleString('en-IN',{month:'long',year:'numeric'})} | ${shop.shop_name}`,
    html: `<p>Your monthly report for ${shop.shop_name} is ready. Full PDF attached.</p>`,
  });
  await query('INSERT INTO email_logs (shop_id, type, status) VALUES ($1,$2,$3)', [shopId, 'monthly', 'sent']);
}

// ── Subscription reminder (7 days and 2 days before expiry) ─────────────────
async function sendSubscriptionReminderEmail(shop, daysLeft) {
  const to = shop.report_email || shop.email;
  if (!to) return;
  const isUrgent  = daysLeft <= 2;
  const charge    = shop.monthly_charge || 299;
  const expiryDate = new Date(shop.subscription_paid_until)
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const adminPhone = process.env.ADMIN_PAYMENT_PHONE || '';
  const adminUpi   = process.env.ADMIN_UPI_ID        || '';

  const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;color:#333;margin:0;padding:0;background:#f5f5f5}
.container{max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden}
.header{background:${isUrgent ? '#dc2626' : '#d97706'};color:white;padding:24px;text-align:center}
.header h1{margin:0;font-size:22px}
.body{padding:24px}
.info-box{background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:16px 0}
.pay-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0}
.pay-row{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:14px}
.label{background:#dbeafe;color:#1d4ed8;font-size:11px;font-weight:bold;padding:3px 8px;border-radius:4px}
.mono{font-family:monospace;font-size:15px;font-weight:bold;color:#1e293b}
.footer{background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8}
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>${isUrgent ? '🚨 Urgent:' : '⏰'} Subscription expiring in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</h1>
    <p style="margin:6px 0 0;font-size:14px">${shop.shop_name} — ${shop.owner_name}</p>
  </div>
  <div class="body">
    <div class="info-box">
      <p style="margin:0;font-size:15px">Your ShopEase subscription expires on <strong>${expiryDate}</strong>.</p>
      <p style="margin:8px 0 0;font-size:13px;color:#92400e">
        ${isUrgent
          ? 'Your account will be locked after this date. Please renew immediately to avoid any disruption.'
          : 'Renew now to keep your billing, inventory, and reports running without interruption.'}
      </p>
    </div>

    <h3 style="color:#334155;margin-bottom:8px">How to renew — ₹${charge}/month</h3>
    <div class="pay-box">
      ${adminPhone ? `<div class="pay-row"><span class="label">Google Pay / PhonePe</span><span class="mono">${adminPhone}</span></div>` : ''}
      ${adminUpi   ? `<div class="pay-row"><span class="label">UPI ID</span><span class="mono">${adminUpi}</span></div>`               : ''}
      <p style="font-size:13px;color:#374151;margin:12px 0 4px">
        After paying, send a WhatsApp screenshot to confirm. Your account will be activated within a few hours.
      </p>
      ${adminPhone ? `<a href="https://wa.me/91${adminPhone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hi ShopEase! Renewing subscription for ${shop.shop_name}. Attaching payment screenshot.`)}"
         style="display:inline-block;background:#25d366;color:white;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:bold">
         💬 Send Screenshot on WhatsApp</a>` : ''}
    </div>
  </div>
  <div class="footer">ShopEase · Subscription Reminder · ${shop.shop_name}</div>
</div></body></html>`;

  await resendEmail({ to, subject: `${isUrgent ? '🚨 URGENT: ' : ''}Your ShopEase plan expires in ${daysLeft} day${daysLeft===1?'':'s'} — ${shop.shop_name}`, html });
  await query(
    `INSERT INTO email_logs (shop_id, type, status) VALUES ($1, 'subscription_reminder', 'sent')`,
    [shop.id]
  );
}

// ── Price change notification ─────────────────────────────────────────────────
async function sendPriceChangeEmail(shop, oldCharge, newCharge) {
  const to = shop.report_email || shop.email;
  if (!to) return;
  const isIncrease = newCharge > oldCharge;

  const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;color:#333;margin:0;padding:0;background:#f5f5f5}
.container{max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden}
.header{background:#2563eb;color:white;padding:24px;text-align:center}
.body{padding:24px}
.change-row{display:flex;align-items:center;justify-content:center;gap:20px;padding:20px;background:#f8fafc;border-radius:8px;margin:16px 0}
.price{font-size:28px;font-weight:bold}
.old{color:#94a3b8;text-decoration:line-through}
.new{color:${isIncrease ? '#dc2626' : '#16a34a'}}
.arrow{font-size:22px;color:#64748b}
.footer{background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8}
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1 style="margin:0;font-size:22px">ShopEase Plan Update</h1>
    <p style="margin:6px 0 0;font-size:14px">${shop.shop_name} — ${shop.owner_name}</p>
  </div>
  <div class="body">
    <p style="font-size:15px;color:#374151">
      Your monthly ShopEase subscription charge has been updated${isIncrease ? ' (price increase)' : ' (price reduction)'}.
    </p>
    <div class="change-row">
      <div class="price old">₹${oldCharge}</div>
      <div class="arrow">→</div>
      <div class="price new">₹${newCharge}</div>
    </div>
    <p style="font-size:14px;color:#64748b">
      This new rate applies from your <strong>next renewal</strong>. Your current subscription remains active until it expires.
    </p>
    ${isIncrease ? `<p style="font-size:13px;color:#92400e;background:#fefce8;border:1px solid #fde68a;border-radius:6px;padding:12px">
      If you have any questions about this change, please contact ShopEase support.
    </p>` : `<p style="font-size:13px;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px">
      Great news! Your plan price has been reduced. You save ₹${oldCharge - newCharge}/month.
    </p>`}
  </div>
  <div class="footer">ShopEase · Plan Update Notification · ${shop.shop_name}</div>
</div></body></html>`;

  await resendEmail({ to, subject: `ShopEase plan update: ₹${oldCharge} → ₹${newCharge}/month — ${shop.shop_name}`, html });
  await query(
    `INSERT INTO email_logs (shop_id, type, status) VALUES ($1, 'price_change', 'sent')`,
    [shop.id]
  );
}

module.exports = { sendDailyReport, sendMonthlyReport, sendSubscriptionReminderEmail, sendPriceChangeEmail };
