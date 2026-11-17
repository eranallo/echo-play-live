// Songs: every band's songbook and the setlists, behind a Library / Setlists
// switch. The library filters by band, by your own answer and by what's on
// your upcoming sets. The full catalog (every song in Airtable, about 1,200)
// loads only when someone picks it.
import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useApp } from './context'
import { Panel, PageHead, TopBar, BandDot } from './ui'
import { SetlistsList, SongModal, useSongAnswers, STATUS_PILL } from './SetlistsScreen'
import { activeBands, memberBands, bandRoster, knowledgeIndex, mergedKnowledge, songBandIndex, upcomingSetSongs, isRetired, SONG_STATUS, KNOWLEDGE } from '../lib/derive'

const VIEW_KEY = 'epl-songs-view'
const PAGE = 100 // rows drawn at a time; the catalog is long
const NOT_MARKED = 'none'

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

function SongRow({ song, dots, mine, onOpen }) {
  const f = song.fields
  const status = SONG_STATUS[f['Show Status']]
  return (
    <button className="row row-plain" onClick={onOpen}>
      <span>
        <span className="row-title">{f['Song Title']}</span>
        <span className="row-sub">
          {dots.length > 0 && <span className="song-dots">{dots.map(n => <BandDot key={n} name={n} />)}</span>}
          {[f['Artist'], status?.short].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="row-end">{mine ? <span className={`pill ${STATUS_PILL[mine]}`}>{mine}</span> : (f['Key'] || '')}</span>
    </button>
  )
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

  // Where the songs come from: 'mine', 'all', a band's id, or 'catalog'.
  const [scope, setScope] = useState(myBandIds.length ? 'mine' : 'all')
  const [status, setStatus] = useState(null) // Know it / Learning / To learn / NOT_MARKED, or null for any
  const [soon, setSoon] = useState(false)
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [openId, setOpenId] = useState(null)
  useEffect(() => { setLimit(PAGE) }, [scope, status, soon, q])
  useEffect(() => { if (scope === 'catalog' && catalog.status === 'idle') loadCatalog() }, [scope, catalog.status, loadCatalog])

  const knowledge = useMemo(() => knowledgeIndex({ 'SONG KNOWLEDGE': mergedKnowledge(data, catalog.data, me.id) }), [data, catalog.data, me.id])
  const { answersFor, mineFor, answer, busy } = useSongAnswers(knowledge)
  const soonSongs = useMemo(() => upcomingSetSongs(data, me, idx), [data, me, idx])

  const source = scope === 'catalog' ? (catalog.data?.SONGS || []) : (data['SONGS'] || [])
  // Band views leave out retired songs; the catalog shows everything.
  const pool = useMemo(() => source.filter(s => {
    if (!s.fields['Song Title']) return false
    if (scope === 'catalog') return true
    if (isRetired(s)) return false
    const b = bandsOf.get(s.id) || []
    if (scope === 'all') return b.length > 0
    if (scope === 'mine') return b.some(id => myBandIds.includes(id))
    return b.includes(scope)
  }).sort(byTitle), [source, scope, bandsOf, myBandIds])

  const searched = pool.filter(s => (!soon || soonSongs.has(s.id)) && matches(q, s.fields['Song Title'], s.fields['Artist'], s.fields['Abbreviation'], s.fields['Album']))
  const answerOf = (s) => mineFor(s.id) || NOT_MARKED
  const counts = {}
  if (isMember) for (const s of searched) counts[answerOf(s)] = (counts[answerOf(s)] || 0) + 1
  const shown = status ? searched.filter(s => answerOf(s) === status) : searched

  // Band dots on each row, unless the list is a single band already.
  const dotsFor = (s) => (bands.some(b => b.id === scope) ? [] : (bandsOf.get(s.id) || []).map(id => idx.get('BANDS', id)?.fields['Band Name']).filter(Boolean))
  const title = scope === 'mine' ? 'My bands' : scope === 'all' ? 'All bands' : scope === 'catalog' ? 'Full catalog' : idx.get('BANDS', scope)?.fields['Band Name']

  // "Who knows it" for a song: the band it's filed under here, else the
  // first band of yours that plays it, else everyone who has answered.
  const open = openId ? (source.find(s => s.id === openId) || idx.get('SONGS', openId)) : null
  let who = null
  if (open) {
    const b = bandsOf.get(open.id) || []
    const bandId = b.includes(scope) ? scope : (b.find(id => myBandIds.includes(id)) || b[0])
    if (bandId) who = { roster: bandRoster(data, bandId), bandName: idx.get('BANDS', bandId)?.fields['Band Name'], everyone: false }
    else {
      const answered = answersFor(open.id)
      who = { roster: (data['MEMBERS'] || []).filter(m => answered?.has(m.id)).sort((x, y) => (x.fields['Member Name'] || '').localeCompare(y.fields['Member Name'] || '')), bandName: null, everyone: true }
    }
  }

  const filtered = !!(q || status || soon)
  const loadingCatalog = scope === 'catalog' && catalog.status !== 'ready'

  return (
    <>
      <div className="library-filters">
        <label style={{ position: 'relative', display: 'block' }}>
          <span className="sr-only">Search songs</span>
          <Search aria-hidden="true" size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)', marginTop: '0.175rem' }} />
          <input className="input" style={{ paddingLeft: '2.4rem', background: 'var(--card)', boxShadow: 'var(--shadow-card)' }} type="search" placeholder="Song, artist or album" value={q} onChange={e => setQ(e.target.value)} />
        </label>
        <div className="chips chips-scroll" role="group" aria-label="Songs from">
          {myBandIds.length > 0 && <button className="chip" aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>My bands</button>}
          <button className="chip" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>All bands</button>
          {bands.map(b => (
            <button key={b.id} className="chip" aria-pressed={scope === b.id} onClick={() => setScope(b.id)}><BandDot name={b.fields['Band Name']} />{b.fields['Band Name']}</button>
          ))}
          <button className="chip" aria-pressed={scope === 'catalog'} onClick={() => setScope('catalog')}>Full catalog</button>
        </div>
        <div className="chips chips-scroll" role="group" aria-label="Filter">
          {isMember && [...KNOWLEDGE, NOT_MARKED].map(k => (
            <button key={k} className="chip" aria-pressed={status === k} onClick={() => setStatus(status === k ? null : k)}>
              {k === NOT_MARKED ? 'Not marked' : k}<span className="chip-count">{counts[k] || 0}</span>
            </button>
          ))}
          <button className="chip" aria-pressed={soon} onClick={() => setSoon(!soon)}>In my upcoming sets</button>
        </div>
      </div>

      {loadingCatalog ? (
        <Panel title="Full catalog">
          {catalog.status === 'error'
            ? <p className="empty">Couldn't load the catalog. <button className="text-link" onClick={loadCatalog}>Try again</button></p>
            : <p className="empty" aria-busy="true"><span className="spinner" style={{ width: '0.9rem', height: '0.9rem', verticalAlign: '-2px', marginRight: '0.5rem' }} />Loading every song in Echo Play Live…</p>}
        </Panel>
      ) : (
        <Panel title={title} count={shown.length}>
          {shown.length ? (
            <>
              <ul className="rows">
                {shown.slice(0, limit).map(s => (
                  <li key={s.id}><SongRow song={s} dots={dotsFor(s)} mine={mineFor(s.id)} onOpen={() => setOpenId(s.id)} /></li>
                ))}
              </ul>
              {shown.length > limit && (
                <div className="panel-foot">
                  <button className="text-link" onClick={() => setLimit(l => l + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more</button>
                </div>
              )}
            </>
          ) : (
            <p className="empty">{q ? `No songs match “${q}”.` : filtered ? 'No songs match these filters.' : 'No songs here yet.'}</p>
          )}
        </Panel>
      )}

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
