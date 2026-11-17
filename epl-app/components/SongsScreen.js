// Songs: every band's songbook and the setlists, behind a Library / Setlists
// switch. The library has two filter buttons, Band and Status, each opening
// a sheet of choices with song counts. The list groups to suit the choice:
// one band by tuning, several bands by band, the full catalog A–Z. The full
// catalog (every song in Airtable, about 1,200) loads only when picked.
import { useEffect, useMemo, useState } from 'react'
import { Search, ChevronDown, Check } from 'lucide-react'
import { useApp } from './context'
import { PageHead, TopBar, BandDot, Sheet } from './ui'
import { SetlistsList, SongModal, SongRow, TuningBadge, useSongAnswers } from './SetlistsScreen'
import { activeBands, memberBands, bandRoster, knowledgeIndex, mergedKnowledge, songBandIndex, upcomingSetSongs, isRetired, tuningName, compareTunings, SONG_STATUS, KNOWLEDGE } from '../lib/derive'
import { plural } from '../lib/format'

const VIEW_KEY = 'epl-songs-view'
const PAGE = 100 // rows drawn at a time; the catalog is long
const NOT_MARKED = 'none'
const STATUS_LABEL = { 'Know it': 'Know it', 'Learning': 'Learning', 'To learn': 'To learn', [NOT_MARKED]: 'Not marked yet' }
const MARK = { 'Know it': 'know', 'Learning': 'learning', 'To learn': 'to-learn' }

const byTitle = (a, b) => (a.fields['Song Title'] || '').localeCompare(b.fields['Song Title'] || '', undefined, { sensitivity: 'base' })

function matches(q, ...parts) {
  if (!q) return true
  const hay = parts.filter(Boolean).join(' ').toLowerCase()
  return q.toLowerCase().split(/\s+/).every(w => hay.includes(w))
}

export default function SongsScreen() {
  const { me } = useApp()
  const [view, setView] = useState('library')
  useEffect(() => { try { const v = localStorage.getItem(VIEW_KEY); if (v === 'library' || v === 'setlists') setView(v) } catch {} }, [])
  const choose = (v) => { setView(v); try { localStorage.setItem(VIEW_KEY, v) } catch {} }

  return (
    <>
      <TopBar />
      <main className="content rise">
        <PageHead title="Songs" sub={me.type === 'member' ? "Every band's songs and setlists. Mark the songs you know." : "Every band's songs and setlists."} />
        <div className="seg" role="group" aria-label="Show">
          <button aria-pressed={view === 'library'} onClick={() => choose('library')}>Library</button>
          <button aria-pressed={view === 'setlists'} onClick={() => choose('setlists')}>Setlists</button>
        </div>
        {view === 'library' ? <Library /> : <SetlistsList />}
      </main>
    </>
  )
}

