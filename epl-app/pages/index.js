import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import Image from 'next/image'

const BAND_COLORS = {
  'So Long Goodnight': { bg: '#1a0a12', color: '#f72585' },
  'The Dick Beldings': { bg: '#001a1f', color: '#00d4ff' },
  'Jambi':             { bg: '#111111', color: '#ffffff' },
  'Elite':             { bg: '#0a1f0a', color: '#4ade80' },
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
  const [previousPage, setPreviousPage] = useState('home')
  const [crewMember, setCrewMember] = useState(null)
  const [setlistData, setSetlistData] = useState(null)

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

  // Pull to refresh
  useEffect(() => {
    let startY = 0
    let pulling = false
    let indicator = null
    let refreshing = false

    function getIndicator() {
      if (!indicator) {
        indicator = document.createElement('div')
        indicator.className = 'ptr-indicator'
        indicator.innerHTML = '<div style="width:16px;height:16px;border:2px solid #3a3a5a;border-top-color:#a78bfa;border-radius:50%;animation:spin 0.8s linear infinite"></div><span>Pull to refresh</span>'
        document.body.appendChild(indicator)
      }
      return indicator
    }

    function onTouchStart(e) {
      startY = e.touches[0].clientY
      pulling = window.scrollY === 0 && !refreshing
    }

    function onTouchMove(e) {
      if (!pulling) return
      const dist = e.touches[0].clientY - startY
      if (dist > 50) {
        const ind = getIndicator()
        ind.classList.add('visible')
        ind.querySelector('span').textContent = dist > 80 ? 'Release to refresh' : 'Pull to refresh'
      } else {
        if (indicator) indicator.classList.remove('visible')
      }
    }

    function onTouchEnd(e) {
      if (!pulling) return
      const dist = e.changedTouches[0].clientY - startY
      if (indicator) indicator.classList.remove('visible')
      if (dist > 80 && !refreshing) {
        refreshing = true
        loadData().finally(() => { refreshing = false })
      }
      pulling = false
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      if (indicator && indicator.parentNode) indicator.parentNode.removeChild(indicator)
      indicator = null
    }
  }, [loadData])

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

  function goToSelect() {
    setPage('select')
    // Don't null member immediately - let page change render first
    setTimeout(() => setMember(null), 100)
  }

  function openShow(show) {
    setPreviousPage(page)
    setSelectedShow(show)
    setPage('show-detail')
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20, background:'#0a0a0f' }}>
      <Head>
        <title>Echo Play Live</title>
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="icon" href="/logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Echo Play Live" />
      </Head>
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

  if (page === 'select') return <MemberSelect data={data} onSelect={selectMember} onBooking={() => setPage('booking')} onCalendar={() => setPage('master-calendar')} onCrew={() => setPage('crew-select')} />
  if (page === 'crew-select') return <CrewSelect data={data} onSelect={(c) => { setCrewMember(c); setPage('crew-home') }} onBack={() => setPage('select')} />
  if (page === 'crew-home') return <CrewHome data={data} crew={crewMember} resolve={resolve} resolveField={resolveField} onShowClick={openShow} onBack={() => setPage('crew-select')} />
  if (page === 'home') return <MemberHome data={data} member={member} resolve={resolve} resolveField={resolveField} onShowClick={openShow} onBack={goToSelect} onNav={setPage} />
  if (page === 'show-detail') return <ShowDetail data={data} member={member} show={selectedShow} resolve={resolve} resolveField={resolveField} onBack={() => setPage(previousPage)} onSetlist={(d) => { setSetlistData(d); setPage('setlist') }} />
  if (page === 'setlist') return <SetlistPage data={data} setlistData={setlistData} onBack={() => setPage('show-detail')} />
  if (page === 'schedule') return <FullSchedule data={data} member={member} resolve={resolve} resolveField={resolveField} onShowClick={openShow} onBack={() => setPage('home')} />
  if (page === 'blackouts') return <Blackouts data={data} member={member} resolve={resolve} onBack={() => setPage('home')} />
  if (page === 'master-calendar') return <MasterCalendar data={data} resolve={resolve} resolveField={resolveField} onShowClick={openShow} onBack={() => member ? setPage('home') : setPage('select')} />
  if (page === 'booking') return <BookingPage data={data} onBack={() => setPage('select')} />
  return null
}

