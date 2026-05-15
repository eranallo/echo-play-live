// API route for blackout dates: POST (create), PATCH (update), DELETE (remove)
const AIRTABLE_TABLE = 'BLACKOUT DATES'

export default async function handler(req, res) {
  // Canonical env-var names used app-wide: AIRTABLE_TOKEN + AIRTABLE_BASE.
  // (Earlier versions of this file used AIRTABLE_API_KEY + a hardcoded base ID;
  // those names don't exist in the Vercel deployment.)
  const apiKey = process.env.AIRTABLE_TOKEN
  const base   = process.env.AIRTABLE_BASE
  if (!apiKey || !base) {
    return res.status(500).json({ error: 'AIRTABLE_TOKEN / AIRTABLE_BASE not configured' })
  }

  const baseUrl = `https://api.airtable.com/v0/${base}/${encodeURIComponent(AIRTABLE_TABLE)}`
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  try {
    if (req.method === 'POST') {
      const fields = req.body || {}
      const r = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fields }),
      })
      const json = await r.json()
      if (!r.ok) {
        return res.status(r.status).json({ error: json?.error?.message || 'Airtable error', detail: json })
      }
      return res.status(200).json({ id: json.id, fields: json.fields })
    }

    if (req.method === 'PATCH') {
      const { recordId, fields } = req.body || {}
      if (!recordId || !fields) {
        return res.status(400).json({ error: 'recordId and fields required' })
      }
      const r = await fetch(`${baseUrl}/${recordId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields }),
      })
      const json = await r.json()
      if (!r.ok) {
        return res.status(r.status).json({ error: json?.error?.message || 'Airtable error', detail: json })
      }
      return res.status(200).json({ id: json.id, fields: json.fields })
    }

    if (req.method === 'DELETE') {
      const { recordId } = req.body || {}
      if (!recordId) {
        return res.status(400).json({ error: 'recordId required' })
      }
      const r = await fetch(`${baseUrl}/${recordId}`, {
        method: 'DELETE',
        headers,
      })
      const json = await r.json()
      if (!r.ok) {
        return res.status(r.status).json({ error: json?.error?.message || 'Airtable error', detail: json })
      }
      return res.status(200).json({ deleted: true, id: recordId })
    }

    res.setHeader('Allow', 'POST, PATCH, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('Blackout API error:', e)
    return res.status(500).json({ error: e.message || 'Server error' })
  }
}
