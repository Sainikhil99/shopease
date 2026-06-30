const jwt = require('jsonwebtoken');

// In-memory token blacklist for logged-out tokens.
// For true 100k-user scale, swap this Map for a Redis SET with TTL matching JWT expiry.
const blacklist = new Map(); // token_jti -> expiry_timestamp

// Auto-prune expired blacklist entries every 30 minutes to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [jti, exp] of blacklist) {
    if (exp < now) blacklist.delete(jti);
  }
}, 30 * 60 * 1000);

const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
  }

  const token = header.slice(7);
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.', code });
  }

  // Check blacklist (handles explicit logout)
  if (decoded.jti && blacklist.has(decoded.jti)) {
    return res.status(401).json({ error: 'Session has been ended. Please log in again.', code: 'TOKEN_REVOKED' });
  }

  req.shop  = decoded;
  req.token = token;
  next();
};

// Called by logout route to blacklist a token
const revokeToken = (decoded) => {
  if (decoded?.jti && decoded?.exp) {
    blacklist.set(decoded.jti, decoded.exp * 1000);
  }
};

module.exports = auth;
module.exports.revokeToken = revokeToken;