// A bottom sheet of choices, each with its song count; picking one closes it.
function ChoiceSheet({ title, options, value, onPick, onClose }) {
  return (
    <Sheet onClose={onClose} label={title}>
      <h2>{title}</h2>
      <div className="sheet-section">
        <ul className="rows link-list">
          {options.map(o => (
            <li key={String(o.key)}>
              <button className="row row-plain choice" aria-pressed={value === o.key} onClick={() => { onPick(o.key); onClose() }}>
                <span>
                  <span className="row-title choice-title">{o.lead}{o.label}</span>
                  {o.sub && <span className="row-sub">{o.sub}</span>}
                </span>
                <span className="row-end choice-end">
                  {o.count != null && <span>{o.count}</span>}
                  {value === o.key ? <Check aria-label="Chosen" /> : <span className="choice-gap" />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  )
}

// Split the list into titled sections to suit the band choice.
function groupSongs(songs, scope, { bands, bandsOf, idx }) {
  // One band: by tuning, like the stage sheet.
  if (bands.some(b => b.id === scope)) {
    const map = new Map()
    for (const s of songs) {
      const t = s.fields['Guitar Tuning'] || ''
      if (!map.has(t)) map.set(t, [])
      map.get(t).push(s)
    }
    return [...map.entries()]
      .sort(([a], [b]) => (!a ? 1 : !b ? -1 : compareTunings(a, b)))
      .map(([t, list]) => ({ key: 't' + t, title: t ? tuningName(t) : 'Tuning not set', tuning: t, songs: list }))
  }
  // The full catalog: A–Z.
  if (scope === 'catalog') {
    const map = new Map()
    for (const s of songs) {
      const first = (s.fields['Song Title'] || '').trim().charAt(0).toUpperCase()
      const letter = /[A-Z]/.test(first) ? first : '#'
      if (!map.has(letter)) map.set(letter, [])
      map.get(letter).push(s)
    }
    return [...map.entries()].sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
      .map(([letter, list]) => ({ key: 'l' + letter, title: letter, songs: list }))
  }
  // Several bands: a section per band.
  const groups = bands.map(b => ({ key: b.id, title: b.fields['Band Name'], band: b.fields['Band Name'], songs: songs.filter(s => (bandsOf.get(s.id) || []).includes(b.id)) }))
  const other = songs.filter(s => !(bandsOf.get(s.id) || []).some(id => bands.some(b => b.id === id)))
  if (other.length) groups.push({ key: 'other', title: 'Other songs', songs: other })
  return groups.filter(g => g.songs.length)
}

function Library() {
  const { data, idx, me, record, catalog, loadCatalog } = useApp()
  const isMember = me.type === 'member'
  const myBandIds = useMemo(() => (isMember ? memberBands(record, idx).map(b => b.band.id) : []), [isMember, record, idx])
  const bandsOf = useMemo(() => songBandIndex(data), [data])
  const bands = useMemo(() => {
    const used = new Set([...bandsOf.values()].flat())
    return activeBands(data).filter(b => used.has(b.id))
  }, [data, bandsOf])
  const soonSongs = useMemo(() => upcomingSetSongs(data, me, idx), [data, me, idx])

  // Which songs: 'soon' (my upcoming sets), 'mine', 'all', a band's id, or 'catalog'.
  const [scope, setScope] = useState(myBandIds.length ? 'mine' : 'all')
  const [status, setStatus] = useState(null) // Know it / Learning / To learn / NOT_MARKED, or null for any
  const [q, setQ] = useState('')
  const [sheet, setSheet] = useState(null) // 'band' | 'status'
  const [limit, setLimit] = useState(PAGE)
  const [openId, setOpenId] = useState(null)
  useEffect(() => { setLimit(PAGE) }, [scope, status, q])
  useEffect(() => { if (scope === 'catalog' && catalog.status === 'idle') loadCatalog() }, [scope, catalog.status, loadCatalog])

  const knowledge = useMemo(() => knowledgeIndex({ 'SONG KNOWLEDGE': mergedKnowledge(data, catalog.data, me.id) }), [data, catalog.data, me.id])
  const { answersFor, mineFor, answer, busy } = useSongAnswers(knowledge)

  // Band views leave out retired songs; the catalog shows everything.
  const inScope = (s, key) => {
    if (!s.fields['Song Title']) return false
    if (key === 'catalog') return true
    if (key === 'soon') return soonSongs.has(s.id)
    if (isRetired(s)) return false
    const b = bandsOf.get(s.id) || []
    if (key === 'all') return b.length > 0
    if (key === 'mine') return b.some(id => myBandIds.includes(id))
    return b.includes(key)
  }
  const source = scope === 'catalog' ? (catalog.data?.SONGS || []) : (data['SONGS'] || [])
  const pool = useMemo(() => source.filter(s => inScope(s, scope)).sort(byTitle), [source, scope, bandsOf, myBandIds, soonSongs]) // eslint-disable-line react-hooks/exhaustive-deps

  const searched = pool.filter(s => matches(q, s.fields['Song Title'], s.fields['Artist'], s.fields['Abbreviation'], s.fields['Album'], tuningName(s.fields['Guitar Tuning'])))
  const answerOf = (s) => mineFor(s.id) || NOT_MARKED
  const shown = status ? searched.filter(s => answerOf(s) === status) : searched
  const groups = groupSongs(shown, scope, { bands, bandsOf, idx })

  // Draw the first `limit` songs, keeping their section titles.
  let left = limit
  const drawn = []
  for (const g of groups) {
    if (left <= 0) break
    drawn.push({ ...g, total: g.songs.length, songs: g.songs.slice(0, left) })
    left -= g.songs.length
  }

  const bandName = (id) => idx.get('BANDS', id)?.fields['Band Name']
  const scopeLabel = scope === 'soon' ? 'My upcoming sets' : scope === 'mine' ? 'My bands' : scope === 'all' ? 'All bands' : scope === 'catalog' ? 'Full catalog' : bandName(scope)
  const count = (key) => (data['SONGS'] || []).filter(s => inScope(s, key)).length
  const bandOptions = [
    { key: 'soon', label: 'My upcoming sets', sub: 'Songs on the setlists for your next shows', count: count('soon') },
    ...(myBandIds.length ? [{ key: 'mine', label: 'My bands', count: count('mine') }] : []),
    { key: 'all', label: 'All bands', count: count('all') },
    ...bands.map(b => ({ key: b.id, label: b.fields['Band Name'], lead: <BandDot name={b.fields['Band Name']} />, count: count(b.id) })),
    { key: 'catalog', label: 'Full catalog', sub: 'Every song in Echo Play Live, retired ones too', count: catalog.data ? catalog.data.SONGS.filter(s => s.fields['Song Title']).length : null },
  ]
  const statusCounts = {}
  for (const s of searched) statusCounts[answerOf(s)] = (statusCounts[answerOf(s)] || 0) + 1
  const statusOptions = [
    { key: null, label: 'Any status', count: searched.length },
    ...[...KNOWLEDGE, NOT_MARKED].map(k => ({ key: k, label: STATUS_LABEL[k], lead: <span className={`song-mark${MARK[k] ? ` mark-${MARK[k]}` : ''}`} />, count: statusCounts[k] || 0 })),
  ]

  // "Who knows it" on the song page: the band it's filed under here, else
  // the first band of yours that plays it, else everyone who has answered.
  const open = openId ? (source.find(s => s.id === openId) || idx.get('SONGS', openId)) : null
  let who = null
  if (open) {
    const b = bandsOf.get(open.id) || []
    const bandId = b.includes(scope) ? scope : (b.find(id => myBandIds.includes(id)) || b[0])
    if (bandId) who = { roster: bandRoster(data, bandId), bandName: bandName(bandId), everyone: false }
    else {
      const answered = answersFor(open.id)
      who = { roster: (data['MEMBERS'] || []).filter(m => answered?.has(m.id)).sort((x, y) => (x.fields['Member Name'] || '').localeCompare(y.fields['Member Name'] || '')), bandName: null, everyone: true }
    }
  }

  const loadingCatalog = scope === 'catalog' && catalog.status !== 'ready'
  const showStatus = (s) => SONG_STATUS[s.fields['Show Status']]?.short
  const subFor = (s) => [s.fields['Artist'], scope === 'catalog' && (bandsOf.get(s.id) || []).map(bandName).filter(Boolean).join(', '), showStatus(s)].filter(Boolean).join(' · ')

  return (
    <>
      <div className="library-filters">
        <label style={{ position: 'relative', display: 'block' }}>
          <span className="sr-only">Search songs</span>
          <Search aria-hidden="true" size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)', marginTop: '0.175rem' }} />
          <input className="input" style={{ paddingLeft: '2.4rem', background: 'var(--card)', boxShadow: 'var(--shadow-card)' }} type="search" placeholder="Song, artist or tuning" value={q} onChange={e => setQ(e.target.value)} />
        </label>
        <div className={`filter-buttons${isMember ? '' : ' single'}`}>
          <button className="filter-button" onClick={() => setSheet('band')} aria-haspopup="dialog">
            <span className="filter-kicker">Band</span>
            <span className="filter-value">{bands.some(b => b.id === scope) && <BandDot name={scopeLabel} />}<span>{scopeLabel}</span></span>
            <ChevronDown aria-hidden="true" />
          </button>
          {isMember && (
            <button className={`filter-button${status ? ' active' : ''}`} onClick={() => setSheet('status')} aria-haspopup="dialog">
              <span className="filter-kicker">Status</span>
              <span className="filter-value">{status && <span className={`song-mark${MARK[status] ? ` mark-${MARK[status]}` : ''}`} />}<span>{status ? STATUS_LABEL[status] : 'Any status'}</span></span>
              <ChevronDown aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {loadingCatalog ? (
        <section className="panel">
          {catalog.status === 'error'
            ? <p className="empty">Couldn't load the catalog. <button className="text-link" onClick={loadCatalog}>Try again</button></p>
            : <p className="empty" aria-busy="true"><span className="spinner" style={{ width: '0.9rem', height: '0.9rem', verticalAlign: '-2px', marginRight: '0.5rem' }} />Loading every song in Echo Play Live…</p>}
        </section>
      ) : shown.length ? (
        <div className="song-list">
          <p className="song-count">{plural(shown.length, 'song')}</p>
          {drawn.map(g => (
            <section className="panel" key={g.key}>
              <div className="song-group-head">
                <span>{g.tuning !== undefined ? <><span className="song-group-eyebrow">Tuning</span><TuningBadge value={g.tuning} /></> : <>{g.band && <BandDot name={g.band} />}<strong>{g.title}</strong></>}</span>
                <span>{plural(g.total, 'song')}</span>
              </div>
              <ul className="rows">
                {g.songs.map(s => (
                  <li key={s.id}><SongRow song={s} mine={mineFor(s.id)} sub={subFor(s)} onOpen={() => setOpenId(s.id)} /></li>
                ))}
              </ul>
            </section>
          ))}
          {shown.length > limit && (
            <button className="button button-tinted button-block" onClick={() => setLimit(l => l + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more songs</button>
          )}
          {isMember && (
            <p className="song-legend">
              <span><span className="song-mark mark-know" /> Know it</span>
              <span><span className="song-mark mark-learning" /> Learning</span>
              <span><span className="song-mark mark-to-learn" /> To learn</span>
            </p>
          )}
        </div>
      ) : (
        <section className="panel"><p className="empty">{q ? `No songs match “${q}”.` : status ? 'No songs match this status.' : 'No songs here yet.'}</p></section>
      )}

      {sheet === 'band' && <ChoiceSheet title="Band" options={bandOptions} value={scope} onPick={setScope} onClose={() => setSheet(null)} />}
      {sheet === 'status' && <ChoiceSheet title="Your status" options={statusOptions} value={status} onPick={setStatus} onClose={() => setSheet(null)} />}

      {open && who && (
        <SongModal
          song={open}
          roster={who.roster}
          bandName={who.bandName}
          everyone={who.everyone}
          answers={answersFor(open.id)}
          mine={mineFor(open.id)}
          busy={busy}
          onAnswer={(st) => answer(open.id, st)}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  )
}
