// Calendar: shows and the calendar in one tab.
// "Mine" is your shows and your unavailable dates; "All EPL" is every
// confirmed show and everyone who's out, which is what booking a weekend
// night needs. Tap a day for what's on it; mark yourself unavailable there.
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarX, Plus } from 'lucide-react'
import { useApp } from './context'
import { Panel, PageHead, ShowList, ShowRow, Sheet, Chevron, PersonAvatar, TopBar, CalendarSubscribe } from './ui'
import { sortedShows, myShows, upcoming, myBlackouts, blackoutsByDate, showsByDate, blackoutPeople, blackoutCovers, sortedPractices, isMyPractice, isCancelled, practicesByDate } from '../lib/derive'
import { PracticeRow } from './PracticeScreen'
import { MONTH_NAMES, todayStr, toDateStr, parseDate, fmtLong, fmtDate, plural } from '../lib/format'

const REASONS = ['Personal', 'Other Gig', 'Vacation', 'Illness', 'Family', 'Other']

// Add, change or delete one of your own unavailable dates.
export function BlackoutSheet({ existing, defaultDate, onClose }) {
  const { api, reload, toast } = useApp()
  const [start, setStart] = useState(existing?.fields['Date'] || defaultDate || todayStr())
  const [end, setEnd] = useState(existing?.fields['End Date'] || '')
  const [reason, setReason] = useState(existing?.fields['Reason'] || 'Personal')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function send(method, body) {
    const res = await api('/api/blackout', { method, body: JSON.stringify(body) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.error) throw new Error(json.error || 'Could not save')
  }

  async function save() {
    if (!start) { setError('Pick a date first'); return }
    if (end && end < start) { setError('"Through" is before the start date'); return }
    setBusy(true); setError(null)
    try {
      const fields = { Date: start, 'End Date': end && end !== start ? end : null, Reason: reason }
      if (existing) await send('PATCH', { recordId: existing.id, fields })
      else await send('POST', fields)
      await reload()
      toast(existing ? 'Blackout updated' : 'Blackout added')
      onClose()
    } catch (e) { setError(e.message); setBusy(false) }
  }

  async function remove() {
    if (!window.confirm('Remove this blackout date?')) return
    setBusy(true); setError(null)
    try {
      await send('DELETE', { recordId: existing.id })
      await reload()
      toast('Blackout removed')
      onClose()
    } catch (e) { setError(e.message); setBusy(false) }
  }

  return (
    <Sheet onClose={onClose} label={existing ? 'Edit blackout date' : 'Add blackout dates'}>
      <h2>{existing ? 'Edit blackout date' : 'Add blackout dates'}</h2>
      <p className="row-sub">Dates you can't play. Pick one day, or a run of days with Through.</p>
      <div className="sheet-section">
        <div className="field-grid">
          <label className="label">Date
            <input className="input" type="date" value={start} onChange={e => { setStart(e.target.value); setError(null) }} />
          </label>
          <label className="label">Through <span style={{ fontWeight: 400 }}>(optional)</span>
            <input className="input" type="date" value={end} min={start} onChange={e => { setEnd(e.target.value); setError(null) }} />
          </label>
        </div>
      </div>
      <div className="sheet-section">
        <span className="label">Reason</span>
        <div className="chips">
          {REASONS.map(r => <button key={r} className="chip" aria-pressed={reason === r} onClick={() => setReason(r)}>{r}</button>)}
        </div>
        <p className="row-sub">Bandmates see the reason on the calendar.</p>
      </div>
      {error && <p className="form-error" style={{ marginTop: '0.9rem' }}>{error}</p>}
      <div className="sheet-section">
        <button className="button button-filled button-block" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        {existing && <button className="button button-danger button-block" onClick={remove} disabled={busy}>Remove blackout</button>}
        <button className="button button-tinted button-block" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </Sheet>
  )
}

function MonthGrid({ month, selected, onSelect, showsMap, outMap, practiceMap }) {
  const today = todayStr()
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < first.getDay(); i++) cells.push(null)
  for (let d = 1; d <= daysIn; d++) cells.push(toDateStr(new Date(month.getFullYear(), month.getMonth(), d)))
  return (
    <div className="month-grid" role="grid">
      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => <div key={i} className="month-wd" aria-hidden="true">{w}</div>)}
      {cells.map((ds, i) => {
        if (!ds) return <div key={'b' + i} className="month-day blank" />
        const dow = parseDate(ds).getDay()
        const n = (showsMap[ds] || []).length
        const out = (outMap[ds] || []).length
        const np = (practiceMap[ds] || []).filter(p => !isCancelled(p)).length
        return (
          <button
            key={ds}
            className="month-day"
            data-today={ds === today ? '' : undefined}
            data-past={ds < today ? '' : undefined}
            data-weekend={dow === 5 || dow === 6 ? '' : undefined}
            aria-pressed={selected === ds}
            aria-label={`${fmtLong(ds)}${n ? `, ${plural(n, 'show')}` : ''}${np ? `, ${plural(np, 'practice')}` : ''}${out ? `, ${out} out` : ''}`}
            onClick={() => onSelect(selected === ds ? null : ds)}
          >
            <span className="dn">{parseDate(ds).getDate()}</span>
            <span className="dots">
              {n > 0 && <span className="dot" />}
              {np > 0 && <span className="dot dot-practice" />}
              {out > 0 && <span className="dot dot-out" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default function CalendarScreen() {
  const { data, me, record, idx, openPerson } = useApp()
  const today = todayStr()
  const [view, setView] = useState('mine')
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [selected, setSelected] = useState(null)
  const [sheet, setSheet] = useState(null) // { existing } or { defaultDate }

  const mineShows = useMemo(() => myShows(data, me), [data, me])
  const allShows = useMemo(() => sortedShows(data), [data])
  const mineOut = useMemo(() => myBlackouts(data, me), [data, me])
  const allOut = useMemo(() => (data['BLACKOUT DATES'] || []).filter(b => blackoutPeople(b, idx).length), [data, idx])

  const shows = view === 'mine' ? mineShows : allShows
  const allPractices = useMemo(() => sortedPractices(data), [data])
  const practices = view === 'mine' ? allPractices.filter(p => isMyPractice(p, me, record)) : allPractices
  const practiceMap = useMemo(() => practicesByDate(practices), [practices])
  const showsMap = useMemo(() => showsByDate(shows), [shows])
  const outMap = useMemo(() => blackoutsByDate(view === 'mine' ? mineOut : allOut), [view, mineOut, allOut])

  // The availability question for a month: of the Friday and Saturday nights
  // still to come, how many are booked, have someone out, or are open.
  const summary = useMemo(() => {
    if (view !== 'all') return null
    const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    let booked = 0, out = 0, open = 0
    for (let d = 1; d <= daysIn; d++) {
      const dt = new Date(month.getFullYear(), month.getMonth(), d)
      const ds = toDateStr(dt)
      if ((dt.getDay() !== 5 && dt.getDay() !== 6) || ds < today) continue
      if (showsMap[ds]) booked++
      else if (outMap[ds]) out++
      else open++
    }
    return { booked, out, open }
  }, [view, month, showsMap, outMap, today])

  const step = (n) => { setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1)); setSelected(null) }
  const selShows = selected ? (showsMap[selected] || []) : []
  const selOut = selected ? (outMap[selected] || []) : []
  const selPractice = selected ? (practiceMap[selected] || []) : []
  const comingUp = upcoming(shows, today)
  const myUpcomingOut = mineOut.filter(b => (b.fields['End Date'] || b.fields['Date']) >= today)

  return (
    <>
      <TopBar />
      <main className="content rise">
        <PageHead title="Calendar" sub={view === 'mine' ? 'Your shows and your blackout dates.' : 'Every confirmed Echo Play Live show, and who’s out.'} />
        <div className="seg" role="group" aria-label="Which calendar">
          <button aria-pressed={view === 'mine'} onClick={() => { setView('mine'); setSelected(null) }}>Personal</button>
          <button aria-pressed={view === 'all'} onClick={() => { setView('all'); setSelected(null) }}>Echo Play Live</button>
        </div>
        <button className="button button-filled button-block" onClick={() => setSheet({ defaultDate: selected && selected >= today ? selected : today })}>
          <CalendarX aria-hidden="true" />Add blackout dates
        </button>

        <section className="panel">
          <div className="month-head">
            <h2>{MONTH_NAMES[month.getMonth()]} {month.getFullYear()}</h2>
            <div className="month-nav">
              <button className="icon-btn" onClick={() => step(-1)} aria-label="Previous month"><ChevronLeft /></button>
              <button className="icon-btn" onClick={() => step(1)} aria-label="Next month"><ChevronRight /></button>
            </div>
          </div>
          <MonthGrid month={month} selected={selected} onSelect={setSelected} showsMap={showsMap} outMap={outMap} practiceMap={practiceMap} />
          {summary && (
            <div className="cal-summary">
              <span className="pill pill-accent">{summary.booked} booked</span>
              <span className="pill pill-bad">{summary.out} with someone out</span>
              <span className="pill">{summary.open} open Fri/Sat</span>
            </div>
          )}
        </section>

        {selected && (
          <Panel title={fmtLong(selected)}>
            {selShows.length > 0 && <ul className="agenda">{selShows.map(s => <li key={s.id}><ShowRow show={s} /></li>)}</ul>}
            {selPractice.length > 0 && <ul className="agenda" style={selShows.length ? { borderTop: '1px solid var(--separator)' } : undefined}>{selPractice.map(p => <li key={p.id}><PracticeRow practice={p} /></li>)}</ul>}
            {selOut.length > 0 && (
              <ul className="rows" style={selShows.length || selPractice.length ? { borderTop: '1px solid var(--separator)' } : undefined}>
                {view === 'mine'
                  ? selOut.map(b => (
                    <li key={b.id}>
                      <button className="row" onClick={() => setSheet({ existing: b })}>
                        <span className="row-icon" data-tone="bad"><CalendarX aria-hidden="true" /></span>
                        <span><span className="row-title">You're blacked out</span><span className="row-sub">{b.fields['Reason'] || 'No reason given'} · tap to edit</span></span>
                        <Chevron />
                      </button>
                    </li>
                  ))
                  : selOut.flatMap(b => blackoutPeople(b, idx).map(p => (
                    <li key={b.id + p.record.id}>
                      <button className="row" onClick={() => openPerson(p.record, p.type)}>
                        <PersonAvatar record={p.record} type={p.type} size={36} />
                        <span><span className="row-title">{p.name}</span><span className="row-sub">Out{b.fields['Reason'] ? ` · ${b.fields['Reason']}` : ''}</span></span>
                        <Chevron />
                      </button>
                    </li>
                  )))}
              </ul>
            )}
            {!selShows.length && !selOut.length && !selPractice.length && <p className="empty">Nothing on this day.</p>}
            {/* From either view, as long as you aren't already out that day. */}
            {selected >= today && !mineOut.some(b => blackoutCovers(b, selected)) && (
              <div className="panel-body"><button className="button button-tinted button-block" onClick={() => setSheet({ defaultDate: selected })}><CalendarX aria-hidden="true" />Black out this date</button></div>
            )}
          </Panel>
        )}

        <Panel title={view === 'mine' ? 'Coming up for you' : 'All upcoming shows'} count={comingUp.length}>
          <ShowList shows={comingUp} open={view === 'mine' ? 6 : 8} emptyText="Nothing coming up yet." />
        </Panel>

        {view === 'mine' && (
          <Panel
            title="My blackout dates"
            count={myUpcomingOut.length}
            action={<button className="text-link" onClick={() => setSheet({ defaultDate: today })}><Plus size={16} aria-hidden="true" />Add</button>}
          >
            {myUpcomingOut.length ? (
              <ul className="rows">
                {myUpcomingOut.map(b => {
                  const end = b.fields['End Date']
                  return (
                    <li key={b.id}>
                      <button className="row row-plain" onClick={() => setSheet({ existing: b })}>
                        <span>
                          <span className="row-title">{end && end !== b.fields['Date'] ? `${fmtDate(b.fields['Date'])} – ${fmtDate(end)}` : fmtDate(b.fields['Date'])}</span>
                          <span className="row-sub">{b.fields['Reason'] || 'No reason given'}</span>
                        </span>
                        <Chevron />
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : <p className="empty">None coming up. Add any dates you can't play so Evan knows before booking.</p>}
          </Panel>
        )}
        <Panel title="In your phone's calendar">
          <div className="panel-body"><CalendarSubscribe /></div>
        </Panel>
      </main>
      {sheet && <BlackoutSheet existing={sheet.existing} defaultDate={sheet.defaultDate} onClose={() => setSheet(null)} />}
    </>
  )
}
