import { put } from '@vercel/blob'

const TOKEN = process.env.AIRTABLE_TOKEN
const BASE = process.env.AIRTABLE_BASE

export const config = {
  api: { bodyParser: { sizeLimit: '6mb' } }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!TOKEN || !BASE) return res.status(500).json({ error: 'Missing Airtable credentials' })

  try {
    const { recordType, recordId, base64, photoField } = req.body || {}

    if (!recordType || !recordId || !base64) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    if (!['MEMBERS', 'CREW'].includes(recordType)) {
      return res.status(400).json({ error: 'Invalid recordType' })
    }

    // Decode base64 data URL
    const matches = base64.match(/^data:(image\/[\w+]+);base64,(.+)$/)
    if (!matches) return res.status(400).json({ error: 'Invalid image data' })
    const mimeType = matches[1]
    const ext = (mimeType.split('/')[1] || 'jpg').split('+')[0]
    const buf = Buffer.from(matches[2], 'base64')

    // Upload to Vercel Blob
    const path = `profiles/${recordType.toLowerCase()}/${recordId}-${Date.now()}.${ext}`
    const blob = await put(path, buf, {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: false,
    })

    // PATCH Airtable record with new photo URL
    const field = photoField || 'Photo'
    const r = await fetch(`https://api.airtable.com/v0/${BASE}/${recordType}/${recordId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: { [field]: [{ url: blob.url }] }
      }),
    })

    const data = await r.json()
    if (!r.ok) {
      return res.status(500).json({ error: data.error?.message || 'Failed to update Airtable' })
    }

    return res.status(200).json({ url: blob.url, success: true })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Upload failed' })
  }
}
