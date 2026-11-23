// Questions the screens ask of the data /api/me returns: whose show is this,
// what is coming up for me, who is out on a date. Kept apart from the screens
// so Home, Calendar and the show page all answer them the same way.

import { todayStr, parseDate, toDateStr } from './format'

export const ids = (v) => (Array.isArray(v) ? v : v ? [v] : [])

// Lookup tables by record id, built once per data load.
export function indexData(data) {
  const byId = {}
  for (const [table, recs] of Object.entries(data)) {
    if (Array.isArray(recs)) byId[table] = new Map(recs.map(r => [r.id, r]))
  }
  const get = (table, id) => byId[table]?.get(id) || null
  const all = (table, v) => ids(v).map(id => get(table, id)).filter(Boolean)
  return { get, all }
}

// Bands are listed only while their Active box is ticked in Airtable.
export const isActiveBand = (band) => !!band?.fields?.['Active']

export function activeBands(data) {
  return (data['BANDS'] || []).filter(isActiveBand)
    .slice().sort((a, b) => (a.fields['Band Name'] || '').localeCompare(b.fields['Band Name'] || ''))
}

// What a member plays in a band: the "Role - <band>" field, falling back to
// their general instruments when that band has no role set for them.
export function roleInBand(member, bandName) {
  const role = bandName ? member?.fields?.[`Role - ${bandName}`] : null
  return role || (member?.fields?.['Instruments'] || []).join(', ')
}

// A member's active bands, each with what they play in it.
export function memberBands(member, idx) {
  return idx.all('BANDS', member.fields['Primary Bands'])
    .filter(isActiveBand)
    .map(b => ({ band: b, name: b.fields['Band Name'], role: roleInBand(member, b.fields['Band Name']) }))
}

// "me" is { type: 'member' | 'crew', id } from the server.
export function isOnShow(show, me) {
  const f = show.fields
  if (me.type === 'member') return ids(f['Members Playing']).includes(me.id)
  return ids(f['Sound Engineer']).includes(me.id) || ids(f['Merch Person']).includes(me.id)
}

// What this person does on a show, in a word or two. For a member that is
// their role in the show's band (bass in one band, guitar in another).
export function roleOnShow(show, me, record, idx) {
  const f = show.fields
  if (me.type === 'crew') {
    const jobs = []
    if (ids(f['Sound Engineer']).includes(me.id)) jobs.push('Sound')
    if (ids(f['Merch Person']).includes(me.id)) jobs.push('Merch')
    return jobs.join(' & ')
  }
  const band = idx ? idx.all('BANDS', f['Band'])[0] : null
  return roleInBand(record, band?.fields?.['Band Name'])
}

// A member's next upcoming show, for their card.
export function nextShowFor(data, person, type) {
  const today = todayStr()
  return sortedShows(data).find(s => s.fields['Date'] >= today && isOnShow(s, { type, id: person.id })) || null
}

const byDate = (a, b) => (a.fields['Date'] || '').localeCompare(b.fields['Date'] || '')

export function sortedShows(data) {
  return (data['SHOWS'] || []).filter(s => s.fields['Date']).slice().sort(byDate)
}

export function upcoming(shows, today = todayStr()) {
  return shows.filter(s => s.fields['Date'] >= today)
}

export function myShows(data, me) {
  return sortedShows(data).filter(s => isOnShow(s, me))
}

// Blackout records belonging to this person.
export function myBlackouts(data, me) {
  const link = me.type === 'member' ? 'Member' : 'Crew'
  return (data['BLACKOUT DATES'] || [])
    .filter(b => ids(b.fields[link]).includes(me.id))
    .slice()
    .sort((a, b) => (a.fields['Date'] || '').localeCompare(b.fields['Date'] || ''))
}

export function blackoutCovers(b, ds) {
  const start = b.fields['Date']
  const end = b.fields['End Date'] || start
  return !!start && start <= ds && ds <= end
}

// Every date a set of blackouts touches → the records touching it.
export function blackoutsByDate(list) {
  const map = {}
  for (const b of list) {
    const start = b.fields['Date']
    if (!start) continue
    const end = b.fields['End Date'] || start
    const cur = parseDate(start)
    const last = parseDate(end)
    for (let n = 0; cur <= last && n < 400; n++) {
      const ds = toDateStr(cur)
      ;(map[ds] = map[ds] || []).push(b)
      cur.setDate(cur.getDate() + 1)
    }
  }
  return map
}

