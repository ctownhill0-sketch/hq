// Fetch wrapper. Every request goes to our own local server; the custom
// X-HQ-Desk header is the CSRF guard checked in src/security.js.

export class ApiError extends Error {
  constructor(message, status, code, data) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const init = { method, headers: { 'X-HQ-Desk': '1', Accept: 'application/json' }, credentials: 'same-origin' };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError('Cannot reach the HQ Desk server. Is it still running in your terminal?', 0, 'OFFLINE');
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) {
    throw new ApiError((data && data.error) || `Request failed (${res.status}).`, res.status, data && data.code, data);
  }
  // Keep the sidebar's Google usage counter fresh.
  if (data && data.usage) window.dispatchEvent(new CustomEvent('hq:usage', { detail: data.usage }));
  return data;
}
