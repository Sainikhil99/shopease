// Safe localStorage wrapper
// Handles QuotaExceededError (storage full), JSON parse errors,
// and private-browsing environments where localStorage may be unavailable.

function isAvailable() {
  try {
    const t = '__shopease_test__';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
    return true;
  } catch { return false; }
}

const STORAGE_OK = isAvailable();

export function safeGet(key, fallback = null) {
  if (!STORAGE_OK) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
}

export function safeSet(key, value) {
  if (!STORAGE_OK) return false;
  let serialized;
  try { serialized = JSON.stringify(value); } catch { return false; }
  try {
    localStorage.setItem(key, serialized);
    return true;
  } catch (e) {
    // QuotaExceededError — try evicting any temp/cache keys then retry once
    if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
      try {
        const victims = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('shopease_tmp_') || k.startsWith('shopease_cache_'))) victims.push(k);
        }
        victims.forEach(k => localStorage.removeItem(k));
        localStorage.setItem(key, serialized);
        return true;
      } catch { /* storage still full — caller must handle */ }
    }
    console.warn('[ShopEase] localStorage write failed for key:', key, e);
    return false;
  }
}

export function safeRemove(key) {
  if (!STORAGE_OK) return false;
  try { localStorage.removeItem(key); return true; } catch { return false; }
}

// Write multiple key-value pairs. Returns true only if all succeeded.
export function safeBatch(pairs) {
  return pairs.every(([key, value]) => safeSet(key, value));
}
