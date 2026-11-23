// Setlists, the song row and the song page they share with the Songs tab.
// A setlist reads like the stage sheet: songs grouped into tuning blocks.
// Members mark their own answer for each song; who else knows it is at the
// bottom of the song page.
import { useEffect, useMemo, useState } from 'react'
import { ListMusic, ExternalLink, ArrowLeftRight, Megaphone, Pause } from 'lucide-react'
import { useApp } from './context'
import { Panel, BandTag, Chevron, Modal, PersonAvatar, TopBar } from './ui'
import { myShows, upcoming, ids, setlistLayout, tuningName, tuningColor, knowledgeIndex, bandRoster, KNOWLEDGE, roleInBand, SONG_STATUS } from '../lib/derive'
import { fmtDate, fmtDur, fmtSetLength, setlistNotes, todayStr, plural } from '../lib/format'

export const STATUS_PILL = { 'Know it': 'pill-good', 'Learning': 'pill-warn', 'To learn': '' }
const MARK = { 'Know it': 'know', 'Learning': 'learning', 'To learn': 'to-learn' }

// A guitar tuning as a coloured badge: "Drop D", "Eb standard".
export function TuningBadge({ value }) {
  const name = tuningName(value)
  if (!name) return <span className="tuning-badge tuning-none">No tuning</span>
  return <span className={`tuning-badge tune-${tuningColor(value)}`}>{name}</span>
}

// One song as a row: your mark (a dot), title and artist, and the tuning.
// Key, BPM and the rest are on the song's page. A setlist leaves the tuning
// to its block header, so showTuning is off there.
export function SongRow({ song, n, mine, sub, showTuning = true, onOpen }) {
  const f = song.fields
  return (
    <button className={`song-row${n != null ? ' numbered' : ''}${showTuning ? '' : ' no-tuning'}`} onClick={onOpen}>
      {n != null && <span className="song-num">{n}</span>}
      <span className={`song-mark${mine ? ` mark-${MARK[mine]}` : ''}`}>{mine && <span className="sr-only">{mine}</span>}</span>
      <span className="song-main">
        <span className="row-title">{f['Song Title']}</span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      {showTuning && <TuningBadge value={f['Guitar Tuning']} />}
    </button>
  )
}

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

// The Setlists side of the Songs tab: the ones for your upcoming shows
// first, then every band's.
export function SetlistsList() {
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
      <Panel title="For your upcoming shows" count={forMe.length}>
        {forMe.length ? (
          <ul className="rows">{forMe.map(({ sl, show }) => <li key={sl.id}><SetlistRow sl={sl} sub={`Next: ${fmtDate(show.fields['Date'])}`} /></li>)}</ul>
        ) : <p className="empty">None of your upcoming shows has a setlist yet.</p>}
      </Panel>
      <Panel title="All setlists" count={all.length}>
        {all.length ? <ul className="rows">{all.map(sl => <li key={sl.id}><SetlistRow sl={sl} /></li>)}</ul> : <p className="empty">No setlists yet.</p>}
      </Panel>
    </>
  )
}

