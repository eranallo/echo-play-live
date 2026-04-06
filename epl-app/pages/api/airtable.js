const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE = process.env.AIRTABLE_BASE;

async function fetchTable(table) {
  let records = [];
  let offset = null;
  do {
    const url = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(table)}?pageSize=100${offset ? '&offset=' + offset : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || `Failed: ${res.status}`);
    }
    const data = await res.json();
    records = records.concat(data.records || []);
    offset = data.offset || null;
  } while (offset);
  return records;
}

export default async function handler(req, res) {
  if (!TOKEN || !BASE) return res.status(500).json({ error: 'Missing credentials.' });
  try {
    const tables = ['BANDS','MEMBERS','SHOWS','VENUES','BLACKOUT DATES','SETLISTS','CREW'];
    const results = {};
    await Promise.all(tables.map(async (t) => {
      try { results[t] = await fetchTable(t); }
      catch (e) { results[t] = []; results[t+'_error'] = e.message; }
    }));
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
