// People: everyone in EPL, with a tap to their card (call or text).
// Two layouts to choose between: by band (who's who in each band, with what
// they play there) or A–Z (everyone once, with their bands underneath).
// Only bands marked Active in Airtable are listed.
import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useApp } from './context'
import { Panel, PageHead, PersonAvatar, BandDot, BandRoles, Chevron, TopBar } from './ui'
import { activeBands, memberBands, roleInBand, ids } from '../lib/derive'

const VIEW_KEY = 'epl-people-view'

function matches(q, ...parts) {
  if (!q) return true
  const hay = parts.flat().filter(Boolean).join(' ').toLowerCase()
  return q.toLowerCase().split(/\s+/).every(w => hay.includes(w))
}

function PersonRow({ record, type, sub, children }) {
  const { openPerson } = useApp()
  const name = type === 'crew' ? record.fields['Name'] : record.fields['Member Name']
  return (
    <li>
      <button className="row" onClick={() => openPerson(record, type)}>
        <PersonAvatar record={record} type={type} size={42} />
        <span>
          <span className="row-title">{name}</span>
          {sub && <span className="row-sub">{sub}</span>}
          {children}
        </span>
        <Chevron />
      </button>
    </li>
  )
}

export default function PeopleScreen({ initialView = 'band' }) {
  const { data, idx } = useApp()
  const [q, setQ] = useState('')
  const [view, setView] = useState(initialView)
  useEffect(() => { try { const v = localStorage.getItem(VIEW_KEY); if (v === 'band' || v === 'az') setView(v) } catch {} }, [])
  const choose = (v) => { setView(v); try { localStorage.setItem(VIEW_KEY, v) } catch {} }

  const members = useMemo(() => (data['MEMBERS'] || []).slice().sort((a, b) => (a.fields['Member Name'] || '').localeCompare(b.fields['Member Name'] || '')), [data])
  // Crew marked inactive in Airtable are left out of the directory.
  const crew = useMemo(() => (data['CREW'] || []).filter(c => c.fields['Active']).sort((a, b) => (a.fields['Name'] || '').localeCompare(b.fields['Name'] || '')), [data])
  const bands = useMemo(() => activeBands(data), [data])

  const memberMatches = (m) => matches(q, m.fields['Member Name'], m.fields['Instruments'], memberBands(m, idx).flatMap(b => [b.name, b.role]))
  const shownCrew = crew.filter(c => matches(q, c.fields['Name'], c.fields['Role']))

  // By band: each active band with its members and what they play in it.
  const byBand = bands.map(band => ({
    band,
    people: members.filter(m => ids(m.fields['Primary Bands']).includes(band.id) && (matches(q, band.fields['Band Name']) || memberMatches(m))),
  })).filter(g => g.people.length)
  const unbanded = members.filter(m => !memberBands(m, idx).length && memberMatches(m))
  const shownAZ = members.filter(memberMatches)

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
        <div className="seg" role="group" aria-label="Layout">
          <button aria-pressed={view === 'band'} onClick={() => choose('band')}>By band</button>
          <button aria-pressed={view === 'az'} onClick={() => choose('az')}>A–Z</button>
        </div>

        {view === 'band' ? (
          <>
            {byBand.map(({ band, people }) => {
              const name = band.fields['Band Name']
              return (
                <Panel key={band.id} title={<><BandDot name={name} />{name}</>} count={people.length}>
                  <ul className="rows">
                    {people.map(m => <PersonRow key={m.id} record={m} type="member" sub={roleInBand(m, name)} />)}
                  </ul>
                </Panel>
              )
            })}
            {unbanded.length > 0 && (
              <Panel title="Other members" count={unbanded.length}>
                <ul className="rows">{unbanded.map(m => <PersonRow key={m.id} record={m} type="member" sub={(m.fields['Instruments'] || []).join(', ')} />)}</ul>
              </Panel>
            )}
            {!byBand.length && !unbanded.length && q && <p className="empty">No band members match “{q}”.</p>}
          </>
        ) : (
          <Panel title="Band members" count={shownAZ.length}>
            {shownAZ.length ? (
              <ul className="rows">
                {shownAZ.map(m => {
                  const mb = memberBands(m, idx)
                  return (
                    <PersonRow key={m.id} record={m} type="member" sub={mb.length ? null : (m.fields['Instruments'] || []).join(', ')}>
                      <BandRoles bands={mb} />
                    </PersonRow>
                  )
                })}
              </ul>
            ) : <p className="empty">No one matches “{q}”.</p>}
          </Panel>
        )}

        <Panel title="Crew" count={shownCrew.length}>
          {shownCrew.length ? (
            <ul className="rows">{shownCrew.map(c => <PersonRow key={c.id} record={c} type="crew" sub={c.fields['Role'] || 'Crew'} />)}</ul>
          ) : <p className="empty">{q ? `No crew match “${q}”.` : 'No crew listed.'}</p>}
        </Panel>
      </main>
    </>
  )
}
