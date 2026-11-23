// The parts of the song library that don't come with the first load.
//
//   GET /api/songs?scope=catalog  Every song in SONGS (about 1,200), with the
//                                 same fields /api/me sends, plus everyone's
//                                 answers for them. Loaded only when someone
//                                 opens the full catalog.
//   GET /api/songs?id=recXXX      One song's lyrics, loaded when its page
//                                 opens, so long lyrics never ride along on
//                                 every load.

import { fetchTable, methodGuard } from '../../lib/airtable';
import { cached } from '../../lib/cache';
import { requirePerson } from '../../lib/identity';
import { VISIBLE_FIELDS, SONG_DETAIL_FIELDS } from '../../lib/visibility';

const RECORD_RE = /^rec[A-Za-z0-9]{14}$/;

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodGuard(res, ['GET']);
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');

  const person = await requirePerson(req, res);
  if (!person) return;

  const { scope, id } = req.query;
  try {
    if (id !== undefined) {
      // Checked against RECORD_RE, so it is safe inside the formula's quotes.
      if (typeof id !== 'string' || !RECORD_RE.test(id)) return res.status(400).json({ error: 'Bad song id' });
      const [song] = await fetchTable('SONGS', { fields: SONG_DETAIL_FIELDS, filterByFormula: `RECORD_ID() = '${id}'` });
      if (!song) return res.status(404).json({ error: 'Song not found' });
      const fields = Object.fromEntries(SONG_DETAIL_FIELDS.filter(f => song.fields?.[f] != null).map(f => [f, song.fields[f]]));
      return res.status(200).json({ id: song.id, fields });
    }

    if (scope === 'catalog') {
      // The whole catalog is the same for everyone; keep it for a minute.
      const [songs, knowledge] = await Promise.all([
        cached('catalog:songs', 60 * 1000, () => fetchTable('SONGS', { fields: VISIBLE_FIELDS.SONGS })),
        fetchTable('SONG KNOWLEDGE', { fields: VISIBLE_FIELDS['SONG KNOWLEDGE'] }),
      ]);
      return res.status(200).json({ SONGS: songs, 'SONG KNOWLEDGE': knowledge });
    }

    return res.status(400).json({ error: 'Ask for scope=catalog or a song id' });
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message || 'Server error' });
  }
}
