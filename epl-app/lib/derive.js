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

// "me" is { type: 'member' | 'crew', id } from the server.
export function isOnShow(show, me) {
  const f = show.fields
  if (me.type === 'member') return ids(f['Members Playing']).includes(me.id)
  return ids(f['Sound Engineer']).includes(me.id) || ids(f['Merch Person']).includes(me.id)
}

// What this person does on a show, in a word or two.
export function roleOnShow(show, me, record) {
  const f = show.fields
  if (me.type === 'crew') {
    const jobs = []
    if (ids(f['Sound Engineer']).includes(me.id)) jobs.push('Sound')
    if (ids(f['Merch Person']).includes(me.id)) jobs.push('Merch')
    return jobs.join(' & ')
  }
  return (record?.fields?.['Instruments'] || []).join(', ')
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

// Group a setlist's songs into runs of the same guitar tuning, the way the
// printed stage sheet draws them.
export function tuningBlocks(songs) {
  const blocks = []
  songs.forEach((song, i) => {
    const tuning = (song.fields['Guitar Tuning'] || '').split('.')[0] || '—'
    const last = blocks[blocks.length - 1]
    if (last && last.tuning === tuning) last.songs.push({ song, n: i + 1 })
    else blocks.push({ tuning, songs: [{ song, n: i + 1 }] })
  })
  return blocks
}
