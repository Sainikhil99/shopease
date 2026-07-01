// Expand libuv thread pool BEFORE any require — bcrypt uses it heavily
process.env.UV_THREADPOOL_SIZE = String(Math.min(require('os').cpus().length * 4, 128));

// Render's free tier has no IPv6 route out; Node 18+ tries IPv6 first by
// default, which hangs until timeout against Supabase/Gmail's IPv6 records.
require('dns').setDefaultResultOrder('ipv4first');

require('dotenv').config();
const cluster   = require('cluster');
const os        = require('os');
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const compression = require('compression');
const { apiLimiter } = require('./middleware/rateLimiter');
const { ping, shutdown } = require('./db');

// ── Cluster: fork one worker per CPU core ─────────────────────────────────────
// This is the key to handling 100k concurrent users on a single machine.
// Each worker is a full Node process with its own DB pool and event loop.
// PM2 does this automatically in production; the manual cluster below is the
// fallback for `node server.js` runs.
if (cluster.isPrimary && process.env.NODE_ENV === 'production' && !process.env.DISABLE_CLUSTER) {
  const numCPUs = os.cpus().length;
  console.log(`[Master] Forking ${numCPUs} workers…`);
  for (let i = 0; i < numCPUs; i++) cluster.fork();
  cluster.on('exit', (worker, code) => {
    console.warn(`[Master] Worker ${worker.process.pid} died (code ${code}). Restarting…`);
    cluster.fork();
  });
  return; // primary process ends here
}

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();

// Trust the first proxy (Nginx / AWS ALB / Render / Railway)
// Required so express-rate-limit reads the real client IP from X-Forwarded-For
app.set('trust proxy', 1);

// ── Security headers (Helmet) ─────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", 'data:', 'blob:'],
      connectSrc:  ["'self'"],
      fontSrc:     ["'self'"],
      objectSrc:   ["'none'"],
      frameSrc:    ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // relaxed for receipt PDF generation
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, Postman, health checks)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600, // preflight cache 10 minutes
}));

// ── Compression ───────────────────────────────────────────────────────────────
// Gzip all JSON responses > 1 KB — reduces bandwidth ~70%
app.use(compression({ level: 6, threshold: 1024 }));

// ── Body parsing (tight limits to prevent JSON bomb DoS) ─────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Global API rate limit ─────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ── Request ID (trace logs across microservices) ──────────────────────────────
app.use((req, _res, next) => {
  req.id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  next();
});

// ── Response key transform: snake_case → camelCase ───────────────────────────
// Applied before routes so every JSON response uses camelCase automatically.
// e.g. { shop_name, bill_number, created_at } → { shopName, billNumber, createdAt }
app.use(require('./middleware/camelCase'));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/products',  require('./routes/products'));
app.use('/api/bills',     require('./routes/bills'));
app.use('/api/returns',   require('./routes/returns'));
app.use('/api/coupons',   require('./routes/coupons'));
app.use('/api/reports',   require('./routes/reports'));
app.use('/api/dashboard', require('./routes/reports'));
app.use('/api/settings',  require('./routes/settings'));
app.use('/api/stock',     require('./routes/stock'));
app.use('/api/admin',     require('./routes/admin'));

// ── Health check (used by load balancer / Docker HEALTHCHECK) ─────────────────
app.get('/health', async (_req, res) => {
  try {
    await ping();
    res.json({ status: 'ok', pid: process.pid, ts: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', detail: 'Database unreachable' });
  }
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  // CORS errors
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ error: err.message });
  }
  // Body parse errors (malformed JSON)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  const status = err.status || err.statusCode || 500;
  console.error(`[${req.id}] ${req.method} ${req.path} →`, err.message);
  res.status(status).json({
    error: status < 500 ? err.message : 'Internal server error',
    requestId: req.id,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`[Worker ${process.pid}] ShopEase running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  if (process.env.NODE_ENV !== 'test') {
    const { startCronJobs } = require('./services/cronJobs');
    startCronJobs();
  }
});

// Keep-alive: prevents connection re-establishment overhead on every request
server.keepAliveTimeout = 65_000;    // slightly above typical load-balancer 60s
server.headersTimeout   = 66_000;    // must be > keepAliveTimeout

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// SIGTERM is sent by Docker / PM2 / K8s when stopping a container.
// We finish in-flight requests, then close DB pool cleanly.
const gracefulShutdown = (signal) => {
  console.log(`[${process.pid}] ${signal} received. Shutting down gracefully…`);
  server.close(async () => {
    try { await shutdown(); } catch {}
    console.log(`[${process.pid}] Shutdown complete.`);
    process.exit(0);
  });
  // Force-exit after 15 s if connections are stuck
  setTimeout(() => { console.error('Forced shutdown after timeout'); process.exit(1); }, 15_000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// Catch unhandled promise rejections — log and let PM2 restart the worker
process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection]', reason);
});

module.exports = app;
