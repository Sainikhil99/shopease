const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,

  // Pool sizing: support ~100k concurrent users via load-balanced instances
  // Each Node process handles ~200 concurrent DB queries; scale horizontally with PM2 cluster
  max: parseInt(process.env.DB_POOL_MAX) || 20,      // max open connections per process
  min: parseInt(process.env.DB_POOL_MIN) || 2,       // keep warm connections ready
  idleTimeoutMillis: 30_000,                          // release idle connections after 30s
  connectionTimeoutMillis: 5_000,                     // fail fast if pool is exhausted
  allowExitOnIdle: false,                             // keep pool alive in long-running server
});

// Crash loudly on unexpected pool errors so the process restarts cleanly via PM2
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
  process.exit(1);
});

// Wrapper: auto-retry once on transient connection errors
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DB] query (${Date.now() - start}ms):`, text.substring(0, 60));
    }
    return result;
  } catch (err) {
    // Retry once on connection-level errors (not query logic errors)
    if (err.code === 'ECONNREFUSED' || err.code === '57P01' || err.code === 'ENOTFOUND') {
      console.warn('[DB] Transient error, retrying once…', err.code);
      return pool.query(text, params);
    }
    throw err;
  }
};

// Used by health-check endpoint
const ping = () => pool.query('SELECT 1');

// Graceful shutdown: drain pool before process exits
const shutdown = () => pool.end();

module.exports = { pool, query, ping, shutdown };
