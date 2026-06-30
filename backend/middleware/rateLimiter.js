const rateLimit = require('express-rate-limit');

const json429 = (req, res) => res.status(429).json({
  error: 'Too many requests. Please slow down.',
  retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
});

// Strict: login / register / OTP — brute-force protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
  skipSuccessfulRequests: false,
});

// OTP specifically: 5 attempts per 10 minutes per IP
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
});

// General API — authenticated routes (per IP)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,    // 1 minute
  max: 300,                    // 300 req/min per IP is plenty for POS use
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
  skip: (req) => req.method === 'OPTIONS',
});

// Reports / heavy queries — extra throttle
const reportLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
});

module.exports = { authLimiter, otpLimiter, apiLimiter, reportLimiter };