// Your answers, with any you just changed shown straight away, and the save.
// Shared by a setlist and the song library.
export function useSongAnswers(knowledge) {
  const { me, api, reload, toast } = useApp()
  const [override, setOverride] = useState({}) // songId -> status, shown before the reload lands
  const [busy, setBusy] = useState(false)

  const answersFor = (id) => {
    const base = knowledge.get(id)
    if (me.type !== 'member' || !(id in override)) return base
    const copy = new Map(base || [])
    if (override[id]) copy.set(me.id, override[id]); else copy.delete(me.id)
    return copy
  }
  const mineFor = (id) => (me.type === 'member' ? answersFor(id)?.get(me.id) || null : null)

  async function answer(id, status) {
    setBusy(true)
    setOverride(o => ({ ...o, [id]: status }))
    try {
      const res = await api('/api/song-knowledge', { method: 'POST', body: JSON.stringify({ songId: id, status }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || 'Could not save')
      toast(status ? `Marked: ${status}` : 'Answer cleared')
      reload()
    } catch (e) {
      setOverride(o => { const n = { ...o }; delete n[id]; return n })
      toast(e.message)
    }
    setBusy(false)
  }

  return { answersFor, mineFor, answer, busy }
}

// Lyrics come one song at a time from /api/songs, kept for the session.
const lyricsCache = new Map()
function useLyrics(songId) {
  const { api } = useApp()
  const [text, setText] = useState(() => lyricsCache.get(songId) ?? null)
  useEffect(() => {
    if (lyricsCache.has(songId)) { setText(lyricsCache.get(songId)); return }
    let cancelled = false
    api(`/api/songs?id=${encodeURIComponent(songId)}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(j => {
        const t = (j?.fields?.Lyrics || '').trim()
        lyricsCache.set(songId, t)
        if (!cancelled) setText(t)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [songId, api])
  return text
}

const GUITAR = ['E', 'A', 'D', 'G', 'B', 'e']
const BASS = ['E', 'A', 'D', 'G']

export function SongModal({ song, roster, answers, bandName, everyone = false, mine, onAnswer, busy, onClose }) {
  const { me, idx, openPerson } = useApp()
  const f = song.fields
  const lyrics = useLyrics(song.id)
  const [allLyrics, setAllLyrics] = useState(false)
  const longLyrics = !!lyrics && (lyrics.split('\n').length > 14 || lyrics.length > 700)
  const bands = idx.all('BANDS', f['Performed By'])
  const status = SONG_STATUS[f['Show Status']]
  const facts = [
    ['Album', f['Album']],
    ['Year', f['Year']],
    ['Time signature', f['Time Signature']],
    ['Shorthand', f['Abbreviation']],
  ].filter(([, v]) => v)
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
    <Modal onClose={onClose} label={f['Song Title']}>
      <h2 style={{ paddingRight: '2rem' }}>{f['Song Title']}</h2>
      <p className="row-sub">{[f['Artist'], fmtDur(f['Duration']), f['Key'] && `Key ${f['Key']}`, f['BPM'] && `${f['BPM']} bpm`].filter(Boolean).join(' · ')}</p>
      {(bands.length > 0 || status) && (
        <div className="song-status">
          {bands.map(b => <BandTag key={b.id} name={b.fields['Band Name']} />)}
          {status && <span className={`pill ${status.tone ? `pill-${status.tone}` : ''}`}>{status.label}</span>}
        </div>
      )}

      {me.type === 'member' && (
        <div className="practice-section">
          <span className="label">Your answer</span>
          <div className="seg knowledge-seg" role="group" aria-label="Your answer for this song">
            {KNOWLEDGE.map(s => (
              <button key={s} aria-pressed={mine === s} disabled={busy} onClick={() => onAnswer(mine === s ? null : s)} data-status={s}>{s}</button>
            ))}
          </div>
          <p className="row-sub">{mine ? 'Tap it again to clear. Your answer follows you to every band.' : 'Your answer follows you to every band that plays it.'}</p>
        </div>
      )}

      {(guitar.length > 0 || bass.length > 0) && (
        <div className="practice-section">
          {guitar.length > 0 && <><span className="label strings-label">Guitar <TuningBadge value={f['Guitar Tuning']} /> low to high</span><div className="strings">{guitar.map((s, i) => <div className="string" key={i}><span>{s.name}</span><strong>{s.note}</strong></div>)}</div></>}
          {bass.length > 0 && <><span className="label strings-label" style={{ marginTop: guitar.length ? '0.6rem' : 0 }}>Bass <TuningBadge value={f['Bass Tuning']} /> low to high</span><div className="strings">{bass.map((s, i) => <div className="string" key={i}><span>{s.name}</span><strong>{s.note}</strong></div>)}</div></>}
        </div>
      )}

      {facts.length > 0 && (
        <div className="practice-section">
          <span className="label">About the song</span>
          <dl className="rows link-list">
            {facts.map(([label, value]) => <div className="kv" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        </div>
      )}

      {lyrics && (
        <div className="practice-section">
          <span className="label">Lyrics</span>
          <div className={`lyrics ${longLyrics && !allLyrics ? 'lyrics-clipped' : ''}`}>{lyrics}</div>
          {longLyrics && !allLyrics && <button className="text-link" onClick={() => setAllLyrics(true)}>Show all lyrics</button>}
        </div>
      )}

      <div className="practice-section">
        <div className="rows link-list">
          {links.map(([label, href]) => (
            <a key={label} className="row row-plain" href={href} target="_blank" rel="noopener noreferrer">
              <span className="row-title">{label}</span>
              <ExternalLink className="chev" aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>

      {roster.length > 0 && (
        <div className="practice-section">
          <span className="label">{everyone ? 'Who knows it in Echo Play Live' : `Who knows it${bandName ? ` in ${bandName}` : ''}`}</span>
          <ul className="practice-people">
            {roster.map(m => {
              const a = answers?.get(m.id)
              return (
                <li key={m.id}>
                  <button onClick={() => openPerson(m, 'member')}>
                    <PersonAvatar record={m} type="member" size={32} />
                    <span><span className="row-title">{m.fields['Member Name']}</span><span className="row-sub">{roleInBand(m, bandName)}</span></span>
                    <span className={`pill ${a ? STATUS_PILL[a] : ''}`}>{a || 'Not said'}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Modal>
  )
}

// A cue in the running order: a transition, a break or an announcement.
function CueRow({ entry }) {
  const transition = /transition/i.test(entry.label)
  const Icon = entry.type === 'Announcement' ? Megaphone : transition ? ArrowLeftRight : Pause
  return (
    <div className={`cue-row cue-${entry.type === 'Announcement' ? 'announce' : transition ? 'transition' : 'break'}`}>
      <Icon aria-hidden="true" />
      <span>{entry.label}</span>
      {fmtDur(entry.seconds) && <span className="cue-time">{fmtDur(entry.seconds)}</span>}
    </div>
  )
}

// A setlist in the order it was built in Airtable's setlist editor: each
// set with its songs, the tuning wherever it changes, and the transitions
// and breaks in between.
export function SetlistScreen({ setlistId, onBack }) {
  const { data, idx, me } = useApp()
  const [songId, setSongId] = useState(null)
  useEffect(() => { window.scrollTo(0, 0) }, [setlistId])
  const knowledge = useMemo(() => knowledgeIndex(data), [data])
  const { answersFor, mineFor, answer, busy } = useSongAnswers(knowledge)

  const sl = idx.get('SETLISTS', setlistId)
  const layout = useMemo(() => (sl ? setlistLayout(sl, data, idx) : null), [sl, data, idx])
  if (!sl) return (<><TopBar title="Setlist" onBack={onBack} /><main className="content"><p className="empty">This setlist isn't available any more.</p></main></>)
  const f = sl.fields
  const band = idx.all('BANDS', f['Band'])[0]
  const bandName = band?.fields['Band Name']
  const roster = band ? bandRoster(data, band.id) : []
  const notes = setlistNotes(f['Notes'])

  // Every song once, for your progress and the song page.
  const songs = [...new Map([
    ...layout.sets.flatMap(st => st.entries.filter(e => e.kind === 'song').map(e => e.song)),
    ...layout.unplaced,
  ].map(s => [s.id, s])).values()]
  const counts = me.type === 'member' ? KNOWLEDGE.map(s => [s, songs.filter(s2 => mineFor(s2.id) === s).length]) : []
  const unmarked = songs.filter(s => !mineFor(s.id)).length
  const open = songId ? songs.find(s => s.id === songId) : null
  const songRow = (s, n, seconds, showTuning) => (
    <SongRow
      key={s.id + '-' + n}
      song={s}
      n={n}
      mine={mineFor(s.id)}
      sub={[s.fields['Artist'], fmtDur(seconds)].filter(Boolean).join(' · ')}
      showTuning={showTuning}
      onOpen={() => setSongId(s.id)}
    />
  )
  const many = layout.sets.length > 1

  return (
    <>
      <TopBar title={f['Set Name'] || 'Setlist'} onBack={onBack} />
      <main className="content rise">
        <header className="page-head">
          <p className="eyebrow">{[plural(layout.songs, 'song'), many && plural(layout.sets.length, 'set'), fmtSetLength(layout.seconds || f['Duration'])].filter(Boolean).join(' · ')}</p>
          <h1>{f['Set Name'] || 'Setlist'}</h1>
          {band && <div className="tags" style={{ marginTop: '0.5rem' }}><BandTag name={bandName} /></div>}
        </header>
        {me.type === 'member' && songs.length > 0 && (
          <section className="panel">
            <div className="panel-head"><h2 className="panel-title">Your progress</h2></div>
            <div className="cal-summary">
              {counts.map(([s, n]) => <span key={s} className={`pill ${STATUS_PILL[s]}`}>{n} {s.toLowerCase()}</span>)}
              <span className="pill">{unmarked} not marked</span>
            </div>
          </section>
        )}
        {notes && <Panel title="Set notes"><p className="note">{notes}</p></Panel>}

        {layout.sets.map(st => (
          <section className="panel" key={'set' + st.number}>
            {many && (
              <div className="set-head">
                <strong>Set {st.number}</strong>
                <span>{[plural(st.songs, 'song'), fmtSetLength(st.seconds)].filter(Boolean).join(' · ')}</span>
              </div>
            )}
            <div className="rows">
              {st.entries.map(e => e.kind === 'tuning' ? (
                <div className="tuning-head" key={e.key}><span>Tuning <TuningBadge value={e.value} /></span><span>{plural(e.count, 'song')}</span></div>
              ) : e.kind === 'cue' ? (
                <CueRow key={e.key} entry={e} />
              ) : songRow(e.song, e.n, e.seconds, false))}
            </div>
          </section>
        ))}

        {layout.unplaced.length > 0 && (
          <Panel title={layout.sets.length ? 'Not in the running order yet' : 'Songs'} count={layout.unplaced.length}>
            <div className="rows">{layout.unplaced.map((s, i) => songRow(s, null, s.fields['Duration'], true))}</div>
          </Panel>
        )}
        {!layout.sets.length && !layout.unplaced.length && <section className="panel"><p className="empty">No songs on this setlist yet.</p></section>}
      </main>
      {open && (
        <SongModal
          song={open}
          roster={roster}
          bandName={bandName}
          answers={answersFor(open.id)}
          mine={mineFor(open.id)}
          busy={busy}
          onAnswer={(status) => answer(open.id, status)}
          onClose={() => setSongId(null)}
        />
      )}
    </>
  )
}
