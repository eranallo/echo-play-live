// The member app: loads the signed-in person's data, then runs the four tabs
// (Home, Calendar, People, Setlists) with show and setlist pages pushed on top.
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Head from 'next/head'
import { House, CalendarDays, UsersRound, ListMusic, Camera, Sun, Moon } from 'lucide-react'
import { AppContext, useApp } from './context'
import { Seal, Sheet, PersonCard, PersonAvatar, BandRoles, Toast } from './ui'
import HomeScreen from './HomeScreen'
import CalendarScreen from './CalendarScreen'
import PeopleScreen from './PeopleScreen'
import SetlistsScreen, { SetlistScreen } from './SetlistsScreen'
import ShowScreen from './ShowScreen'
import { indexData, memberBands } from '../lib/derive'

const TABS = [
  ['home', 'Home', House],
  ['calendar', 'Calendar', CalendarDays],
  ['people', 'People', UsersRound],
  ['setlists', 'Setlists', ListMusic],
]

const PAGE_COLOR = { light: '#f5f0e8', dark: '#11191d' }

// Shrink a phone photo before upload: 800px on the long side, JPEG.
async function compressImage(file, maxDim = 800, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width >= height) { height = Math.round(height * maxDim / width); width = maxDim }
        else { width = Math.round(width * maxDim / height); height = maxDim }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(b => resolve(b || file), 'image/jpeg', quality)
    }
    img.onerror = () => reject(new Error('Could not read that photo'))
    img.src = URL.createObjectURL(file)
  })
}

function ProfileSheet({ onClose, theme, setTheme }) {
  const { me, record, idx, api, reload, toast } = useApp()
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const f = record.fields
  const isMember = me.type === 'member'
  const name = isMember ? f['Member Name'] : f['Name']
  const what = isMember ? (f['Instruments'] || []).join(', ') : (f['Role'] || 'Crew')
  const bands = isMember ? memberBands(record, idx) : []
  const standalone = typeof window !== 'undefined' && (window.navigator.standalone || window.matchMedia?.('(display-mode: standalone)').matches)

  async function upload(file) {
    if (!file) return
    setBusy(true); setError(null)
    try {
      const blob = await compressImage(file)
      const base64 = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result)
        r.onerror = () => reject(new Error('Could not read that photo'))
        r.readAsDataURL(blob)
      })
      const res = await api('/api/upload-photo', { method: 'POST', body: JSON.stringify({ base64 }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || 'Upload failed')
      await reload()
      toast('Photo updated')
    } catch (e) { setError(e.message) }
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Sheet onClose={onClose} label="Your profile">
      <div className="sheet-section center" style={{ marginTop: 0 }}>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => upload(e.target.files?.[0])} />
        <button className="avatar-edit" onClick={() => !busy && fileRef.current?.click()} aria-label="Change your photo">
          <PersonAvatar record={record} type={me.type} size={96} />
          <span className="avatar-badge">{busy ? <span className="spinner" style={{ width: '0.9rem', height: '0.9rem' }} /> : <Camera aria-hidden="true" />}</span>
        </button>
        <h2>{name}</h2>
        {(!isMember || !bands.length) && what && <p className="row-sub" style={{ marginTop: 0 }}>{what}</p>}
        {error && <p className="form-error">{error}</p>}
      </div>
      {bands.length > 0 && (
        <div className="sheet-section">
          <div className="person-card"><BandRoles bands={bands} /></div>
        </div>
      )}
      <div className="sheet-section">
        <span className="label">Appearance</span>
        <div className="seg" role="group" aria-label="Appearance">
          <button aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Sun size={15} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 6 }} />Light</button>
          <button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Moon size={15} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 6 }} />Dark</button>
        </div>
      </div>
      {!standalone && (
        <div className="sheet-section">
          <p className="row-sub">Keep this one tap away: in Safari, tap Share, then <strong>Add to Home Screen</strong>.</p>
        </div>
      )}
      <div className="sheet-section">
        <p className="row-sub">This app opens from your personal link. Please don't share it; anyone with it sees what you see.</p>
        <button className="button button-tinted button-block" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  )
}

function CenteredMessage({ title, children }) {
  return (
    <main className="center-screen">
      <Head><title>Echo Play Live</title></Head>
      <Seal />
      {title && <h1>{title}</h1>}
      <p>{children}</p>
    </main>
  )
}

