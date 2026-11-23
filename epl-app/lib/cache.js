// A small in-memory cache for Airtable reads.
//
// It lives as long as one warm server instance, so it only helps requests
// that land on the same instance within the time limit; that's most app
// opens when several people check at once. Entries hold the promise, so
// requests arriving together share one Airtable call. A failed load is
// dropped straight away so the next request tries again.

const store = new Map();

/**
 * Return `load()`'s result, reusing one from the last `ttlMs` ms.
 * Pass { fresh: true } to skip the cached copy and store a new one.
 */
export function cached(key, ttlMs, load, { fresh = false } = {}) {
  const now = Date.now();
  const hit = store.get(key);
  if (!fresh && hit && hit.expires > now) return hit.promise;
  const promise = Promise.resolve().then(load);
  store.set(key, { expires: now + ttlMs, promise });
  promise.catch(() => { if (store.get(key)?.promise === promise) store.delete(key); });
  return promise;
}

export function forget(key) {
  store.delete(key);
}
