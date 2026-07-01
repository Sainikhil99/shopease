const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body } = require('express-validator');
const { query }        = require('../db');
const auth             = require('../middleware/auth');
const { revokeToken }  = require('../middleware/auth');
const validate         = require('../middleware/validate');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');

// ── OTP helpers (DB-backed so all PM2 workers share the same OTPs) ───────────
// In-memory Maps don't work in PM2 cluster mode: the OTP written by worker 1
// is invisible to worker 2.  Storing in PostgreSQL makes every worker consistent.

async function saveOTP(phone, otp) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min TTL
  await query(
    `INSERT INTO otps (phone, otp_code, expires_at, sent_at, attempts)
     VALUES ($1, $2, $3, NOW(), 0)
     ON CONFLICT (phone) DO UPDATE
     SET otp_code = $2, expires_at = $3, sent_at = NOW(), attempts = 0`,
    [phone, otp, expiresAt]
  );
}

async function getOTP(phone) {
  const result = await query(
    `SELECT otp_code, expires_at, attempts FROM otps WHERE phone = $1`,
    [phone]
  );
  return result.rows[0] || null;
}

async function incrementAttempts(phone) {
  await query(`UPDATE otps SET attempts = attempts + 1 WHERE phone = $1`, [phone]);
}

async function deleteOTP(phone) {
  await query(`DELETE FROM otps WHERE phone = $1`, [phone]);
}

// Clean up expired OTPs every 15 minutes (any worker runs this — idempotent)
setInterval(async () => {
  try { await query(`DELETE FROM otps WHERE expires_at < NOW()`); } catch {}
}, 15 * 60 * 1000);

const signToken = (shopId, phone) =>
  jwt.sign(
    { shopId, phone, jti: `${shopId}-${Date.now()}` },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '8h' }
  );

// ── POST /api/auth/send-otp ───────────────────────────────────────────────────
router.post('/send-otp',
  otpLimiter,
  body('phone').trim().matches(/^\d{10}$/).withMessage('Valid 10-digit mobile number required'),
  validate,
  async (req, res) => {
    const { phone } = req.body;

    // Block if previous OTP is still valid and was requested too recently (30s cooldown)
    const existing = await getOTP(phone);
    if (existing && new Date(existing.expires_at) > new Date() && new Date(existing.sent_at) > new Date(Date.now() - 30_000)) {
      return res.status(429).json({ error: 'Please wait 30 seconds before requesting a new OTP' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await saveOTP(phone, otp);

    // In production: await sendSMSviaMSG91(phone, otp);
    console.log(`[OTP] ${phone}: ${otp}`); // dev only — remove in production
    res.json({
      message: 'OTP sent successfully',
      ...(process.env.NODE_ENV !== 'production' && { dev_otp: otp }),
    });
  }
);

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────
router.post('/verify-otp',
  authLimiter,
  body('phone').trim().matches(/^\d{10}$/).withMessage('Valid phone required'),
  body('otp').trim().isLength({ min: 6, max: 6 }).isNumeric().withMessage('6-digit OTP required'),
  validate,
  async (req, res) => {
    const { phone, otp } = req.body;
    const record = await getOTP(phone);

    // Max 5 wrong attempts before locking out
    if (!record || new Date(record.expires_at) < new Date()) {
      return res.status(401).json({ error: 'OTP expired. Please request a new one.' });
    }
    const attempts = (record.attempts || 0) + 1;
    if (attempts > 5) {
      await deleteOTP(phone);
      return res.status(401).json({ error: 'Too many wrong attempts. Please request a new OTP.' });
    }
    if (record.otp_code !== otp) {
      await incrementAttempts(phone);
      return res.status(401).json({ error: `Invalid OTP. ${6 - attempts} attempts remaining.` });
    }
    await deleteOTP(phone); // one-time use

    const result = await query('SELECT id, shop_name, owner_name, phone FROM shops WHERE phone = $1', [phone]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No shop found for this number. Please register first.' });
    }
    const shop = result.rows[0];
    res.json({ token: signToken(shop.id, shop.phone), shop: { id: shop.id, shopName: shop.shop_name, ownerName: shop.owner_name } });
  }
);

// ── POST /api/auth/firebase-phone-login ──────────────────────────────────────
// Called by the frontend AFTER Firebase Phone Auth verifies the OTP.
// We trust Firebase's verification and just need the phone number to issue our JWT.
router.post('/firebase-phone-login', authLimiter, async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'idToken required' });

  let phone;
  try {
    const { getApps, getAuth } = require('../services/firebaseAdmin');
    if (!getApps().length) throw new Error('Firebase Admin not initialised — check FIREBASE_SERVICE_ACCOUNT in Render');
    const decoded = await getAuth().verifyIdToken(idToken);
    phone = (decoded.phone_number || '').replace('+91', '');
    if (!phone) throw new Error('No phone number in token');
  } catch (err) {
    // Use 400 not 401 — 401 is intercepted by the frontend as "session expired"
    return res.status(400).json({ error: 'Firebase verification failed: ' + err.message });
  }

  const result = await query(
    'SELECT id, shop_name, owner_name, phone FROM shops WHERE phone = $1',
    [phone]
  );
  if (!result.rows.length) {
    return res.status(404).json({ error: 'No shop found for this number. Please register first.' });
  }
  const shop = result.rows[0];
  res.json({ token: signToken(shop.id, shop.phone), shop: { id: shop.id, shopName: shop.shop_name, ownerName: shop.owner_name } });
});

