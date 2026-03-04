/** Centralized API client — single place for base URL, headers, error handling. */

const BASE = '';

class ApiError extends Error {
  constructor(status, body) {
    super(body?.error ?? body?.message ?? `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function request(path, opts = {}) {
  const res = await fetch(BASE + path, opts);
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  get:  (path)        => request(path),
  post: (path, body)  => request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  /** POST with FormData (multipart) — no Content-Type header (browser sets boundary). */
  postForm: (path, formData) => request(path, { method: 'POST', body: formData }),
};
