// Upload your own profile photo straight into Airtable.
//
// The photo goes to Airtable's upload endpoint, so there is no copy sitting at
// a permanent public address (the old route went through Vercel Blob, whose
// store is private, which broke uploads). Airtable adds the upload to the
// field, so the old photo is then removed and only the new one is kept.
//
// Who you are comes from your personal-link token, so a request can only
// ever change its own sender's photo.

import { airtableRaw, uploadAttachment, methodGuard } from '../../lib/airtable';
import { requirePerson } from '../../lib/identity';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
};

// MEMBERS calls it "Profile Photo"; CREW calls it "Photo".
const TARGET = {
  member: { table: 'MEMBERS', field: 'Profile Photo' },
  crew: { table: 'CREW', field: 'Photo' },
};

const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };
const MAX_BYTES = 5 * 1024 * 1024; // Airtable's limit for direct uploads

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
  const contentType = match ? match[1] : 'image/jpeg';
  const data = match ? match[2] : base64;
  const ext = MIME_EXT[contentType];
  if (!ext) return res.status(400).json({ error: 'Please choose a JPG, PNG, WebP or HEIC photo' });
  if (Math.floor(data.length * 3 / 4) > MAX_BYTES) {
    return res.status(413).json({ error: 'That photo is too large (5 MB max)' });
  }

  const { table, field } = TARGET[person.type];
  const filename = `profile-${Date.now()}.${ext}`;

  try {
    const up = await uploadAttachment(person.id, field, { contentType, base64: data, filename });
    if (!up.ok) {
      console.error('Airtable upload failed:', up.status, up.error);
      return res.status(up.status >= 400 && up.status < 600 ? up.status : 502).json({ error: 'Airtable did not accept the photo' });
    }

    // Keep only the photo just uploaded, so it becomes the face on lineups.
    const added = up.attachments.find(a => a.filename === filename) || up.attachments[up.attachments.length - 1];
    if (!added) return res.status(502).json({ error: 'Airtable did not return the photo' });
    if (up.attachments.length > 1) {
      const trim = await airtableRaw(`${table}/${person.id}`, {
        method: 'PATCH',
        body: { fields: { [field]: [{ id: added.id }] } },
      });
      if (!trim.ok) {
        console.error('Could not remove the old photo:', trim.status, trim.data);
        return res.status(502).json({ error: 'Saved, but the old photo is still first. Try again.' });
      }
    }
    return res.status(200).json({ url: added.url });
  } catch (e) {
    console.error('Upload error:', e);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
