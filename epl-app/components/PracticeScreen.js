// Practice: what each band is rehearsing, and when. Practices live in the
// PRACTICES table in Airtable; a skipped week is marked Cancelled there and
// shows here as called off rather than disappearing.
import { useMemo, useState } from 'react'
import { Clock, ListMusic, Navigation } from 'lucide-react'
import { useApp } from './context'
import { Panel, PageHead, TopBar, BandTag, DateTile, Modal, PersonAvatar, Chevron } from './ui'
import { sortedPractices, isMyPractice, isCancelled, ids, bandRoster, roleInBand } from '../lib/derive'
import { todayStr, fmtTime, fmtLong, countdown, mapsHref, plural } from '../lib/format'

export function practiceTime(p) {
  const s = fmtTime(p.fields['Start Time'])
  const e = fmtTime(p.fields['End Time'])
  return s && e ? `${s}–${e}` : s || ''
}

export function PracticeRow({ practice }) {
  const { idx, me, openPractice } = useApp()
  const f = practice.fields
  const band = idx.all('BANDS', f['Band'])[0]
  const cancelled = isCancelled(practice)
  const needed = me.type === 'member' && ids(f['Members Needed']).includes(me.id)
  return (
    <button className="agenda-row" data-cancelled={cancelled ? '' : undefined} onClick={() => openPractice(practice.id)}>
      <DateTile ds={f['Date']} />
      <span className="agenda-copy">
        <strong className="practice-title">{f['Practice'] || (band ? `${band.fields['Band Name']} practice` : 'Practice')}</strong>
        {band && <span className="agenda-meta"><BandTag name={band.fields['Band Name']} /></span>}
        {(practiceTime(practice) || f['Location']) && (
          <span className="agenda-meta">
            {practiceTime(practice) && <><Clock aria-hidden="true" />{practiceTime(practice)}</>}
            {practiceTime(practice) && f['Location'] && ' · '}
            {f['Location']}
          </span>
        )}
      </span>
      <span className="agenda-end">
        {cancelled ? <span className="pill pill-bad">Called off</span> : needed && <span className="pill pill-accent">You're needed</span>}
      </span>
    </button>
  )
}

export function PracticeModal({ practiceId, onClose }) {
  const { data, idx, openSetlist, openPerson } = useApp()
  const p = idx.get('PRACTICES', practiceId)
  if (!p) return null
  const f = p.fields
  const band = idx.all('BANDS', f['Band'])[0]
  const bandName = band?.fields['Band Name']
  const cancelled = isCancelled(p)
  const sets = idx.all('SETLISTS', f['Setlist'])
  const named = idx.all('MEMBERS', f['Members Needed'])
  const people = named.length ? named : (band ? bandRoster(data, band.id) : [])
  return (
    <Modal onClose={onClose} label="Practice">
      <div className="person-head" style={{ marginBottom: '0.75rem' }}>
        <p className="eyebrow">{fmtLong(f['Date'])} · {countdown(f['Date'])}</p>
        <h2>{f['Practice'] || (bandName ? `${bandName} practice` : 'Practice')}</h2>
        {bandName && <BandTag name={bandName} />}
        {cancelled && <span className="pill pill-bad">Called off</span>}
      </div>
      <dl className="rows practice-facts">
        {practiceTime(p) && <div className="kv"><dt>Time</dt><dd>{practiceTime(p)}</dd></div>}
        {f['Location'] && <div className="kv"><dt>Where</dt><dd>{f['Location']}</dd></div>}
      </dl>
      {f['Location'] && !cancelled && (
        <a className="button button-filled button-block" style={{ marginTop: '0.75rem' }} href={mapsHref(f['Location'])} target="_blank" rel="noopener noreferrer"><Navigation aria-hidden="true" />Directions</a>
      )}
      {sets.length > 0 && (
        <div className="practice-section">
          <span className="label">What to run</span>
          {sets.map(sl => (
            <button key={sl.id} className="row person-next" onClick={() => { onClose(); openSetlist(sl.id) }}>
              <span className="row-icon"><ListMusic aria-hidden="true" /></span>
              <span><span className="row-title">{sl.fields['Set Name'] || 'Setlist'}</span><span className="row-sub">{plural(ids(sl.fields['Songs']).length, 'song')}</span></span>
              <Chevron />
            </button>
          ))}
        </div>
      )}
      {people.length > 0 && (
        <div className="practice-section">
          <span className="label">{named.length ? "Who's needed" : 'Whole band'}</span>
          <ul className="practice-people">
            {people.map(m => (
              <li key={m.id}>
                <button onClick={() => { onClose(); openPerson(m, 'member') }}>
                  <PersonAvatar record={m} type="member" size={32} />
                  <span><span className="row-title">{m.fields['Member Name']}</span><span className="row-sub">{roleInBand(m, bandName)}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {f['Notes'] && (
        <div className="practice-section">
          <span className="label">Notes</span>
          <p className="practice-notes">{f['Notes']}</p>
        </div>
      )}
    </Modal>
  )
}

export default function PracticeScreen() {
  const { data, me, record } = useApp()
  const today = todayStr()
  const [view, setView] = useState(me.type === 'member' ? 'mine' : 'all')
  const [showPast, setShowPast] = useState(false)
  const all = useMemo(() => sortedPractices(data), [data])
  const list = view === 'mine' ? all.filter(p => isMyPractice(p, me, record)) : all
  const coming = list.filter(p => p.fields['Date'] >= today)
  const past = list.filter(p => p.fields['Date'] < today).reverse()

  return (
    <>
      <TopBar />
      <main className="content rise">
        <PageHead title="Practice" sub="What each band is rehearsing, and when." />
        {me.type === 'member' && (
          <div className="seg" role="group" aria-label="Which practices">
            <button aria-pressed={view === 'mine'} onClick={() => setView('mine')}>My practices</button>
            <button aria-pressed={view === 'all'} onClick={() => setView('all')}>All bands</button>
          </div>
        )}
        <Panel title="Coming up" count={coming.filter(p => !isCancelled(p)).length}>
          {coming.length ? (
            <ul className="agenda">{coming.map(p => <li key={p.id}><PracticeRow practice={p} /></li>)}</ul>
          ) : (
            <p className="empty">{view === 'mine' ? 'No practices scheduled for your bands yet.' : 'No practices scheduled yet.'}</p>
          )}
        </Panel>
        {past.length > 0 && (
          <Panel title="Past practices" count={past.length}>
            {showPast
              ? <ul className="agenda">{past.slice(0, 20).map(p => <li key={p.id}><PracticeRow practice={p} /></li>)}</ul>
              : <button className="fold" style={{ borderTop: 0 }} onClick={() => setShowPast(true)}>Show past practices</button>}
          </Panel>
        )}
      </main>
    </>
  )
}
