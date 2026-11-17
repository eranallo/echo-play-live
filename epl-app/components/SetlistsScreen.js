// Setlists: the ones for your upcoming shows first, then every band's.
// A setlist reads like the stage sheet: songs grouped into tuning blocks.
import { useEffect, useMemo, useState } from 'react'
import { ListMusic, ExternalLink } from 'lucide-react'
import { useApp } from './context'
import { Panel, PageHead, BandTag, Chevron, Sheet, TopBar } from './ui'
import { myShows, upcoming, ids, tuningBlocks } from '../lib/derive'
import { fmtDate, fmtDur, fmtSetLength, setlistNotes, todayStr, plural } from '../lib/format'

function SetlistRow({ sl, sub }) {
  const { idx, openSetlist } = useApp()
  const band = idx.all('BANDS', sl.fields['Band'])[0]
  return (
    <button className="row" onClick={() => openSetlist(sl.id)}>
      <span className="row-icon"><ListMusic aria-hidden="true" /></span>
      <span>
        <span className="row-title">{sl.fields['Set Name'] || 'Setlist'}</span>
        <span className="row-sub">{[sub, plural(ids(sl.fields['Songs']).length, 'song'), fmtSetLength(sl.fields['Duration'])].filter(Boolean).join(' · ')}</span>
        {band && <span className="tags" style={{ marginTop: '0.35rem' }}><BandTag name={band.fields['Band Name']} /></span>}
      </span>
      <Chevron />
    </button>
  )
}

export default function SetlistsScreen() {
  const { data, me, idx } = useApp()
  const today = todayStr()
  // Setlists attached to your next shows, each with the date it's for.
  const forMe = useMemo(() => {
    const seen = new Map()
    for (const show of upcoming(myShows(data, me), today)) {
      for (const sl of idx.all('SETLISTS', show.fields['SETLISTS'])) if (!seen.has(sl.id)) seen.set(sl.id, { sl, show })
    }
    return [...seen.values()]
  }, [data, me, idx, today])
  const all = useMemo(() => (data['SETLISTS'] || []).slice().sort((a, b) => (a.fields['Set Name'] || '').localeCompare(b.fields['Set Name'] || '')), [data])

  return (
    <>
      <TopBar />
      <main className="content rise">
        <PageHead title="Setlists" sub="Running orders, grouped by tuning like the stage sheet." />
        <Panel title="For your upcoming shows" count={forMe.length}>
          {forMe.length ? (
            <ul className="rows">{forMe.map(({ sl, show }) => <li key={sl.id}><SetlistRow sl={sl} sub={`Next: ${fmtDate(show.fields['Date'])}`} /></li>)}</ul>
          ) : <p className="empty">None of your upcoming shows has a setlist yet.</p>}
        </Panel>
        <Panel title="All setlists" count={all.length}>
          {all.length ? <ul className="rows">{all.map(sl => <li key={sl.id}><SetlistRow sl={sl} /></li>)}</ul> : <p className="empty">No setlists yet.</p>}
        </Panel>
      </main>
    </>
  )
}

const GUITAR = ['E', 'A', 'D', 'G', 'B', 'e']
const BASS = ['E', 'A', 'D', 'G']

function SongSheet({ song, onClose }) {
  const f = song.fields
  const q = encodeURIComponent(`${f['Song Title'] || ''} ${f['Artist'] || ''}`.trim())
  const links = [
    ['Spotify', `https://open.spotify.com/search/${q}`],
    ['Apple Music', `https://music.apple.com/search?term=${q}`],
    ['Tabs', `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(f['Song Title'] || '')}`],
  ]
  const strings = (val, names) => (val ? String(val).split('.') : []).map((note, i) => ({ note, name: names[i] || '' }))
  const guitar = strings(f['Guitar Tuning'], GUITAR)
  const bass = strings(f['Bass Tuning'], BASS)
  return (
    <Sheet onClose={onClose} label={f['Song Title']}>
      <h2>{f['Song Title']}</h2>
      <p className="row-sub">{[f['Artist'], fmtDur(f['Duration']), f['Key'] && `Key ${f['Key']}`, f['BPM'] && `${f['BPM']} bpm`].filter(Boolean).join(' · ')}</p>
      {guitar.length > 0 && (
        <div className="sheet-section">
          <span className="label">Guitar, low to high</span>
          <div className="strings">{guitar.map((s, i) => <div className="string" key={i}><span>{s.name}</span><strong>{s.note}</strong></div>)}</div>
        </div>
      )}
      {bass.length > 0 && (
        <div className="sheet-section">
          <span className="label">Bass, low to high</span>
          <div className="strings">{bass.map((s, i) => <div className="string" key={i}><span>{s.name}</span><strong>{s.note}</strong></div>)}</div>
        </div>
      )}
      <div className="sheet-section">
        <div className="rows panel" style={{ boxShadow: 'none', background: 'var(--fill-quiet)' }}>
          {links.map(([label, href]) => (
            <a key={label} className="row row-plain" href={href} target="_blank" rel="noopener noreferrer">
              <span className="row-title">{label}</span>
              <ExternalLink className="chev" aria-hidden="true" />
            </a>
          ))}
        </div>
        <button className="button button-tinted button-block" onClick={onClose}>Close</button>
      </div>
    </Sheet>
  )
}

export function SetlistScreen({ setlistId, onBack }) {
  const { idx } = useApp()
  const [song, setSong] = useState(null)
  useEffect(() => { window.scrollTo(0, 0) }, [setlistId])
  const sl = idx.get('SETLISTS', setlistId)
  if (!sl) return (<><TopBar title="Setlist" onBack={onBack} /><main className="content"><p className="empty">This setlist isn't available any more.</p></main></>)
  const f = sl.fields
  const songs = idx.all('SONGS', f['Songs'])
  const band = idx.all('BANDS', f['Band'])[0]
  const notes = setlistNotes(f['Notes'])
  const blocks = tuningBlocks(songs)
  return (
    <>
      <TopBar title={f['Set Name'] || 'Setlist'} onBack={onBack} />
      <main className="content rise">
        <header className="page-head">
          <p className="eyebrow">{[plural(songs.length, 'song'), fmtSetLength(f['Duration'])].filter(Boolean).join(' · ')}</p>
          <h1>{f['Set Name'] || 'Setlist'}</h1>
          {band && <div className="tags" style={{ marginTop: '0.5rem' }}><BandTag name={band.fields['Band Name']} /></div>}
        </header>
        {notes && <Panel title="Set notes"><p className="note">{notes}</p></Panel>}
        <section className="panel">
          {blocks.length ? blocks.map((block, bi) => (
            <div key={bi}>
              <div className="tuning-head"><span>Tuning <strong>{block.tuning}</strong></span><span>{plural(block.songs.length, 'song')}</span></div>
              <ul className="rows">
                {block.songs.map(({ song: s, n }) => (
                  <li key={s.id + n}>
                    <button className="row" onClick={() => setSong(s)}>
                      <span className="song-num">{n}</span>
                      <span><span className="row-title">{s.fields['Song Title']}</span><span className="row-sub">{[s.fields['Artist'], fmtDur(s.fields['Duration'])].filter(Boolean).join(' · ')}</span></span>
                      <span className="row-end">{s.fields['Key'] || ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )) : <p className="empty">No songs on this setlist yet.</p>}
        </section>
      </main>
      {song && <SongSheet song={song} onClose={() => setSong(null)} />}
    </>
  )
}
