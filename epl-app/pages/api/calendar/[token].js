// A person's calendar feed: /api/calendar/<token>.ics
//
// Calendar apps can't send the app's header, so the personal token is in
// the address, the same as the personal link; anyone with this address sees
// the same schedule. Clearing the token in Airtable stops the feed too.

import { methodGuard } from '../../../lib/airtable';
import { findPersonByToken } from '../../../lib/identity';
import { loadTables } from '../../../lib/data';
import { indexData } from '../../../lib/derive';
import { buildCalendar } from '../../../lib/ical';

const TABLES = ['SHOWS', 'VENUES', 'BANDS', 'PRACTICES', 'SETLISTS', 'MEMBERS', 'CREW'];

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return methodGuard(res, ['GET']);
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');

  const token = String(req.query.token || '').replace(/\.ics$/i, '');
  let person;
  try {
    person = await findPersonByToken(token);
  } catch {
    return res.status(503).send('Echo Play Live is busy. Try again shortly.');
  }
  if (!person) return res.status(404).send('Not found');

  // An empty or partial feed would make calendar apps delete events, so if
  // any table fails, answer with an error and let them keep the last copy.
  const { results, errors } = await loadTables(TABLES);
  if (Object.keys(errors).length) return res.status(503).send('Echo Play Live is busy. Try again shortly.');

  const idx = indexData(results);
  const me = { type: person.type, id: person.id };
  const record = idx.get(person.type === 'member' ? 'MEMBERS' : 'CREW', person.id);
  const ics = buildCalendar({ data: results, idx, me, record });

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="echo-play-live.ics"');
  return res.status(200).send(ics);
}
