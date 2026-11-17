// Setlists and the song page they share with the Songs tab.
// A setlist reads like the stage sheet: songs grouped into tuning blocks.
// Each song says who knows it, and members mark their own answer.
import { useEffect, useMemo, useState } from 'react'
import { ListMusic, ExternalLink } from 'lucide-react'
import { useApp } from './context'
import { Panel, BandTag, Chevron, Modal, PersonAvatar, TopBar } from './ui'
import { myShows, upcoming, ids, tuningBlocks, knowledgeIndex, bandRoster, knowledgeSummary, KNOWLEDGE, roleInBand, SONG_STATUS } from '../lib/derive'
import { fmtDate, fmtDur, fmtSetLength, setlistNotes, todayStr, plural, firstName } from '../lib/format'

export const STATUS_PILL = { 'Know it': 'pill-good', 'Learning': 'pill-warn', 'To learn': '' }

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

// "Who knows it" across EPL, for a song no band plays yet: only people who
// have answered are listed, so nobody is counted as not knowing it.
function everyoneSummary(answers, roster) {
  const knows = roster.filter(m => answers?.get(m.id) === 'Know it')
  const working = roster.filter(m => ['Learning', 'To learn'].includes(answers?.get(m.id)))
  if (knows.length) return { text: knows.length === 1 ? `${firstName(knows[0].fields['Member Name'])} knows it` : `${knows.length} people know it`, tone: 'good' }
  if (working.length) return { text: `${working.map(m => firstName(m.fields['Member Name'])).join(', ')} still on it`, tone: 'warn' }
  return null
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
  const summary = everyone ? everyoneSummary(answers, roster) : knowledgeSummary(answers, roster)
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

      {roster.length > 0 && (
        <div className="practice-section">
          <span className="label">{everyone ? 'Who knows it in Echo Play Live' : `Who knows it${bandName ? ` in ${bandName}` : ''}`}</span>
          {summary && <p className={`knowledge-line tone-${summary.tone}`}>{summary.text}</p>}
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

      {(guitar.length > 0 || bass.length > 0) && (
        <div className="practice-section">
          {guitar.length > 0 && <><span className="label">Guitar, low to high</span><div className="strings">{guitar.map((s, i) => <div className="string" key={i}><span>{s.name}</span><strong>{s.note}</strong></div>)}</div></>}
          {bass.length > 0 && <><span className="label" style={{ marginTop: guitar.length ? '0.6rem' : 0 }}>Bass, low to high</span><div className="strings">{bass.map((s, i) => <div className="string" key={i}><span>{s.name}</span><strong>{s.note}</strong></div>)}</div></>}
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
    </Modal>
  )
}

export function SetlistScreen({ setlistId, onBack }) {
  const { data, idx, me } = useApp()
  const [songId, setSongId] = useState(null)
  useEffect(() => { window.scrollTo(0, 0) }, [setlistId])
  const knowledge = useMemo(() => knowledgeIndex(data), [data])
  const { answersFor, mineFor, answer, busy } = useSongAnswers(knowledge)

  const sl = idx.get('SETLISTS', setlistId)
  if (!sl) return (<><TopBar title="Setlist" onBack={onBack} /><main className="content"><p className="empty">This setlist isn't available any more.</p></main></>)
  const f = sl.fields
  const songs = idx.all('SONGS', f['Songs'])
  const band = idx.all('BANDS', f['Band'])[0]
  const bandName = band?.fields['Band Name']
  const roster = band ? bandRoster(data, band.id) : []
  const notes = setlistNotes(f['Notes'])
  const blocks = tuningBlocks(songs)

  const counts = me.type === 'member' ? KNOWLEDGE.map(s => [s, songs.filter(s2 => mineFor(s2.id) === s).length]) : []
  const unmarked = songs.filter(s => !mineFor(s.id)).length

  const open = songId ? songs.find(s => s.id === songId) : null

  return (
    <>
      <TopBar title={f['Set Name'] || 'Setlist'} onBack={onBack} />
      <main className="content rise">
        <header className="page-head">
          <p className="eyebrow">{[plural(songs.length, 'song'), fmtSetLength(f['Duration'])].filter(Boolean).join(' · ')}</p>
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
        <section className="panel">
          {blocks.length ? blocks.map((block, bi) => (
            <div key={bi}>
              <div className="tuning-head"><span>Tuning <strong>{block.tuning}</strong></span><span>{plural(block.songs.length, 'song')}</span></div>
              <ul className="rows">
                {block.songs.map(({ song: s, n }) => {
                  const summary = knowledgeSummary(answersFor(s.id), roster)
                  const mine = mineFor(s.id)
                  return (
                    <li key={s.id + n}>
                      <button className="row" onClick={() => setSongId(s.id)}>
                        <span className="song-num">{n}</span>
                        <span>
                          <span className="row-title">{s.fields['Song Title']}</span>
                          <span className="row-sub">{[s.fields['Artist'], fmtDur(s.fields['Duration'])].filter(Boolean).join(' · ')}</span>
                          {summary && <span className={`knowledge-line tone-${summary.tone}`}>{summary.text}</span>}
                        </span>
                        <span className="row-end">{mine ? <span className={`pill ${STATUS_PILL[mine]}`}>{mine}</span> : (s.fields['Key'] || '')}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )) : <p className="empty">No songs on this setlist yet.</p>}
        </section>
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
