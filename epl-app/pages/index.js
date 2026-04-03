import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import Image from 'next/image'

const BAND_COLORS = {
  'So Long Goodnight': { bg: '#1a2e1a', color: '#6bcb77' },
  'The Dick Beldings': { bg: '#1a1a2e', color: '#a78bfa' },
  'Jambi':             { bg: '#2e1a1a', color: '#ff9f7f' },
  'Elite':             { bg: '#1a2a2e', color: '#7ecbcb' },
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

function BandTag({ name }) {
  const c = BAND_COLORS[name] || { bg: '#1a1a2e', color: '#a78bfa' }
  return <span style={{ display:'inline-flex', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:c.bg, color:c.color, margin:'0 2px' }}>{name}</span>
}

function fmt(d) {
  if (!d) return '—'
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' }) }
  catch { return d }
}

function fmtShort(d) {
  if (!d) return '—'
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' }) }
  catch { return d }
}

function initials(name) {
  return (name || '?').split(' ').map(x => x[0]).join('').toUpperCase().slice(0, 2)
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr + 'T00:00:00') - new Date(new Date().toDateString())
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function MemberAvatar({ member, size = 42 }) {
  const f = member.fields
  const name = f['Member Name'] || '—'
  const photo = f['Photo'] && Array.isArray(f['Photo']) && f['Photo'][0] ? f['Photo'][0].url : null
  if (photo) {
    return <img src={photo} alt={name} style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
  }
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:'#1a1a2e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size < 36 ? 11 : 14, fontWeight:700, color:'#a78bfa', flexShrink:0 }}>
      {initials(name)}
    </div>
  )
}

export default function Home() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [member, setMember] = useState(null)
  const [page, setPage] = useState('select')
  const [selectedShow, setSelectedShow] = useState(null)

  const loadData = useCallback(async () => {
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

  function resolve(ids, table) {
    if (!ids || !data) return []
    const arr = Array.isArray(ids) ? ids : [ids]
    return arr.map(id => (data[table] || []).find(x => x.id === id)).filter(Boolean)
  }

  function resolveField(ids, table, field) {
    return resolve(ids, table).map(r => r.fields[field] || '?')
  }

  function selectMember(m) {
    setMember(m)
    setPage('home')
    setSelectedShow(null)
  }

  function openShow(show) {
    setSelectedShow(show)
    setPage('show-detail')
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20, background:'#0a0a0f' }}>
      <Head><title>Echo Play Live</title></Head>
      <img src="/logo.png" alt="Echo Play Live" style={{ width:120, height:120, objectFit:'contain', opacity:0.9 }} />
      <div style={{ color:'#6b7280', fontSize:13 }}>Loading...</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0a0a0f' }}>
      <div style={{ background:'#1a0a0a', border:'1px solid #3a1a1a', borderRadius:12, padding:'2rem', color:'#ff9f7f', fontSize:14, maxWidth:400 }}>
        Connection error: {error}
      </div>
    </div>
  )

  if (page === 'select') return <MemberSelect data={data} onSelect={selectMember} onBooking={() => setPage('booking')} onCalendar={() => setPage('master-calendar')} />
  if (page === 'home') return <MemberHome data={data} member={member} resolve={resolve} resolveField={resolveField} onShowClick={openShow} onBack={() => { setMember(null); setPage('select') }} onNav={setPage} />
  if (page === 'show-detail') return <ShowDetail data={data} member={member} show={selectedShow} resolve={resolve} resolveField={resolveField} onBack={() => setPage('home')} />
  if (page === 'schedule') return <FullSchedule data={data} member={member} resolve={resolve} resolveField={resolveField} onShowClick={openShow} onBack={() => setPage('home')} />
  if (page === 'blackouts') return <Blackouts data={data} member={member} resolve={resolve} onBack={() => setPage('home')} />
  if (page === 'master-calendar') return <MasterCalendar data={data} resolve={resolve} resolveField={resolveField} onShowClick={openShow} onBack={() => member ? setPage('home') : setPage('select')} />
  if (page === 'booking') return <BookingPage data={data} onBack={() => setPage('select')} />
  return null
}

