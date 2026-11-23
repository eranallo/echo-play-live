// Loading the tables a person may see, shared by /api/me and the calendar
// feed. Each table is read with only the fields in lib/visibility.js and
// kept for a short while (lib/cache.js), so opening the app doesn't send
// dozens of requests to Airtable every time.

import { fetchTable } from './airtable';
import { cached } from './cache';
import { VISIBLE_FIELDS, TABLE_FILTERS, TABLE_NARROWING } from './visibility';

const TTL_MS = 30 * 1000;

// One table. TABLE_FILTERS decide what a person may see and are always
// applied. TABLE_NARROWING only skips rows the app would throw away (the
// song catalog, venues never played); if Airtable rejects that formula the
// table is read without it, which is slower but complete.
function readTable(table) {
  const fields = VISIBLE_FIELDS[table];
  const filter = TABLE_FILTERS[table];
  const narrow = TABLE_NARROWING[table];
  const both = (a, b) => (a && b ? `AND(${a}, ${b})` : a || b);
  if (!narrow) return fetchTable(table, { fields, filterByFormula: filter });
  const full = () => fetchTable(table, { fields, filterByFormula: filter });
  return fetchTable(table, { fields, filterByFormula: both(filter, narrow) }).then(
    // Nothing back is more likely a formula that matched wrongly than an
    // empty table; read it in full rather than show nothing.
    (rows) => (rows.length ? rows : full()),
    (e) => {
      if (e.statusCode !== 422) throw e;
      console.warn(`Narrowing formula for ${table} was rejected; reading it in full.`, e.message);
      return full();
    },
  );
}

/**
 * Load tables by name. Returns { results: { TABLE: records }, errors:
 * { TABLE: message } }; one failing table doesn't stop the others.
 * Pass { fresh: true } after a change so the person sees it straight away.
 */
export async function loadTables(tables, { fresh = false } = {}) {
  const results = {};
  const errors = {};
  await Promise.all(tables.map(async (table) => {
    try {
      results[table] = await cached(`table:${table}`, TTL_MS, () => readTable(table), { fresh });
    } catch (e) {
      results[table] = [];
      errors[table] = e.message || 'Unknown Airtable error';
    }
  }));
  return { results, errors };
}
