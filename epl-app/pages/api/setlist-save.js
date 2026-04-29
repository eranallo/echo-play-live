const TOKEN = process.env.AIRTABLE_TOKEN
const BASE = process.env.AIRTABLE_BASE

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { recordId, setName, bandId, showId, songIds, builderData, setLength } = req.body

  const fields = {}
  if (setName) fields['Set Name'] = setName
  if (bandId) fields['Band'] = [bandId]
  if (showId) fields['Show'] = [showId]
  if (songIds) fields['Songs'] = songIds
  if (setLength !== undefined) fields['Set Length'] = setLength
  if (builderData) fields['Notes'] = '%%BUILDER%%' + JSON.stringify(builderData)

  try {
    let r
    if (recordId) {
      // UPDATE existing
      r = await fetch(`https://api.airtable.com/v0/${BASE}/SETLISTS/${recordId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      })
    } else {
      // CREATE new
      r = await fetch(`https://api.airtable.com/v0/${BASE}/SETLISTS`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      })
    }
    const data = await r.json()
    if (!r.ok) return res.status(400).json(data)
    return res.json({ success: true, id: data.id })
  } catch(e) {
    return res.status(500).json({ error: e.message })
  }
}