// ── POST /api/auth/login (email + password) ───────────────────────────────────
router.post('/login',
  authLimiter,
  body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 1 }).withMessage('Password required'),
  validate,
  async (req, res) => {
    const { email, password } = req.body;

    const result = await query(
      'SELECT id, shop_name, owner_name, phone, password_hash FROM shops WHERE email = $1',
      [email]
    );
    // Always run bcrypt even on no-match to prevent timing attacks
    const shop         = result.rows[0];
    const hashToCheck  = shop?.password_hash || '$2a$12$invalidhashtopreventtimingattack00000000000000000000000000';
    const valid        = await bcrypt.compare(password, hashToCheck);

    if (!shop || !valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json({ token: signToken(shop.id, shop.phone), shop: { id: shop.id, shopName: shop.shop_name, ownerName: shop.owner_name } });
  }
);

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register',
  authLimiter,
  body('ownerName').trim().isLength({ min: 2, max: 100 }).withMessage('Owner name must be 2–100 characters'),
  body('shopName').trim().isLength({ min: 2, max: 100 }).withMessage('Shop name must be 2–100 characters'),
  body('phone').trim().matches(/^\d{10}$/).withMessage('Valid 10-digit phone required'),
  body('email').optional({ checkFalsy: true }).trim().isEmail().normalizeEmail().withMessage('Invalid email format'),
  body('password').optional({ checkFalsy: true }).isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('gstin').optional({ checkFalsy: true }).trim().matches(/^[0-9A-Z]{15}$/).withMessage('GSTIN must be 15 alphanumeric characters'),
  validate,
  async (req, res) => {
    const { ownerName, shopName, phone, email, password, address, gstin } = req.body;

    const existing = await query('SELECT id FROM shops WHERE phone = $1 OR (email IS NOT NULL AND email = $2)', [phone, email || '']);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Phone number or email is already registered' });
    }

    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    const result = await query(
      `INSERT INTO shops (owner_name, shop_name, phone, email, address, gstin, password_hash, report_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$4) RETURNING id, shop_name, owner_name, phone`,
      [ownerName, shopName, phone, email || null, address || null, gstin?.toUpperCase() || null, passwordHash]
    );
    const shop = result.rows[0];
    res.status(201).json({ token: signToken(shop.id, shop.phone), shop: { id: shop.id, shopName: shop.shop_name, ownerName: shop.owner_name } });
  }
);

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', auth, (req, res) => {
  revokeToken(req.shop); // blacklist the JWT so it can't be reused
  res.json({ message: 'Logged out successfully' });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
  const result = await query(
    'SELECT id, shop_name, owner_name, phone, email, address, gstin FROM shops WHERE id = $1',
    [req.shop.shopId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });
  const s = result.rows[0];
  res.json({ id: s.id, shopName: s.shop_name, ownerName: s.owner_name, phone: s.phone, email: s.email, address: s.address, gstin: s.gstin });
});

module.exports = router;
