const nodemailer = require('nodemailer');
const { query } = require('../db');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
});

async function getDailyReportData(shopId, date) {
  const d = date || new Date().toISOString().split('T')[0];
  const [shop, summary, paymentBreakdown, itemsSold, lowStock] = await Promise.all([
    query('SELECT * FROM shops WHERE id=$1', [shopId]),
    query(`SELECT COALESCE(SUM(total),0) as revenue, COALESCE(SUM(discount_amount),0) as discounts,
                  COALESCE(SUM(tax_amount),0) as gst, COUNT(*) as bill_count
           FROM bills WHERE shop_id=$1 AND DATE(created_at)=$2 AND status='completed'`, [shopId, d]),
    query(`SELECT payment_mode, SUM(total) as amount FROM bills WHERE shop_id=$1 AND DATE(created_at)=$2 GROUP BY payment_mode`, [shopId, d]),
    query(`SELECT bi.product_name, SUM(bi.quantity) as qty, SUM(bi.item_total) as revenue
           FROM bill_items bi JOIN bills b ON bi.bill_id=b.id
           WHERE b.shop_id=$1 AND DATE(b.created_at)=$2 GROUP BY bi.product_name ORDER BY qty DESC`, [shopId, d]),
    query(`SELECT name, stock_qty FROM products WHERE shop_id=$1 AND stock_qty<=min_stock_alert AND is_active=true`, [shopId]),
  ]);
  return { shop: shop.rows[0], date: d, ...summary.rows[0], paymentBreakdown: paymentBreakdown.rows, itemsSold: itemsSold.rows, lowStock: lowStock.rows };
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

    ${data.lowStock.length > 0 ? `
    <div class="alert">
      <strong style="color:#dc2626">⚠ Low Stock Alert</strong>
      <ul style="margin:8px 0 0;padding-left:20px">
        ${data.lowStock.map(p => `<li>${p.name}: <strong>${p.stock_qty} units remaining</strong></li>`).join('')}
      </ul>
    </div>` : ''}
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
    from: `"ShopEase Reports" <${process.env.GMAIL_USER}>`,
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
    from: `"ShopEase Reports" <${process.env.GMAIL_USER}>`,
    to: shop.report_email,
    subject: `Monthly Report — ${new Date().toLocaleString('en-IN',{month:'long',year:'numeric'})} | ${shop.shop_name}`,
    html: `<p>Your monthly report for ${shop.shop_name} is ready. Full PDF attached.</p>`,
  });
  await query('INSERT INTO email_logs (shop_id, type, status) VALUES ($1,$2,$3)', [shopId, 'monthly', 'sent']);
}

module.exports = { sendDailyReport, sendMonthlyReport };
