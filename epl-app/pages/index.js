import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'

const BAND_COLORS = {
  'So Long Goodnight': { bg: '#1a2e1a', color: '#6bcb77' },
  'The Dick Beldings': { bg: '#1a1a2e', color: '#a78bfa' },
  'Jambi':             { bg: '#2e1a1a', color: '#ff9f7f' },
  'Elite':             { bg: '#1a2a2e', color: '#7ecbcb' },
}

function BandTag({ name }) {
  const c = BAND_COLORS[name] || { bg: '#1a1a2e', color: '#a78bfa' }
  return <span className="band-tag" style={{ background: c.bg, color: c.color }}>{name}</span>
}

function StatusPill({ status }) {
  if (!status) return null
  const l = status.toLowerCase()
  const cls = l.includes('confirm') ? 'pill-confirmed' : l.includes('hold') ? 'pill-hold' : l.includes('complet') ? 'pill-completed' : l.includes('new') ? 'pill-new' : 'pill-inquiry'
  return <span className={`pill ${cls}`}>{status}</span>
}

function fmt(d) {
  if (!d) return '—'
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return d }
}

function cur(n) {
  if (!n && n !== 0) return '—'
  return '$' + Math.round(Number(n)).toLocaleString()
}

function initials(name) {
  return (name || '?').split(' ').map(x => x[0]).join('').toUpperCase().slice(0, 2)
}

function Avatar({ name, size = 38 }) {
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size < 35 ? 11 : 13 }}>
      {initials(name)}
    </div>
  )
}