export function showsByDate(shows) {
  const map = {}
  for (const s of shows) (map[s.fields['Date']] = map[s.fields['Date']] || []).push(s)
  return map
}

// The people a blackout record covers, as display rows.
export function blackoutPeople(b, idx) {
  const members = idx.all('MEMBERS', b.fields['Member']).map(m => ({ record: m, type: 'member', name: m.fields['Member Name'] || '?' }))
  const crew = idx.all('CREW', b.fields['Crew']).map(c => ({ record: c, type: 'crew', name: c.fields['Name'] || '?' }))
  return [...members, ...crew]
}

// Things that need this person's attention, most urgent first.
export function needsYou(data, me, record) {
  const items = []
  const today = todayStr()
  const mine = myBlackouts(data, me)
  for (const show of upcoming(myShows(data, me), today)) {
    const clash = mine.find(b => blackoutCovers(b, show.fields['Date']))
    if (clash) items.push({ kind: 'conflict', key: 'c-' + show.id, show, blackout: clash })
  }
  const photoField = me.type === 'member' ? 'Profile Photo' : 'Photo'
  if (!(record?.fields?.[photoField] || []).length) items.push({ kind: 'photo', key: 'photo' })
  return items
}

// Setlists attached to a show, first one first.
export function setlistsForShow(show, idx) {
  return idx.all('SETLISTS', show.fields['SETLISTS'])
}

// Tunings are stored as their string notes, low to high ("D.A.D.G.B.E").
// These turn them into the names players use: Standard, Eb standard,
// Drop D, and for 7- and 8-string guitars "Drop E · 8-string". Anything
// else is shown as its notes.
const SEMITONE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 }

// Semitones between neighbouring strings in standard tuning: fourths, plus
// the major third between the G and B strings on a guitar (6+ strings).
// Basses (4-5 strings) are all fourths. Drop: the lowest string a whole
// step further down.
const standardSteps = (strings) => Array.from({ length: strings - 1 }, (_, i) => (strings >= 6 && i === strings - 3 ? 4 : 5))

function readTuning(value) {
  const notes = String(value || '').split('.').map(n => n.trim()).filter(Boolean)
  const semis = notes.map(n => SEMITONE[n])
  if (notes.length < 2 || semis.some(n => n == null)) return { notes, kind: null }
  const steps = semis.slice(1).map((n, i) => (n - semis[i] + 12) % 12)
  const std = standardSteps(notes.length)
  const same = (pattern) => steps.every((n, i) => n === pattern[i])
  const kind = same(std) ? 'standard' : same([7, ...std.slice(1)]) ? 'drop' : null
  return { notes, kind }
}

export function tuningName(value) {
  if (!value) return null
  const { notes, kind } = readTuning(value)
  if (!kind) return notes.join(' ') || null
  const low = notes[0]
  const base = kind === 'drop' ? `Drop ${low}` : low === 'E' ? 'Standard' : `${low} standard`
  return notes.length > 6 ? `${base} · ${notes.length}-string` : base
}

// A colour per tuning so they stand out in lists: standard tunings in cool
// colours, drop tunings in warm ones. The colours are in styles/globals.css.
const TUNING_COLOR = {
  'Standard': 'blue', 'Eb standard': 'violet', 'D standard': 'teal', 'C standard': 'slate',
  'Drop D': 'orange', 'Drop Db': 'red', 'Drop C': 'magenta', 'Drop B': 'brown',
  'Drop F# · 7-string': 'gold', 'Drop E · 8-string': 'wine',
}
export const tuningColor = (value) => TUNING_COLOR[tuningName(value)] || 'gray'

// Order tunings from E standard down, standard before drop on the same note.
export function compareTunings(a, b) {
  const depth = (v) => {
    const { notes } = readTuning(v)
    const n = SEMITONE[notes[0]]
    if (n == null) return -99
    const d = n <= 4 ? n : n - 12 // E2 and below
    return notes.length >= 8 && d > -6 ? d - 12 : d // 8-strings sit an octave lower
  }
  const drop = (v) => (readTuning(v).kind === 'drop' ? 1 : 0)
  return depth(b) - depth(a) || drop(a) - drop(b) || String(a).localeCompare(String(b))
}

