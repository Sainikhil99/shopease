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

// GET /api/admin/shops — all shops with subscription status (for billing panel)
router.get('/shops', adminAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        id, owner_name, shop_name, phone, email, address, gstin,
        created_at,
        COALESCE(monthly_charge, 299) AS monthly_charge,
        subscription_paid_until,
        CASE
          WHEN subscription_paid_until >= CURRENT_DATE THEN 'active'
          ELSE 'expired'
        END AS subscription_status,
        (subscription_paid_until - CURRENT_DATE)::int AS days_remaining
      FROM shops
      ORDER BY subscription_paid_until ASC NULLS FIRST
    `);
    res.json({ shops: result.rows });
  } catch (err) {
    console.error('[Admin] Shops list error:', err.message);
    res.status(500).json({ error: 'Could not fetch shops' });
  }
});

// POST /api/admin/shops/:id/mark-paid — extend subscription by N months (default 1)
router.post('/shops/:id/mark-paid', adminAuth, async (req, res) => {
  const months = Math.max(1, Math.min(12, parseInt(req.body.months) || 1));
  try {
    const result = await query(`
      UPDATE shops
      SET subscription_paid_until =
        GREATEST(CURRENT_DATE, COALESCE(subscription_paid_until, CURRENT_DATE))
        + ($2::int * INTERVAL '1 month')
      WHERE id = $1
      RETURNING id, shop_name, owner_name, subscription_paid_until,
        (subscription_paid_until - CURRENT_DATE)::int AS days_remaining
    `, [req.params.id, months]);
    if (!result.rows.length) return res.status(404).json({ error: 'Shop not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Admin] Mark paid error:', err.message);
    res.status(500).json({ error: 'Could not update subscription' });
  }
});

module.exports = router;
