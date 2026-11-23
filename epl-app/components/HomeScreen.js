// Home: what needs you, your next show, this week, and what's coming up.
// Same order as StageKin's My Stage on a phone. On a show day, a show-day
// card leads: the countdown to the next call, the day's times, and one tap
// to directions and the setlist.
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Camera, Navigation, ListMusic, Check } from 'lucide-react'
import { useApp } from './context'
import { Panel, PageHead, ShowList, Chevron, BandTag, TopBar, PersonAvatar } from './ui'
import { myShows, upcoming, myBlackouts, blackoutCovers, needsYou, roleOnShow, sortedPractices, isMyPractice, isCancelled, setlistsForShow } from '../lib/derive'
import { PracticeRow } from './PracticeScreen'
import { todayStr, addDays, parseDate, fmtLong, fmtTime, fmtDate, countdown, firstName, plural, mapsHref } from '../lib/format'

// The time now, ticking every 30 seconds while the screen is open.
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30 * 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

const inHm = (ms) => {
  const mins = Math.max(1, Math.round(ms / 60000))
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`
}

// Today's show: what's next and when, every call time, and the way there.
function ShowDay({ show }) {
  const { idx, me, record, openShow, openSetlist } = useApp()
  const now = useNow()
  const f = show.fields
  const band = idx.all('BANDS', f['Band'])[0]
  const venue = idx.all('VENUES', f['Venue'])[0]?.fields || {}
  const address = venue['Address']
  const times = [
    ['Trailer load-in', f['Trailer Load-In Time']], ['Load in', f['Load-In Time']],
    ['Soundcheck', f['Sound Check Time']], ['Doors', f['Doors Time']],
    ['On stage', f['Start Time']], ['End', f['End Time']],
  ].filter(([, t]) => t && !Number.isNaN(new Date(t).getTime())).map(([label, t]) => ({ label, t, at: new Date(t).getTime() }))
  const next = times.find(x => x.at > now)
  const onStage = f['Start Time'] && now >= new Date(f['Start Time']).getTime() && (!f['End Time'] || now < new Date(f['End Time']).getTime())
  const status = !times.length ? "Times aren't set yet"
    : onStage ? 'On stage now'
    : next ? (next.label === 'End' ? 'Playing until ' + fmtTime(next.t) : `${next.label} in ${inHm(next.at - now)}`)
    : "That's a wrap. Nice work."
  const role = roleOnShow(show, me, record, idx)
  const sets = setlistsForShow(show, idx)
  const lineup = idx.all('MEMBERS', f['Members Playing']).filter(m => m.id !== me.id)

  return (
    <section className="next-card showday">
      <p className="eyebrow next-eyebrow"><span>Show day</span><span>{status}</span></p>
      <h2>{band?.fields['Band Name'] || f['Show Name']}</h2>
      <p>{[venue['Venue Name'], venue['City']].filter(Boolean).join(' · ')}{role && <><br />{role}</>}</p>
      {times.length > 0 && (
        <ol className="showday-times">
          {times.map(x => {
            const state = x.at <= now ? 'done' : x === next ? 'next' : ''
            return (
              <li key={x.label} data-state={state || undefined}>
                <span>{state === 'done' ? <Check aria-hidden="true" /> : null}{x.label}</span>
                <strong>{fmtTime(x.t)}</strong>
              </li>
            )
          })}
        </ol>
      )}
      {lineup.length > 0 && (
        <div className="showday-lineup" aria-label={`Playing with ${lineup.map(m => firstName(m.fields['Member Name'])).join(', ')}`}>
          {lineup.slice(0, 6).map(m => <PersonAvatar key={m.id} record={m} type="member" size={30} />)}
          <span>with {lineup.slice(0, 3).map(m => firstName(m.fields['Member Name'])).join(', ')}{lineup.length > 3 ? ` +${lineup.length - 3}` : ''}</span>
        </div>
      )}
      <div className="showday-actions">
        {address && <a className="button button-filled" href={mapsHref(address)} target="_blank" rel="noopener noreferrer"><Navigation aria-hidden="true" />Directions</a>}
        {sets[0] && <button className="button button-tinted" onClick={() => openSetlist(sets[0].id)}><ListMusic aria-hidden="true" />Setlist</button>}
        <button className="button button-tinted" onClick={() => openShow(show.id)}>Show details</button>
      </div>
    </section>
  )
}

function NeedsYou({ items }) {
  const { idx, openShow, openProfile } = useApp()
  return (
    <Panel title="Needs you" count={items.length} countTone="warn" className={items.length ? 'panel-needs' : ''}>
      {items.length ? (
        <ul className="rows">
          {items.map(item => {
            if (item.kind === 'conflict') {
              const band = idx.all('BANDS', item.show.fields['Band'])[0]
              return (
                <li key={item.key}>
                  <button className="row" onClick={() => openShow(item.show.id)}>
                    <span className="row-icon" data-tone="bad"><AlertTriangle aria-hidden="true" /></span>
                    <span>
                      <span className="row-title">You're blacked out for a show you're on</span>
                      <span className="row-sub">{fmtDate(item.show.fields['Date'])} · {band?.fields['Band Name'] || 'Show'}. Let Evan know.</span>
                    </span>
                    <Chevron />
                  </button>
                </li>
              )
            }
            return (
              <li key={item.key}>
                <button className="row" onClick={openProfile}>
                  <span className="row-icon"><Camera aria-hidden="true" /></span>
                  <span>
                    <span className="row-title">Add your photo</span>
                    <span className="row-sub">It's the face bandmates see on show lineups.</span>
                  </span>
                  <Chevron />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="empty">You're all caught up. Nothing is waiting on you.</p>
      )}
    </Panel>
  )
}

function NextShow({ show }) {
  const { idx, me, record, openShow, setTab } = useApp()
  if (!show) {
    return (
      <section className="next-card">
        <p className="eyebrow next-eyebrow"><span>Next on your schedule</span></p>
        <h2>Nothing booked for you yet</h2>
        <p>Keep your unavailable dates up to date. Your next show will appear here.</p>
        <div className="next-foot"><span /><button className="button button-filled" onClick={() => setTab('calendar')}>Open calendar</button></div>
      </section>
    )
  }
  const f = show.fields
  const band = idx.all('BANDS', f['Band'])[0]
  const venue = idx.all('VENUES', f['Venue'])[0]
  const calls = [
    f['Load-In Time'] && `Load in ${fmtTime(f['Load-In Time'])}`,
    f['Sound Check Time'] && `Soundcheck ${fmtTime(f['Sound Check Time'])}`,
    f['Start Time'] && `Set ${fmtTime(f['Start Time'])}`,
  ].filter(Boolean)
  const role = roleOnShow(show, me, record, idx)
  return (
    <section className="next-card">
      <p className="eyebrow next-eyebrow"><span>Next on your schedule</span><span>{countdown(f['Date'])}</span></p>
      <h2>{band?.fields['Band Name'] || f['Show Name']}</h2>
      <p>
        {[fmtLong(f['Date']), venue?.fields['Venue Name']].filter(Boolean).join(' · ')}
        {(calls.length > 0 || role) && <><br />{[...calls, role].filter(Boolean).join(' · ')}</>}
      </p>
      <div className="next-foot">
        {band ? <BandTag name={band.fields['Band Name']} /> : <span />}
        <button className="button button-filled" onClick={() => openShow(show.id)}>Open show</button>
      </div>
    </section>
  )
}

function ThisWeek({ shows, blackouts, practices }) {
  const { idx } = useApp()
  const today = todayStr()
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i))
  const [selected, setSelected] = useState(null)
  const showsOn = (ds) => shows.filter(s => s.fields['Date'] === ds)
  const outOn = (ds) => blackouts.some(b => blackoutCovers(b, ds))
  const practiceOn = (ds) => practices.filter(p => p.fields['Date'] === ds)
  const sel = selected && showsOn(selected)
  const selPractice = selected ? practiceOn(selected) : []
  return (
    <Panel title="This week">
      <div className="week">
        {days.map(ds => {
          const d = parseDate(ds)
          const n = showsOn(ds).length
          const np = practiceOn(ds).filter(p => !isCancelled(p)).length
          return (
            <button
              key={ds}
              className="week-day"
              data-today={ds === today ? '' : undefined}
              aria-pressed={selected === ds}
              aria-label={`${fmtLong(ds)}${n ? `, ${plural(n, 'show')}` : ''}${np ? `, ${plural(np, 'practice')}` : ''}${outOn(ds) ? ', blacked out' : ''}`}
              onClick={() => setSelected(selected === ds ? null : ds)}
            >
              <span className="wd">{d.toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
              <span className="dn">{d.getDate()}</span>
              <span className="dots">
                {n > 0 && <span className="dot" />}
                {np > 0 && <span className="dot dot-practice" />}
                {outOn(ds) && <span className="dot dot-out" />}
              </span>
            </button>
          )
        })}
      </div>
      {selected && (
        <div style={{ borderTop: '1px solid var(--separator)' }}>
          {sel.length > 0 && <ShowList shows={sel} open={5} />}
          {selPractice.length > 0 && <ul className="agenda" style={sel.length ? { borderTop: '1px solid var(--separator)' } : undefined}>{selPractice.map(p => <li key={p.id}><PracticeRow practice={p} /></li>)}</ul>}
          {!sel.length && !selPractice.length && (
            <p className="empty">{fmtLong(selected)}: {outOn(selected) ? "you're blacked out." : 'nothing on for you.'}</p>
          )}
        </div>
      )}
    </Panel>
  )
}

export default function HomeScreen() {
  const { data, me, record, idx } = useApp()
  const today = todayStr()
  const mine = useMemo(() => upcoming(myShows(data, me), today), [data, me, today])
  const blackouts = useMemo(() => myBlackouts(data, me), [data, me])
  const items = useMemo(() => needsYou(data, me, record), [data, me, record])
  const practices = useMemo(() => sortedPractices(data).filter(p => p.fields['Date'] >= today && isMyPractice(p, me, record)), [data, me, record, today])
  const nextPractice = practices.find(p => !isCancelled(p))
  const name = me.type === 'member' ? record.fields['Member Name'] : record.fields['Name']
  // Crew see which job they're booked for on each show.
  const roleFor = (s) => roleOnShow(s, me, record, idx)
  const todays = mine.find(s => s.fields['Date'] === today)
  return (
    <>
      <TopBar />
      <main className="content rise">
        <PageHead eyebrow={fmtLong(today)} title={`Hi, ${firstName(name)}`} />
        {todays && <ShowDay show={todays} />}
        <NeedsYou items={items} />
        {!todays && <NextShow show={mine[0]} />}
        {nextPractice && (
          <Panel title="Next practice">
            <ul className="agenda"><li><PracticeRow practice={nextPractice} /></li></ul>
          </Panel>
        )}
        <ThisWeek shows={mine} blackouts={blackouts} practices={practices} />
        <Panel title="My upcoming shows" count={mine.length}>
          <ShowList shows={mine} open={3} subFor={me.type === 'crew' ? roleFor : undefined} emptyText="No upcoming shows assigned yet." />
        </Panel>
      </main>
    </>
  )
}