// A setlist in the running order built in Airtable's setlist editor:
// SETLIST ITEMS sorted by Set Number, then Position. Break, Transition and
// Announcement cues stay where they were placed, and a Set Break starts the
// next set. Only songs still linked in SETLISTS "Songs" are shown (the
// editor keeps a song's row when it's unlinked); linked songs with no row
// yet are returned as `unplaced`. A setlist never arranged in the editor
// runs in the order of its Songs field.
//
// Returns { sets: [{ number, songs, seconds, entries }], unplaced, songs,
// seconds }. Entries are { kind: 'tuning', value, count } whenever the
// guitar tuning changes, { kind: 'song', song, n, seconds } and
// { kind: 'cue', type, label, seconds }.
export function setlistLayout(sl, data, idx) {
  const linked = ids(sl.fields['Songs'])
  const linkedSet = new Set(linked)
  const typeOf = (it) => it.fields['Item Type'] || (ids(it.fields['Song']).length ? 'Song' : 'Break')
  const order = (it) => (it.fields['Position'] == null ? Infinity : Number(it.fields['Position']))
  const items = (data['SETLIST ITEMS'] || [])
    .filter(it => ids(it.fields['Setlist']).includes(sl.id))
    .filter(it => typeOf(it) !== 'Song' || ids(it.fields['Song']).some(id => linkedSet.has(id)))
    .sort((a, b) => (a.fields['Set Number'] || 1) - (b.fields['Set Number'] || 1) || order(a) - order(b))
  const arranged = items.some(it => typeOf(it) === 'Song')

  const sets = []
  let set = null
  let block = null
  const startSet = (number) => { set = { number, songs: 0, seconds: 0, entries: [] }; sets.push(set); block = null }
  const addSong = (song, seconds, key) => {
    const tuning = song.fields['Guitar Tuning'] || ''
    if (!block || block.value !== tuning) { block = { kind: 'tuning', value: tuning, count: 0, key: 't-' + key }; set.entries.push(block) }
    block.count++
    set.songs++
    set.seconds += Number(seconds) || 0
    set.entries.push({ kind: 'song', song, n: set.songs, seconds, key })
  }

  const placed = new Set()
  if (arranged) {
    let breakPending = false
    for (const it of items) {
      const type = typeOf(it)
      const number = it.fields['Set Number'] || 1
      if (type === 'Set Break') { if (set) breakPending = true; continue }
      if (!set) startSet(number)
      else if (breakPending || number !== set.number) startSet(Math.max(number, breakPending ? set.number + 1 : number))
      breakPending = false
      if (type === 'Song') {
        const songId = ids(it.fields['Song']).find(id => linkedSet.has(id))
        const song = idx.get('SONGS', songId)
        if (!song) continue
        placed.add(songId)
        addSong(song, it.fields['Duration'] ?? song.fields['Duration'], it.id)
      } else {
        const seconds = it.fields['Cue Duration'] ?? it.fields['Duration']
        set.entries.push({ kind: 'cue', type, label: it.fields['Cue Text'] || it.fields['Item'] || type, seconds, key: it.id })
        set.seconds += Number(seconds) || 0
      }
    }
  } else if (linked.length) {
    startSet(1)
    linked.forEach((id, i) => { const song = idx.get('SONGS', id); if (song) { placed.add(id); addSong(song, song.fields['Duration'], id + i) } })
  }

  const unplaced = linked.filter(id => !placed.has(id)).map(id => idx.get('SONGS', id)).filter(Boolean)
  return {
    sets,
    unplaced,
    songs: sets.reduce((n, s) => n + s.songs, 0) + unplaced.length,
    seconds: sets.reduce((n, s) => n + s.seconds, 0) + unplaced.reduce((n, s) => n + (Number(s.fields['Duration']) || 0), 0),
  }
}

// --- practices ------------------------------------------------------------

export const isCancelled = (p) => p.fields['Status'] === 'Cancelled'

export function sortedPractices(data) {
  return (data['PRACTICES'] || []).filter(p => p.fields['Date']).slice().sort((a, b) =>
    (a.fields['Date'] || '').localeCompare(b.fields['Date'] || '') ||
    (a.fields['Start Time'] || '').localeCompare(b.fields['Start Time'] || ''))
}

// Practices you're asked to: you're listed as needed, or it's one of your
// active bands and nobody in particular is listed (empty means everyone).
export function isMyPractice(p, me, record) {
  if (me.type !== 'member') return false
  const needed = ids(p.fields['Members Needed'])
  if (needed.length) return needed.includes(me.id)
  const myBands = ids(record?.fields?.['Primary Bands'])
  return ids(p.fields['Band']).some(id => myBands.includes(id))
}

