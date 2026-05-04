// API route for blackout dates: POST (create), PATCH (update), DELETE (remove)
const AIRTABLE_BASE = 'appYUOoJgvRyZ7fLB'
const AIRTABLE_TABLE = 'BLACKOUT DATES'

export default async function handler(req, res) {
  const apiKey = process.env.AIRTABLE_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'AIRTABLE_API_KEY not configured' })
  }

  const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}`
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
