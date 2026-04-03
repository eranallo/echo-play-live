const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE = process.env.AIRTABLE_BASE;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!TOKEN || !BASE) return res.status(500).json({ error: 'Missing credentials' });

  try {
    const r = await fetch(`https://api.airtable.com/v0/${BASE}/INQUIRIES`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: req.body }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || 'Failed to submit');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
