const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    // status 0  = network error (backend unreachable)
    // status 4xx = client error (wrong credentials, not found, etc.)
    // status 5xx = server error
    this.status = status;
  }
}

async function apiFetch(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('shopease_token');

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
    // Network error — backend is down or unreachable
    throw new ApiError(err.message || 'Cannot connect to server', 0);
  }

  if (res.status === 401) {
    // Token expired — fire an event so AppContext can clear auth state
    localStorage.removeItem('shopease_token');
    localStorage.removeItem('shopease_current_shop');
    window.dispatchEvent(new Event('shopease:session-expired'));
    throw new ApiError('Session expired. Please log in again.', 401);
  }

  let data;
  try { data = await res.json(); } catch { data = {}; }

  if (!res.ok) {
    throw new ApiError(data.error || data.message || `Request failed (${res.status})`, res.status);
  }

  return data;
}

export const api = {
  get:    (path)        => apiFetch(path),
  post:   (path, body)  => apiFetch(path, { method: 'POST',   body }),
  put:    (path, body)  => apiFetch(path, { method: 'PUT',    body }),
  patch:  (path, body)  => apiFetch(path, { method: 'PATCH',  body }),
  delete: (path)        => apiFetch(path, { method: 'DELETE' }),
};
