// Formatting helpers shared by every screen. Dates from Airtable are plain
// "YYYY-MM-DD" strings; they are read as local midnight, never as UTC, or a
// Friday show turns into Thursday evening west of London.

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function parseDate(ds) {
  return new Date(ds + 'T00:00:00')
}

export function toDateStr(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function todayStr() {
  return toDateStr(new Date())
}

export function addDays(ds, n) {
  const d = parseDate(ds)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

// Whole days from today. Math.round, not ceil: a span that crosses the
// November clock change contains a 25-hour day.
export function daysUntil(ds) {
  if (!ds) return null
  return Math.round((parseDate(ds) - parseDate(todayStr())) / 86400000)
}

export function countdown(ds) {
  const d = daysUntil(ds)
  if (d == null) return ''
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  if (d === -1) return 'Yesterday'
  return d > 0 ? `In ${d} days` : `${-d} days ago`
}

export function fmtDate(ds, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  if (!ds) return '—'
  try { return parseDate(ds).toLocaleDateString('en-US', opts) } catch { return ds }
}
export const fmtLong = (ds) => fmtDate(ds, { weekday: 'long', month: 'long', day: 'numeric' })
export const fmtFull = (ds) => fmtDate(ds, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

// Airtable dateTime fields arrive as ISO strings; plain "HH:MM" is also handled.
export function fmtTime(t) {
  if (!t) return ''
  let h, min
  if (t.includes('T')) {
    const d = new Date(t)
    if (isNaN(d)) return ''
    h = d.getHours(); min = d.getMinutes()
  } else {
    const m = t.match(/^(\d{1,2}):(\d{2})/)
    if (!m) return t
    h = parseInt(m[1], 10); min = parseInt(m[2], 10)
  }
  const ap = h >= 12 ? 'pm' : 'am'
  if (h > 12) h -= 12
  if (h === 0) h = 12
  return min === 0 ? `${h}${ap}` : `${h}:${String(min).padStart(2, '0')}${ap}`
}

export function initials(name) {
  return (name || '?').split(' ').filter(Boolean).map(x => x[0]).join('').toUpperCase().slice(0, 2)
}
export function firstName(name) {
  return (name || '').split(' ')[0] || name || ''
}

// First image URL from an Airtable attachment field, or null.
export function attachmentUrl(fields, field) {
  const a = fields?.[field]
  return Array.isArray(a) && a[0] ? a[0].url : null
}
// MEMBERS keeps its portrait in "Profile Photo"; CREW in "Photo".
export const memberPhoto = (fields) => attachmentUrl(fields, 'Profile Photo')

// Airtable duration fields arrive as seconds (225 → "3:45").
export function fmtDur(sec) {
  const n = Number(sec)
  if (sec == null || sec === '' || !isFinite(n)) return ''
  return `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, '0')}`
}
// A setlist's total length, from the SETLISTS "Duration" rollup (seconds).
export function fmtSetLength(sec) {
  const mins = Math.round(Number(sec) / 60)
  if (!mins) return null
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`
}
// The retired Setlist Builder stored JSON in Notes behind this marker.
export function setlistNotes(notes) {
  return notes && !String(notes).startsWith('%%BUILDER%%') ? notes : null
}

export const telHref = (p) => 'tel:' + String(p).replace(/[^\d+]/g, '')
export const smsHref = (p) => 'sms:' + String(p).replace(/[^\d+]/g, '')
export const mapsHref = (addr) => 'https://maps.apple.com/?q=' + encodeURIComponent(addr)
export const googleMapsHref = (addr) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr)

export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`
