// PM2 production config
// Start:   pm2 start ecosystem.config.js --env production
// Monitor: pm2 monit
// Logs:    pm2 logs shopease

module.exports = {
  apps: [{
    name: 'shopease',
    script: './server.js',

    // One worker per CPU core — this is how 100k concurrent users are handled.
    // Each worker has its own event loop + DB connection pool (20 connections each).
    // On a 4-core server: 4 workers × 20 DB conns = 80 total DB connections.
    instances: 'max',
    exec_mode: 'cluster',

    // Disable the in-process cluster (server.js) when PM2 handles it
    env_production: {
      NODE_ENV: 'production',
      DISABLE_CLUSTER: 'true',
      PORT: 5000,
    },
    env_development: {
      NODE_ENV: 'development',
      DISABLE_CLUSTER: 'true',
      PORT: 5000,
    },

    // Auto-restart if memory exceeds 512 MB (memory leak guard)
    max_memory_restart: '512M',

    // Restart on crash, but back off if it keeps failing
    restart_delay: 2000,
    max_restarts: 10,
    min_uptime: '10s',

    // Zero-downtime reload: new workers start before old ones die
    wait_ready: false,
    kill_timeout: 15000,     // give graceful shutdown 15s (matches server.js timeout)

    // Log config
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,

    // Watch (dev only — never in production)
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
  }],
};
