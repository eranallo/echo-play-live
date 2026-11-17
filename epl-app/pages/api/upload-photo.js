// Upload your own profile photo: stores it in Vercel Blob, then sets the
// photo field on your MEMBERS or CREW record.
//
// Who you are comes from your personal-link token, so a request can only
// ever change its own sender's photo.

import { put } from '@vercel/blob';
import { airtableRaw, methodGuard } from '../../lib/airtable';
import { requirePerson } from '../../lib/identity';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb',
    },
  },
};

// MEMBERS calls it "Profile Photo"; CREW calls it "Photo".
const TARGET = {
  member: { table: 'MEMBERS', field: 'Profile Photo' },
  crew: { table: 'CREW', field: 'Photo' },
};

const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodGuard(res, ['POST']);

  const person = await requirePerson(req, res);
  if (!person) return;

  const { base64 } = req.body || {};
  if (typeof base64 !== 'string' || !base64) {
    return res.status(400).json({ error: 'No image received' });
  }

  // Expect a data URL, e.g. "data:image/jpeg;base64,..."
  const match = base64.match(/^data:([\w.+-]+\/[\w.+-]+);base64,(.+)$/);
  const mime = match ? match[1] : 'image/jpeg';
  const ext = MIME_EXT[mime];
  if (!ext) return res.status(400).json({ error: 'Please choose a JPG, PNG, WebP or HEIC photo' });

  const { table, field } = TARGET[person.type];

  try {
    const buffer = Buffer.from(match ? match[2] : base64, 'base64');
    const blob = await put(`profiles/${table}/${person.id}-${Date.now()}.${ext}`, buffer, {
      access: 'public',
      contentType: mime,
      addRandomSuffix: true,
    });

    const { ok, status, data } = await airtableRaw(`${table}/${person.id}`, {
      method: 'PATCH',
      body: { fields: { [field]: [{ url: blob.url }] } },
    });

    if (!ok) {
      return res.status(status).json({
        error: `Saving the photo to Airtable failed: ${data?.error?.message || 'unknown error'}`,
      });
    }
    return res.status(200).json({ url: blob.url });
  } catch (e) {
    console.error('Upload error:', e);
    return res.status(500).json({ error: e.message || 'Upload failed' });
  }
}
