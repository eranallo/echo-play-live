// Shared building blocks, in StageKin's shapes with EPL's brand.
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, MapPin, Phone, MessageSquare, X, CalendarDays, CalendarPlus, Link as LinkIcon } from 'lucide-react'
import { useApp } from './context'
import { initials, fmtTime, fmtDate, daysUntil, attachmentUrl, memberPhoto, telHref, smsHref, parseDate } from '../lib/format'
import { memberBands, nextShowFor } from '../lib/derive'

// Each band's colour, as [light theme, dark theme] shades that both read on
// their card. Bands not listed fall back to the amber accent.
const BAND_PALETTE = {
  'So Long Goodnight': ['#c2185b', '#ff5fa2'],
  'The Dick Beldings': ['#00708f', '#4fd8ff'],
  'Jambi': ['#11191d', '#f5f0e8'],
  'Elite': ['#1b7a43', '#5fe08f'],
}

const bandStyle = (name) => {
  const c = BAND_PALETTE[name]
  return c ? { '--band-l': c[0], '--band-d': c[1] } : undefined
}

// Your shows and practices in your phone's calendar: one tap subscribes,
// and the calendar app re-reads the feed on its own (/api/calendar).
export function CalendarSubscribe() {
  const { token, toast } = useApp()
  const [host, setHost] = useState(null)
  useEffect(() => { setHost(window.location.host) }, [])
  if (!token || !host) return null
  const path = `/api/calendar/${token}.ics`
  const webcal = `webcal://${host}${path}`
  const copy = async () => {
    try { await navigator.clipboard.writeText(`https://${host}${path}`); toast('Calendar link copied') } catch { toast("Couldn't copy the link") }
  }
  return (
    <div className="calendar-subscribe">
      <p className="row-sub">Your shows and practices in your phone's calendar, with call times and the address. It keeps itself up to date.</p>
      <div className="button-row">
        <a className="button button-filled" href={webcal} aria-label="Add to Apple Calendar"><CalendarPlus aria-hidden="true" />Apple</a>
        <a className="button button-tinted" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer" aria-label="Add to Google Calendar"><CalendarPlus aria-hidden="true" />Google</a>
      </div>
      <button className="text-link" onClick={copy}><LinkIcon size={15} aria-hidden="true" />Copy link for another calendar</button>
      <p className="row-sub fine-print">Like your app link, this calendar link is just for you. Google can take a few hours to pick up changes.</p>
    </div>
  )
}

// A band named with its colour as a dot, rather than a filled chip.
export function BandTag({ name }) {
  return <span className="band-tag" style={bandStyle(name)}><BandDot name={name} />{name}</span>
}

export function BandDot({ name }) {
  return <span className="band-dot" style={bandStyle(name)} aria-hidden="true" />
}

// A member's bands as lines: dot, band, and what they play in it.
export function BandRoles({ bands }) {
  if (!bands.length) return null
  return (
    <ul className="band-roles">
      {bands.map(b => (
        <li key={b.name}><BandDot name={b.name} /><span className="band-roles-name">{b.name}</span>{b.role && <span className="band-roles-role">{b.role}</span>}</li>
      ))}
    </ul>
  )
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

// A centred dialog: for quick looks like a person's card or a photo.
export function Modal({ onClose, label, className = '', children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={label} onClick={e => e.stopPropagation()}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Close"><X /></button>
        {children}
      </div>
    </div>
  )
}

export function Lightbox({ src, alt, onClose }) {
  return (
    <div className="modal-backdrop lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label={alt}>
      <img src={src} alt={alt} />
    </div>
  )
}

// A bandmate's or crew person's card: who they are, what they play in which
// band, their next show, and a quick call or text.
export function PersonCard({ profile, onClose }) {
  const { data, idx, openShow } = useApp()
  const { record, type } = profile
  const f = record.fields || {}
  const isMember = type === 'member'
  const name = (isMember ? f['Member Name'] : f['Name']) || '—'
  const bands = isMember ? memberBands(record, idx) : []
  const next = nextShowFor(data, record, type)
  const nextBand = next ? idx.all('BANDS', next.fields['Band'])[0] : null
  const phone = f['Phone']
  return (
    <Modal onClose={onClose} label={name} className="person-card">
      <div className="person-head">
        <PersonAvatar record={record} type={type} size={84} />
        <h2>{name}</h2>
        {!isMember && <p className="row-sub">{f['Role'] || 'Crew'}</p>}
        {isMember && !bands.length && (f['Instruments'] || []).length > 0 && <p className="row-sub">{f['Instruments'].join(', ')}</p>}
      </div>
      <BandRoles bands={bands} />
      {next && (
        <button className="row person-next" onClick={() => { onClose(); openShow(next.id) }}>
          <span className="row-icon"><CalendarDays aria-hidden="true" /></span>
          <span>
            <span className="row-sub" style={{ marginTop: 0 }}>Next show</span>
            <span className="row-title">{fmtDate(next.fields['Date'])} · {nextBand?.fields['Band Name'] || next.fields['Show Name']}</span>
          </span>
          <ChevronRight className="chev" aria-hidden="true" />
        </button>
      )}
      {phone ? (
        <>
          <div className="button-row" style={{ marginTop: '1rem' }}>
            <a className="button button-filled" href={telHref(phone)}><Phone aria-hidden="true" />Call</a>
            <a className="button button-tinted" href={smsHref(phone)}><MessageSquare aria-hidden="true" />Text</a>
          </div>
          <p className="row-sub num" style={{ textAlign: 'center', marginTop: '0.6rem' }}>{phone}</p>
        </>
      ) : <p className="row-sub" style={{ textAlign: 'center', marginTop: '1rem' }}>No phone number on file.</p>}
    </Modal>
  )
}

export function Chevron() {
  return <ChevronRight className="chev" aria-hidden="true" />
}

export function Toast({ message }) {
  if (!message) return null
  return <div className="toast" role="status">{message}</div>
}
