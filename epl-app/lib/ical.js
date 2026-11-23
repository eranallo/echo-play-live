// A person's shows and practices as an iCalendar (.ics) feed.
//
// Calendar apps subscribe to /api/calendar/<token>.ics and read it again
// every so often, so the events follow Airtable without anyone re-adding
// them. Shows run from the first call time to the end of the set; times are
// stored in UTC, and the call-time list in each event is written in Texas
// time, where EPL plays.

import { myShows, isMyPractice, isCancelled, ids } from './derive';

const TZ = 'America/Chicago';
const HOUR = 3600 * 1000;
const KEEP_PAST_DAYS = 60;

const pad = (n) => String(n).padStart(2, '0');
const utc = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const dayOnly = (ds) => ds.replace(/-/g, '');
const dayAfter = (ds) => { const d = new Date(`${ds}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const clock = (iso) => new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const valid = (iso) => !!iso && !Number.isNaN(new Date(iso).getTime());

// Text values escape \ ; , and newlines (RFC 5545 §3.3.11).
const text = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Lines over 75 bytes continue on the next line after a space (§3.1).
function fold(line) {
  const parts = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > (parts.length ? 74 : 75)) { parts.push(cur); cur = ''; bytes = 0; }
    cur += ch;
    bytes += b;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

// A timed event, or an all-day one on `date` when there are no times.
function when(start, end, date) {
  if (start) {
    const stop = end && end > start ? end : new Date(start.getTime() + 4 * HOUR);
    return [`DTSTART:${utc(start)}`, `DTEND:${utc(stop)}`];
  }
  return [`DTSTART;VALUE=DATE:${dayOnly(date)}`, `DTEND;VALUE=DATE:${dayOnly(dayAfter(date))}`];
}

function showEvent(show, idx) {
  const f = show.fields;
  const band = idx.get('BANDS', ids(f['Band'])[0])?.fields['Band Name'] || f['Show Name'] || 'Show';
  const venue = idx.get('VENUES', ids(f['Venue'])[0])?.fields || {};
  const calls = [
    ['Trailer load-in', f['Trailer Load-In Time']], ['Load in', f['Load-In Time']],
    ['Soundcheck', f['Sound Check Time']], ['Doors', f['Doors Time']],
    ['Set', f['Start Time']], ['End', f['End Time']],
  ].filter(([, t]) => valid(t));
  const starts = calls.filter(([label]) => label !== 'End').map(([, t]) => new Date(t).getTime());
  const start = starts.length ? new Date(Math.min(...starts)) : null;
  const end = valid(f['End Time']) ? new Date(f['End Time'])
    : valid(f['Start Time']) ? new Date(new Date(f['Start Time']).getTime() + 3 * HOUR) : null;
  const setNames = idx.all('SETLISTS', f['SETLISTS']).map(s => s.fields['Set Name']).filter(Boolean);
  const description = [
    ...calls.map(([label, t]) => `${label}: ${clock(t)}`),
    setNames.length && `Setlist: ${setNames.join(', ')}`,
    venue['Parking Notes'] && `Parking: ${venue['Parking Notes']}`,
    f['Show Notes'],
    'Details, lineup and setlist are in the Echo Play Live app.',
  ].filter(Boolean).join('\n');
  return {
    uid: show.id,
    summary: venue['Venue Name'] ? `${band} @ ${venue['Venue Name']}` : band,
    when: when(start, end, f['Date']),
    location: [venue['Venue Name'], venue['Address'] || [venue['City'], venue['State']].filter(Boolean).join(', ')].filter(Boolean).join(', '),
    description,
    status: 'CONFIRMED',
  };
}

function practiceEvent(p, idx) {
  const f = p.fields;
  const band = idx.get('BANDS', ids(f['Band'])[0])?.fields['Band Name'];
  const cancelled = isCancelled(p);
  const start = valid(f['Start Time']) ? new Date(f['Start Time']) : null;
  const end = valid(f['End Time']) ? new Date(f['End Time']) : start ? new Date(start.getTime() + 2 * HOUR) : null;
  const setNames = idx.all('SETLISTS', f['Setlist']).map(s => s.fields['Set Name']).filter(Boolean);
  return {
    uid: p.id,
    summary: `${cancelled ? 'Called off: ' : ''}Practice${band ? ` · ${band}` : ''}`,
    when: when(start, end, f['Date']),
    location: f['Location'] || '',
    description: [setNames.length && `Run: ${setNames.join(', ')}`, f['Notes']].filter(Boolean).join('\n'),
    status: cancelled ? 'CANCELLED' : 'CONFIRMED',
  };
}

/** The feed for one person: their shows, and for members their practices. */
export function buildCalendar({ data, idx, me, record }) {
  const since = new Date(Date.now() - KEEP_PAST_DAYS * 24 * HOUR).toISOString().slice(0, 10);
  const events = [
    ...myShows(data, me).filter(s => s.fields['Date'] >= since).map(s => showEvent(s, idx)),
    ...(data['PRACTICES'] || [])
      .filter(p => p.fields['Date'] && p.fields['Date'] >= since && isMyPractice(p, me, record))
      .map(p => practiceEvent(p, idx)),
  ];
  const stamp = utc(new Date());
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Echo Play Live//Member App//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Echo Play Live', `X-WR-TIMEZONE:${TZ}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
  ];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT', `UID:${e.uid}@echoplaylive`, `DTSTAMP:${stamp}`, ...e.when,
      `SUMMARY:${text(e.summary)}`,
      ...(e.location ? [`LOCATION:${text(e.location)}`] : []),
      ...(e.description ? [`DESCRIPTION:${text(e.description)}`] : []),
      `STATUS:${e.status}`, 'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