function MemberSelect({ data, onSelect, onBooking, onCalendar, onCrew }) {
  const members = data['MEMBERS'] || []
  const today = new Date()
  const totalShows = (data['SHOWS'] || []).filter(s => s.fields['Date'] && new Date(s.fields['Date']) >= today).length
  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', display:'flex', flexDirection:'column', alignItems:'center', padding:'2.5rem 1.5rem 2rem' }}>
      <Head>
        <title>Echo Play Live</title>
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="icon" href="/logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Echo Play Live" />
      </Head>
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
        <div style={{ height:'0.5px', background:'#1a1a2a', margin:'12px 0 8px' }} />
        <button onClick={onCrew} style={{ width:'100%', padding:'14px', background:'transparent', border:'0.5px solid #1a2a2e', borderRadius:14, cursor:'pointer', fontFamily:'inherit', textAlign:'center' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#7ecbcb' }}>Not a band member?</div>
          <div style={{ fontSize:11, color:'#6b7280', marginTop:3 }}>Sound engineers & merch crew →</div>
        </button>
      </div>
    </div>
  )
}

function MemberHome({ data, member, resolve, resolveField, onShowClick, onBack, onNav }) {
  useEffect(() => { window.scrollTo(0, 0) }, [member?.id])
  const f = member.fields
  const name = f['Member Name'] || '—'
  const today = new Date(new Date().toDateString())
  const myShows = (data['SHOWS'] || []).filter(s => {
    const mp = s.fields['Members Playing'] || []
    return Array.isArray(mp) && mp.includes(member.id) && new Date((s.fields['Date'] || '') + 'T00:00:00') >= today
  }).sort((a, b) => a.fields['Date'] > b.fields['Date'] ? 1 : -1)

  const nextShow = myShows[0]
  const bands = resolveField(f['Primary Bands'], 'BANDS', 'Band Name')
  const myBlackouts = (data['BLACKOUT DATES'] || []).filter(b => {
    const bm = b.fields['Member'] || []
    return Array.isArray(bm) ? bm.includes(member.id) : bm === member.id
  }).sort((a, b) => a.fields['Date'] > b.fields['Date'] ? 1 : -1)

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', color:'#ffffff', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <Head>
        <title>EPL — {name}</title>
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="icon" href="/logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Echo Play Live" />
      </Head>

      <div style={{ background:'#111118', borderBottom:'0.5px solid #1e1e2e', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <img src="/logo.png" alt="EPL" onClick={onBack} style={{ width:36, height:36, objectFit:'contain', mixBlendMode:'screen', cursor:'pointer' }} />
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
  const bandRecs = resolve(f['Band'], 'BANDS')
  const venueRecs = resolve(f['Venue'], 'VENUES')
  const vf = venueRecs[0] ? venueRecs[0].fields : {}
  const address = f['Venue Address'] || vf['Address'] || ''
  const venuePhoto = vf['Photo'] && Array.isArray(vf['Photo']) && vf['Photo'][0] ? vf['Photo'][0].url : null
  const bandLogo = bandRecs[0]?.fields['Logo/Photo'] && Array.isArray(bandRecs[0].fields['Logo/Photo']) ? bandRecs[0].fields['Logo/Photo'][0]?.url : null

  return (
    <div onClick={onClick} style={{ background:'#111118', border:'0.5px solid #2a2a3a', borderRadius:16, overflow:'hidden', cursor:'pointer' }}>
      {venuePhoto ? (
        <div style={{ position:'relative', height:140 }}>
          <img src={venuePhoto} alt={vf['Venue Name']} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.75) 100%)' }} />
          <div style={{ position:'absolute', bottom:12, left:14, right:14 }}>
            <div style={{ fontSize:17, fontWeight:700, color:'#ffffff', textShadow:'0 1px 3px rgba(0,0,0,0.8)' }}>{vf['Venue Name'] || '—'}</div>
            <div style={{ display:'flex', gap:4, marginTop:4, flexWrap:'wrap', alignItems:'center' }}>
              {f['Indoor / Outdoor'] && <span style={{ fontSize:10, padding:'1px 7px', borderRadius:20, background:'rgba(0,0,0,0.5)', color:'#cccccc', border:'0.5px solid rgba(255,255,255,0.2)' }}>{f['Indoor / Outdoor'] === 'Outdoor' ? '🌿 Outdoor' : f['Indoor / Outdoor'] === 'Both' ? '🏟️ Both' : '🏠 Indoor'}</span>}
            </div>
          </div>
          <div style={{ position:'absolute', top:10, right:12, background:'#1a1a2e', borderRadius:8, padding:'5px 12px', textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:700, color:'#a78bfa' }}>{days}</div>
            <div style={{ fontSize:9, color:'#6b7280' }}>{days === 1 ? 'day' : 'days'}</div>
          </div>
        </div>
      ) : (
        <div style={{ padding:'16px 16px 0' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
            <div>
              <div style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>{vf['Venue Name'] || '—'}</div>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center' }}>
                {bands.map((b, i) => <BandTag key={i} name={b} />)}
                {f['Indoor / Outdoor'] && <span style={{ fontSize:10, padding:'1px 7px', borderRadius:20, background:'#0a0a1a', color:'#6b7280', border:'0.5px solid #2a2a3a' }}>{f['Indoor / Outdoor'] === 'Outdoor' ? '🌿 Outdoor' : f['Indoor / Outdoor'] === 'Both' ? '🏟️ Both' : '🏠 Indoor'}</span>}
              </div>
            </div>
            <div style={{ background:'#1a1a2e', borderRadius:10, padding:'6px 14px', textAlign:'center', flexShrink:0, marginLeft:12 }}>
              <div style={{ fontSize:22, fontWeight:700, color:'#a78bfa' }}>{days}</div>
              <div style={{ fontSize:10, color:'#6b7280' }}>{days === 1 ? 'day' : 'days'}</div>
            </div>
          </div>
        </div>
      )}
      <div style={{ padding: venuePhoto ? '14px 16px' : '0 16px' }}>
        {bandLogo && (
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <img src={bandLogo} alt="" style={{ width:44, height:44, objectFit:'contain', borderRadius:8, background:'#1a1a2e', padding:4, flexShrink:0 }} />
            <div style={{ fontSize:18, fontWeight:700, color: BAND_COLORS[bands[0]]?.color || '#ffffff' }}>{bands[0]}</div>
          </div>
        )}
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

function ShowDetail({ data, member, show, resolve, resolveField, onBack, onSetlist }) {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const [weather, setWeather] = useState(null)

  useEffect(() => {
    async function fetchWeather() {
      try {
        const showDate = show.fields['Date']
        if (!showDate) { setWeather('unavailable'); return }

        // Check if date is within 16-day forecast window
        const today = new Date(new Date().toDateString())
        const showD = new Date(showDate + 'T00:00:00')
        const daysAway = Math.ceil((showD - today) / (1000 * 60 * 60 * 24))
        if (daysAway > 16) { setWeather('tooFar'); return }
        if (daysAway < 0) { setWeather('past'); return }

        // Use Fort Worth coords as default — reliable fallback
        let lat = 32.7555, lon = -97.3308

        // Try to get venue city coords
        const venueIds = show.fields['Venue'] || []
        const venueRec = (data['VENUES'] || []).find(v =>
          Array.isArray(venueIds) ? venueIds.includes(v.id) : venueIds === v.id
        )
        if (venueRec) {
          const city = venueRec.fields['City'] || ''
          const state = venueRec.fields['State'] || 'TX'
          if (city) {
            try {
              const geoRes = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city + ' ' + state + ' USA')}&count=1&language=en&format=json`
              )
              const geoData = await geoRes.json()
              if (geoData.results && geoData.results[0]) {
                lat = geoData.results[0].latitude
                lon = geoData.results[0].longitude
              }
            } catch(e) {}
          }
        }

        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&temperature_unit=fahrenheit&timezone=America%2FChicago&start_date=${showDate}&end_date=${showDate}`
        )
        const wData = await weatherRes.json()

        if (wData.daily && wData.daily.temperature_2m_max && wData.daily.temperature_2m_max.length > 0 && wData.daily.temperature_2m_max[0] !== null) {
          const code = wData.daily.weathercode[0]
          const conditions = {
            0:'☀️ Clear', 1:'🌤️ Mainly clear', 2:'⛅ Partly cloudy', 3:'☁️ Overcast',
            45:'🌫️ Foggy', 48:'🌫️ Foggy',
            51:'🌦️ Light drizzle', 53:'🌦️ Drizzle', 55:'🌧️ Heavy drizzle',
            61:'🌧️ Light rain', 63:'🌧️ Rain', 65:'🌧️ Heavy rain',
            71:'🌨️ Light snow', 73:'❄️ Snow', 75:'❄️ Heavy snow',
            80:'🌦️ Showers', 81:'🌧️ Showers', 82:'⛈️ Violent showers',
            95:'⛈️ Thunderstorm', 96:'⛈️ Thunderstorm', 99:'⛈️ Thunderstorm',
          }
          setWeather({
            high: Math.round(wData.daily.temperature_2m_max[0]),
            low: Math.round(wData.daily.temperature_2m_min[0]),
            rain: wData.daily.precipitation_probability_max[0] ?? 0,
            label: conditions[code] || '🌡️ Unknown',
            daysAway,
            lat,
            lon,
            date: showDate,
          })
        } else {
          setWeather('unavailable')
        }
      } catch(e) {
        setWeather('unavailable')
      }
    }
    fetchWeather()
  }, [show.id])

  const f = show.fields
  const bands = resolveField(f['Band'], 'BANDS', 'Band Name')
  const bandRecs = resolve(f['Band'], 'BANDS')
  const bandLogo = bandRecs[0]?.fields['Logo/Photo'] && Array.isArray(bandRecs[0].fields['Logo/Photo']) ? bandRecs[0].fields['Logo/Photo'][0]?.url : null
  const venueRecs = resolve(f['Venue'], 'VENUES')
  const vf = venueRecs[0] ? venueRecs[0].fields : {}
  const address = f['Venue Address'] || vf['Address'] || ''
  const days = daysUntil(f['Date'])
  const setlistRecs = resolve(f['SETLISTS'] || f['Setlist'] || [], 'SETLISTS')
  const setlist = setlistRecs[0]
  const songIds = setlist ? (setlist.fields['Songs'] || []) : []
  const songRecs = (Array.isArray(songIds) ? songIds : [songIds])
    .map(id => (data['SONGS'] || []).find(s => s.id === id))
    .filter(Boolean)
  const setName = setlist?.fields['Set Name'] || null
  const setLength = setlist?.fields['Set Length'] || null


  function openMaps(addr) {
    const encoded = encodeURIComponent(addr)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (isIOS) window.open(`maps://maps.apple.com/?q=${encoded}`)
    else window.open(`https://maps.google.com/?q=${encoded}`)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', color:'#ffffff', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <Head>
        <title>EPL — Show Details</title>
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="icon" href="/logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Echo Play Live" />
      </Head>
      {(() => {
        const venuePhoto = vf['Photo'] && Array.isArray(vf['Photo']) && vf['Photo'][0] ? vf['Photo'][0].url : null

        return venuePhoto ? (
          <div style={{ position:'relative', width:'100%', height:220 }}>
            <img src={venuePhoto} alt={vf['Venue Name']} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.7) 100%)' }} />
            <button onClick={onBack} style={{ position:'absolute', top:16, left:16, background:'rgba(0,0,0,0.5)', border:'none', color:'#ffffff', fontSize:22, cursor:'pointer', padding:'4px 10px', borderRadius:20, backdropFilter:'blur(4px)' }}>‹</button>
            <img src="/logo.png" alt="EPL" onClick={onBack} style={{ position:'absolute', top:14, right:14, width:32, height:32, objectFit:'contain', mixBlendMode:'screen', cursor:'pointer', opacity:0.8 }} />
            <div style={{ position:'absolute', bottom:14, left:16, right:16 }}>
              <div style={{ fontSize:22, fontWeight:700, color:'#ffffff', textShadow:'0 1px 4px rgba(0,0,0,0.8)' }}>{vf['Venue Name'] || '—'}</div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,0.75)', marginTop:2 }}>{fmt(f['Date'])}</div>
            </div>
          </div>
        ) : (
          <div style={{ background:'#111118', borderBottom:'0.5px solid #1e1e2e', padding:'12px 20px', display:'flex', alignItems:'center', gap:14, position:'sticky', top:0, zIndex:50 }}>
            <button onClick={onBack} style={{ background:'none', border:'none', color:'#a78bfa', fontSize:22, cursor:'pointer', padding:0, lineHeight:1 }}>‹</button>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:600 }}>{vf['Venue Name'] || '—'}</div>
              <div style={{ fontSize:12, color:'#6b7280' }}>{fmt(f['Date'])}</div>
            </div>
            <img src="/logo.png" alt="EPL" onClick={onBack} style={{ width:30, height:30, objectFit:'contain', mixBlendMode:'screen', cursor:'pointer', opacity:0.7 }} />
          </div>
        )
      })()}

      <div style={{ padding:'20px 20px 80px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            {bandLogo && (
              <img src={bandLogo} alt="" style={{ width:52, height:52, objectFit:'contain', borderRadius:10, background:'#1a1a2e', padding:4, flexShrink:0 }} />
            )}
            <div>
              {bands.map((b, i) => (
                <div key={i} style={{ fontSize:22, fontWeight:700, color: BAND_COLORS[b]?.color || '#ffffff', lineHeight:1.2 }}>{b}</div>
              ))}
            </div>
          </div>
          {days != null && days >= 0 && (
            <div style={{ background:'#1a1a2e', borderRadius:10, padding:'6px 14px', textAlign:'center', flexShrink:0, marginLeft:12 }}>
              <div style={{ fontSize:20, fontWeight:700, color:'#a78bfa' }}>{days}</div>
              <div style={{ fontSize:10, color:'#6b7280' }}>{days === 1 ? 'day away' : 'days away'}</div>
            </div>
          )}
        </div>

        <div style={{ marginBottom:20 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <div style={{ background:'#0a0a1a', borderRadius:10, padding:'12px 14px' }}>
              <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Load in</div>
              <div style={{ fontSize:18, fontWeight:700, color:'#ffffff' }}>{f['Load-In Time'] || '—'}</div>
            </div>
            <div style={{ background:'#0a0a1a', borderRadius:10, padding:'12px 14px' }}>
              <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Sound check</div>
              <div style={{ fontSize:18, fontWeight:700, color:'#ffffff' }}>
                {f['Sound Check Time'] || '—'}
              </div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div style={{ background:'#0a0a1a', borderRadius:10, padding:'12px 14px' }}>
              <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Set time</div>
              <div style={{ fontSize:18, fontWeight:700, color:'#a78bfa' }}>{f['Set Time'] || '—'}</div>
            </div>
            <div style={{ background:'#0a0a1a', borderRadius:10, padding:'12px 14px' }}>
              <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>End time</div>
              <div style={{ fontSize:18, fontWeight:700, color:'#ffffff' }}>{f['End Time'] || '—'}</div>
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
          {f['Indoor / Outdoor'] && (
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'#0a0a1a', borderRadius:20, border:'0.5px solid #2a2a3a' }}>
              <span style={{ fontSize:16 }}>{f['Indoor / Outdoor'] === 'Outdoor' ? '🌿' : f['Indoor / Outdoor'] === 'Both' ? '🏟️' : '🏠'}</span>
              <span style={{ fontSize:13, fontWeight:600, color:'#ffffff' }}>{f['Indoor / Outdoor']}</span>
            </div>
          )}
          {weather && weather !== 'unavailable' && weather !== 'tooFar' && weather !== 'past' && (
            <a
              href={`https://forecast.weather.gov/MapClick.php?lat=${weather.lat}&lon=${weather.lon}&TextType=1`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', background:'#0a0a1a', borderRadius:20, border:`0.5px solid ${weather.rain > 50 ? '#3a2020' : '#2a2a3a'}`, flex:1, textDecoration:'none' }}
            >
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#ffffff' }}>{weather.label} · {weather.high}°/{weather.low}°F</div>
                <div style={{ fontSize:11, color: weather.rain > 50 ? '#ff9f7f' : '#6b7280' }}>
                  {weather.rain}% rain{weather.rain > 50 ? ' ⚠️' : ''}{weather.daysAway > 7 ? ' · extended forecast' : ''} · tap for full forecast ↗
                </div>
              </div>
            </a>
          )}
          {weather === 'tooFar' && (
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'#0a0a1a', borderRadius:20, border:'0.5px solid #1a1a2a', flex:1 }}>
              <span style={{ fontSize:13, color:'#3a3a4a' }}>📅 Show is too far out for a forecast</span>
            </div>
          )}
          {weather === 'past' && null}
          {!weather && f['Date'] && (
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'#0a0a1a', borderRadius:20, border:'0.5px solid #1a1a2a', flex:1 }}>
              <span style={{ fontSize:13, color:'#3a3a4a' }}>🌡️ Fetching forecast...</span>
            </div>
          )}
        </div>

        {(address || vf['Venue Name']) && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Venue</div>
            <div style={{ background:'#111118', border:'0.5px solid #2a2a3a', borderRadius:14, padding:16 }}>
              <div style={{ fontSize:15, fontWeight:600, marginBottom: address ? 6 : 0 }}>{vf['Venue Name'] || '—'}</div>
              {address && <div style={{ fontSize:13, color:'#9ca3af', marginBottom:12 }}>{address}</div>}
              {vf['Parking Notes'] && <div style={{ fontSize:12, color:'#6b7280', marginBottom:12 }}>🅿️ {vf['Parking Notes']}</div>}
              {address && (
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => openMaps(address)} style={{ flex:1, padding:'10px', background:'#1a1a2e', border:'none', borderRadius:10, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                    <img src="https://www.apple.com/favicon.ico" alt="Apple" style={{ width:16, height:16, borderRadius:3 }} />
                    <span style={{ color:'#a78bfa', fontSize:13, fontWeight:600 }}>Apple Maps</span>
                  </button>
                  <button onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`)} style={{ flex:1, padding:'10px', background:'#1a2e1a', border:'none', borderRadius:10, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                    <img src="https://www.gstatic.com/images/branding/product/1x/maps_round_32dp.png" alt="Google Maps" style={{ width:16, height:16, borderRadius:3 }} />
                    <span style={{ color:'#6bcb77', fontSize:13, fontWeight:600 }}>Google Maps</span>
                  </button>
                </div>
              )}
              {!address && (
                <div style={{ fontSize:12, color:'#3a3a4a', marginTop:4 }}>No address on file — add it in Airtable</div>
              )}
            </div>
          </div>
        )}

        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Setlist</div>
          {songRecs.length > 0 ? (
            <div onClick={() => onSetlist({ setlist, songRecs, show })} style={{ background:'#111118', border:'0.5px solid #2a2a3a', borderRadius:14, padding:'16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:'#ffffff', marginBottom:4 }}>{setName || 'View setlist'}</div>
                <div style={{ fontSize:12, color:'#6b7280' }}>{songRecs.length} songs{setLength ? ` · ${setLength} min` : ''}</div>
              </div>
              <div style={{ color:'#a78bfa', fontSize:22 }}>›</div>
            </div>
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

        {(() => {
          const memberIds = f['Members Playing'] || []
          const memberRecs = (Array.isArray(memberIds) ? memberIds : [memberIds])
            .map(id => (data['MEMBERS'] || []).find(m => m.id === id))
            .filter(Boolean)
          if (!memberRecs.length) return null
          return (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
                Band members ({memberRecs.length})
              </div>
              <div style={{ background:'#111118', border:'0.5px solid #2a2a3a', borderRadius:14, overflow:'hidden' }}>
                {memberRecs.map((m, i) => {
                  const mf = m.fields
                  const name = mf['Member Name'] || '—'
                  const instruments = (mf['Instruments'] || []).join(', ') || mf['Role/Instrument'] || '—'
                  const initials = name.split(' ').map(x => x[0]).join('').toUpperCase().slice(0,2)
                  const photo = mf['Photo'] && Array.isArray(mf['Photo']) && mf['Photo'][0] ? mf['Photo'][0].url : null
                  return (
                    <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom: i < memberRecs.length-1 ? '0.5px solid #1a1a2a' : 'none' }}>
                      {photo
                        ? <img src={photo} alt={name} style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                        : <div style={{ width:36, height:36, borderRadius:'50%', background:'#1a1a2e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#a78bfa', flexShrink:0 }}>{initials}</div>
                      }
                      <div>
                        <div style={{ fontSize:14, fontWeight:600, color:'#ffffff' }}>{name}</div>
                        <div style={{ fontSize:12, color:'#6b7280', marginTop:1 }}>{instruments}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Crew</div>
          <div style={{ background:'#111118', border:'0.5px solid #2a2a3a', borderRadius:14, overflow:'hidden' }}>
            {(() => {
              // Resolve sound — check linked CREW first, then linked MEMBERS, then fallback to Sound Provider text
              const soundCrewRecs = resolve(f['Sound Engineer'], 'CREW')
              const soundMemberRecs = resolve(f['Sound Engineer'], 'MEMBERS')
              const soundName = soundCrewRecs[0]
                ? soundCrewRecs[0].fields['Name']
                : soundMemberRecs[0]
                ? soundMemberRecs[0].fields['Member Name']
                : f['Sound Provider'] === 'Venue Provided'
                ? 'Venue provided'
                : f['Sound Provider'] || null

              // Resolve merch — check linked CREW first, then linked MEMBERS
              const merchCrewRecs = resolve(f['Merch Person'], 'CREW')
              const merchMemberRecs = resolve(f['Merch Person'], 'MEMBERS')
              const merchName = merchCrewRecs[0]
                ? merchCrewRecs[0].fields['Name']
                : merchMemberRecs[0]
                ? merchMemberRecs[0].fields['Member Name']
                : null

              const soundRole = soundCrewRecs[0]
                ? soundCrewRecs[0].fields['Role'] || 'Sound Engineer'
                : soundMemberRecs[0]
                ? 'Member (Sound)'
                : f['Sound Provider'] || null

              const merchRole = merchCrewRecs[0]
                ? merchCrewRecs[0].fields['Role'] || 'Merch'
                : merchMemberRecs[0]
                ? 'Member (Merch)'
                : null

              const rows = [
                ['Sound', soundName, soundRole, f['Sound Notes']],
                ['Merch', merchName, merchRole, f['Merch Notes']],
              ].filter(([,val]) => val)

              if (!rows.length) return <div style={{ padding:'12px 16px', fontSize:13, color:'#6b7280' }}>No crew assigned yet.</div>
              return rows.map(([label, name, role, notes], i) => (
                <div key={label} style={{ padding:'12px 16px', borderBottom: i < rows.length-1 ? '0.5px solid #1a1a2a' : 'none' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div>
                      <div style={{ fontSize:12, color:'#6b7280', marginBottom:2 }}>{label}</div>
                      <div style={{ fontSize:14, fontWeight:600, color:'#ffffff' }}>{name}</div>
                      {role && name !== 'Venue provided' && <div style={{ fontSize:11, color:'#7ecbcb', marginTop:2 }}>{role}</div>}
                    </div>
                  </div>
                  {notes && <div style={{ fontSize:12, color:'#6b7280', marginTop:6, paddingTop:6, borderTop:'0.5px solid #1a1a2a' }}>{notes}</div>}
                </div>
              ))
            })()}
          </div>
        </div>


      </div>
    </div>
  )
}

function MasterCalendar({ data, resolve, resolveField, onShowClick, onBack }) {
  const year = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  const today = new Date(new Date().toDateString())

  useEffect(() => {
    try {
      const el = document.getElementById('month-' + currentMonth)
      if (el) el.scrollIntoView({ behavior:'instant', block:'start' })
    } catch(e) {}
  }, [currentMonth])

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
    const startStr = b.fields['Date']
    const endStr = b.fields['End Date'] || startStr
    if (!startStr) return
    const start = new Date(startStr + 'T00:00:00')
    const end = new Date(endStr + 'T00:00:00')
    const cur = new Date(start)
    while (cur <= end) {
      const ds = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`
      if (!blackoutsByDate[ds]) blackoutsByDate[ds] = []
      blackoutsByDate[ds].push(b)
      cur.setDate(cur.getDate() + 1)
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
    return !!blackoutsByDate[ds] && !showsByDate[ds] && dt >= today
  }).length

  const [filter, setFilter] = useState('all')
  const [expandedBlackout, setExpandedBlackout] = useState(null)

  function toggleFilter(f) {
    setFilter(prev => prev === f ? 'all' : f)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', color:'#ffffff', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <Head>
        <title>EPL — Show Calendar {year}</title>
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="icon" href="/logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Echo Play Live" />
      </Head>
      <div style={{ background:'#111118', borderBottom:'0.5px solid #1e1e2e', padding:'12px 20px', display:'flex', alignItems:'center', gap:14, position:'sticky', top:0, zIndex:50 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'#a78bfa', fontSize:22, cursor:'pointer', padding:0 }}>‹</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:600 }}>Show Calendar {year}</div>
          <div style={{ fontSize:12, color:'#6b7280' }}>All Fridays & Saturdays</div>
        </div>
        {filter !== 'all' && (
          <button onClick={() => setFilter('all')} style={{ fontSize:12, padding:'5px 12px', borderRadius:20, background:'#2a2a3a', border:'none', color:'#a78bfa', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
            Reset
          </button>
        )}
        <img src="/logo.png" alt="EPL" onClick={onBack} style={{ width:30, height:30, objectFit:'contain', mixBlendMode:'screen', cursor:'pointer', opacity:0.7 }} />
      </div>

      <div style={{ background:'#0a0a0f', padding:'12px 20px 10px', borderBottom:'0.5px solid #1e1e2e', position:'sticky', top:52, zIndex:40 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
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
      </div>

      <div style={{ padding:'8px 20px 80px' }}>
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
            <div id={'month-' + group.monthIdx} style={{ fontSize:12, fontWeight:700, color:'#a78bfa', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10, marginTop:8, display:'flex', alignItems:'center', gap:10, scrollMarginTop:145 }}>
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
              const isExpanded = expandedBlackout === ds
              const dayName = dt.toLocaleDateString('en-US', { weekday:'short' })
              const dayNum = dt.getDate()

              let bg = '#111118', border = '0.5px solid #2a2a3a', statusColor = '#6b7280'
              if (isPast) { bg = '#0a0a0a'; border = '0.5px solid #1a1a1a'; statusColor = '#3a3a3a' }
              else if (isBooked) { bg = '#0f1f0f'; border = '0.5px solid #2a4a2a'; statusColor = '#6bcb77' }
              else if (isBlackedOut) { bg = '#160e0e'; border = '0.5px solid #3a2020'; statusColor = '#ff9f7f' }
              else { bg = '#0d0d1f'; border = '0.5px solid #2a2a4a'; statusColor = '#5a5a8a' }

              return (
                <div key={ds} style={{ marginBottom:6 }}>
                  <div onClick={() => {
                    if (isBooked && shows.length === 1) onShowClick(shows[0])
                    else if (isBooked && shows.length > 1) setExpandedBlackout(expandedBlackout === ds ? null : ds)
                    else if (isBlackedOut) setExpandedBlackout(isExpanded ? null : ds)
                  }} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'10px 14px', background:bg, border: isExpanded ? '1px solid #6bcb77' : border, borderRadius: isExpanded ? '10px 10px 0 0' : 10, cursor: isBooked || isBlackedOut ? 'pointer' : 'default' }}>
                    <div style={{ width:36, textAlign:'center', flexShrink:0, paddingTop:1 }}>
                      <div style={{ fontSize:16, fontWeight:700, color: isPast ? '#3a3a3a' : isBooked ? '#6bcb77' : isBlackedOut ? '#ff9f7f' : '#a78bfa' }}>{dayNum}</div>
                      <div style={{ fontSize:10, color:'#6b7280' }}>{dayName}</div>
                    </div>
                    <div style={{ width:'0.5px', alignSelf:'stretch', background:'#2a2a3a', flexShrink:0 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      {isBooked && shows.length === 1 ? (() => {
                        const venueRecs = resolve(shows[0].fields['Venue'], 'VENUES')
                        const vf = venueRecs[0] ? venueRecs[0].fields : {}
                        const bands = resolveField(shows[0].fields['Band'], 'BANDS', 'Band Name')
                        const bRec = (data['BANDS'] || []).find(br => br.fields['Band Name'] === bands[0])
                        const logo = bRec?.fields['Logo/Photo']?.[0]?.url
                        return (
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            {logo && <img src={logo} alt={bands[0]} style={{ width:34, height:34, objectFit:'contain', borderRadius:6, background:'#0a1a0a', padding:2, flexShrink:0 }} />}
                            <div>
                              <div style={{ fontSize:13, fontWeight:600, color:'#ffffff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{vf['Venue Name'] || '—'}</div>
                              <div style={{ display:'flex', gap:4, marginTop:2, alignItems:'center', flexWrap:'wrap' }}>
                                {bands.map((b, bi) => <span key={bi} style={{ fontSize:10, padding:'1px 6px', borderRadius:20, background:BAND_COLORS[b]?.bg||'#1a1a2e', color:BAND_COLORS[b]?.color||'#a78bfa', fontWeight:600 }}>{b}</span>)}
                                {shows[0].fields['Set Time'] && <span style={{ fontSize:10, color:'#6b7280' }}>{shows[0].fields['Set Time']}</span>}
                              </div>
                            </div>
                          </div>
                        )
                      })() : isBooked && shows.length > 1 ? (
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:'#6bcb77' }}>{shows.length} shows — tap to select</div>
                          <div style={{ display:'flex', gap:4, marginTop:4, flexWrap:'wrap' }}>
                            {shows.flatMap(s => resolveField(s.fields['Band'], 'BANDS', 'Band Name')).filter((b,i,a) => a.indexOf(b)===i).map((b, bi) => (
                              <span key={bi} style={{ fontSize:10, padding:'1px 6px', borderRadius:20, background:BAND_COLORS[b]?.bg||'#1a1a2e', color:BAND_COLORS[b]?.color||'#a78bfa', fontWeight:600 }}>{b}</span>
                            ))}
                          </div>
                        </div>
                      ) : isBlackedOut ? (
                        <div style={{ fontSize:13, color:'#ff9f7f' }}>
                          {blackouts.reduce((a, b) => a + (Array.isArray(b.fields['Member']) ? b.fields['Member'].length : 1), 0)} member conflict{blackouts.length > 1 ? 's' : ''} — tap for details
                        </div>
                      ) : isPast ? (
                        <div style={{ fontSize:13, color:'#3a3a3a' }}>Past date</div>
                      ) : (
                        <div style={{ fontSize:13, color:'#5a5a8a' }}>Open — available to book</div>
                      )}
                    </div>
                    <div style={{ fontSize:14, color:statusColor, flexShrink:0 }}>
                      {isBooked && shows.length === 1 ? '›' : isBooked && shows.length > 1 ? (isExpanded ? '▲' : '▼') : isBlackedOut ? (isExpanded ? '▲' : '▼') : ''}
                    </div>
                  </div>

                  {isExpanded && isBooked && shows.length > 1 && (
                    <div style={{ background:'#0f1f0f', border:'1px solid #2a4a2a', borderTop:'none', borderRadius:'0 0 10px 10px', padding:'8px 12px', marginBottom:6 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'#6bcb77', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Select a show</div>
                      {shows.map((s, i) => {
                        const sf = s.fields
                        const sBands = resolveField(sf['Band'], 'BANDS', 'Band Name')
                        const sVenue = resolve(sf['Venue'], 'VENUES')
                        const svf = sVenue[0] ? sVenue[0].fields : {}
                        return (
                          <div key={s.id} onClick={e => { e.stopPropagation(); onShowClick(s) }} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom: i < shows.length-1 ? '0.5px solid #1a2a1a' : 'none', cursor:'pointer' }}>
                            {sBands.map((b, bi) => {
                              const bRec = (data['BANDS'] || []).find(br => br.fields['Band Name'] === b)
                              const logo = bRec?.fields['Logo/Photo']?.[0]?.url
                              return logo ? <img key={bi} src={logo} alt={b} style={{ width:38, height:38, objectFit:'contain', borderRadius:8, background:'#0a1a0a', padding:3, flexShrink:0 }} /> : null
                            })}
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:13, fontWeight:600, color:'#ffffff' }}>{svf['Venue Name'] || '—'}</div>
                              <div style={{ display:'flex', gap:4, marginTop:3, flexWrap:'wrap', alignItems:'center' }}>
                                {sBands.map((b, bi) => <span key={bi} style={{ fontSize:10, padding:'1px 6px', borderRadius:20, background:BAND_COLORS[b]?.bg||'#1a1a2e', color:BAND_COLORS[b]?.color||'#a78bfa', fontWeight:600 }}>{b}</span>)}
                                {sf['Set Time'] && <span style={{ fontSize:10, color:'#6b7280' }}>{sf['Set Time']}</span>}
                              </div>
                            </div>
                            <span style={{ color:'#6bcb77', fontSize:16, flexShrink:0 }}>›</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {isExpanded && isBlackedOut && (
                    <div style={{ background:'#1a0a0a', border:'1px solid #ff9f7f', borderTop:'none', borderRadius:'0 0 10px 10px', padding:'12px 16px' }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'#ff9f7f', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Member conflicts</div>
                      {blackouts.map((b, bi) => {
                        const mids = b.fields['Member'] || []
                        const names = (Array.isArray(mids) ? mids : [mids]).map(id => memberById[id] || '?').filter(Boolean)
                        return names.map((n, ni) => (
                          <div key={bi + '-' + ni} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'0.5px solid #2a1a1a' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ width:28, height:28, borderRadius:'50%', background:'#2e1a1a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#ff9f7f' }}>
                                {n.split(' ').map(x => x[0]).join('').toUpperCase().slice(0,2)}
                              </div>
                              <div>
                                <div style={{ fontSize:13, fontWeight:600, color:'#ffffff' }}>{n}</div>
                                {b.fields['Reason'] && <div style={{ fontSize:11, color:'#6b7280' }}>{b.fields['Reason']}</div>}
                              </div>
                            </div>
                            <div style={{ fontSize:11, color:'#ff9f7f', fontWeight:500 }}>Unavailable</div>
                          </div>
                        ))
                      })}
                      <div style={{ marginTop:10, fontSize:12, color:'#6b7280', fontStyle:'italic' }}>
                        Date may still be bookable with available members.
                      </div>
                    </div>
                  )}
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
  const today = new Date(new Date().toDateString())
  const myShows = (data['SHOWS'] || []).filter(s => {
    const mp = s.fields['Members Playing'] || []
    return Array.isArray(mp) && mp.includes(member.id) && new Date((s.fields['Date'] || '') + 'T00:00:00') >= today
  }).sort((a, b) => a.fields['Date'] > b.fields['Date'] ? 1 : -1)

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', color:'#ffffff', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <Head>
        <title>EPL — My Schedule</title>
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="icon" href="/logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Echo Play Live" />
      </Head>
      <div style={{ background:'#111118', borderBottom:'0.5px solid #1e1e2e', padding:'12px 20px', display:'flex', alignItems:'center', gap:14, position:'sticky', top:0, zIndex:50 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'#a78bfa', fontSize:22, cursor:'pointer', padding:0 }}>‹</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:600 }}>My schedule</div>
          <div style={{ fontSize:12, color:'#6b7280' }}>{myShows.length} upcoming shows</div>
        </div>
        <img src="/logo.png" alt="EPL" onClick={onBack} style={{ width:30, height:30, objectFit:'contain', mixBlendMode:'screen', cursor:'pointer', opacity:0.7 }} />
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
  const [currentEndDate, setCurrentEndDate] = useState('')
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
    setPendingDates(prev => [...prev, { date: currentDate, endDate: currentEndDate || currentDate, reason: currentReason }])
    setCurrentDate('')
    setCurrentEndDate('')
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
      <Head>
        <title>EPL - Blackout Dates</title>
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="icon" href="/logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Echo Play Live" />
      </Head>
      <div style={{ background:'#111118', borderBottom:'0.5px solid #1e1e2e', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={onBack} style={{ background:'none', border:'none', color:'#a78bfa', fontSize:22, cursor:'pointer', padding:0 }}>{String.fromCharCode(8249)}</button>
          <img src="/logo.png" alt="EPL" onClick={onBack} style={{ width:28, height:28, objectFit:'contain', mixBlendMode:'screen', cursor:'pointer', opacity:0.7 }} />
          <div style={{ fontSize:15, fontWeight:600 }}>My blackout dates</div>
        </div>
        <button onClick={() => { setShowForm(f => !f); setPendingDates([]); setCurrentDate(''); setCurrentEndDate(''); setCurrentReason('Personal') }} style={{ fontSize:13, padding:'6px 14px', borderRadius:20, background: showForm ? '#2a2a3a' : '#1a1a2e', border:'none', color:'#a78bfa', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
          {showForm ? 'Cancel' : '+ Add dates'}
        </button>
      </div>

      <div style={{ padding:'8px 20px 80px' }}>
        {submitted && (
          <div style={{ background:'#0f2a0f', border:'0.5px solid #2a4a2a', borderRadius:10, padding:'12px 16px', marginBottom:14, fontSize:13, color:'#6bcb77' }}>
            Blackout {localBlackouts.length === 1 ? 'date' : 'dates'} submitted successfully!
          </div>
        )}

        {showForm && (
          <div style={{ background:'#111118', border:'0.5px solid #2a2a3a', borderRadius:14, padding:16, marginBottom:20 }}>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Add blackout dates</div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
              <div>
                <div style={{ fontSize:12, color:'#6b7280', marginBottom:6 }}>Start date</div>
                <input
                  type="date"
                  value={currentDate}
                  onChange={e => setCurrentDate(e.target.value)}
                  style={{ width:'100%', padding:'10px 8px', background:'#1a1a2a', border:'0.5px solid #3a3a4a', borderRadius:10, color:'#ffffff', fontSize:13, fontFamily:'inherit', boxSizing:'border-box', display:'block' }}
                />
              </div>
              <div>
                <div style={{ fontSize:12, color:'#6b7280', marginBottom:6 }}>End date <span style={{ color:'#3a3a4a' }}>(optional)</span></div>
                <input
                  type="date"
                  value={currentEndDate}
                  min={currentDate}
                  onChange={e => setCurrentEndDate(e.target.value)}
                  style={{ width:'100%', padding:'10px 8px', background:'#1a1a2a', border:'0.5px solid #3a3a4a', borderRadius:10, color:'#ffffff', fontSize:13, fontFamily:'inherit', boxSizing:'border-box', display:'block' }}
                />
              </div>
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
                      <span style={{ fontSize:13, fontWeight:600, color:'#ffffff' }}>{p.endDate && p.endDate !== p.date ? `${fmt(p.date)} → ${fmt(p.endDate)}` : fmt(p.date)}</span>
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

        {myBlackouts.length ? myBlackouts.map((b, i) => {
          const hasEnd = b.fields['End Date'] && b.fields['End Date'] !== b.fields['Date']
          const dateDisplay = hasEnd ? `${fmt(b.fields['Date'])} → ${fmt(b.fields['End Date'])}` : fmt(b.fields['Date'])
          const daysOut = daysUntil(b.fields['Date'])
          return (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 0', borderBottom:'0.5px solid #1a1a2a' }}>
            <div>
              <div style={{ fontSize:14, fontWeight:600 }}>{dateDisplay}</div>
              <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{b.fields['Reason'] || 'No reason listed'}</div>
            </div>
            <div style={{ fontSize:12, color: daysOut > 0 ? '#ff9f7f' : '#3a3a3a' }}>
              {daysOut > 0 ? `In ${daysOut} days` : 'Past'}
            </div>
          </div>
        )}) : (
          <div style={{ color:'#6b7280', fontSize:14, paddingTop:'1rem', textAlign:'center' }}>
            No blackout dates yet.
          </div>
        )}
      </div>
    </div>
  )
}

function CrewSelect({ data, onSelect, onBack }) {
  const crew = data['CREW'] || []
  const active = crew.filter(c => c.fields['Active'] !== false)
  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', display:'flex', flexDirection:'column', alignItems:'center', padding:'2.5rem 1.5rem 2rem', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <Head>
        <title>EPL — Crew</title>
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="icon" href="/logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Echo Play Live" />
      </Head>
      <div style={{ marginBottom:'1.75rem', textAlign:'center' }}>
        <img src="/logo.png" alt="Echo Play Live" onClick={onBack} style={{ width:100, height:100, objectFit:'contain', marginBottom:14, mixBlendMode:'screen', cursor:'pointer' }} />
        <div style={{ fontSize:15, fontWeight:700, color:'#ffffff', marginBottom:4 }}>Crew Portal</div>
        <div style={{ fontSize:13, color:'#6b7280' }}>Select your name to see your schedule</div>
      </div>
      <div style={{ width:'100%', maxWidth:380, display:'flex', flexDirection:'column', gap:10 }}>
        {active.length ? active.map(c => {
          const f = c.fields
          const name = f['Name'] || '—'
          const role = f['Role'] || '—'
          const initials = name.split(' ').map(x => x[0]).join('').toUpperCase().slice(0,2)
          return (
            <button key={c.id} onClick={() => onSelect(c)} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', background:'#111118', border:'0.5px solid #1a2a2e', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%', fontFamily:'inherit' }}>
              <div style={{ width:44, height:44, borderRadius:'50%', background:'#1a2a2e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#7ecbcb', flexShrink:0 }}>{initials}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:600, color:'#ffffff' }}>{name}</div>
                <div style={{ fontSize:12, color:'#7ecbcb', marginTop:2 }}>{role}</div>
              </div>
              <div style={{ color:'#2a2a3a', fontSize:20 }}>›</div>
            </button>
          )
        }) : (
          <div style={{ textAlign:'center', color:'#6b7280', fontSize:14, padding:'2rem 0' }}>
            No crew members found. Add them to the CREW table in Airtable.
          </div>
        )}
        <div style={{ height:'0.5px', background:'#1a1a2a', margin:'6px 0' }} />
        <button onClick={onBack} style={{ padding:'12px', background:'transparent', border:'none', cursor:'pointer', fontSize:13, color:'#6b7280', fontFamily:'inherit', textAlign:'center' }}>
          ← Back to member select
        </button>
      </div>
    </div>
  )
}

function CrewHome({ data, crew, resolve, resolveField, onShowClick, onBack }) {
  const f = crew.fields
  const name = f['Name'] || '—'
  const role = f['Role'] || '—'
  const today = new Date(new Date().toDateString())
  const initials = name.split(' ').map(x => x[0]).join('').toUpperCase().slice(0,2)

  const soundShows = (data['SHOWS'] || []).filter(s => {
    const sr = s.fields['Sound Engineer'] || []
    return (Array.isArray(sr) ? sr : [sr]).includes(crew.id) && new Date((s.fields['Date'] || '') + 'T00:00:00') >= today
  }).sort((a,b) => a.fields['Date'] > b.fields['Date'] ? 1 : -1)

  const merchShows = (data['SHOWS'] || []).filter(s => {
    const mr = s.fields['Merch Person'] || []
    return (Array.isArray(mr) ? mr : [mr]).includes(crew.id) && new Date((s.fields['Date'] || '') + 'T00:00:00') >= today
  }).sort((a,b) => a.fields['Date'] > b.fields['Date'] ? 1 : -1)

  const allShows = [...new Map([...soundShows, ...merchShows].map(s => [s.id, s])).values()]
    .sort((a,b) => a.fields['Date'] > b.fields['Date'] ? 1 : -1)

  const nextShow = allShows[0]

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', color:'#ffffff', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <Head>
        <title>EPL — {name}</title>
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="icon" href="/logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Echo Play Live" />
      </Head>
      <div style={{ background:'#111118', borderBottom:'0.5px solid #1e1e2e', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <img src="/logo.png" alt="EPL" onClick={onBack} style={{ width:32, height:32, objectFit:'contain', mixBlendMode:'screen', cursor:'pointer' }} />
          <span style={{ fontSize:14, fontWeight:600 }}>Echo Play Live</span>
        </div>
        <button onClick={onBack} style={{ fontSize:12, color:'#6b7280', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>Switch ›</button>
      </div>

      <div style={{ padding:'20px 20px 60px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24 }}>
          <div style={{ width:52, height:52, borderRadius:'50%', background:'#1a2a2e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, fontWeight:700, color:'#7ecbcb' }}>{initials}</div>
          <div>
            <div style={{ fontSize:20, fontWeight:700 }}>{name}</div>
            <div style={{ fontSize:13, color:'#7ecbcb', marginTop:2 }}>{role}</div>
          </div>
        </div>

        {nextShow && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Next assignment</div>
            <CrewShowCard show={nextShow} crew={crew} resolve={resolve} resolveField={resolveField} soundShows={soundShows} merchShows={merchShows} onClick={() => onShowClick(nextShow)} />
          </div>
        )}

        {!nextShow && (
          <div style={{ padding:20, background:'#111118', border:'0.5px solid #2a2a3a', borderRadius:16, textAlign:'center', color:'#6b7280', fontSize:14, marginBottom:20 }}>
            No upcoming assignments yet.
          </div>
        )}

        {allShows.length > 1 && (
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>All upcoming ({allShows.length})</div>
            {allShows.map(s => {
              const sf = s.fields
              const venueRecs = resolve(sf['Venue'], 'VENUES')
              const vf = venueRecs[0] ? venueRecs[0].fields : {}
              const bands = resolveField(sf['Band'], 'BANDS', 'Band Name')
              const days = daysUntil(sf['Date'])
              const isSound = soundShows.find(x => x.id === s.id)
              const isMerch = merchShows.find(x => x.id === s.id)
              return (
                <div key={s.id} onClick={() => onShowClick(s)} style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 0', borderBottom:'0.5px solid #1a1a2a', cursor:'pointer' }}>
                  <div style={{ width:44, textAlign:'center', flexShrink:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#7ecbcb' }}>{days}</div>
                    <div style={{ fontSize:10, color:'#6b7280' }}>days</div>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{vf['Venue Name'] || '—'}</div>
                    <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>{fmt(sf['Date'])}</div>
                    <div style={{ display:'flex', gap:4 }}>
                      {bands.map((b,i) => <BandTag key={i} name={b} />)}
                      {isSound && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:20, background:'#1a2a2e', color:'#7ecbcb', fontWeight:600 }}>Sound</span>}
                      {isMerch && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:20, background:'#1a1a2e', color:'#a78bfa', fontWeight:600 }}>Merch</span>}
                    </div>
                  </div>
                  <div style={{ color:'#2a2a3a', fontSize:18 }}>›</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function CrewShowCard({ show, crew, resolve, resolveField, soundShows, merchShows, onClick }) {
  const f = show.fields
  const days = daysUntil(f['Date'])
  const bands = resolveField(f['Band'], 'BANDS', 'Band Name')
  const venueRecs = resolve(f['Venue'], 'VENUES')
  const vf = venueRecs[0] ? venueRecs[0].fields : {}
  const address = f['Venue Address'] || vf['Address'] || ''
  const isSound = soundShows.find(x => x.id === show.id)
  const isMerch = merchShows.find(x => x.id === show.id)

  return (
    <div onClick={onClick} style={{ background:'#111118', border:'0.5px solid #1a2a2e', borderRadius:16, padding:20, cursor:'pointer' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>{vf['Venue Name'] || '—'}</div>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {bands.map((b,i) => <BandTag key={i} name={b} />)}
            {isSound && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:'#1a2a2e', color:'#7ecbcb', fontWeight:600 }}>Your role: Sound</span>}
            {isMerch && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:'#1a1a2e', color:'#a78bfa', fontWeight:600 }}>Your role: Merch</span>}
          </div>
        </div>
        <div style={{ background:'#1a2a2e', borderRadius:10, padding:'6px 14px', textAlign:'center', flexShrink:0, marginLeft:12 }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#7ecbcb' }}>{days}</div>
          <div style={{ fontSize:10, color:'#6b7280' }}>days</div>
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
            <div style={{ fontSize:12, fontWeight:500, color:'#7ecbcb' }}>Get directions</div>
            <div style={{ fontSize:11, color:'#6b7280' }}>{address}</div>
          </div>
        </a>
      )}
      <div style={{ marginTop:12, fontSize:12, color:'#6b7280', display:'flex', justifyContent:'space-between' }}>
        <span>{fmt(f['Date'])}</span>
        <span style={{ color:'#7ecbcb' }}>View details →</span>
      </div>
    </div>
  )
}


function SetlistPage({ data, setlistData, onBack }) {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const [tuningPopup, setTuningPopup] = useState(null)
  const { setlist, songRecs, show } = setlistData || {}
  const sf = show?.fields || {}
  const bands = (sf['Band'] || []).map(id => (data['BANDS'] || []).find(b => b.id === id)?.fields['Band Name']).filter(Boolean)
  const bandColor = BAND_COLORS[bands[0]]?.color || '#a78bfa'
  const setName = setlist?.fields['Set Name'] || 'Setlist'
  const setLength = setlist?.fields['Set Length'] || null
  const notes = setlist?.fields['Notes'] || null

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', color:'#ffffff', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <Head><title>EPL — Setlist</title></Head>
      <div style={{ background:'#111118', borderBottom:'0.5px solid #1e1e2e', padding:'12px 20px', display:'flex', alignItems:'center', gap:14, position:'sticky', top:0, zIndex:50 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'#a78bfa', fontSize:22, cursor:'pointer', padding:0, lineHeight:1 }}>‹</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:600 }}>{setName}</div>
          <div style={{ fontSize:12, color:'#6b7280' }}>{bands.join(', ')}{setLength ? ` · ${setLength} min` : ''}</div>
        </div>
        <img src="/logo.png" alt="EPL" onClick={onBack} style={{ width:30, height:30, objectFit:'contain', mixBlendMode:'screen', cursor:'pointer', opacity:0.7 }} />
      </div>

      <div style={{ padding:'16px 20px 80px' }}>
        {notes && (
          <div style={{ background:'#111118', border:'0.5px solid #2a2a3a', borderRadius:12, padding:'12px 16px', marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Set notes</div>
            <div style={{ fontSize:13, color:'#9ca3af', lineHeight:1.6 }}>{notes}</div>
          </div>
        )}

        <div style={{ background:'#111118', border:'0.5px solid #2a2a3a', borderRadius:14, overflow:'hidden' }}>
          {(songRecs || []).map((song, i) => {
            const s = song.fields
            return (
              <div key={song.id} style={{ padding:'14px 16px', borderBottom: i < songRecs.length-1 ? '0.5px solid #1a1a2a' : 'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                  <div style={{ width:26, textAlign:'center', flexShrink:0, fontSize:13, fontWeight:700, color:'#3a3a5a' }}>{i+1}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:600, color:'#ffffff' }}>{s['Song Title'] || '—'}</div>
                    <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{s['Artist'] || ''}{s['Duration'] ? ` · ${s['Duration']}` : ''}</div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0, display:'flex', flexDirection:'column', gap:4 }}>
                    {(s['Guitar Tuning'] || s['Bass Tuning']) && (
                      <div onClick={e => { e.stopPropagation(); setTuningPopup({ title: s['Song Title'], guitar: s['Guitar Tuning'], bass: s['Bass Tuning'] }) }} style={{ textAlign:'center', cursor:'pointer', padding:'4px 8px', borderRadius:8, background:'rgba(167,139,250,0.08)' }}>
                        <div style={{ fontSize:9, color:'#3a3a5a', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:2 }}>Tuning</div>
                        <div style={{ fontSize:22, color:'#a78bfa', fontWeight:800, lineHeight:1 }}>{(s['Guitar Tuning'] || s['Bass Tuning']).split('.')[0]}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, paddingLeft:38, flexWrap:'wrap' }}>
                  <a href={`https://open.spotify.com/search/${encodeURIComponent((s['Song Title'] || '') + ' ' + (s['Artist'] || ''))}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', background:'#0d1f0d', border:'0.5px solid #1a3a1a', borderRadius:20, textDecoration:'none' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#1db954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                    <span style={{ fontSize:11, fontWeight:600, color:'#1db954' }}>Spotify</span>
                  </a>
                  <a href={`https://music.apple.com/search?term=${encodeURIComponent((s['Song Title'] || '') + ' ' + (s['Artist'] || ''))}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', background:'#1a0a1a', border:'0.5px solid #3a1a3a', borderRadius:20, textDecoration:'none' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24"><defs><linearGradient id="am" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fc3c44"/><stop offset="100%" stopColor="#fd8bab"/></linearGradient></defs><rect width="24" height="24" rx="6" fill="url(#am)"/><path d="M17 8.5v5.25a1.75 1.75 0 11-1.5-1.732V9.8l-5 1.1v4.35a1.75 1.75 0 11-1.5-1.732V9.5a.75.75 0 01.592-.733l6-1.333A.75.75 0 0117 8.5z" fill="white"/></svg>
                    <span style={{ fontSize:11, fontWeight:600, color:'#fc3c44' }}>Apple Music</span>
                  </a>
                  <a href={`https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(s['Song Title'] || '')}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', background:'#1a1000', border:'0.5px solid #3a2a00', borderRadius:20, textDecoration:'none' }}>
                    <img src="https://www.ultimate-guitar.com/favicon.ico" alt="UG" style={{ width:14, height:14, borderRadius:2 }} />
                    <span style={{ fontSize:11, fontWeight:600, color:'#f5a623' }}>Tabs</span>
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {tuningPopup && (
        <div onClick={() => setTuningPopup(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#111118', border:'0.5px solid #2a2a3a', borderRadius:20, padding:24, width:'100%', maxWidth:320 }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#ffffff', marginBottom:4 }}>{tuningPopup.title}</div>
            <div style={{ fontSize:12, color:'#6b7280', marginBottom:20 }}>Full tuning reference</div>
            {tuningPopup.guitar && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Guitar — Low to High</div>
                <div style={{ display:'flex', gap:6 }}>
                  {tuningPopup.guitar.split('.').map((note, i) => (
                    <div key={i} style={{ flex:1, background:'#1a1a2e', borderRadius:8, padding:'8px 4px', textAlign:'center' }}>
                      <div style={{ fontSize:10, color:'#6b7280', marginBottom:2 }}>{['E','A','D','G','B','e'][i] || ''}</div>
                      <div style={{ fontSize:16, fontWeight:700, color:'#a78bfa' }}>{note}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {tuningPopup.bass && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Bass — Low to High</div>
                <div style={{ display:'flex', gap:6 }}>
                  {tuningPopup.bass.split('.').map((note, i) => (
                    <div key={i} style={{ flex:1, background:'#1a1a2e', borderRadius:8, padding:'8px 4px', textAlign:'center' }}>
                      <div style={{ fontSize:10, color:'#6b7280', marginBottom:2 }}>{['E','A','D','G'][i] || ''}</div>
                      <div style={{ fontSize:16, fontWeight:700, color:'#f72585' }}>{note}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => setTuningPopup(null)} style={{ width:'100%', padding:'12px', background:'#1a1a2e', border:'none', borderRadius:12, color:'#a78bfa', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Close</button>
          </div>
        </div>
      )}
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
      <Head>
        <title>EPL — Book a Show</title>
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="icon" href="/logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Echo Play Live" />
      </Head>
      <div style={{ background:'#111118', borderBottom:'0.5px solid #1e1e2e', padding:'12px 20px', display:'flex', alignItems:'center', gap:14, position:'sticky', top:0, zIndex:50 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'#a78bfa', fontSize:22, cursor:'pointer', padding:0 }}>‹</button>
        <div style={{ fontSize:15, fontWeight:600 }}>Book a show</div>
      </div>
      <div style={{ padding:'20px', maxWidth:520, margin:'0 auto' }}>
        {done ? (
          <div style={{ textAlign:'center', padding:'4rem 0' }}>
            <img src="/logo.png" alt="EPL" style={{ width:100, height:100, objectFit:'contain', marginBottom:20, mixBlendMode:'screen' }} />
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
