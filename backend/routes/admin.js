const router = require('express').Router();
const { query } = require('../db');
const { sendEmail } = require('../services/resendEmail');

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

// GET /api/admin/test-firebase — checks if Firebase Admin SDK initialised correctly
router.get('/test-firebase', adminAuth, (req, res) => {
  try {
    const { getApps } = require('../services/firebaseAdmin');
    const apps = getApps();
    res.json({
      initialised: apps.length > 0,
      appCount: apps.length,
      serviceAccountSet: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      serviceAccountLength: (process.env.FIREBASE_SERVICE_ACCOUNT || '').length,
    });
  } catch (err) {
    res.status(200).json({ initialised: false, error: err.message });
  }
});

// GET /api/admin/test-email — sends a test email to ADMIN_ALERT_EMAIL to verify Resend config
router.get('/test-email', adminAuth, async (req, res) => {
  if (!process.env.RESEND_API_KEY) {
    return res.status(400).json({ error: 'RESEND_API_KEY not configured in Render' });
  }
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to) {
    return res.status(400).json({ error: 'ADMIN_ALERT_EMAIL not configured in Render' });
  }
  try {
    await sendEmail({
      to,
      subject: 'ShopEase — Test Email',
      html: '<p>This is a test email. If you received this, your Resend configuration on Render is working correctly.</p>',
    });
    res.json({ status: 'sent', to });
  } catch (err) {
    res.status(500).json({ error: 'Email send failed', detail: err.message });
  }
});

module.exports = router;
