const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function apiFetch(path, { method = 'GET', body, silent = false } = {}) {
  const token = sessionStorage.getItem('shopease_token');

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  } catch (err) {
    throw new ApiError(err.message || 'Cannot connect to server', 0);
  }

  if (res.status === 401) {
    // Only force-logout for user-initiated calls, not background syncs
    if (!silent) {
      sessionStorage.removeItem('shopease_token');
      localStorage.removeItem('shopease_current_shop');
      window.dispatchEvent(new Event('shopease:session-expired'));
    }
    throw new ApiError('Session expired. Please log in again.', 401);
  }

  let data;
  try { data = await res.json(); } catch { data = {}; }

  if (!res.ok) {
    throw new ApiError(data.error || data.message || `Request failed (${res.status})`, res.status);
  }

  return data;
}

// User-initiated calls — a 401 will log the user out
export const api = {
  get:    (path)        => apiFetch(path),
  post:   (path, body)  => apiFetch(path, { method: 'POST',   body }),
  put:    (path, body)  => apiFetch(path, { method: 'PUT',    body }),
  patch:  (path, body)  => apiFetch(path, { method: 'PATCH',  body }),
  delete: (path)        => apiFetch(path, { method: 'DELETE' }),
};

// Background sync calls — a 401 is silently ignored, never forces logout
export const bgApi = {
  get:    (path)        => apiFetch(path,                        { silent: true }),
  post:   (path, body)  => apiFetch(path, { method: 'POST',   body, silent: true }),
  put:    (path, body)  => apiFetch(path, { method: 'PUT',    body, silent: true }),
  patch:  (path, body)  => apiFetch(path, { method: 'PATCH',  body, silent: true }),
  delete: (path)        => apiFetch(path, { method: 'DELETE',       silent: true }),
};
