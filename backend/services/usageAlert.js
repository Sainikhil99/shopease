const nodemailer = require('nodemailer');
const { query } = require('../db');

const FREE_SHOP_LIMIT = 50;
const FREE_DB_MB      = 500;

// In-memory dedup: key = 'warning' | 'critical', value = timestamp of last send.
// Resets on server restart — acceptable for a daily cron.
const lastSent = {};

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    family: 4, // force IPv4 — Render free tier has no IPv6 route
  });
}

function alreadySentToday(level) {
  const ts = lastSent[level];
  if (!ts) return false;
  return Date.now() - ts < 24 * 60 * 60 * 1000;
}

async function sendAlertEmail(shopCount, dbMB, level) {
  const to = process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_USER;
  if (!to) {
    console.log(`[ALERT] ${level.toUpperCase()}: ${shopCount}/${FREE_SHOP_LIMIT} shops, ${dbMB}/${FREE_DB_MB} MB (no ADMIN_ALERT_EMAIL set — skipping email)`);
    return;
  }

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[ALERT] ${level.toUpperCase()}: ${shopCount}/${FREE_SHOP_LIMIT} shops, ${dbMB}/${FREE_DB_MB} MB (SMTP not configured)`);
    return;
  }

  const isRed    = level === 'critical';
  const accent   = isRed ? '#dc2626' : '#d97706';
  const subject  = isRed
    ? '🔴 CRITICAL — ShopEase is approaching free tier limits'
    : '🟡 WARNING — ShopEase free tier usage at 80%+';

  const shopPct = Math.round((shopCount / FREE_SHOP_LIMIT) * 100);
  const dbPct   = Math.round((dbMB / FREE_DB_MB) * 100);

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
      <div style="background:${accent};padding:24px 28px">
        <h2 style="margin:0;color:#fff;font-size:18px">${subject}</h2>
      </div>
      <div style="padding:24px 28px">
        <p style="color:#374151;margin:0 0 20px">Your ShopEase platform usage has crossed the ${isRed ? '95%' : '80%'} threshold on the free tier.</p>

        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb">Metric</th>
              <th style="padding:10px 12px;text-align:right;color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb">Used</th>
              <th style="padding:10px 12px;text-align:right;color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb">Limit</th>
              <th style="padding:10px 12px;text-align:right;color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb">%</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6">Shops registered</td>
              <td style="padding:10px 12px;text-align:right;font-weight:600;color:${shopPct >= 95 ? '#dc2626' : '#111827'}">${shopCount}</td>
              <td style="padding:10px 12px;text-align:right;color:#6b7280">${FREE_SHOP_LIMIT}</td>
              <td style="padding:10px 12px;text-align:right;font-weight:600;color:${shopPct >= 95 ? '#dc2626' : shopPct >= 80 ? '#d97706' : '#16a34a'}">${shopPct}%</td>
            </tr>
            <tr>
              <td style="padding:10px 12px">Database size</td>
              <td style="padding:10px 12px;text-align:right;font-weight:600;color:${dbPct >= 95 ? '#dc2626' : '#111827'}">${dbMB} MB</td>
              <td style="padding:10px 12px;text-align:right;color:#6b7280">${FREE_DB_MB} MB</td>
              <td style="padding:10px 12px;text-align:right;font-weight:600;color:${dbPct >= 95 ? '#dc2626' : dbPct >= 80 ? '#d97706' : '#16a34a'}">${dbPct}%</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top:20px;padding:14px 16px;background:${isRed ? '#fef2f2' : '#fffbeb'};border:1px solid ${isRed ? '#fca5a5' : '#fcd34d'};border-radius:8px">
          <strong style="color:${accent}">Action required:</strong>
          <span style="color:#374151"> Upgrade Supabase to Pro ($25/mo) and Render to Starter ($7/mo) to avoid service interruption.</span>
        </div>

        <p style="margin-top:20px;font-size:13px;color:#9ca3af">This alert was sent automatically by ShopEase. You will not receive another ${level} alert for 24 hours.</p>
      </div>
    </div>`;

  try {
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    lastSent[level] = Date.now();
    console.log(`[ALERT] ${level} email sent to ${to} — shops: ${shopCount}/${FREE_SHOP_LIMIT}, DB: ${dbMB}/${FREE_DB_MB} MB`);
  } catch (err) {
    console.error('[ALERT] Email send failed:', err.message);
  }
}

async function checkAndAlert() {
  try {
    const [shopRes, dbRes] = await Promise.all([
      query('SELECT COUNT(*) FROM shops'),
      query("SELECT pg_database_size(current_database()) AS bytes"),
    ]);

    const shopCount = parseInt(shopRes.rows[0].count, 10);
    const dbMB      = Math.round(parseInt(dbRes.rows[0].bytes, 10) / (1024 * 1024));
    const shopPct   = shopCount / FREE_SHOP_LIMIT;
    const dbPct     = dbMB / FREE_DB_MB;

    console.log(`[USAGE] Shops: ${shopCount}/${FREE_SHOP_LIMIT} (${Math.round(shopPct * 100)}%) | DB: ${dbMB}/${FREE_DB_MB} MB (${Math.round(dbPct * 100)}%)`);

    if ((shopPct >= 0.95 || dbPct >= 0.95) && !alreadySentToday('critical')) {
      await sendAlertEmail(shopCount, dbMB, 'critical');
    } else if ((shopPct >= 0.80 || dbPct >= 0.80) && !alreadySentToday('warning')) {
      await sendAlertEmail(shopCount, dbMB, 'warning');
    }
  } catch (err) {
    console.error('[USAGE] Check failed:', err.message);
  }
}

module.exports = { checkAndAlert };
