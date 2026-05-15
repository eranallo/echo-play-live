// Bulk-fetch endpoint for the admin dashboard. Fetches every table the app
// needs in parallel.
//
// Phase 03 changes vs. earlier version:
//   M1: routes through the shared lib/airtable.js helper
//   M2: surfaces per-table errors in a top-level `errors` map so the client
//       can show a non-blocking warning per failed table instead of silently
//       seeing an empty list
//   M4: drops the s-maxage=30 CDN cache so writes are visible immediately
//       across all screens (was masking partial data on the master calendar
//       after a blackout submit)

import { fetchTable, TOKEN, BASE } from '../../lib/airtable';

const TABLES = ['BANDS', 'MEMBERS', 'SHOWS', 'VENUES', 'BLACKOUT DATES', 'SETLISTS', 'SONGS', 'CREW'];

export default async function handler(req, res) {
  if (!TOKEN || !BASE) {
    return res.status(500).json({ error: 'AIRTABLE_TOKEN / AIRTABLE_BASE not configured' });
  }

  const results = {};
  const errors = {};

  // Fetch all tables in parallel. Catch per-table failures so a single
  // bad table doesn't kill the whole response.
  await Promise.all(TABLES.map(async (t) => {
    try {
      results[t] = await fetchTable(t);
    } catch (e) {
      results[t] = [];
      errors[t] = e.message || 'Unknown Airtable error';
    }
  }));

  // M2: surface partial errors at the top level so the client can render a
  // banner per failed table. (Previously stored as results[t+'_error'] which
  // the client never read.)
  if (Object.keys(errors).length) {
    results.errors = errors;
  }

  // M4: no CDN cache. Writes (blackout/inquiry/setlist) are now immediately
  // visible across screens. Slight cost in Airtable API calls; per their docs
  // the rate limit is 5 req/sec/base which is comfortably above typical use.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  return res.status(200).json(results);
}
