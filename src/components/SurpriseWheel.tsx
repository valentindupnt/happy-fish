import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { celebrate } from '../lib/fx'
import { Icon, Sheet } from './ui'

const COLORS = ['#FF8C1A', '#4D8EEA', '#FF6FAE', '#2ECC71', '#F2C66D', '#9B6BDF', '#5ED3B3', '#E0304E']

function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Roue des idées de surprises. Le tirage reste dans le téléphone : la surprise reste secrète. */
export function SurpriseWheel({ onClose }: { onClose: () => void }) {
  const { surpriseIdeas, couple, userId, run, reload, nameOf } = useStore()
  const [slices, setSlices] = useState(() => shuffle(surpriseIdeas).slice(0, 8))
  const [angle, setAngle] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [managing, setManaging] = useState(surpriseIdeas.length < 2)

  const n = slices.length
  const step = 360 / Math.max(1, n)

  const spin = () => {
    if (spinning || n < 2) return
    setPicked(null)
    const index = Math.floor(Math.random() * n)
    // La flèche est en haut : on amène le milieu de la part choisie sous la flèche
    const target = 360 - (index * step + step / 2)
    const next = angle - (angle % 360) + 360 * 5 + target
    setAngle(next)
    setSpinning(true)
    window.setTimeout(() => {
      setSpinning(false)
      setPicked(slices[index].title)
      celebrate()
    }, 3600)
  }

  const add = async () => {
    const t = title.trim()
    if (!t) return
    if (await run(() => supabase.from('surprise_ideas').insert({ couple_id: couple?.id, created_by: userId, title: t }))) {
      setTitle('')
      await reload(['surprises'])
    }
  }

  const remove = async (id: string) => {
    if (await run(() => supabase.from('surprise_ideas').delete().eq('id', id))) await reload(['surprises'])
  }

  // Les parts suivent la liste quand on ajoute ou retire une idée
  useEffect(() => {
    if (spinning) return
    const ids = new Set(surpriseIdeas.map((x) => x.id))
    const stale = slices.some((x) => !ids.has(x.id)) || slices.length < Math.min(8, surpriseIdeas.length)
    if (stale) setSlices(shuffle(surpriseIdeas).slice(0, 8))
  }, [surpriseIdeas, slices, spinning])

  const gradient = slices.map((_, i) => `${COLORS[i % COLORS.length]} ${i * step}deg ${(i + 1) * step}deg`).join(', ')

  return (
    <Sheet title="Roue des surprises" onClose={onClose}>
      {n >= 2 ? (
        <>
          <div className="wheel-wrap">
            <div className="wheel-pointer" aria-hidden="true" />
            <div className="wheel" style={{ background: `conic-gradient(${gradient})`, transform: `rotate(${angle}deg)` }} aria-hidden="true">
              {slices.map((s, i) => (
                <span key={s.id} className="wheel-label" style={{ transform: `rotate(${i * step + step / 2}deg)` }}>
                  <span className={i * step + step / 2 < 180 ? 'flip' : undefined}>{s.title.length > 16 ? `${s.title.slice(0, 15)}…` : s.title}</span>
                </span>
              ))}
            </div>
            <div className="wheel-hub" aria-hidden="true" />
          </div>
          <div aria-live="polite" style={{ textAlign: 'center', minHeight: 44 }}>
            {picked && (
              <>
                <span className="small">La roue a choisi :</span>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{picked}</div>
              </>
            )}
          </div>
          <button type="button" className="btn primary block" disabled={spinning} onClick={spin}>{spinning ? 'Ça tourne…' : picked ? 'Retourner la roue' : 'Tourner la roue'}</button>
          <span className="small" style={{ textAlign: 'center' }}>Le résultat n’est enregistré nulle part : il reste entre toi et ta roue.</span>
          {surpriseIdeas.length > 8 && <span className="small" style={{ textAlign: 'center' }}>La roue montre 8 idées tirées au hasard parmi les {surpriseIdeas.length}.</span>}
        </>
      ) : (
        <div className="card empty">Il faut au moins 2 idées pour faire tourner la roue.</div>
      )}

      <button type="button" className="btn small ghost" onClick={() => setManaging((m) => !m)}>
        {managing ? 'Masquer les idées' : `Gérer les idées (${surpriseIdeas.length})`}
      </button>
      {managing && (
        <div className="stack" style={{ gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" aria-label="Nouvelle idée de surprise" placeholder="Petit-déjeuner au lit" maxLength={120} value={title}
              onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add() }} />
            <button type="button" className="btn primary" disabled={!title.trim()} onClick={add}>Ajouter</button>
          </div>
          {surpriseIdeas.length > 0 && (
            <ul className="list card">
              {surpriseIdeas.map((s) => (
                <li key={s.id} className="row-between" style={{ alignItems: 'center', padding: '8px 12px', gap: 8 }}>
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{s.title}</span>
                    <span className="small">par {nameOf(s.created_by)}</span>
                  </span>
                  {s.created_by === userId && (
                    <button type="button" className="icon-btn" aria-label={`Retirer ${s.title}`} onClick={() => remove(s.id)}><Icon name="close" /></button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  )
}