export default function EplApp({ token }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [linkProblem, setLinkProblem] = useState(false)
  const [partialErrors, setPartialErrors] = useState(null)
  const [tab, setTabState] = useState('home')
  const [stack, setStack] = useState([]) // [{ type: 'show' | 'setlist', id }]
  const [person, setPerson] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState(null)
  const [theme, setThemeState] = useState('light')

  // Every API call carries the personal-link token.
  const api = useCallback((path, init = {}) => fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}), 'x-epl-token': token },
  }), [token])

  const loadData = useCallback(async () => {
    try {
      const res = await api('/api/me')
      if (res.status === 401) { setLinkProblem(true); return }
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Could not load your schedule')
      // Per-table failures become a banner; the rest of the app still loads.
      if (json.errors) { setPartialErrors(json.errors); delete json.errors } else setPartialErrors(null)
      setData(json)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => { loadData() }, [loadData])

  // The theme was applied before first paint by pages/_document.js.
  useEffect(() => { setThemeState(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light') }, [])
  const setTheme = useCallback((t) => {
    setThemeState(t)
    document.documentElement.setAttribute('data-theme', t)
    try { localStorage.setItem('epl-theme', t) } catch {}
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', PAGE_COLOR[t])
  }, [])

  const toastTimer = useRef(null)
  const toast = useCallback((msg) => {
    setToastMsg(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), 2400)
  }, [])

  // Pull to refresh
  useEffect(() => {
    let startY = 0, pulling = false, indicator = null, refreshing = false
    function getIndicator() {
      if (!indicator) {
        indicator = document.createElement('div')
        indicator.className = 'ptr-indicator'
        indicator.innerHTML = '<div class="spinner"></div><span>Pull to refresh</span>'
        document.body.appendChild(indicator)
      }
      return indicator
    }
    function onTouchStart(e) {
      startY = e.touches[0].clientY
      pulling = window.scrollY === 0 && !refreshing && !document.querySelector('.sheet-backdrop')
    }
    function onTouchMove(e) {
      if (!pulling) return
      const dist = e.touches[0].clientY - startY
      if (dist > 50) {
        const ind = getIndicator()
        ind.classList.add('visible')
        ind.querySelector('span').textContent = dist > 80 ? 'Release to refresh' : 'Pull to refresh'
      } else if (indicator) indicator.classList.remove('visible')
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
      if (indicator?.parentNode) indicator.parentNode.removeChild(indicator)
    }
  }, [loadData])

  const idx = useMemo(() => (data ? indexData(data) : null), [data])
  const me = data?.me
  const record = me && idx ? idx.get(me.type === 'member' ? 'MEMBERS' : 'CREW', me.id) : null

  const setTab = useCallback((t) => { setTabState(t); setStack([]); window.scrollTo(0, 0) }, [])
  const push = useCallback((entry) => { setStack(s => [...s, entry]); window.scrollTo(0, 0) }, [])
  const pop = useCallback(() => { setStack(s => s.slice(0, -1)); window.scrollTo(0, 0) }, [])

  const ctx = useMemo(() => ({
    data, idx, me, record, api, toast, setTab,
    reload: loadData,
    openShow: (id) => push({ type: 'show', id }),
    openSetlist: (id) => push({ type: 'setlist', id }),
    openPerson: (rec, type) => setPerson({ record: rec, type }),
    openProfile: () => setProfileOpen(true),
  }), [data, idx, me, record, api, toast, setTab, loadData, push])

  if (linkProblem) return (
    <CenteredMessage title="This link isn't working">
      Your personal link may have been reset. Ask Evan for your current Echo Play Live link.
    </CenteredMessage>
  )
  if (loading) return (
    <main className="center-screen" aria-busy="true">
      <Head><title>Echo Play Live</title></Head>
      <Seal />
      <span className="spinner" aria-label="Loading" />
    </main>
  )
  if (error || !data) return (
    <main className="center-screen">
      <Head><title>Echo Play Live</title></Head>
      <Seal />
      <h1>Couldn't load your schedule</h1>
      <p>{error || 'Nothing came back.'} Check your signal and try again.</p>
      <button className="button button-filled" onClick={() => { setError(null); setLoading(true); loadData() }}>Try again</button>
    </main>
  )
  if (!record) return (
    <CenteredMessage title="Couldn't load your profile">
      Your link works, but your record didn't come back from Airtable. Pull down to try again, or let Evan know.
    </CenteredMessage>
  )

  const top = stack[stack.length - 1]
  let screen
  if (top?.type === 'show') screen = <ShowScreen key={'s' + top.id + stack.length} showId={top.id} onBack={pop} />
  else if (top?.type === 'setlist') screen = <SetlistScreen key={'l' + top.id + stack.length} setlistId={top.id} onBack={pop} />
  else if (tab === 'calendar') screen = <CalendarScreen />
  else if (tab === 'people') screen = <PeopleScreen />
  else if (tab === 'setlists') screen = <SetlistsScreen />
  else screen = <HomeScreen />

  const name = me.type === 'member' ? record.fields['Member Name'] : record.fields['Name']

  return (
    <AppContext.Provider value={ctx}>
      <Head><title>{`Echo Play Live — ${name}`}</title></Head>
      {partialErrors && (
        <div className="banner" role="status">
          <span>Couldn't load: <strong>{Object.keys(partialErrors).join(', ')}</strong>. Some screens may look empty.</span>
          <button className="text-link" onClick={() => setPartialErrors(null)}>Dismiss</button>
        </div>
      )}
      <div className="app">{screen}</div>
      <nav className="dock" aria-label="Tabs">
        <div className="dock-inner">
          {TABS.map(([key, label, Icon]) => (
            <button
              key={key}
              className="dock-item"
              aria-current={tab === key ? 'page' : undefined}
              onClick={() => (tab === key && stack.length ? setStack([]) : setTab(key))}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>
      {person && <PersonCard profile={person} onClose={() => setPerson(null)} />}
      {profileOpen && <ProfileSheet onClose={() => setProfileOpen(false)} theme={theme} setTheme={setTheme} />}
      <Toast message={toastMsg} />
    </AppContext.Provider>
  )
}
