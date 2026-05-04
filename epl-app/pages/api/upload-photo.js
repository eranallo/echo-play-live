import { put } from '@vercel/blob'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb',
    },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { recordType, recordId, base64, photoField = 'Photo' } = req.body || {}

  if (!recordType || !recordId || !base64) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  if (recordType !== 'MEMBERS' && recordType !== 'CREW') {
    return res.status(400).json({ error: 'Invalid recordType' })
  }

  try {
    // Strip the data URL prefix if present, e.g. "data:image/jpeg;base64,..."
    const match = base64.match(/^data:([\w.\-+]+\/[\w.\-+]+);base64,(.+)$/)
    let mime = 'image/jpeg'
    let b64 = base64
    if (match) {
      mime = match[1]
      b64 = match[2]
    }

    const buffer = Buffer.from(b64, 'base64')
    const ext = mime.split('/')[1] || 'jpg'
    const path = `profiles/${recordType}/${recordId}-${Date.now()}.${ext}`

    const blob = await put(path, buffer, {
      access: 'public',
      contentType: mime,
      addRandomSuffix: false,
    })

    // Map record type to Airtable table
    const table = recordType === 'MEMBERS' ? 'MEMBERS' : 'CREW'

    // PATCH the Airtable record's Photo field
    const apiKey = process.env.AIRTABLE_API_KEY
    const baseId = process.env.AIRTABLE_BASE_ID

    if (!apiKey || !baseId) {
      return res.status(500).json({ error: 'Airtable env vars not configured' })
    }

    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}/${recordId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            [photoField]: [{ url: blob.url }],
          },
        }),
      }
    )

    if (!airtableRes.ok) {
      const errText = await airtableRes.text()
      return res.status(airtableRes.status).json({
        error: `Airtable update failed: ${errText}`,
        blobUrl: blob.url,
      })
    }

    return res.status(200).json({ url: blob.url })
  } catch (e) {
    console.error('Upload error:', e)
    return res.status(500).json({ error: e.message || 'Upload failed' })
  }
}