export default function Home() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [role, setRole] = useState('admin')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/airtable')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function resolveLinked(ids, table, field) {
    if (!ids || !Array.isArray(ids) || !data) return []
    return ids.map(id => {
      const r = (data[table] || []).find(x => x.id === id)
      return r ? (r.fields[field] || '?') : '?'
    })
  }

  const nav = [
    { section: 'Overview' },
    { id: 'dashboard', label: 'Dashboard', color: '#a78bfa' },
    { id: 'shows', label: 'Shows', color: '#6bcb77' },
    { id: 'finances', label: 'Finances', color: '#ffd166' },
    { section: 'People' },
    { id: 'members', label: 'Members', color: '#7ecbcb' },
    { id: 'availability', label: 'Availability', color: '#ff9f7f' },
    { section: 'Operations' },
    { id: 'venues', label: 'Venue CRM', color: '#a78bfa' },
    { id: 'inquiries', label: 'Inquiries', color: '#6bcb77' },
    { id: 'promote', label: 'Promote', color: '#ffd166' },
  ]

  return (
    <>
      <Head>
        <title>Echo Play Live</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="logo-mark">EPL</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Echo Play Live</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Band Management</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select className="role-select" value={role} onChange={e => { setRole(e.target.value); setPage(e.target.value === 'admin' ? 'dashboard' : e.target.value === 'member' ? 'member-portal' : 'booking') }}>
            <option value="admin">Admin (Evan)</option>
            <option value="member">Member view</option>
            <option value="public">Public booking</option>
          </select>
          <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>ER</div>
        </div>
      </div>

      <div className="layout">
        {role === 'admin' && (
          <div className="sidebar">
            {nav.map((item, i) =>
              item.section ? (
                <div key={i} className="nav-section">{item.section}</div>
              ) : (
                <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}>
                  <div className="nav-dot" style={{ background: item.color }} />
                  {item.label}
                </button>
              )
            )}
            <div className="nav-section">Data</div>
            <button className="nav-item" onClick={loadData}>
              <div className="nav-dot" style={{ background: '#9ca3af' }} />
              Refresh
            </button>
          </div>
        )}

        <div className="main">
          {loading && <div className="loading"><div className="spinner" /><span>Loading from Airtable...</span></div>}
          {error && <div className="alert alert-error">Connection error: {error}</div>}

          {!loading && data && (
            <>
              {page === 'dashboard' && <Dashboard data={data} resolveLinked={resolveLinked} />}
              {page === 'shows' && <Shows data={data} resolveLinked={resolveLinked} />}
              {page === 'finances' && <Finances data={data} resolveLinked={resolveLinked} />}
              {page === 'members' && <Members data={data} resolveLinked={resolveLinked} />}
              {page === 'availability' && <Availability data={data} resolveLinked={resolveLinked} />}
              {page === 'venues' && <Venues data={data} resolveLinked={resolveLinked} />}
              {page === 'inquiries' && <Inquiries data={data} resolveLinked={resolveLinked} />}
              {page === 'promote' && <Promote data={data} resolveLinked={resolveLinked} />}
              {page === 'member-portal' && <MemberPortal data={data} resolveLinked={resolveLinked} />}
              {page === 'booking' && <Booking data={data} />}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function Dashboard({ data, resolveLinked }) {
  const shows = data['SHOWS'] || []
  const members = data['MEMBERS'] || []
  const venues = data['VENUES'] || []
  const inquiries = data['INQUIRIES'] || []
  const today = new Date()
  const upcoming = shows.filter(s => s.fields['Date'] && new Date(s.fields['Date']) >= today)
    .sort((a, b) => a.fields['Date'] > b.fields['Date'] ? 1 : -1).slice(0, 6)
  const totalRev = shows.reduce((a, s) => a + Number(s.fields['Performance Rate'] || 0), 0)
  const totalEPL = shows.reduce((a, s) => a + Number(s.fields['EPL Fee'] || 0), 0)
  const newInq = inquiries.filter(i => (i.fields['Status'] || '').toLowerCase() === 'new').length

  return (
    <div>
      <div className="page-title">Dashboard</div>
      <div className="page-sub">Connected to Airtable · {shows.length} shows · {members.length} members · {venues.length} venues</div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-label">Total revenue</div><div className="stat-val">{cur(totalRev)}</div><div className="stat-sub">all bands</div></div>
        <div className="stat"><div className="stat-label">EPL fees</div><div className="stat-val">{cur(totalEPL)}</div><div className="stat-sub">management</div></div>
        <div className="stat"><div className="stat-label">Shows booked</div><div className="stat-val">{shows.length}</div><div className="stat-sub">{members.length} members</div></div>
        <div className="stat"><div className="stat-label">New inquiries</div><div className="stat-val">{newInq}</div><div className="stat-sub">awaiting review</div></div>
      </div>

      <div className="two-col">
        <div>
          <div className="section-label">Upcoming shows</div>
          <div className="card">
            <table>
              <thead><tr><th>Date</th><th>Band</th><th>Venue</th><th>Rate</th></tr></thead>
              <tbody>
                {upcoming.length ? upcoming.map(s => {
                  const f = s.fields
                  const bands = resolveLinked(f['Band'], 'BANDS', 'Band Name')
                  const vs = resolveLinked(f['Venue'], 'VENUES', 'Venue Name')
                  return <tr key={s.id}><td>{fmt(f['Date'])}</td><td>{bands.map((b, i) => <BandTag key={i} name={b} />)}</td><td>{vs[0] || '—'}</td><td>{cur(f['Performance Rate'])}</td></tr>
                }) : <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--hint)', padding: '1.5rem' }}>No upcoming shows yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div className="section-label">Bands</div>
          <div className="card card-body">
            {(data['BANDS'] || []).map(b => {
              const f = b.fields
              const name = f['Band Name'] || '—'
              const c = BAND_COLORS[name] || { color: '#a78bfa' }
              return (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontWeight: 500, fontSize: 13 }}>{name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{f['Genre'] || ''}</div>
                  <div style={{ fontSize: 12, color: 'var(--hint)' }}>{Number(f['Total Shows 2026'] || 0)} shows</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="section-label" style={{ marginTop: '0.5rem' }}>Member roster</div>
      <div className="card card-body">
        <div className="three-col">
          {(data['MEMBERS'] || []).map(m => {
            const f = m.fields
            const name = f['Member Name'] || '—'
            const bands = resolveLinked(f['Primary Bands'], 'BANDS', 'Band Name')
            const subs = resolveLinked(f['Can Sub For'], 'BANDS', 'Band Name')
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 10, background: 'var(--surface2)', borderRadius: 8 }}>
                <Avatar name={name} size={30} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{(f['Instruments'] || []).join(', ') || '—'}</div>
                  <div>{bands.map((b, i) => <BandTag key={i} name={b} />)}</div>
                  {subs.length > 0 && <div style={{ fontSize: 10, color: 'var(--hint)', marginTop: 2 }}>Sub: {subs.join(', ')}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Shows({ data, resolveLinked }) {
  const [filter, setFilter] = useState('all')
  const bands = ['all', ...(data['BANDS'] || []).map(b => b.fields['Band Name'])]
  let shows = [...(data['SHOWS'] || [])].sort((a, b) => a.fields['Date'] > b.fields['Date'] ? 1 : -1)
  if (filter !== 'all') shows = shows.filter(s => resolveLinked(s.fields['Band'], 'BANDS', 'Band Name').includes(filter))

  return (
    <div>
      <div className="page-title">Shows</div>
      <div className="page-sub">All events across every band</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        {bands.map(b => {
          const c = BAND_COLORS[b] || {}
          return (
            <button key={b} onClick={() => setFilter(b)} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, border: '0.5px solid', borderColor: filter === b ? (c.bg || '#1a1a2e') : 'var(--border2)', background: filter === b ? (c.bg || '#1a1a2e') : 'transparent', color: filter === b ? (c.color || '#a78bfa') : 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
              {b === 'all' ? 'All shows' : b}
            </button>
          )
        })}
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Date</th><th>Band</th><th>Venue</th><th>Rate</th><th>EPL Fee</th><th>Net</th><th>Status</th></tr></thead>
          <tbody>
            {shows.map(s => {
              const f = s.fields
              const bands = resolveLinked(f['Band'], 'BANDS', 'Band Name')
              const vs = resolveLinked(f['Venue'], 'VENUES', 'Venue Name')
              return <tr key={s.id}><td>{fmt(f['Date'])}</td><td>{bands.map((b, i) => <BandTag key={i} name={b} />)}</td><td style={{ fontSize: 12 }}>{vs[0] || '—'}</td><td>{cur(f['Performance Rate'])}</td><td style={{ color: 'var(--muted)' }}>{cur(f['EPL Fee'])}</td><td style={{ fontWeight: 500 }}>{cur(f['Net Income'])}</td><td><StatusPill status={f['Status']} /></td></tr>
            })}
            {!shows.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--hint)', padding: '2rem' }}>No shows found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Finances({ data, resolveLinked }) {
  const shows = data['SHOWS'] || []
  const totalRev = shows.reduce((a, s) => a + Number(s.fields['Performance Rate'] || 0), 0)
  const totalEPL = shows.reduce((a, s) => a + Number(s.fields['EPL Fee'] || 0), 0)
  const totalExp = shows.reduce((a, s) => a + Number(s.fields['Total Expenses'] || 0), 0)
  const totalPayout = shows.reduce((a, s) => a + Number(s.fields['Band Payout'] || 0), 0)
  const sorted = [...shows].sort((a, b) => a.fields['Date'] > b.fields['Date'] ? 1 : -1)

  return (
    <div>
      <div className="page-title">Finances</div>
      <div className="page-sub">P&L per show and band</div>
      <div className="stat-grid">
        <div className="stat"><div className="stat-label">Performance fees</div><div className="stat-val">{cur(totalRev)}</div></div>
        <div className="stat"><div className="stat-label">EPL fees</div><div className="stat-val">{cur(totalEPL)}</div></div>
        <div className="stat"><div className="stat-label">Total expenses</div><div className="stat-val">{cur(totalExp)}</div></div>
        <div className="stat"><div className="stat-label">Band payouts</div><div className="stat-val">{cur(totalPayout)}</div></div>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Date</th><th>Band</th><th>Venue</th><th>Rate</th><th>EPL</th><th>Trailer</th><th>Audio</th><th>Ads</th><th>Net</th><th>Payout</th><th>Status</th></tr></thead>
          <tbody>
            {sorted.map(s => {
              const f = s.fields
              const bands = resolveLinked(f['Band'], 'BANDS', 'Band Name')
              const vs = resolveLinked(f['Venue'], 'VENUES', 'Venue Name')
              return <tr key={s.id}><td>{fmt(f['Date'])}</td><td>{bands.map((b, i) => <BandTag key={i} name={b} />)}</td><td style={{ fontSize: 12 }}>{vs[0] || '—'}</td><td>{cur(f['Performance Rate'])}</td><td style={{ color: 'var(--muted)' }}>{cur(f['EPL Fee'])}</td><td style={{ color: 'var(--muted)' }}>{cur(f['Trailer Cost'])}</td><td style={{ color: 'var(--muted)' }}>{cur(f['Audio Engineer Cost'])}</td><td style={{ color: 'var(--muted)' }}>{cur(f['Social Ads Spend'])}</td><td style={{ fontWeight: 500 }}>{cur(f['Net Income'])}</td><td style={{ color: '#a78bfa' }}>{cur(f['Band Payout'])}</td><td><StatusPill status={f['Status']} /></td></tr>
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Members({ data, resolveLinked }) {
  return (
    <div>
      <div className="page-title">Members</div>
      <div className="page-sub">Roster, instruments, sub coverage</div>
      <div className="three-col">
        {(data['MEMBERS'] || []).map(m => {
          const f = m.fields
          const name = f['Member Name'] || '—'
          const bands = resolveLinked(f['Primary Bands'], 'BANDS', 'Band Name')
          const subs = resolveLinked(f['Can Sub For'], 'BANDS', 'Band Name')
          return (
            <div key={m.id} className="member-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Avatar name={name} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{(f['Instruments'] || []).join(', ') || f['Role/Instrument'] || '—'}</div>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--hint)', marginBottom: 4 }}>Primary bands</div>
                {bands.length ? bands.map((b, i) => <BandTag key={i} name={b} />) : <span style={{ fontSize: 12, color: 'var(--hint)' }}>—</span>}
              </div>
              {subs.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--hint)', marginBottom: 4 }}>Can sub for</div>
                  {subs.map((b, i) => <BandTag key={i} name={b} />)}
                </div>
              )}
              <div style={{ paddingTop: 10, borderTop: '0.5px solid var(--border)', fontSize: 12, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{f['Experience Level'] || 'Primary'}</span>
                <span style={{ color: f['Active'] === false ? 'var(--danger-text)' : 'var(--success-text)' }}>{f['Active'] === false ? 'Inactive' : 'Active'}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Availability({ data, resolveLinked }) {
  const [selectedMember, setSelectedMember] = useState('')
  const today = new Date()
  const year = today.getFullYear(), month = today.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthName = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const showDates = new Set((data['SHOWS'] || []).map(s => s.fields['Date']).filter(Boolean))
  const blackoutDates = new Set((data['BLACKOUT DATES'] || []).map(b => b.fields['Date']).filter(Boolean))
  const upcoming = (data['SHOWS'] || []).filter(s => s.fields['Date'] && new Date(s.fields['Date']) >= today).sort((a, b) => a.fields['Date'] > b.fields['Date'] ? 1 : -1)

  const conflicts = []
  upcoming.forEach(show => {
    const showDate = show.fields['Date'];
    (data['BLACKOUT DATES'] || []).forEach(b => {
      if (b.fields['Date'] === showDate) {
        const mids = b.fields['Member'] || []
        const mRec = (data['MEMBERS'] || []).find(m => Array.isArray(mids) ? mids.includes(m.id) : mids === m.id)
        if (mRec) {
          const bands = resolveLinked(show.fields['Band'], 'BANDS', 'Band Name')
          const vs = resolveLinked(show.fields['Venue'], 'VENUES', 'Venue Name')
          conflicts.push({ date: showDate, member: mRec.fields['Member Name'] || 'Unknown', band: bands[0] || '—', venue: vs[0] || '—' })
        }
      }
    })
  })

  const myShows = selectedMember ? (data['SHOWS'] || []).filter(s => {
    const mp = s.fields['Members Playing'] || []
    return Array.isArray(mp) && mp.includes(selectedMember) && new Date(s.fields['Date'] || '') >= today
  }).sort((a, b) => a.fields['Date'] > b.fields['Date'] ? 1 : -1) : []

  const myBlackouts = selectedMember ? (data['BLACKOUT DATES'] || []).filter(b => {
    const bm = b.fields['Member'] || []
    return Array.isArray(bm) ? bm.includes(selectedMember) : bm === selectedMember
  }) : []

  const days = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ d, ds, hasShow: showDates.has(ds), isBlock: blackoutDates.has(ds), isToday: d === today.getDate() })
  }

  return (
    <div>
      <div className="page-title">Availability & conflicts</div>
      <div className="page-sub">Blackout dates, show conflicts, and member schedules</div>
      <div className="two-col">
        <div>
          <div className="section-label">{monthName}</div>
          <div className="card card-body">
            <div className="cal-grid">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} className="cal-header">{d}</div>)}
              {days.map((day, i) => day ? (
                <div key={i} className={`cal-day ${day.hasShow ? 'has-show' : ''} ${day.isBlock && !day.hasShow ? 'blocked' : ''} ${day.isToday ? 'today' : ''}`}>
                  <span className="cal-num">{day.d}</span>
                  {day.hasShow && <span className="cal-label show">gig</span>}
                  {day.isBlock && !day.hasShow && <span className="cal-label block">out</span>}
                </div>
              ) : <div key={i} />)}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 10, borderTop: '0.5px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)' }}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#1a1a2e' }} />Show booked</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)' }}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#2e1a1a' }} />Member blackout</div>
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <div className="section-label">Member schedule lookup</div>
            <div className="card card-body">
              <select className="form-input" style={{ marginBottom: 12 }} value={selectedMember} onChange={e => setSelectedMember(e.target.value)}>
                <option value="">— select member —</option>
                {(data['MEMBERS'] || []).map(m => <option key={m.id} value={m.id}>{m.fields['Member Name'] || '—'}</option>)}
              </select>
              {selectedMember && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Upcoming shows</div>
                  {myShows.length ? myShows.map(s => {
                    const bands = resolveLinked(s.fields['Band'], 'BANDS', 'Band Name')
                    const vs = resolveLinked(s.fields['Venue'], 'VENUES', 'Venue Name')
                    return <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid var(--border)', fontSize: 12 }}><span>{fmt(s.fields['Date'])}</span><span>{bands.map((b, i) => <BandTag key={i} name={b} />)}</span><span style={{ color: 'var(--muted)' }}>{vs[0] || '—'}</span></div>
                  }) : <div style={{ fontSize: 12, color: 'var(--hint)' }}>No upcoming shows assigned.</div>}
                  {myBlackouts.length > 0 && <>
                    <div style={{ fontSize: 13, fontWeight: 500, margin: '10px 0 6px' }}>Blackout dates</div>
                    {myBlackouts.map((b, i) => <div key={i} style={{ fontSize: 12, color: 'var(--warning-text)', padding: '4px 0' }}>{fmt(b.fields['Date'])} — {b.fields['Reason'] || '—'}</div>)}
                  </>}
                </>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="section-label">Booking conflicts ({conflicts.length})</div>
          {conflicts.length ? conflicts.map((c, i) => (
            <div key={i} className="conflict-row">
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--warning-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'white', fontWeight: 600, flexShrink: 0 }}>!</div>
              <div style={{ fontSize: 13 }}><strong>{c.member}</strong> blacked out {fmt(c.date)} — <BandTag name={c.band} /> @ {c.venue}</div>
            </div>
          )) : <div className="card card-body" style={{ textAlign: 'center', color: 'var(--hint)', fontSize: 13 }}>No conflicts detected.</div>}

          <div style={{ marginTop: '1rem' }}>
            <div className="section-label">All blackout dates</div>
            <div className="card">
              <table>
                <thead><tr><th>Member</th><th>Date</th><th>Reason</th></tr></thead>
                <tbody>
                  {(data['BLACKOUT DATES'] || []).sort((a, b) => a.fields['Date'] > b.fields['Date'] ? 1 : -1).map(b => {
                    const f = b.fields
                    const mids = f['Member'] || []
                    const mRec = (data['MEMBERS'] || []).find(m => Array.isArray(mids) ? mids.includes(m.id) : mids === m.id)
                    return <tr key={b.id}><td style={{ fontWeight: 500 }}>{mRec ? mRec.fields['Member Name'] : '—'}</td><td>{fmt(f['Date'])}</td><td style={{ color: 'var(--muted)' }}>{f['Reason'] || '—'}</td></tr>
                  })}
                  {!(data['BLACKOUT DATES'] || []).length && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--hint)', padding: '1rem' }}>No blackout dates yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Venues({ data, resolveLinked }) {
  return (
    <div>
      <div className="page-title">Venue CRM</div>
      <div className="page-sub">Relationships, communications, outreach timing</div>
      <div className="three-col" style={{ marginBottom: '1rem' }}>
        {(data['VENUES'] || []).map(v => {
          const f = v.fields
          return (
            <div key={v.id} className="card card-body">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{f['Venue Name'] || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{f['City'] || ''}{f['State'] ? ', ' + f['State'] : ''}{f['Capacity'] ? ` · Cap. ${Number(f['Capacity']).toLocaleString()}` : ''}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{f['Booking Email'] || f['Contact Email'] || ''}</div>
              {f['Relationship Status'] && <StatusPill status={f['Relationship Status']} />}
              {f['Next Available Outreach Date'] && <div style={{ fontSize: 11, color: 'var(--hint)', marginTop: 6 }}>Outreach from: {fmt(f['Next Available Outreach Date'])}</div>}
            </div>
          )
        })}
        {!(data['VENUES'] || []).length && <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--hint)', padding: '2rem' }}>No venues yet — add them in Airtable.</div>}
      </div>
      <div className="section-label">Communication log</div>
      <div className="card">
        <table>
          <thead><tr><th>Venue</th><th>Date</th><th>Type</th><th>Notes</th><th>Outcome</th></tr></thead>
          <tbody>
            {[...(data['COMMUNICATIONS'] || [])].sort((a, b) => a.fields['Date'] > b.fields['Date'] ? -1 : 1).map(c => {
              const f = c.fields
              const vRec = (data['VENUES'] || []).find(v => v.id === (Array.isArray(f['Venue']) ? f['Venue'][0] : f['Venue']))
              return <tr key={c.id}><td style={{ fontWeight: 500 }}>{vRec ? vRec.fields['Venue Name'] : '—'}</td><td>{fmt(f['Date'])}</td><td>{f['Type'] || '—'}</td><td style={{ color: 'var(--muted)', fontSize: 12 }}>{(f['Notes'] || '').slice(0, 60)}{(f['Notes'] || '').length > 60 ? '...' : ''}</td><td><StatusPill status={f['Outcome']} /></td></tr>
            })}
            {!(data['COMMUNICATIONS'] || []).length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--hint)', padding: '1.5rem' }}>No communications logged yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Inquiries({ data, resolveLinked }) {
  const inqs = [...(data['INQUIRIES'] || [])].sort((a, b) => a.fields['Submitted Date'] > b.fields['Submitted Date'] ? -1 : 1)
  return (
    <div>
      <div className="page-title">Booking inquiries</div>
      <div className="page-sub">Incoming requests from the public booking form</div>
      <div className="card">
        <table>
          <thead><tr><th>Submitted</th><th>Booker</th><th>Band(s)</th><th>Event date</th><th>Type</th><th>Status</th></tr></thead>
          <tbody>
            {inqs.map(i => {
              const f = i.fields
              const bands = resolveLinked(f['Band(s) Requested'] || f['Bands Requested'], 'BANDS', 'Band Name')
              return <tr key={i.id}><td>{fmt(f['Submitted Date'])}</td><td style={{ fontWeight: 500 }}>{f['Booker Name'] || '—'}</td><td>{bands.map((b, idx) => <BandTag key={idx} name={b} />)}</td><td>{fmt(f['Requested Date'])}</td><td style={{ color: 'var(--muted)' }}>{f['Booker Type'] || '—'}</td><td><StatusPill status={f['Status'] || 'New'} /></td></tr>
            })}
            {!inqs.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--hint)', padding: '2rem' }}>No inquiries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Promote({ data, resolveLinked }) {
  const [selected, setSelected] = useState('')
  const [copy, setCopy] = useState(null)
  const today = new Date()
  const upcoming = (data['SHOWS'] || []).filter(s => s.fields['Date'] && new Date(s.fields['Date']) >= today).sort((a, b) => a.fields['Date'] > b.fields['Date'] ? 1 : -1)

  function generate(idx) {
    setSelected(idx)
    const s = upcoming[parseInt(idx)]
    if (!s) { setCopy(null); return }
    const f = s.fields
    const bands = resolveLinked(f['Band'], 'BANDS', 'Band Name')
    const vs = resolveLinked(f['Venue'], 'VENUES', 'Venue Name')
    const band = bands[0] || 'The Band', venue = vs[0] || 'the venue'
    const dt = new Date((f['Date'] || '') + 'T00:00:00')
    const long = dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    setCopy([
      { name: 'Facebook Event', text: `LIVE MUSIC — ${band}\n${long}\n${venue}, Fort Worth TX\n\nCome out for a great night of live music!\n\n#livemusic #${band.replace(/\s/g, '')} #fortworthmusic` },
      { name: 'Bandsintown', text: `Artist: ${band}\nVenue: ${venue}\nDate: ${f['Date']}\nCity: Fort Worth, TX\nTicket URL: (add link)` },
      { name: 'Instagram caption', text: `Back at ${venue}!\n${long} — come see us. Doors at 7pm.\n\n#${band.replace(/\s/g, '')} #LiveMusic #FortWorth` },
      { name: 'Text blast', text: `${band} is playing ${venue} on ${long}. Come out! Doors at 7pm.` },
    ])
  }

  return (
    <div>
      <div className="page-title">Promote</div>
      <div className="page-sub">Generate ready-to-use promotion copy per show</div>
      <div style={{ marginBottom: '1.25rem' }}>
        <label className="form-label">Select a show:</label>
        <select className="form-input" style={{ maxWidth: 440, marginTop: 6 }} value={selected} onChange={e => generate(e.target.value)}>
          <option value="">— choose a show —</option>
          {upcoming.map((s, i) => {
            const bands = resolveLinked(s.fields['Band'], 'BANDS', 'Band Name')
            const vs = resolveLinked(s.fields['Venue'], 'VENUES', 'Venue Name')
            return <option key={s.id} value={i}>{fmt(s.fields['Date'])} — {bands[0] || 'Band'} @ {vs[0] || 'Venue'}</option>
          })}
        </select>
      </div>
      {copy && (
        <div className="two-col">
          {copy.map((c, i) => <CopyCard key={i} name={c.name} text={c.text} />)}
        </div>
      )}
    </div>
  )
}

function CopyCard({ name, text }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="card card-body">
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{name}</div>
      <pre style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', background: 'var(--surface2)', padding: 10, borderRadius: 6, marginBottom: 8 }}>{text}</pre>
      <button className="btn btn-sm" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? 'Copied!' : 'Copy'}</button>
    </div>
  )
}

function MemberPortal({ data, resolveLinked }) {
  const [selected, setSelected] = useState('')
  const today = new Date()
  const member = selected ? (data['MEMBERS'] || []).find(m => m.id === selected) : null
  const myShows = member ? (data['SHOWS'] || []).filter(s => {
    const mp = s.fields['Members Playing'] || []
    return Array.isArray(mp) && mp.includes(selected) && new Date(s.fields['Date'] || '') >= today
  }).sort((a, b) => a.fields['Date'] > b.fields['Date'] ? 1 : -1) : []
  const myBlackouts = member ? (data['BLACKOUT DATES'] || []).filter(b => {
    const bm = b.fields['Member'] || []
    return Array.isArray(bm) ? bm.includes(selected) : bm === selected
  }) : []

  return (
    <div>
      <div className="page-title">Member portal</div>
      <div className="page-sub">Select your name to view your schedule</div>
      <select className="form-input" style={{ maxWidth: 300, marginBottom: '1.5rem' }} value={selected} onChange={e => setSelected(e.target.value)}>
        <option value="">— select your name —</option>
        {(data['MEMBERS'] || []).map(m => <option key={m.id} value={m.id}>{m.fields['Member Name'] || '—'}</option>)}
      </select>
      {member && (
        <div className="two-col">
          <div className="member-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <Avatar name={member.fields['Member Name']} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{member.fields['Member Name']}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{(member.fields['Instruments'] || []).join(', ') || '—'}</div>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--hint)', marginBottom: 4 }}>My bands</div>
              {resolveLinked(member.fields['Primary Bands'], 'BANDS', 'Band Name').map((b, i) => <BandTag key={i} name={b} />)}
            </div>
            {resolveLinked(member.fields['Can Sub For'], 'BANDS', 'Band Name').length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--hint)', marginBottom: 4 }}>Can sub for</div>
                {resolveLinked(member.fields['Can Sub For'], 'BANDS', 'Band Name').map((b, i) => <BandTag key={i} name={b} />)}
              </div>
            )}
          </div>
          <div>
            <div className="section-label">Upcoming shows</div>
            <div className="card">
              <table>
                <thead><tr><th>Date</th><th>Band</th><th>Venue</th></tr></thead>
                <tbody>
                  {myShows.map(s => {
                    const bands = resolveLinked(s.fields['Band'], 'BANDS', 'Band Name')
                    const vs = resolveLinked(s.fields['Venue'], 'VENUES', 'Venue Name')
                    return <tr key={s.id}><td>{fmt(s.fields['Date'])}</td><td>{bands.map((b, i) => <BandTag key={i} name={b} />)}</td><td style={{ fontSize: 12 }}>{vs[0] || '—'}</td></tr>
                  })}
                  {!myShows.length && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--hint)', padding: '1rem' }}>No upcoming shows assigned yet.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="section-label" style={{ marginTop: '1rem' }}>Blackout dates</div>
            <div className="card">
              <table>
                <thead><tr><th>Date</th><th>Reason</th></tr></thead>
                <tbody>
                  {myBlackouts.map((b, i) => <tr key={i}><td>{fmt(b.fields['Date'])}</td><td style={{ color: 'var(--muted)' }}>{b.fields['Reason'] || '—'}</td></tr>)}
                  {!myBlackouts.length && <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--hint)', padding: '1rem' }}>No blackouts on record.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Booking({ data }) {
  const [bookerType, setBookerType] = useState('')
  const [selectedBands, setSelectedBands] = useState([])
  const [form, setForm] = useState({ name: '', email: '', phone: '', date: '', date2: '', venue: '', notes: '', budget: '', attendance: '', dealType: '' })
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  function toggleBand(name) {
    setSelectedBands(prev => prev.includes(name) ? prev.filter(b => b !== name) : [...prev, name])
  }

  async function submit() {
    setSubmitting(true)
    setResult(null)
    try {
      const fields = {
        'Booker Name': form.name,
        'Booker Email': form.email,
        'Booker Phone': form.phone,
        'Booker Type': bookerType,
        'Event Location/Venue Name': form.venue,
        'Special Requests': form.notes,
        'Status': 'New',
        'Submitted Date': new Date().toISOString().split('T')[0],
      }
      if (form.date) fields['Requested Date'] = form.date
      if (form.date2) fields['Alternate Date'] = form.date2
      const res = await fetch('/api/inquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setResult('success')
      setForm({ name: '', email: '', phone: '', date: '', date2: '', venue: '', notes: '', budget: '', attendance: '', dealType: '' })
      setSelectedBands([])
      setBookerType('')
    } catch (e) {
      setResult('error: ' + e.message)
    }
    setSubmitting(false)
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="page-title">Book a show</div>
      <div className="page-sub">Fill out the form below and Evan will be in touch</div>

      {result === 'success' && <div className="alert alert-success">Inquiry submitted! We'll be in touch shortly.</div>}
      {result && result.startsWith('error') && <div className="alert alert-error">{result}</div>}

      <div className="booking-step">
        <div className="step-header"><div className="step-num">1</div><div className="step-title">Who are you?</div></div>
        <select className="form-input" value={bookerType} onChange={e => setBookerType(e.target.value)}>
          <option value="">— select —</option>
          <option value="Venue/Bar">Venue / Bar</option>
          <option value="Private Event">Private event (wedding, birthday, corporate)</option>
          <option value="Festival">Festival / Multi-band event</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className="booking-step">
        <div className="step-header"><div className="step-num">2</div><div className="step-title">Which band(s)?</div></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(data['BANDS'] || []).map(b => {
            const name = b.fields['Band Name'] || '—'
            const c = BAND_COLORS[name] || { bg: '#1a1a2e', color: '#a78bfa' }
            const sel = selectedBands.includes(name)
            return <button key={b.id} onClick={() => toggleBand(name)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, border: `1.5px solid ${c.bg}`, color: c.color, background: sel ? c.bg : 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>{name}</button>
          })}
        </div>
      </div>

      {bookerType === 'Venue/Bar' && (
        <div className="booking-step" style={{ borderColor: '#1a2e1a' }}>
          <div className="step-header"><div className="step-num" style={{ background: '#1a2e1a', color: '#6bcb77' }}>+</div><div className="step-title">Venue details</div></div>
          <select className="form-input" value={form.dealType} onChange={e => setForm(f => ({ ...f, dealType: e.target.value }))}><option value="">Deal type</option><option>Flat fee</option><option>Door deal</option><option>Ticket %</option><option>Guarantee + %</option></select>
          <input className="form-input" placeholder="Expected attendance" value={form.attendance} onChange={e => setForm(f => ({ ...f, attendance: e.target.value }))} />
          <input className="form-input" placeholder="Budget / rate expectation" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} />
        </div>
      )}
      {bookerType === 'Private Event' && (
        <div className="booking-step" style={{ borderColor: '#1a2e1a' }}>
          <div className="step-header"><div className="step-num" style={{ background: '#1a2e1a', color: '#6bcb77' }}>+</div><div className="step-title">Event details</div></div>
          <input className="form-input" placeholder="Guest count" value={form.attendance} onChange={e => setForm(f => ({ ...f, attendance: e.target.value }))} />
          <input className="form-input" placeholder="Budget range" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} />
        </div>
      )}
      {bookerType === 'Festival' && (
        <div className="booking-step" style={{ borderColor: '#1a2e1a' }}>
          <div className="step-header"><div className="step-num" style={{ background: '#1a2e1a', color: '#6bcb77' }}>+</div><div className="step-title">Festival details</div></div>
          <input className="form-input" placeholder="Festival name" />
          <input className="form-input" placeholder="Set length (minutes)" />
        </div>
      )}

      <div className="booking-step">
        <div className="step-header"><div className="step-num">3</div><div className="step-title">Event details</div></div>
        <div className="two-col">
          <div className="form-group"><label className="form-label">Preferred date</label><input type="date" className="form-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Alternate date</label><input type="date" className="form-input" value={form.date2} onChange={e => setForm(f => ({ ...f, date2: e.target.value }))} /></div>
        </div>
        <div className="form-group"><label className="form-label">Location / venue name</label><input className="form-input" placeholder="Where?" value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} /></div>
        <div className="two-col">
          <div className="form-group"><label className="form-label">Your name</label><input className="form-input" placeholder="Full name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" placeholder="you@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
        </div>
        <div className="form-group"><label className="form-label">Phone</label><input type="tel" className="form-input" placeholder="(555) 000-0000" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={3} placeholder="Anything we should know?" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
      </div>

      <button className="btn btn-primary" style={{ width: '100%', padding: '13px', fontSize: 14 }} onClick={submit} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit booking inquiry'}</button>
    </div>
  )
}
