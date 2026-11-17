// Everything the signed-in person's app needs, in one request.
//
// Replaces the old /api/airtable, which returned every field of every table
// to anyone. This one requires a personal-link token and returns only the
// fields in lib/visibility.js.

import { fetchTable, methodGuard } from '../../lib/airtable';
import { requirePerson } from '../../lib/identity';
import { VISIBLE_FIELDS, TABLE_FILTERS } from '../../lib/visibility';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodGuard(res, ['GET']);

  // Personal data: never cached by a CDN or shared between people.
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');

  const person = await requirePerson(req, res);
  if (!person) return;

  const results = {};
  const errors = {};

  // One failing table shouldn't blank the whole app; report it instead.
  await Promise.all(Object.entries(VISIBLE_FIELDS).map(async ([table, fields]) => {
    try {
      results[table] = await fetchTable(table, { fields, filterByFormula: TABLE_FILTERS[table] });
    } catch (e) {
      results[table] = [];
      errors[table] = e.message || 'Unknown Airtable error';
    }
  }));

  // Send only the venues the visible shows play at, and only the bands'
  // songs plus anything on a setlist. The tables hold hundreds of venues and
  // over a thousand songs; the rest of the song catalog loads from
  // /api/songs when someone opens it.
  const linked = (records, field) => new Set((records || []).flatMap(r => r.fields?.[field] || []));
  if (!errors.VENUES && !errors.SHOWS) {
    const used = linked(results.SHOWS, 'Venue');
    results.VENUES = results.VENUES.filter(v => used.has(v.id));
  }
  if (!errors.SONGS && !errors.SETLISTS) {
    const used = linked(results.SETLISTS, 'Songs');
    results.SONGS = results.SONGS.filter(s => used.has(s.id) || (s.fields?.['Performed By'] || []).length);
    const kept = new Set(results.SONGS.map(s => s.id));
    // Everyone's answers for those songs, and all of your own answers, so
    // "My status" works on catalog songs you've marked too.
    if (!errors['SONG KNOWLEDGE']) {
      results['SONG KNOWLEDGE'] = results['SONG KNOWLEDGE'].filter(k =>
        (k.fields?.Song || []).some(id => kept.has(id)) || (k.fields?.Member || []).includes(person.id));
    }
  }

  if (Object.keys(errors).length) results.errors = errors;
  results.me = person;
  return res.status(200).json(results);
}
