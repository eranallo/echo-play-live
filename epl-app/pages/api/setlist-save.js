const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const AIRTABLE_BASE = process.env.AIRTABLE_BASE

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { setName, bandId, showId, songIds, builderData, setLength } = req.body
  try {
    const fields = { 'Set Name': setName }
    if (bandId) fields['Band'] = [bandId]
    if (showId) fields['Show'] = [showId]
    if (songIds && songIds.length) fields['Songs'] = songIds
    if (setLength) fields['Set Length'] = setLength
    if (builderData) fields['Notes'] = '%%BUILDER%%' + JSON.stringify(builderData)

    const r = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/SETLISTS`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    })
    const data = await r.json()
    if (data.error) return res.status(400).json(data)
    res.json({ success: true, id: data.id })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
}
