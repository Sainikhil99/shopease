const router = require('express').Router();
const nodemailer = require('nodemailer');
const { query } = require('../db');

const FREE_SHOP_LIMIT = 50;
const FREE_DB_MB = 500;

// Guard: compare Authorization Bearer token against ADMIN_KEY env var
const adminAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token || token !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// GET /api/admin/usage
// Returns shop count and database size vs free-tier limits.
// Called by the admin dashboard banner every time the page loads.
router.get('/usage', adminAuth, async (req, res) => {
  try {
    const [shopRes, dbRes] = await Promise.all([
      query('SELECT COUNT(*) FROM shops'),
      query("SELECT pg_database_size(current_database()) AS bytes"),
    ]);

    const shopCount = parseInt(shopRes.rows[0].count, 10);
    const dbMB      = Math.round(parseInt(dbRes.rows[0].bytes, 10) / (1024 * 1024));
    const shopPct   = Math.round((shopCount / FREE_SHOP_LIMIT) * 100);
    const dbPct     = Math.round((dbMB / FREE_DB_MB) * 100);
    const status    = shopPct >= 95 || dbPct >= 95 ? 'critical'
                    : shopPct >= 80 || dbPct >= 80  ? 'warning'
                    : 'ok';

    res.json({
      shops:    { count: shopCount, limit: FREE_SHOP_LIMIT, pct: shopPct },
      database: { mb: dbMB, limit: FREE_DB_MB, pct: dbPct },
      status,
    });
  } catch (err) {
    console.error('[Admin] Usage stats error:', err.message);
    res.status(500).json({ error: 'Could not fetch usage stats' });
  }
});

// GET /api/admin/test-email — sends a test email to ADMIN_ALERT_EMAIL to verify SMTP config
router.get('/test-email', adminAuth, async (req, res) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    return res.status(400).json({ error: 'SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in Render' });
  }
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const to = process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_USER;
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to,
      subject: 'ShopEase — Test Email',
      html: '<p>This is a test email. If you received this, your SMTP configuration on Render is working correctly.</p>',
    });
    res.json({ status: 'sent', to });
  } catch (err) {
    res.status(500).json({ error: 'Email send failed', detail: err.message });
  }
});

module.exports = router;
