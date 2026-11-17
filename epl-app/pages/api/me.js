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

  // Send only the venues the visible shows play at and the songs on the
  // setlists. The tables hold hundreds of venues and over a thousand songs;
  // a phone needs a few dozen of each.
  const linked = (records, field) => new Set((records || []).flatMap(r => r.fields?.[field] || []));
  if (!errors.VENUES && !errors.SHOWS) {
    const used = linked(results.SHOWS, 'Venue');
    results.VENUES = results.VENUES.filter(v => used.has(v.id));
  }
  if (!errors.SONGS && !errors.SETLISTS) {
    const used = linked(results.SETLISTS, 'Songs');
    results.SONGS = results.SONGS.filter(s => used.has(s.id));
    if (!errors['SONG KNOWLEDGE']) {
      results['SONG KNOWLEDGE'] = results['SONG KNOWLEDGE'].filter(k => (k.fields?.Song || []).some(id => used.has(id)));
    }
  }

  if (Object.keys(errors).length) results.errors = errors;
  results.me = person;
  return res.status(200).json(results);
}
