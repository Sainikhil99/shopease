const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

if (!getApps().length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    try {
      initializeApp({ credential: cert(JSON.parse(raw)) });
      console.log('[Firebase] Admin SDK initialised');
    } catch (err) {
      console.error('[Firebase] Failed to initialise Admin SDK:', err.message);
    }
  } else {
    console.warn('[Firebase] FIREBASE_SERVICE_ACCOUNT not set — phone token verification disabled');
  }
}

module.exports = { getApps, getAuth };