export function practicesByDate(list) {
  const map = {}
  for (const p of list) (map[p.fields['Date']] = map[p.fields['Date']] || []).push(p)
  return map
}

// --- song knowledge -------------------------------------------------------

export const KNOWLEDGE = ['Know it', 'Learning', 'To learn']

// songId -> Map(memberId -> status)
export function knowledgeIndex(data) {
  const bySong = new Map()
  for (const k of data['SONG KNOWLEDGE'] || []) {
    const status = k.fields['Status']
    if (!status) continue
    for (const songId of ids(k.fields['Song'])) {
      if (!bySong.has(songId)) bySong.set(songId, new Map())
      for (const memberId of ids(k.fields['Member'])) bySong.get(songId).set(memberId, status)
    }
  }
  return bySong
}

// The members a setlist is for: the band's roster.
export function bandRoster(data, bandId) {
  return (data['MEMBERS'] || []).filter(m => ids(m.fields['Primary Bands']).includes(bandId))
    .slice().sort((a, b) => (a.fields['Member Name'] || '').localeCompare(b.fields['Member Name'] || ''))
}

// One line for a song, said the way StageKin says it: "Everyone knows it",
// "Kevin, Josh still on it", "3 of 5 know it", "Nobody has said". People who
// haven't answered are not counted as not knowing it.
export function knowledgeSummary(answers, roster) {
  if (!roster.length) return null
  const first = (m) => (m.fields['Member Name'] || '?').split(' ')[0]
  const knows = roster.filter(m => answers?.get(m.id) === 'Know it')
  const working = roster.filter(m => ['Learning', 'To learn'].includes(answers?.get(m.id)))
  if (knows.length === roster.length) return { text: 'Everyone knows it', tone: 'good' }
  if (working.length) return { text: `${working.map(first).join(', ')} still on it`, tone: 'warn' }
  if (knows.length) return { text: `${knows.length} of ${roster.length} know it`, tone: 'quiet' }
  return { text: 'Nobody has said', tone: 'quiet' }
}

// --- song library ---------------------------------------------------------

// SONGS "Show Status", said for a member: is the band playing it?
export const SONG_STATUS = {
  Live: { label: 'Playing it live', short: null, tone: 'good' },
  Practicing: { label: 'Practicing it', short: 'Practicing', tone: 'warn' },
  Untouched: { label: 'Not started yet', short: 'Not started', tone: '' },
  Dead: { label: 'Retired', short: 'Retired', tone: '' },
}

export const isRetired = (song) => song.fields['Show Status'] === 'Dead'

// songId -> [bandId]: the bands that play a song. "Performed By" first, then
// the band of any setlist it's on, so a setlist song nobody linked still
// shows up under its band.
export function songBandIndex(data) {
  const map = new Map()
  const add = (songId, bandId) => {
    if (!map.has(songId)) map.set(songId, [])
    if (!map.get(songId).includes(bandId)) map.get(songId).push(bandId)
  }
  for (const s of data['SONGS'] || []) for (const b of ids(s.fields['Performed By'])) add(s.id, b)
  for (const sl of data['SETLISTS'] || []) for (const songId of ids(sl.fields['Songs'])) for (const b of ids(sl.fields['Band'])) add(songId, b)
  return map
}

// Songs on the setlists of your upcoming shows.
export function upcomingSetSongs(data, me, idx, today = todayStr()) {
  const songs = new Set()
  for (const show of upcoming(myShows(data, me), today)) {
    for (const sl of idx.all('SETLISTS', show.fields['SETLISTS'])) for (const id of ids(sl.fields['Songs'])) songs.add(id)
  }
  return songs
}

// The answers to show. /api/me's are complete for the songs it sends and
// for all of your own; the catalog adds everyone else's on the other songs.
// Catalog copies of those are skipped because they may be older.
export function mergedKnowledge(data, catalog, meId) {
  const base = data['SONG KNOWLEDGE'] || []
  if (!catalog) return base
  const sent = new Set((data['SONGS'] || []).map(s => s.id))
  const extra = (catalog['SONG KNOWLEDGE'] || []).filter(k =>
    !ids(k.fields['Member']).includes(meId) && !ids(k.fields['Song']).some(id => sent.has(id)))
  return [...base, ...extra]
}
