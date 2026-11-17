// One show, read the way you'd use it on the day: when to be there, where,
// who's playing and crewing, the set, and the notes.
import { useEffect, useState } from 'react'
import { Navigation, Ticket, ListMusic, Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning, Thermometer, House, Trees, TentTree } from 'lucide-react'
import { useApp } from './context'
import { Panel, TopBar, BandTag, PersonAvatar, Chevron, Lightbox } from './ui'
import { setlistsForShow, ids, roleInBand } from '../lib/derive'
import { fmtTime, fmtFull, countdown, daysUntil, attachmentUrl, mapsHref, googleMapsHref, fmtSetLength, plural } from '../lib/format'

const WEATHER = [
  [[0, 1], Sun, 'Clear'], [[2], CloudSun, 'Partly cloudy'], [[3], Cloud, 'Overcast'],
  [[45, 48], CloudFog, 'Fog'], [[51, 53, 55], CloudDrizzle, 'Drizzle'],
  [[61, 63, 65, 80, 81, 82], CloudRain, 'Rain'], [[71, 73, 75], CloudSnow, 'Snow'],
  [[95, 96, 99], CloudLightning, 'Storms'],
]

// Forecast for the show's day from Open-Meteo, within its 16-day window.
function useForecast(show, venue) {
  const [wx, setWx] = useState(null)
  const ds = show.fields['Date']
  useEffect(() => {
    let cancelled = false
    async function run() {
      const away = daysUntil(ds)
      if (away == null || away < 0 || away > 15) return
      let lat = 32.7555, lon = -97.3308 // Fort Worth, when the venue can't be found
      const city = venue?.fields['City']
      if (city) {
        try {
          const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json&countryCode=US`).then(r => r.json())
          if (g.results?.[0]) { lat = g.results[0].latitude; lon = g.results[0].longitude }
        } catch {}
      }
      try {
        const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&temperature_unit=fahrenheit&timezone=America%2FChicago&start_date=${ds}&end_date=${ds}`).then(r => r.json())
        const d = w.daily
        if (cancelled || !d || d.temperature_2m_max?.[0] == null) return
        const entry = WEATHER.find(([codes]) => codes.includes(d.weathercode[0]))
        setWx({ hi: Math.round(d.temperature_2m_max[0]), lo: Math.round(d.temperature_2m_min[0]), rain: d.precipitation_probability_max[0] ?? 0, Icon: entry?.[1] || Thermometer, label: entry?.[2] || 'Forecast' })
      } catch {}
    }
    run()
    return () => { cancelled = true }
  }, [ds, venue?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return wx
}

// SHOWS "Indoor / Outdoor" is a single select: Indoor, Outdoor or Both.
const SETTING = {
  Indoor: { label: 'Indoor show', Icon: House, tone: '' },
  Outdoor: { label: 'Outdoor show', Icon: Trees, tone: 'pill-good' },
  Both: { label: 'Indoor & outdoor', Icon: TentTree, tone: 'pill-good' },
}

const isImage = (a) => !a.type || a.type.startsWith('image/')
const thumb = (a) => a.thumbnails?.large?.url || a.url

// What the band needs to know about the room to play it: photos (including
// the room layout), production details and the green room.
function VenuePanel({ venue, onPhoto }) {
  const vf = venue.fields
  const files = [
    ...(vf['Photo'] || []).map(a => ({ ...a, label: null })),
    ...(vf['Room Layout'] || []).map(a => ({ ...a, label: 'Room layout' })),
  ]
  const facts = [
    ['Venue type', vf['Venue Type']],
    ['Capacity', vf['Capacity'] ? Number(vf['Capacity']).toLocaleString() : null],
    ['Ages', vf['Age Restriction']],
    ['Green room', vf['Green Room'] ? 'Yes' : null],
    ['House console', vf['House Console']],
    ['FOH', vf['FOH Location']],
    ['Power', vf['Power Drops']],
  ].filter(([, v]) => v)
  const notes = [
    ['Stage', vf['Stage Specs']],
    ['PA system', vf['PA System']],
    ['Mic locker', vf['Mic Locker']],
    ['Sound notes', vf['Sound Notes']],
  ].filter(([, v]) => v)
  if (!files.length && !facts.length && !notes.length) return null
  return (
    <Panel title={vf['Venue Name'] ? `About ${vf['Venue Name']}` : 'Venue'}>
      {files.length > 0 && (
        <div className="gallery" role="list">
          {files.map((a, i) => isImage(a) ? (
            <button key={a.id || i} className="gallery-item" role="listitem" onClick={() => onPhoto(a)} aria-label={a.label || `Venue photo ${i + 1}`}>
              <img src={thumb(a)} alt="" loading="lazy" />
              {a.label && <span className="gallery-tag">{a.label}</span>}
            </button>
          ) : (
            <a key={a.id || i} className="gallery-item gallery-file" role="listitem" href={a.url} target="_blank" rel="noopener noreferrer">
              <span>{a.label || a.filename || 'File'}</span>
            </a>
          ))}
        </div>
      )}
      {facts.length > 0 && (
        <dl className="rows" style={files.length ? { borderTop: '1px solid var(--separator)' } : undefined}>
          {facts.map(([label, value]) => <div className="kv" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      )}
      {notes.length > 0 && (
        <div className="rows" style={{ borderTop: '1px solid var(--separator)' }}>
          {notes.map(([label, text]) => <p className="note" key={label}><span className="note-label">{label}</span>{text}</p>)}
        </div>
      )}
    </Panel>
  )
}

export default function ShowScreen({ showId, onBack }) {
  const { idx, openPerson, openSetlist } = useApp()
  const show = idx.get('SHOWS', showId)
  const venue = show ? idx.all('VENUES', show.fields['Venue'])[0] : null
  const wx = useForecast(show || { fields: {} }, venue)
  const [photo, setPhoto] = useState(null)
  useEffect(() => { window.scrollTo(0, 0) }, [showId])
  if (!show) return (<><TopBar title="Show" onBack={onBack} /><main className="content"><p className="empty">This show isn't available any more.</p></main></>)

  const f = show.fields
  const band = idx.all('BANDS', f['Band'])[0]
  const bandName = band?.fields['Band Name'] || f['Show Name'] || 'Show'
  const logo = attachmentUrl(band?.fields, 'Logo/Photo')
  const vf = venue?.fields || {}
  const address = vf['Address']
  const past = daysUntil(f['Date']) < 0

  const times = [
    ['Trailer load-in', f['Trailer Load-In Time']],
    ['Load in', f['Load-In Time']],
    ['Soundcheck', f['Sound Check Time']],
    ['Doors', f['Doors Time']],
    ['Set', f['Start Time'], true],
    ['End', f['End Time']],
  ].filter(([, t]) => t)

  const members = idx.all('MEMBERS', f['Members Playing'])
  const crewRows = [
    ['Sound', f['Sound Engineer'], f['Sound Provider']],
    ['Merch', f['Merch Person'], null],
  ].flatMap(([job, link, provider]) => {
    const people = [...idx.all('CREW', link).map(r => [r, 'crew']), ...idx.all('MEMBERS', link).map(r => [r, 'member'])]
    if (people.length) return people.map(([r, type]) => ({ job, record: r, type }))
    return provider ? [{ job, provider }] : []
  })
  const sets = setlistsForShow(show, idx)
  const notes = [['Show notes', f['Show Notes']], ['Production notes', f['Production Notes']], ['Sound notes', f['Sound Notes']], ['Merch notes', f['Merch Notes']]].filter(([, v]) => v)
  const setting = SETTING[f['Indoor / Outdoor']]
  const hero = (vf['Photo'] || []).find(isImage)

  return (
    <>
      <TopBar title={bandName} onBack={onBack} />
      <main className="content rise">
        {hero && (
          <button className="hero-photo" onClick={() => setPhoto(hero)} aria-label={`Photo of ${vf['Venue Name'] || 'the venue'}`}>
            <img src={thumb(hero)} alt="" />
          </button>
        )}
        <header className="show-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            {logo && <img className="band-logo" src={logo} alt="" />}
            <div style={{ minWidth: 0 }}>
              <p className="eyebrow">{fmtFull(f['Date'])}</p>
              <h1>{bandName}</h1>
            </div>
          </div>
          {vf['Venue Name'] && <p className="show-sub">{[vf['Venue Name'], vf['City']].filter(Boolean).join(' · ')}</p>}
          <div className="show-badges">
            <span className={`pill ${past ? '' : 'pill-accent'}`}>{past ? 'Played' : countdown(f['Date'])}</span>
            {setting && <span className={`pill ${setting.tone}`}><setting.Icon aria-hidden="true" />{setting.label}</span>}
            {wx && <span className={`pill ${wx.rain > 50 ? 'pill-warn' : ''}`}><wx.Icon aria-hidden="true" />{wx.hi}°/{wx.lo}° · {wx.rain}% rain</span>}
          </div>
        </header>

        <Panel title="Call times">
          {times.length ? (
            <dl className="rows">
              {times.map(([label, t, strong]) => (
                <div className="kv" key={label}><dt>{label}</dt><dd className={strong ? 'kv-strong' : ''}>{fmtTime(t)}</dd></div>
              ))}
            </dl>
          ) : <p className="empty">Times aren't set yet.</p>}
          {address && (
            <div className="panel-body" style={{ borderTop: '1px solid var(--separator)', paddingTop: '0.9rem' }}>
              <p className="row-sub" style={{ marginTop: 0, marginBottom: '0.7rem' }}>{address}</p>
              <div className="button-row">
                <a className="button button-filled" href={mapsHref(address)} target="_blank" rel="noopener noreferrer"><Navigation aria-hidden="true" />Directions</a>
                <a className="button button-tinted" href={googleMapsHref(address)} target="_blank" rel="noopener noreferrer">Google Maps</a>
              </div>
              {vf['Parking Notes'] && <p className="row-sub" style={{ marginTop: '0.7rem' }}>Parking: {vf['Parking Notes']}</p>}
            </div>
          )}
        </Panel>

        <Panel title="Who's playing" count={members.length}>
          {members.length ? (
            <ul className="rows">
              {members.map(m => (
                <li key={m.id}>
                  <button className="row" onClick={() => openPerson(m, 'member')}>
                    <PersonAvatar record={m} type="member" size={38} />
                    <span><span className="row-title">{m.fields['Member Name']}</span><span className="row-sub">{roleInBand(m, band?.fields['Band Name'])}</span></span>
                    <Chevron />
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="empty">The lineup isn't set yet.</p>}
        </Panel>

        {crewRows.length > 0 && (
          <Panel title="Crew">
            <ul className="rows">
              {crewRows.map((c, i) => c.record ? (
                <li key={i}>
                  <button className="row" onClick={() => openPerson(c.record, c.type)}>
                    <PersonAvatar record={c.record} type={c.type} size={38} />
                    <span><span className="row-title">{c.type === 'crew' ? c.record.fields['Name'] : c.record.fields['Member Name']}</span><span className="row-sub">{c.job}</span></span>
                    <Chevron />
                  </button>
                </li>
              ) : (
                <li key={i}><div className="row row-plain"><span><span className="row-title">{c.provider}</span><span className="row-sub">{c.job}</span></span></div></li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel title="Set">
          {sets.length ? (
            <ul className="rows">
              {sets.map(sl => (
                <li key={sl.id}>
                  <button className="row" onClick={() => openSetlist(sl.id)}>
                    <span className="row-icon"><ListMusic aria-hidden="true" /></span>
                    <span><span className="row-title">{sl.fields['Set Name'] || 'Setlist'}</span><span className="row-sub">{[plural(ids(sl.fields['Songs']).length, 'song'), fmtSetLength(sl.fields['Duration'])].filter(Boolean).join(' · ')}</span></span>
                    <Chevron />
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="empty">No setlist yet. Check back closer to the show.</p>}
        </Panel>

        {venue && <VenuePanel venue={venue} onPhoto={setPhoto} />}

        {(f['Ticket URL'] || f['Ticket Price']) && (
          <Panel title="Tickets">
            {f['Ticket URL'] ? (
              <a className="row" href={f['Ticket URL']} target="_blank" rel="noopener noreferrer">
                <span className="row-icon"><Ticket aria-hidden="true" /></span>
                <span><span className="row-title">Get tickets</span>{f['Ticket Price'] != null && <span className="row-sub">${f['Ticket Price']}</span>}</span>
                <Chevron />
              </a>
            ) : <p className="empty">${f['Ticket Price']}</p>}
          </Panel>
        )}

        {notes.length > 0 && (
          <Panel title="Notes">
            <div className="rows">
              {notes.map(([label, text]) => <p className="note" key={label}><span className="note-label">{label}</span>{text}</p>)}
            </div>
          </Panel>
        )}

        {band && <div className="tags" style={{ justifyContent: 'center' }}><BandTag name={band.fields['Band Name']} /></div>}
      </main>
      {photo && <Lightbox src={photo.url} alt={vf['Venue Name'] || 'Venue'} onClose={() => setPhoto(null)} />}
    </>
  )
}
