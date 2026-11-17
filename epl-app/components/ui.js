// Shared building blocks, in StageKin's shapes with EPL's brand.
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, MapPin, Phone, MessageSquare } from 'lucide-react'
import { useApp } from './context'
import { initials, fmtTime, daysUntil, attachmentUrl, memberPhoto, telHref, smsHref, parseDate } from '../lib/format'

// Each band's colour, as [light theme, dark theme] shades that both read on
// their card. Bands not listed fall back to the amber accent.
const BAND_PALETTE = {
  'So Long Goodnight': ['#c2185b', '#ff5fa2'],
  'The Dick Beldings': ['#00708f', '#4fd8ff'],
  'Jambi': ['#11191d', '#f5f0e8'],
  'Elite': ['#1b7a43', '#5fe08f'],
}

export function BandTag({ name }) {
  const c = BAND_PALETTE[name]
  return <span className="band-tag" style={c ? { '--band-l': c[0], '--band-d': c[1] } : undefined}>{name}</span>
}

// The EPL seal, black on light and white on dark.
export function Seal({ className = 'seal' }) {
  return (
    <>
      <img className={`${className} seal-light`} src="/brand/epl-seal-black.svg" alt="Echo Play Live" />
      <img className={`${className} seal-dark`} src="/brand/epl-seal-white.svg" alt="" aria-hidden="true" />
    </>
  )
}

export function Avatar({ name, src, size = 40 }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  )
}

// A person's avatar from their record, whichever table it came from.
export function PersonAvatar({ record, type, size = 40 }) {
  const f = record?.fields || {}
  const name = type === 'crew' ? f['Name'] : f['Member Name']
  const src = type === 'crew' ? attachmentUrl(f, 'Photo') : memberPhoto(f)
  return <Avatar name={name} src={src} size={size} />
}

export function Panel({ title, count, countTone, action, className = '', children }) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-head">
          <h2 className="panel-title">
            {title}
            {count != null && count > 0 && <span className={`count num ${countTone === 'warn' ? 'count-warn' : ''}`}>{count}</span>}
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function PageHead({ eyebrow, title, sub }) {
  return (
    <header className="page-head">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {sub && <p>{sub}</p>}
    </header>
  )
}

// The bar at the top of every screen. Tab roots show the seal and the
// person's avatar; detail screens show a back button and their title.
export function TopBar({ title, onBack }) {
  const { record, me, openProfile } = useApp()
  if (onBack) {
    return (
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Back"><ChevronLeft /></button>
        <div className="topbar-title">{title}</div>
        <span />
      </div>
    )
  }
  return (
    <div className="topbar">
      <Seal />
      <div className="topbar-title" aria-hidden="true" />
      <button className="icon-btn" onClick={openProfile} aria-label="Your profile and settings">
        <PersonAvatar record={record} type={me.type} size={34} />
      </button>
    </div>
  )
}

export function DateTile({ ds }) {
  const d = parseDate(ds)
  return (
    <span className="date-tile" aria-hidden="true">
      <span>{d.toLocaleDateString('en-US', { month: 'short' })}</span>
      <strong className="num">{d.getDate()}</strong>
    </span>
  )
}

// One show as a list row: date tile, band and venue, set time.
export function ShowRow({ show, sub }) {
  const { idx, openShow } = useApp()
  const f = show.fields
  const band = idx.all('BANDS', f['Band'])[0]
  const venue = idx.all('VENUES', f['Venue'])[0]
  const past = daysUntil(f['Date']) < 0
  const where = [venue?.fields['Venue Name'], venue?.fields['City']].filter(Boolean).join(' · ')
  return (
    <button className="agenda-row" onClick={() => openShow(show.id)}>
      <DateTile ds={f['Date']} />
      <span className="agenda-copy">
        <strong>{band?.fields['Band Name'] || f['Show Name'] || 'Show'}</strong>
        {where && <span className="agenda-meta"><MapPin aria-hidden="true" />{where}</span>}
        {sub && <span className="agenda-meta">{sub}</span>}
      </span>
      <span className="agenda-end">
        {f['Start Time'] && <span className="row-end num">{fmtTime(f['Start Time'])}</span>}
        {past && <span className="state" data-state="past">Played</span>}
      </span>
    </button>
  )
}

// A list of shows that shows the first few and folds the rest.
export function ShowList({ shows, open = 3, noun = 'show', subFor, emptyText }) {
  const [expanded, setExpanded] = useState(false)
  if (!shows.length) return <p className="empty">{emptyText || `No ${noun}s yet.`}</p>
  const visible = expanded ? shows : shows.slice(0, open)
  const rest = shows.length - visible.length
  return (
    <>
      <ul className="agenda">
        {visible.map(s => <li key={s.id}><ShowRow show={s} sub={subFor?.(s)} /></li>)}
      </ul>
      {rest > 0 && <button className="fold" onClick={() => setExpanded(true)}>Show {rest} more {rest === 1 ? noun : noun + 's'}</button>}
    </>
  )
}

export function Sheet({ onClose, label, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={e => e.stopPropagation()}>
        <div className="grabber" aria-hidden="true" />
        {children}
      </div>
    </div>
  )
}

// A bandmate's or crew person's card: photo, what they do, bands, phone.
export function PersonCard({ profile, onClose }) {
  const { idx } = useApp()
  const { record, type } = profile
  const f = record.fields || {}
  const isMember = type === 'member'
  const name = (isMember ? f['Member Name'] : f['Name']) || '—'
  const what = isMember ? (f['Instruments'] || []).join(', ') : (f['Role'] || 'Crew')
  const bands = isMember ? idx.all('BANDS', f['Primary Bands']).map(b => b.fields['Band Name']) : []
  const phone = f['Phone']
  return (
    <Sheet onClose={onClose} label={name}>
      <div className="sheet-section center" style={{ marginTop: 0 }}>
        <PersonAvatar record={record} type={type} size={92} />
        <h2>{name}</h2>
        {what && <p className="row-sub" style={{ marginTop: 0 }}>{what}</p>}
        {bands.length > 0 && <div className="tags" style={{ justifyContent: 'center' }}>{bands.map(b => <BandTag key={b} name={b} />)}</div>}
      </div>
      <div className="sheet-section">
        {phone ? (
          <>
            <div className="button-row">
              <a className="button button-filled" href={telHref(phone)}><Phone aria-hidden="true" />Call</a>
              <a className="button button-tinted" href={smsHref(phone)}><MessageSquare aria-hidden="true" />Text</a>
            </div>
            <p className="row-sub num" style={{ textAlign: 'center' }}>{phone}</p>
          </>
        ) : <p className="row-sub" style={{ textAlign: 'center' }}>No phone number on file.</p>}
        <button className="button button-tinted button-block" onClick={onClose}>Close</button>
      </div>
    </Sheet>
  )
}

export function Chevron() {
  return <ChevronRight className="chev" aria-hidden="true" />
}

export function Toast({ message }) {
  if (!message) return null
  return <div className="toast" role="status">{message}</div>
}
