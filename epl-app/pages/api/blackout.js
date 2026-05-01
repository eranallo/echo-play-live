const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE = process.env.AIRTABLE_BASE;
const TABLE = 'BLACKOUT%20DATES';

export default async function handler(req, res) {
  if (!TOKEN || !BASE) return res.status(500).json({ error: 'Missing credentials' });

  try {
    if (req.method === 'POST') {
      const r = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: req.body }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || 'Failed to submit');
      return res.status(200).json(data);
    }

    if (req.method === 'PATCH') {
      const { recordId, fields } = req.body || {};
      if (!recordId) return res.status(400).json({ error: 'Missing recordId' });
      if (!fields || typeof fields !== 'object') return res.status(400).json({ error: 'Missing fields' });
      const r = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}/${recordId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || 'Failed to update');
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { recordId } = req.body || {};
      if (!recordId) return res.status(400).json({ error: 'Missing recordId' });
      const r = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}/${recordId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || 'Failed to delete');
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
