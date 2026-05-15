// Shared Airtable client for every API route in pages/api/.
//
// The point: define env-var names + base URL + auth headers ONCE so we never
// end up in a Phase-01-style state where two routes read a stale name while
// three routes read the canonical name. All routes funnel through this file.

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE  = process.env.AIRTABLE_BASE;

const API_ROOT = 'https://api.airtable.com/v0';
const DEFAULT_TIMEOUT_MS = 15000;

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

function assertEnv() {
  if (!TOKEN || !BASE) {
    const err = new Error('AIRTABLE_TOKEN / AIRTABLE_BASE not configured');
    err.statusCode = 500;
    throw err;
  }
}

function authHeaders() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  };
}

// Path resolution: caller passes 'TABLE NAME' or 'TABLE NAME/recXXX'. The
// table-name segment needs URL-encoding (spaces, special chars) but record-id
// segments don't need extra encoding. Everything after the first '/' is
// passed through.
function buildUrl(path) {
  const [table, ...rest] = path.split('/');
  const encodedTable = encodeURIComponent(table);
  return rest.length
    ? `${API_ROOT}/${BASE}/${encodedTable}/${rest.join('/')}`
    : `${API_ROOT}/${BASE}/${encodedTable}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Low-level fetch wrapper. Returns { ok, status, data }.
 * Handles env-var check, JSON encoding/decoding, timeout via AbortController.
 *
 * @param {string} path  e.g. 'BLACKOUT DATES' or 'BLACKOUT DATES/recABC123'
 * @param {object} init  { method, body, query?, timeoutMs? }
 *                       body: JS object (auto-stringified) or string
 *                       query: object → ?key=val&key=val (encoded)
 */
export async function airtableRaw(path, init = {}) {
  assertEnv();
  const { body, query, timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init;

  let url = buildUrl(path);
  if (query && typeof query === 'object') {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) qs.append(k, String(v));
    }
    const s = qs.toString();
    if (s) url += (url.includes('?') ? '&' : '?') + s;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let res, data;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { ...authHeaders(), ...(rest.headers || {}) },
      body: body === undefined ? undefined
          : typeof body === 'string' ? body
          : JSON.stringify(body),
      signal: ctrl.signal,
    });
    data = await res.json().catch(() => ({}));
  } finally {
    clearTimeout(timer);
  }

  return { ok: res.ok, status: res.status, data };
}

/**
 * Convenience wrapper for the typical "do one Airtable call and return its
 * result to the client" pattern. Forwards Airtable's status code + error body
 * on failure. Pass an optional `shape` callback to pick fields off success.
 *
 *   await airtableRequest(res, 'BLACKOUT DATES', { method: 'POST', body: { fields } })
 *
 * Always returns the result of res.status(...).json(...) for caller convenience.
 */
export async function airtableRequest(res, path, init = {}, shape) {
  try {
    const { ok, status, data } = await airtableRaw(path, init);
    if (!ok) {
      return res.status(status).json({
        error: data?.error?.message || data?.error || 'Airtable error',
        detail: data,
      });
    }
    return res.status(200).json(shape ? shape(data) : data);
  } catch (e) {
    const code = e.statusCode || 500;
    return res.status(code).json({ error: e.message || 'Server error' });
  }
}

/**
 * Page through an entire table, returning the full record array.
 * Throws on failure (with a statusCode property the caller can forward).
 */
export async function fetchTable(table) {
  const records = [];
  let offset = null;
  do {
    const query = { pageSize: 100 };
    if (offset) query.offset = offset;
    const { ok, status, data } = await airtableRaw(table, { query });
    if (!ok) {
      const err = new Error(data?.error?.message || `Failed to fetch ${table}: HTTP ${status}`);
      err.statusCode = status;
      throw err;
    }
    records.push(...(data.records || []));
    offset = data.offset || null;
  } while (offset);
  return records;
}

/**
 * 405 helper. Sets the Allow header per HTTP spec and returns the JSON error.
 */
export function methodGuard(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  return res.status(405).json({ error: 'Method not allowed' });
}

// Exported for direct use in special cases (upload-photo.js builds its own
// PATCH URL because it talks to both Vercel Blob AND Airtable in one route).
export { TOKEN, BASE, API_ROOT, authHeaders, buildUrl, assertEnv };
