// Your answer for a song: Know it, Learning, To learn, or cleared.
//
// One SONG KNOWLEDGE row per member per song. Who you are comes from your
// personal-link token, so a request can only ever set its own sender's
// answer. The row is found by its Key ("<member id>:<song id>"), which the
// app writes, so the lookup is one exact match instead of a table scan.

import { airtableRaw, fetchTable, methodGuard } from '../../lib/airtable';
import { requirePerson } from '../../lib/identity';

const TABLE = 'SONG KNOWLEDGE';
const STATUSES = ['Know it', 'Learning', 'To learn'];
const RECORD_RE = /^rec[A-Za-z0-9]{14}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodGuard(res, ['POST']);

  const person = await requirePerson(req, res);
  if (!person) return;
  if (person.type !== 'member') {
    return res.status(403).json({ error: 'Song answers are for band members' });
  }

  const { songId, status } = req.body || {};
  if (typeof songId !== 'string' || !RECORD_RE.test(songId)) {
    return res.status(400).json({ error: 'songId required' });
  }
  if (status != null && !STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Unknown status' });
  }

  // Both ids are checked against RECORD_RE above, so they are safe inside
  // the formula's quotes.
  const key = `${person.id}:${songId}`;

  try {
    const existing = await fetchTable(TABLE, { fields: ['Key'], filterByFormula: `{Key} = '${key}'` });
    const mine = existing.filter(r => r.fields.Key === key);

    // Cleared: remove any row (and any accidental duplicates).
    if (status == null) {
      for (const r of mine) await airtableRaw(`${TABLE}/${r.id}`, { method: 'DELETE' });
      return res.status(200).json({ songId, status: null });
    }

    if (mine.length) {
      const { ok, status: code, data } = await airtableRaw(`${TABLE}/${mine[0].id}`, {
        method: 'PATCH',
        body: { fields: { Status: status } },
      });
      if (!ok) return res.status(code).json({ error: data?.error?.message || 'Could not save' });
      for (const extra of mine.slice(1)) await airtableRaw(`${TABLE}/${extra.id}`, { method: 'DELETE' });
      return res.status(200).json({ id: data.id, songId, status });
    }

    // Look up the song's title so the row reads well in Airtable.
    const song = await airtableRaw(`SONGS/${songId}`, { method: 'GET' });
    if (!song.ok) return res.status(404).json({ error: 'Song not found' });
    const entry = `${person.name} — ${song.data?.fields?.['Song Title'] || 'Song'}`;

    const { ok, status: code, data } = await airtableRaw(TABLE, {
      method: 'POST',
      body: { fields: { Entry: entry, Member: [person.id], Song: [songId], Status: status, Key: key } },
    });
    if (!ok) return res.status(code).json({ error: data?.error?.message || 'Could not save' });
    return res.status(200).json({ id: data.id, songId, status });
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message || 'Server error' });
  }
}