function MemberSelect({ data, onSelect, onBooking, onCalendar }) {
  const members = data['MEMBERS'] || []
  const today = new Date()
  const totalShows = (data['SHOWS'] || []).filter(s => s.fields['Date'] && new Date(s.fields['Date']) >= today).length
  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', display:'flex', flexDirection:'column', alignItems:'center', padding:'2.5rem 1.5rem 2rem' }}>
      <Head><title>Echo Play Live</title></Head>
      <div style={{ marginBottom:'1.75rem', textAlign:'center' }}>
        <img src="/logo.png" alt="Echo Play Live" style={{ width:120, height:120, objectFit:'contain', marginBottom:14, mixBlendMode:'screen' }} />
        <div style={{ fontSize:13, color:'#6b7280' }}>Select your name to continue</div>
      </div>
      <div style={{ width:'100%', maxWidth:420 }}>
        <button onClick={onCalendar} style={{ width:'100%', padding:'16px', background:'#0f1f0f', border:'1px solid #2a4a2a', borderRadius:14, cursor:'pointer', fontFamily:'inherit', textAlign:'center', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'center', gap:12 }}>
          <span style={{ fontSize:22 }}>📅</span>
          <div style={{ textAlign:'left' }}>
            <div style={{ fontSize:15, fontWeight:700, color:'#6bcb77' }}>Show Availability Calendar</div>
            <div style={{ fontSize:12, color:'#4a7a4a', marginTop:2 }}>{totalShows} booked · view all Fridays & Saturdays</div>
          </div>
        </button>
        <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Band members</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {members.map(m => {
            const f = m.fields
            const name = f['Member Name'] || '—'
            const instruments = (f['Instruments'] || []).join(', ') || f['Role/Instrument'] || ''
            return (
              <button key={m.id} onClick={() => onSelect(m)} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'16px 12px', background:'#111118', border:'0.5px solid #2a2a3a', borderRadius:14, cursor:'pointer', fontFamily:'inherit', textAlign:'center' }}>
                <MemberAvatar member={m} size={48} />
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#ffffff' }}>{name}</div>
                  <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{instruments}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MemberHome({ data, member, resolve, resolveField, onShowClick, onBack, onNav }) {
  const f = member.fields
  const name = f['Member Name'] || '—'
  const today = new Date()
  const myShows = (data['SHOWS'] || []).filter(s => {
    const mp = s.fields['Members Playing'] || []
    return Array.isArray(mp) && mp.includes(member.id) && new Date(s.fields['Date'] || '') >= today
  }).sort((a, b) => a.fields['Date'] > b.fields['Date'] ? 1 : -1)

  const nextShow = myShows[0]
  const bands = resolveField(f['Primary Bands'], 'BANDS', 'Band Name')
  const myBlackouts = (data['BLACKOUT DATES'] || []).filter(b => {
    const bm = b.fields['Member'] || []
    return Array.isArray(bm) ? bm.includes(member.id) : bm === member.id
  })

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', color:'#ffffff', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <Head><title>EPL — {name}</title></Head>

      <div style={{ background:'#111118', borderBottom:'0.5px solid #1e1e2e', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <img src="/logo.png" alt="EPL" style={{ width:36, height:36, objectFit:'contain' }} />
        <button onClick={onBack} style={{ fontSize:12, color:'#6b7280', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>Switch ›</button>
      </div>

      <div style={{ padding:'20px 20px 40px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24 }}>
          <MemberAvatar member={member} size={54} />
          <div>
            <div style={{ fontSize:20, fontWeight:700 }}>{name}</div>
            <div style={{ display:'flex', gap:4, marginTop:4, flexWrap:'wrap' }}>{bands.map((b, i) => <BandTag key={i} name={b} />)}</div>
          </div>
        </div>

        {nextShow && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Next show</div>
            <NextShowCard show={nextShow} resolve={resolve} resolveField={resolveField} onClick={() => onShowClick(nextShow)} />
          </div>
        )}

        {!nextShow && (
          <div style={{ marginBottom:20, padding:20, background:'#111118', border:'0.5px solid #2a2a3a', borderRadius:16, textAlign:'center', color:'#6b7280', fontSize:14 }}>
            No upcoming shows assigned yet.
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
          <QuickCard label="My schedule" value={myShows.length} sub="upcoming shows" onClick={() => onNav('schedule')} color="#a78bfa" icon="🎸" />
          <QuickCard label="Blackout dates" value={myBlackouts.length} sub="on record" onClick={() => onNav('blackouts')} color="#ff9f7f" icon="🚫" />
        </div>

        {myShows.length > 0 && (
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Upcoming shows</div>
            {myShows.slice(0, 4).map(s => (
              <ShowRow key={s.id} show={s} resolve={resolve} resolveField={resolveField} onClick={() => onShowClick(s)} />
            ))}
            {myShows.length > 4 && (
              <button onClick={() => onNav('schedule')} style={{ width:'100%', padding:'12px', marginTop:8, background:'transparent', border:'0.5px solid #2a2a3a', borderRadius:10, color:'#a78bfa', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                View all {myShows.length} shows →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function QuickCard({ label, value, sub, onClick, color, icon }) {
  return (
    <div onClick={onClick} style={{ background:'#111118', border:'0.5px solid #2a2a3a', borderRadius:14, padding:'14px 16px', cursor:'pointer', display:'flex', flexDirection:'column', gap:6 }}>
      <div style={{ fontSize:20 }}>{icon}</div>
      <div style={{ fontSize:22, fontWeight:700, color:color }}>{value}</div>
      <div style={{ fontSize:13, fontWeight:600, color:'#ffffff' }}>{label}</div>
      <div style={{ fontSize:11, color:'#6b7280' }}>{sub}</div>
    </div>
  )
}

function NextShowCard({ show, resolve, resolveField, onClick }) {
  const f = show.fields
  const days = daysUntil(f['Date'])
  const bands = resolveField(f['Band'], 'BANDS', 'Band Name')
  const venueRecs = resolve(f['Venue'], 'VENUES')
  const vf = venueRecs[0] ? venueRecs[0].fields : {}
  const address = f['Venue Address'] || vf['Address'] || ''

  return (
    <div onClick={onClick} style={{ background:'#111118', border:'0.5px solid #2a2a3a', borderRadius:16, padding:20, cursor:'pointer' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>{vf['Venue Name'] || '—'}</div>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>{bands.map((b, i) => <BandTag key={i} name={b} />)}</div>
        </div>
        <div style={{ background:'#1a1a2e', borderRadius:10, padding:'6px 14px', textAlign:'center', flexShrink:0, marginLeft:12 }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#a78bfa' }}>{days}</div>
          <div style={{ fontSize:10, color:'#6b7280' }}>{days === 1 ? 'day' : 'days'}</div>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom: address ? 14 : 0 }}>
        <TimeBlock label="Load in" value={f['Load-In Time']} />
        <TimeBlock label="Set time" value={f['Set Time']} />
        <TimeBlock label="End time" value={f['End Time']} />
      </div>
      {address && (
        <a href={`https://maps.apple.com/?q=${encodeURIComponent(address)}`} onClick={e => e.stopPropagation()} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:'#0a0a1a', borderRadius:10, textDecoration:'none', marginTop:4 }}>
          <span style={{ fontSize:14 }}>📍</span>
          <div>
            <div style={{ fontSize:12, fontWeight:500, color:'#a78bfa' }}>Get directions</div>
            <div style={{ fontSize:11, color:'#6b7280' }}>{address}</div>
          </div>
        </a>
      )}
      <div style={{ marginTop:12, fontSize:12, color:'#6b7280', display:'flex', justifyContent:'space-between' }}>
        <span>{fmt(f['Date'])}</span>
        <span style={{ color:'#a78bfa' }}>View details →</span>
      </div>
    </div>
  )
}

function TimeBlock({ label, value }) {
  return (
    <div style={{ background:'#0a0a1a', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
      <div style={{ fontSize:10, color:'#6b7280', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:600, color:'#ffffff' }}>{value || '—'}</div>
    </div>
  )
}

function ShowRow({ show, resolve, resolveField, onClick }) {
  const f = show.fields
  const days = daysUntil(f['Date'])
  const bands = resolveField(f['Band'], 'BANDS', 'Band Name')
  const venueRecs = resolve(f['Venue'], 'VENUES')
  const vf = venueRecs[0] ? venueRecs[0].fields : {}

  return (
    <div onClick={onClick} style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 0', borderBottom:'0.5px solid #1a1a2a', cursor:'pointer' }}>
      <div style={{ width:44, textAlign:'center', flexShrink:0 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#a78bfa' }}>{days != null ? days : '—'}</div>
        <div style={{ fontSize:10, color:'#6b7280' }}>days</div>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:600, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{vf['Venue Name'] || '—'}</div>
        <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>{fmt(f['Date'])}</div>
        <div>{bands.map((b, i) => <BandTag key={i} name={b} />)}</div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontSize:13, color:'#ffffff', fontWeight:500 }}>{f['Set Time'] || '—'}</div>
        <div style={{ fontSize:10, color:'#6b7280' }}>set time</div>
      </div>
      <div style={{ color:'#2a2a3a', fontSize:18 }}>›</div>
    </div>
  )
}

function ShowDetail({ data, member, show, resolve, resolveField, onBack }) {
  const f = show.fields
  const bands = resolveField(f['Band'], 'BANDS', 'Band Name')
  const venueRecs = resolve(f['Venue'], 'VENUES')
  const vf = venueRecs[0] ? venueRecs[0].fields : {}
  const address = f['Venue Address'] || vf['Address'] || ''
  const days = daysUntil(f['Date'])
  const setlistRecs = resolve(f['Setlist'], 'SETLISTS')
  const setlist = setlistRecs[0]
  const songs = setlist ? (setlist.fields['Songs'] || '').split('\n').filter(s => s.trim()) : []

  function openMaps(addr) {
    const encoded = encodeURIComponent(addr)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (isIOS) window.open(`maps://maps.apple.com/?q=${encoded}`)
    else window.open(`https://maps.google.com/?q=${encoded}`)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', color:'#ffffff', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <Head><title>EPL — Show Details</title></Head>
      <div style={{ background:'#111118', borderBottom:'0.5px solid #1e1e2e', padding:'12px 20px', display:'flex', alignItems:'center', gap:14, position:'sticky', top:0, zIndex:50 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'#a78bfa', fontSize:22, cursor:'pointer', padding:0, lineHeight:1 }}>‹</button>
        <div>
          <div style={{ fontSize:15, fontWeight:600 }}>{vf['Venue Name'] || '—'}</div>
          <div style={{ fontSize:12, color:'#6b7280' }}>{fmt(f['Date'])}</div>
        </div>
      </div>

      <div style={{ padding:'20px 20px 80px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>{bands.map((b, i) => <BandTag key={i} name={b} />)}</div>
          {days != null && days >= 0 && (
            <div style={{ background:'#1a1a2e', borderRadius:10, padding:'6px 14px', textAlign:'center' }}>
              <div style={{ fontSize:20, fontWeight:700, color:'#a78bfa' }}>{days}</div>
              <div style={{ fontSize:10, color:'#6b7280' }}>{days === 1 ? 'day away' : 'days away'}</div>
            </div>
          )}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:20 }}>
          <TimeBlock label="Load in" value={f['Load-In Time']} />
          <TimeBlock label="Set time" value={f['Set Time']} />
          <TimeBlock label="End time" value={f['End Time']} />
        </div>

        {(address || vf['Venue Name']) && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Venue</div>
            <div style={{ background:'#111118', border:'0.5px solid #2a2a3a', borderRadius:14, padding:16 }}>
              <div style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>{vf['Venue Name'] || '—'}</div>
              {address && <div style={{ fontSize:13, color:'#9ca3af', marginBottom:12 }}>{address}</div>}
              {vf['Parking Notes'] && <div style={{ fontSize:12, color:'#6b7280', marginBottom:12 }}>🅿️ {vf['Parking Notes']}</div>}
              {address && (
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => openMaps(address)} style={{ flex:1, padding:'10px', background:'#1a1a2e', border:'none', borderRadius:10, color:'#a78bfa', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Apple Maps</button>
                  <button onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`)} style={{ flex:1, padding:'10px', background:'#1a2e1a', border:'none', borderRadius:10, color:'#6bcb77', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Google Maps</button>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
            Setlist {songs.length > 0 ? `(${songs.length} songs)` : ''}
          </div>
          {songs.length > 0 ? (
            <>
              <div style={{ background:'#111118', border:'0.5px solid #2a2a3a', borderRadius:14, overflow:'hidden' }}>
                {songs.map((song, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', borderBottom: i < songs.length - 1 ? '0.5px solid #1a1a2a' : 'none' }}>
                    <div style={{ width:24, textAlign:'center', fontSize:12, color:'#6b7280', fontWeight:600 }}>{i + 1}</div>
                    <div style={{ fontSize:14 }}>{song.trim()}</div>
                  </div>
                ))}
              </div>
              {setlist?.fields['Notes'] && (
                <div style={{ marginTop:10, padding:14, background:'#111118', border:'0.5px solid #2a2a3a', borderRadius:12 }}>
                  <div style={{ fontSize:11, color:'#6b7280', marginBottom:6, fontWeight:600 }}>Set notes</div>
                  <div style={{ fontSize:13, color:'#9ca3af', lineHeight:1.6 }}>{setlist.fields['Notes']}</div>
                </div>
              )}
            </>
          ) : (
            <div style={{ background:'#111118', border:'0.5px solid #2a2a3a', borderRadius:14, padding:20, textAlign:'center', color:'#6b7280', fontSize:13 }}>
              No setlist added yet — check back closer to the show.
            </div>
          )}
        </div>

        {f['Show Notes'] && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Show notes</div>
            <div style={{ background:'#1a1a0a', border:'0.5px solid #2a2a1a', borderRadius:14, padding:16, fontSize:13, color:'#e5e5b0', lineHeight:1.6 }}>{f['Show Notes']}</div>
          </div>
        )}

        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Show info</div>
          <div style={{ background:'#111118', border:'0.5px solid #2a2a3a', borderRadius:14, overflow:'hidden' }}>
            {[
              ['Deal type', f['Deal Type']],
              ['Sound check', f['Sound Check Confirmed'] ? 'Confirmed ✓' : 'TBC'],
              ['Contract', f['Contract Signed'] ? 'Signed ✓' : 'Pending'],
              ['Status', f['Status']],
            ].filter(([, val]) => val).map(([label, val], i, arr) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'12px 16px', borderBottom: i < arr.length - 1 ? '0.5px solid #1a1a2a' : 'none' }}>
                <span style={{ fontSize:13, color:'#6b7280' }}>{label}</span>
                <span style={{ fontSize:13, color:'#ffffff', fontWeight:500 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MasterCalendar({ data, resolve, resolveField, onShowClick, onBack }) {
  const year = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  const currentMonthRef = useState(null)
  const monthRefs = {}

  useEffect(() => {
    const el = document.getElementById('month-' + currentMonth)
    if (el) el.scrollIntoView({ behavior:'instant', block:'start' })
  }, [])

  // Generate all Fridays (5) and Saturdays (6) for the year
  const weekendDates = []
  const d = new Date(year, 0, 1)
  while (d.getFullYear() === year) {
    if (d.getDay() === 5 || d.getDay() === 6) {
      weekendDates.push(new Date(d))
    }
    d.setDate(d.getDate() + 1)
  }

  const showsByDate = {}
  ;(data['SHOWS'] || []).forEach(s => {
    const dt = s.fields['Date']
    if (dt) {
      if (!showsByDate[dt]) showsByDate[dt] = []
      showsByDate[dt].push(s)
    }
  })

  const blackoutsByDate = {}
  ;(data['BLACKOUT DATES'] || []).forEach(b => {
    const dt = b.fields['Date']
    if (dt) {
      if (!blackoutsByDate[dt]) blackoutsByDate[dt] = []
      blackoutsByDate[dt].push(b)
    }
  })

  // Build member lookup
  const memberById = {}
  ;(data['MEMBERS'] || []).forEach(m => { memberById[m.id] = m.fields['Member Name'] || '?' })

  // Group by month
  const grouped = {}
  weekendDates.forEach(dt => {
    const key = dt.getMonth()
    if (!grouped[key]) grouped[key] = { label: MONTH_NAMES[dt.getMonth()], monthIdx: key, dates: [] }
    grouped[key].dates.push(dt)
  })

  const today = new Date()
  today.setHours(0,0,0,0)

  function toDateStr(dt) {
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
  }

  const bookedCount = Object.keys(showsByDate).length
  const totalWeekends = weekendDates.length
  const availableCount = weekendDates.filter(dt => {
    const ds = toDateStr(dt)
    return !showsByDate[ds] && !blackoutsByDate[ds] && dt >= today
  }).length
  const blackedOutCount = weekendDates.filter(dt => {
    const ds = toDateStr(dt)
    return blackoutsByDate[ds] && !showsByDate[ds] && dt >= today
  }).length

  const [filter, setFilter] = useState('all')

  function toggleFilter(f) {
    setFilter(prev => prev === f ? 'all' : f)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', color:'#ffffff', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <Head><title>EPL — Show Calendar {year}</title></Head>
      <div style={{ background:'#111118', borderBottom:'0.5px solid #1e1e2e', padding:'12px 20px', display:'flex', alignItems:'center', gap:14, position:'sticky', top:0, zIndex:50 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'#a78bfa', fontSize:22, cursor:'pointer', padding:0 }}>‹</button>
        <div>
          <div style={{ fontSize:15, fontWeight:600 }}>Show Calendar {year}</div>
          <div style={{ fontSize:12, color:'#6b7280' }}>All Fridays & Saturdays</div>
        </div>
        {filter !== 'all' && (
          <button onClick={() => setFilter('all')} style={{ marginLeft:'auto', fontSize:12, padding:'5px 12px', borderRadius:20, background:'#2a2a3a', border:'none', color:'#a78bfa', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
            Reset
          </button>
        )}
      </div>

      <div style={{ padding:'16px 20px 8px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
          <button onClick={() => toggleFilter('booked')} style={{ background: filter==='booked' ? '#1a3a1a' : '#0f1f0f', border: filter==='booked' ? '1.5px solid #6bcb77' : '0.5px solid #2a4a2a', borderRadius:10, padding:'10px 12px', textAlign:'center', cursor:'pointer', fontFamily:'inherit' }}>
            <div style={{ fontSize:18, fontWeight:700, color:'#6bcb77' }}>{bookedCount}</div>
            <div style={{ fontSize:10, color: filter==='booked' ? '#6bcb77' : '#4a7a4a', marginTop:2, fontWeight: filter==='booked' ? 700 : 400 }}>Booked</div>
          </button>
          <button onClick={() => toggleFilter('blackout')} style={{ background: filter==='blackout' ? '#2a1010' : '#0f0a0a', border: filter==='blackout' ? '1.5px solid #ff9f7f' : '0.5px solid #3a2a2a', borderRadius:10, padding:'10px 12px', textAlign:'center', cursor:'pointer', fontFamily:'inherit' }}>
            <div style={{ fontSize:18, fontWeight:700, color:'#ff9f7f' }}>{blackedOutCount}</div>
            <div style={{ fontSize:10, color: filter==='blackout' ? '#ff9f7f' : '#6b7280', marginTop:2, fontWeight: filter==='blackout' ? 700 : 400 }}>Blacked Out</div>
          </button>
          <button onClick={() => toggleFilter('available')} style={{ background: filter==='available' ? '#16162e' : '#0d0d1a', border: filter==='available' ? '1.5px solid #a78bfa' : '0.5px solid #2a2a4a', borderRadius:10, padding:'10px 12px', textAlign:'center', cursor:'pointer', fontFamily:'inherit' }}>
            <div style={{ fontSize:18, fontWeight:700, color:'#a78bfa' }}>{availableCount}</div>
            <div style={{ fontSize:10, color: filter==='available' ? '#a78bfa' : '#6b7280', marginTop:2, fontWeight: filter==='available' ? 700 : 400 }}>Available</div>
          </button>
        </div>
        {filter !== 'all' && (
          <div style={{ fontSize:12, color:'#6b7280', marginBottom:8, textAlign:'center' }}>
            Showing <span style={{ color:'#ffffff', fontWeight:600 }}>{filter === 'booked' ? 'booked' : filter === 'blackout' ? 'blacked out' : 'available'}</span> dates only — tap again or Reset to clear
          </div>
        )}
      </div>

      <div style={{ padding:'0 20px 80px' }}>
        {Object.values(grouped).map(group => {
          const filteredDates = group.dates.filter(dt => {
            const ds = toDateStr(dt)
            const isBooked = !!showsByDate[ds]
            const isBlackedOut = !!blackoutsByDate[ds] && !isBooked
            const isAvailable = !isBooked && !isBlackedOut && dt >= today
            if (filter === 'booked') return isBooked
            if (filter === 'blackout') return isBlackedOut
            if (filter === 'available') return isAvailable
            return true
          })
          if (filteredDates.length === 0) return null
          return (
          <div key={group.label} style={{ marginBottom:24 }}>
            <div id={'month-' + group.monthIdx} style={{ fontSize:12, fontWeight:700, color:'#a78bfa', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10, display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ flex:1, height:'0.5px', background:'#1a1a2e' }} />
              {group.label}
              <div style={{ flex:1, height:'0.5px', background:'#1a1a2e' }} />
            </div>
            {filteredDates.map(dt => {
              const ds = toDateStr(dt)
              const shows = showsByDate[ds] || []
              const blackouts = blackoutsByDate[ds] || []
              const isPast = dt < today
              const isBooked = shows.length > 0
              const isBlackedOut = blackouts.length > 0 && !isBooked
              const isAvailable = !isBooked && !isBlackedOut && !isPast
              const dayName = dt.toLocaleDateString('en-US', { weekday:'short' })
              const dayNum = dt.getDate()

              let bg = '#111118'
              let border = '0.5px solid #2a2a3a'
              let statusColor = '#6b7280'
              let statusText = 'Available'

              if (isPast) { bg = '#0a0a0a'; border = '0.5px solid #1a1a1a'; statusColor = '#3a3a3a'; statusText = 'Past' }
              else if (isBooked) { bg = '#0f1f0f'; border = '0.5px solid #2a4a2a'; statusColor = '#6bcb77'; statusText = `${shows.length} show${shows.length>1?'s':''}` }
              else if (isBlackedOut) { bg = '#160e0e'; border = '0.5px solid #3a2020'; statusColor = '#ff9f7f'; statusText = 'conflict' }
              else { bg = '#0d0d1f'; border = '0.5px solid #2a2a4a'; statusColor = '#5a5a8a'; statusText = 'Open' }

              return (
                <div key={ds} onClick={() => { if (isBooked && shows.length === 1) onShowClick(shows[0]) }} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', background:bg, border:border, borderRadius:10, marginBottom:6, cursor: isBooked ? 'pointer' : 'default' }}>
                  <div style={{ width:36, textAlign:'center', flexShrink:0 }}>
                    <div style={{ fontSize:16, fontWeight:700, color: isPast ? '#3a3a3a' : isBooked ? '#6bcb77' : isBlackedOut ? '#ff9f7f' : '#a78bfa' }}>{dayNum}</div>
                    <div style={{ fontSize:10, color:'#6b7280' }}>{dayName}</div>
                  </div>
                  <div style={{ width:'0.5px', height:30, background:'#2a2a3a', flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    {isBooked ? shows.map((s, i) => {
                      const venueRecs = resolve(s.fields['Venue'], 'VENUES')
                      const vf = venueRecs[0] ? venueRecs[0].fields : {}
                      const bands = resolveField(s.fields['Band'], 'BANDS', 'Band Name')
                      const c = BAND_COLORS[bands[0]] || { color:'#a78bfa' }
                      return (
                        <div key={i} style={{ marginBottom: i < shows.length-1 ? 6 : 0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'#ffffff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{vf['Venue Name'] || '—'}</div>
                          <div style={{ display:'flex', gap:4, marginTop:2, alignItems:'center' }}>
                            {bands.map((b, bi) => <span key={bi} style={{ fontSize:10, padding:'1px 6px', borderRadius:20, background:BAND_COLORS[b]?.bg||'#1a1a2e', color:BAND_COLORS[b]?.color||'#a78bfa', fontWeight:600 }}>{b}</span>)}
                            {s.fields['Set Time'] && <span style={{ fontSize:10, color:'#6b7280' }}>{s.fields['Set Time']}</span>}
                          </div>
                        </div>
                      )
                    }) : isBlackedOut ? (
                      <div style={{ fontSize:13, color:'#ff9f7f' }}>
                        {blackouts.length} member{blackouts.length>1?'s':''} blacked out
                      </div>
                    ) : isPast ? (
                      <div style={{ fontSize:13, color:'#3a3a3a' }}>Past date</div>
                    ) : (
                      <div style={{ fontSize:13, color:'#5a5a8a' }}>Open — available to book</div>
                    )}
                  </div>
                  <div style={{ fontSize:12, fontWeight:600, color:statusColor, flexShrink:0 }}>
                    {isBooked ? '›' : ''}
                  </div>
                </div>
              )
            })}
          </div>
        )})}
      </div>
    </div>
  )
}

function FullSchedule({ data, member, resolve, resolveField, onShowClick, onBack }) {
  const today = new Date()
  const myShows = (data['SHOWS'] || []).filter(s => {
    const mp = s.fields['Members Playing'] || []
    return Array.isArray(mp) && mp.includes(member.id) && new Date(s.fields['Date'] || '') >= today
  }).sort((a, b) => a.fields['Date'] > b.fields['Date'] ? 1 : -1)

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', color:'#ffffff', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <Head><title>EPL — My Schedule</title></Head>
      <div style={{ background:'#111118', borderBottom:'0.5px solid #1e1e2e', padding:'12px 20px', display:'flex', alignItems:'center', gap:14, position:'sticky', top:0, zIndex:50 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'#a78bfa', fontSize:22, cursor:'pointer', padding:0 }}>‹</button>
        <div>
          <div style={{ fontSize:15, fontWeight:600 }}>My schedule</div>
          <div style={{ fontSize:12, color:'#6b7280' }}>{myShows.length} upcoming shows</div>
        </div>
      </div>
      <div style={{ padding:'16px 20px 60px' }}>
        {myShows.map(s => <ShowRow key={s.id} show={s} resolve={resolve} resolveField={resolveField} onClick={() => onShowClick(s)} />)}
        {!myShows.length && <div style={{ color:'#6b7280', fontSize:14, paddingTop:'1rem', textAlign:'center' }}>No upcoming shows assigned yet.</div>}
      </div>
    </div>
  )
}

function Blackouts({ data, member, resolve, onBack }) {
  const [showForm, setShowForm] = useState(false)
  const [currentDate, setCurrentDate] = useState('')
  const [currentReason, setCurrentReason] = useState('Personal')
  const [pendingDates, setPendingDates] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [localBlackouts, setLocalBlackouts] = useState([])

  const myBlackouts = [...(data['BLACKOUT DATES'] || []).filter(b => {
    const bm = b.fields['Member'] || []
    return Array.isArray(bm) ? bm.includes(member.id) : bm === member.id
  }), ...localBlackouts].sort((a, b) => a.fields['Date'] > b.fields['Date'] ? 1 : -1)

  const REASONS = ['Personal', 'Other Gig', 'Vacation', 'Illness', 'Family', 'Other']

  function addToPending() {
    if (!currentDate) return
    if (pendingDates.find(p => p.date === currentDate)) return
    setPendingDates(prev => [...prev, { date: currentDate, reason: currentReason }])
    setCurrentDate('')
    setCurrentReason('Personal')
  }

  function removePending(date) {
    setPendingDates(prev => prev.filter(p => p.date !== date))
  }

  async function submitAll() {
    if (pendingDates.length === 0) return
    setSubmitting(true)
    try {
      const results = []
      for (const p of pendingDates) {
        const res = await fetch('/api/blackout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 'Member': [member.id], 'Date': p.date, 'Reason': p.reason })
        })
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        results.push({ id: json.id, fields: { Date: p.date, Reason: p.reason, Member: [member.id] } })
      }
      setLocalBlackouts(prev => [...prev, ...results])
      setPendingDates([])
      setShowForm(false)
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 3000)
    } catch(e) { alert('Error: ' + e.message) }
    setSubmitting(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', color:'#ffffff', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <Head><title>EPL - Blackout Dates</title></Head>
      <div style={{ background:'#111118', borderBottom:'0.5px solid #1e1e2e', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <button onClick={onBack} style={{ background:'none', border:'none', color:'#a78bfa', fontSize:22, cursor:'pointer', padding:0 }}>{String.fromCharCode(8249)}</button>
          <div style={{ fontSize:15, fontWeight:600 }}>My blackout dates</div>
        </div>
        <button onClick={() => { setShowForm(f => !f); setPendingDates([]); setCurrentDate(''); setCurrentReason('Personal') }} style={{ fontSize:13, padding:'6px 14px', borderRadius:20, background: showForm ? '#2a2a3a' : '#1a1a2e', border:'none', color:'#a78bfa', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
          {showForm ? 'Cancel' : '+ Add dates'}
        </button>
      </div>

      <div style={{ padding:'16px 20px 80px' }}>
        {submitted && (
          <div style={{ background:'#0f2a0f', border:'0.5px solid #2a4a2a', borderRadius:10, padding:'12px 16px', marginBottom:14, fontSize:13, color:'#6bcb77' }}>
            Blackout {localBlackouts.length === 1 ? 'date' : 'dates'} submitted successfully!
          </div>
        )}

        {showForm && (
          <div style={{ background:'#111118', border:'0.5px solid #2a2a3a', borderRadius:14, padding:16, marginBottom:20 }}>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Add blackout dates</div>

            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:12, color:'#6b7280', marginBottom:6 }}>Date you cannot play</div>
              <input
                type="date"
                value={currentDate}
                onChange={e => setCurrentDate(e.target.value)}
                style={{ width:'100%', padding:'10px 12px', background:'#1a1a2a', border:'0.5px solid #3a3a4a', borderRadius:10, color:'#ffffff', fontSize:15, fontFamily:'inherit', boxSizing:'border-box', display:'block' }}
              />
            </div>

            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, color:'#6b7280', marginBottom:8 }}>Reason</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                {REASONS.map(r => (
                  <button key={r} onClick={() => setCurrentReason(r)} style={{ padding:'8px 6px', background: currentReason===r ? '#1a1a2e' : '#0a0a1a', border: currentReason===r ? '0.5px solid #a78bfa' : '0.5px solid #2a2a3a', borderRadius:8, color: currentReason===r ? '#a78bfa' : '#6b7280', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight: currentReason===r ? 600 : 400 }}>{r}</button>
                ))}
              </div>
            </div>

            <button onClick={addToPending} disabled={!currentDate} style={{ width:'100%', padding:'11px', background: currentDate ? '#0f2a0f' : '#0a0a0a', border: currentDate ? '0.5px solid #2a4a2a' : '0.5px solid #1a1a1a', borderRadius:10, color: currentDate ? '#6bcb77' : '#3a3a3a', fontSize:13, fontWeight:600, cursor: currentDate ? 'pointer' : 'default', fontFamily:'inherit', marginBottom: pendingDates.length > 0 ? 12 : 0 }}>
              + Add to list
            </button>

            {pendingDates.length > 0 && (
              <div>
                <div style={{ fontSize:11, color:'#6b7280', marginBottom:8, marginTop:4 }}>Dates to submit ({pendingDates.length})</div>
                {pendingDates.map((p, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'#0a0a1a', borderRadius:8, marginBottom:6 }}>
                    <div>
                      <span style={{ fontSize:13, fontWeight:600, color:'#ffffff' }}>{fmt(p.date)}</span>
                      <span style={{ fontSize:12, color:'#6b7280', marginLeft:8 }}>{p.reason}</span>
                    </div>
                    <button onClick={() => removePending(p.date)} style={{ background:'none', border:'none', color:'#ff9f7f', fontSize:16, cursor:'pointer', padding:'0 4px', fontFamily:'inherit' }}>×</button>
                  </div>
                ))}
                <button onClick={submitAll} disabled={submitting} style={{ width:'100%', padding:'13px', background:'#1a1a2e', border:'none', borderRadius:12, color:'#a78bfa', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', marginTop:6 }}>
                  {submitting ? 'Submitting...' : `Submit ${pendingDates.length} blackout date${pendingDates.length > 1 ? 's' : ''}`}
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>
          {myBlackouts.length} date{myBlackouts.length !== 1 ? 's' : ''} on record
        </div>

        {myBlackouts.length ? myBlackouts.map((b, i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 0', borderBottom:'0.5px solid #1a1a2a' }}>
            <div>
              <div style={{ fontSize:14, fontWeight:600 }}>{fmt(b.fields['Date'])}</div>
              <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{b.fields['Reason'] || 'No reason listed'}</div>
            </div>
            <div style={{ fontSize:12, color: daysUntil(b.fields['Date']) > 0 ? '#ff9f7f' : '#3a3a3a' }}>
              {daysUntil(b.fields['Date']) > 0 ? `In ${daysUntil(b.fields['Date'])} days` : 'Past'}
            </div>
          </div>
        )) : (
          <div style={{ color:'#6b7280', fontSize:14, paddingTop:'1rem', textAlign:'center' }}>
            No blackout dates yet.
          </div>
        )}
      </div>
    </div>
  )
}

function BookingPage({ data, onBack }) {
  const [bookerType, setBookerType] = useState('')
  const [selectedBands, setSelectedBands] = useState([])
  const [form, setForm] = useState({ name:'', email:'', phone:'', date:'', date2:'', venue:'', notes:'' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  function toggleBand(name) {
    setSelectedBands(p => p.includes(name) ? p.filter(b => b !== name) : [...p, name])
  }

  async function submit() {
    setSubmitting(true)
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
      const res = await fetch('/api/inquiry', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(fields) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setDone(true)
    } catch (e) { alert('Error: ' + e.message) }
    setSubmitting(false)
  }

  const bands = data['BANDS'] || []

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', color:'#ffffff', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <Head><title>EPL — Book a Show</title></Head>
      <div style={{ background:'#111118', borderBottom:'0.5px solid #1e1e2e', padding:'12px 20px', display:'flex', alignItems:'center', gap:14, position:'sticky', top:0, zIndex:50 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'#a78bfa', fontSize:22, cursor:'pointer', padding:0 }}>‹</button>
        <div style={{ fontSize:15, fontWeight:600 }}>Book a show</div>
      </div>
      <div style={{ padding:'20px', maxWidth:520, margin:'0 auto' }}>
        {done ? (
          <div style={{ textAlign:'center', padding:'4rem 0' }}>
            <img src="/logo.png" alt="EPL" style={{ width:100, height:100, objectFit:'contain', marginBottom:20, opacity:0.8 }} />
            <div style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>Inquiry sent!</div>
            <div style={{ fontSize:14, color:'#6b7280', marginBottom:24 }}>Evan will be in touch shortly.</div>
            <button onClick={onBack} style={{ padding:'12px 28px', background:'#1a1a2e', border:'none', borderRadius:12, color:'#a78bfa', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Back to home</button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, color:'#6b7280', marginBottom:8, fontWeight:600, letterSpacing:'0.06em' }}>WHO ARE YOU?</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {['Venue/Bar','Private Event','Festival','Other'].map(t => (
                  <button key={t} onClick={() => setBookerType(t)} style={{ padding:'11px', background: bookerType===t ? '#1a1a2e' : '#111118', border:`0.5px solid ${bookerType===t?'#a78bfa':'#2a2a3a'}`, borderRadius:10, color: bookerType===t ? '#a78bfa' : '#9ca3af', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight: bookerType===t ? 600 : 400 }}>{t}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, color:'#6b7280', marginBottom:8, fontWeight:600, letterSpacing:'0.06em' }}>WHICH BAND(S)?</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {bands.map(b => {
                  const name = b.fields['Band Name'] || '—'
                  const c = BAND_COLORS[name] || { bg:'#1a1a2e', color:'#a78bfa' }
                  const sel = selectedBands.includes(name)
                  return <button key={b.id} onClick={() => toggleBand(name)} style={{ padding:'8px 16px', borderRadius:20, fontSize:13, border:`1.5px solid ${c.bg}`, color:c.color, background: sel ? c.bg : 'transparent', cursor:'pointer', fontFamily:'inherit', fontWeight: sel ? 600 : 400 }}>{name}</button>
                })}
              </div>
            </div>
            <div style={{ fontSize:12, color:'#6b7280', marginBottom:8, fontWeight:600, letterSpacing:'0.06em' }}>EVENT DETAILS</div>
            {[['name','Your name'],['email','Email address'],['phone','Phone number'],['venue','Venue / location name']].map(([id, ph]) => (
              <input key={id} type={id==='email'?'email':id==='phone'?'tel':'text'} placeholder={ph} value={form[id]} onChange={e => setForm(f=>({...f,[id]:e.target.value}))} style={{ width:'100%', padding:'12px 14px', background:'#1a1a2a', border:'0.5px solid #2a2a3a', borderRadius:10, color:'#ffffff', fontSize:14, fontFamily:'inherit', marginBottom:10 }} />
            ))}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              {[['date','Preferred date'],['date2','Alternate date']].map(([id, label]) => (
                <div key={id}>
                  <div style={{ fontSize:11, color:'#6b7280', marginBottom:4 }}>{label}</div>
                  <input type="date" value={form[id]} onChange={e => setForm(f=>({...f,[id]:e.target.value}))} style={{ width:'100%', padding:'11px 12px', background:'#1a1a2a', border:'0.5px solid #2a2a3a', borderRadius:10, color:'#ffffff', fontSize:13, fontFamily:'inherit' }} />
                </div>
              ))}
            </div>
            <textarea placeholder="Notes / special requests" value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} rows={3} style={{ width:'100%', padding:'12px 14px', background:'#1a1a2a', border:'0.5px solid #2a2a3a', borderRadius:10, color:'#ffffff', fontSize:14, fontFamily:'inherit', marginBottom:20, resize:'vertical' }} />
            <button onClick={submit} disabled={submitting} style={{ width:'100%', padding:'14px', background:'#1a1a2e', border:'none', borderRadius:12, color:'#a78bfa', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Submitting...' : 'Send booking inquiry'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
