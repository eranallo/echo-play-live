// People: everyone in EPL, with a tap to their card (call or text).
import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useApp } from './context'
import { Panel, PageHead, PersonAvatar, BandTag, Chevron, TopBar } from './ui'

function matches(q, ...parts) {
  if (!q) return true
  const hay = parts.flat().filter(Boolean).join(' ').toLowerCase()
  return q.toLowerCase().split(/\s+/).every(w => hay.includes(w))
}

export default function PeopleScreen() {
  const { data, idx, openPerson } = useApp()
  const [q, setQ] = useState('')
  const members = useMemo(() => (data['MEMBERS'] || []).slice().sort((a, b) => (a.fields['Member Name'] || '').localeCompare(b.fields['Member Name'] || '')), [data])
  // Crew marked inactive in Airtable are left out of the directory.
  const crew = useMemo(() => (data['CREW'] || []).filter(c => c.fields['Active']).sort((a, b) => (a.fields['Name'] || '').localeCompare(b.fields['Name'] || '')), [data])

  const bandsOf = (m) => idx.all('BANDS', m.fields['Primary Bands']).map(b => b.fields['Band Name'])
  const shownMembers = members.filter(m => matches(q, m.fields['Member Name'], m.fields['Instruments'], bandsOf(m)))
  const shownCrew = crew.filter(c => matches(q, c.fields['Name'], c.fields['Role']))

  return (
    <>
      <TopBar />
      <main className="content rise">
        <PageHead title="People" sub="Everyone in Echo Play Live. Tap someone to call or text." />
        <label style={{ position: 'relative', display: 'block' }}>
          <span className="sr-only">Search people</span>
          <Search aria-hidden="true" size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)', marginTop: '0.175rem' }} />
          <input className="input" style={{ paddingLeft: '2.4rem', background: 'var(--card)', boxShadow: 'var(--shadow-card)' }} type="search" placeholder="Name, instrument or band" value={q} onChange={e => setQ(e.target.value)} />
        </label>

        <Panel title="Band members" count={shownMembers.length}>
          {shownMembers.length ? (
            <ul className="rows">
              {shownMembers.map(m => (
                <li key={m.id}>
                  <button className="row" onClick={() => openPerson(m, 'member')}>
                    <PersonAvatar record={m} type="member" size={42} />
                    <span>
                      <span className="row-title">{m.fields['Member Name']}</span>
                      <span className="row-sub">{(m.fields['Instruments'] || []).join(', ')}</span>
                      <span className="tags" style={{ marginTop: '0.35rem' }}>{bandsOf(m).map(b => <BandTag key={b} name={b} />)}</span>
                    </span>
                    <Chevron />
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="empty">No one matches “{q}”.</p>}
        </Panel>

        <Panel title="Crew" count={shownCrew.length}>
          {shownCrew.length ? (
            <ul className="rows">
              {shownCrew.map(c => (
                <li key={c.id}>
                  <button className="row" onClick={() => openPerson(c, 'crew')}>
                    <PersonAvatar record={c} type="crew" size={42} />
                    <span><span className="row-title">{c.fields['Name']}</span><span className="row-sub">{c.fields['Role'] || 'Crew'}</span></span>
                    <Chevron />
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="empty">{q ? `No crew match “${q}”.` : 'No crew listed.'}</p>}
        </Panel>
      </main>
    </>
  )
}
