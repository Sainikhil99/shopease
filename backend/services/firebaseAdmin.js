const admin = require('firebase-admin');

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(raw)),
      });
    } catch (err) {
      console.error('[Firebase] Failed to initialise Admin SDK:', err.message);
    }
  } else {
    console.warn('[Firebase] FIREBASE_SERVICE_ACCOUNT not set — phone token verification disabled');
  }
}

module.exports = admin;
