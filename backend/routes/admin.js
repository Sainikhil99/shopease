const router = require('express').Router();
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

module.exports = router;
