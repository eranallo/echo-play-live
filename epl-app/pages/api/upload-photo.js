// Upload a profile photo: stores in Vercel Blob, then PATCHes the Airtable
// record's Photo field with the blob URL.
//
// Phase 03: routes the Airtable PATCH through lib/airtable.js. Vercel Blob
// upload still uses @vercel/blob directly.

import { put } from '@vercel/blob';
import { airtableRaw, TOKEN, BASE } from '../../lib/airtable';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { recordType, recordId, base64, photoField = 'Photo' } = req.body || {};

  if (!recordType || !recordId || !base64) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (recordType !== 'MEMBERS' && recordType !== 'CREW') {
    return res.status(400).json({ error: 'Invalid recordType' });
  }
  if (!TOKEN || !BASE) {
    return res.status(500).json({ error: 'AIRTABLE_TOKEN / AIRTABLE_BASE not configured' });
  }

  try {
    // Strip the data URL prefix if present, e.g. "data:image/jpeg;base64,..."
    const match = base64.match(/^data:([\w.\-+]+\/[\w.\-+]+);base64,(.+)$/);
    let mime = 'image/jpeg';
    let b64 = base64;
    if (match) {
      mime = match[1];
      b64 = match[2];
    }

    const buffer = Buffer.from(b64, 'base64');
    const ext = mime.split('/')[1] || 'jpg';
    const path = `profiles/${recordType}/${recordId}-${Date.now()}.${ext}`;

    const blob = await put(path, buffer, {
      access: 'public',
      contentType: mime,
      addRandomSuffix: false,
    });

    // PATCH the Airtable record's Photo field via the shared lib.
    const table = recordType === 'MEMBERS' ? 'MEMBERS' : 'CREW';
    const { ok, status, data } = await airtableRaw(`${table}/${recordId}`, {
      method: 'PATCH',
      body: {
        fields: {
          [photoField]: [{ url: blob.url }],
        },
      },
    });

    if (!ok) {
      return res.status(status).json({
        error: `Airtable update failed: ${data?.error?.message || 'unknown'}`,
        blobUrl: blob.url,   // surface the blob URL so the client can retry the PATCH later
        detail: data,
      });
    }

    return res.status(200).json({ url: blob.url });
  } catch (e) {
    console.error('Upload error:', e);
    return res.status(500).json({ error: e.message || 'Upload failed' });
  }
}
