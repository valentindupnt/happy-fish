import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { celebrate } from '../lib/fx'
import { weekLabel } from '../lib/dates'
import type { Review } from '../lib/types'
import { Icon, Sheet } from './ui'

const COLORS = ['#FF8C1A', '#4D8EEA', '#FF6FAE', '#2ECC71', '#F2C66D', '#9B6BDF', '#5ED3B3', '#E0304E']

type Slice = { id: string; title: string }

function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Le bilan en attente qui débloque la roue : 3 ratés ou plus la semaine passée chez l'autre,
 * surprise pas encore reçue. Celui qui n'a pas raté lance la roue, une seule fois par bilan.
 */
export function useWheelUnlock(): Review | null {
  const { reviews, partner } = useStore()
  return useMemo(
    () => reviews.find((r) => r.profile_id === partner?.id && r.surprise_due && !r.surprise_received_at) ?? null,
    [reviews, partner?.id],
  )
}

/** Roue des surprises : le tirage se fait dans la base, au hasard parmi les idées de surprise du duo */
export function SurpriseWheel({ onClose }: { onClose: () => void }) {
  const { surpriseIdeas, couple, userId, run, reload, nameOf, partnerName } = useStore()
  const unlock = useWheelUnlock()
  const pool = useMemo<Slice[]>(() => surpriseIdeas.map((s) => ({ id: s.id, title: s.title })), [surpriseIdeas])
  const [slices, setSlices] = useState(() => shuffle(pool).slice(0, 8))
  const [angle, setAngle] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [title, setTitle] = useState('')

  const n = slices.length
  const step = 360 / Math.max(1, n)
  const alreadySpun = Boolean(unlock?.surprise_picked_at)
  const picked = revealed ?? (alreadySpun ? unlock?.surprise_pick ?? null : null)
  const canSpin = Boolean(unlock) && !alreadySpun && !spinning && pool.length >= 2

  const spin = async () => {
    if (!canSpin || !unlock) return
    setRevealed(null)
    let chosen = ''
    const ok = await run(async () => {
      const res = await supabase.rpc('spin_wheel', { p_review: unlock.id })
      if (!res.error) chosen = String(res.data)
      return res
    })
    if (!ok || !chosen) return
    // Le tirage vient de la base : on s'assure que la part gagnante est sur la roue
    let list = slices
    let index = list.findIndex((s) => s.title === chosen)
    if (index < 0) {
      const winner = pool.find((s) => s.title === chosen) ?? { id: `x-${chosen}`, title: chosen }
      index = Math.floor(Math.random() * Math.max(1, list.length))
      list = list.map((s, i) => (i === index ? winner : s))
      setSlices(list)
    }
    const stepNow = 360 / Math.max(1, list.length)
    // La flèche est en haut : on amène le milieu de la part choisie sous la flèche
    const target = 360 - (index * stepNow + stepNow / 2)
    setAngle(angle - (angle % 360) + 360 * 5 + target)
    setSpinning(true)
    window.setTimeout(() => {
      setSpinning(false)
      setRevealed(chosen)
      celebrate()
      void reload(['reviews'])
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

  // Les parts suivent la liste quand une idée est ajoutée ou retirée
  useEffect(() => {
    if (spinning) return
    const ids = new Set(pool.map((x) => x.id))
    const stale = slices.some((x) => !ids.has(x.id)) || slices.length < Math.min(8, pool.length)
    if (stale) setSlices(shuffle(pool).slice(0, 8))
  }, [pool, slices, spinning])

  const gradient = slices.map((_, i) => `${COLORS[i % COLORS.length]} ${i * step}deg ${(i + 1) * step}deg`).join(', ')

  let status: string
  if (unlock) {
    status = alreadySpun
      ? `La roue a déjà tourné pour ${weekLabel(unlock.week_start).toLowerCase()}. Elle repart au prochain bilan à 3 ratés.`
      : `${partnerName} a eu ${unlock.missed} ratés ${weekLabel(unlock.week_start).toLowerCase()} : tu peux lancer la roue une fois.`
  } else {
    status = `La roue se débloque quand ${partnerName || 'l’autre'} atteint 3 ratés sur une semaine. C’est toi qui la lances.`
  }

  return (
    <Sheet title="Surprise" onClose={onClose}>
      {n >= 2 ? (
        <>
          <div className="wheel-wrap" style={unlock && !alreadySpun ? undefined : { opacity: 0.55 }}>
            <div className="wheel-pointer" aria-hidden="true" />
            <div className="wheel" style={{ background: `conic-gradient(${gradient})`, transform: `rotate(${angle}deg)` }} aria-hidden="true">
              {slices.map((s, i) => (
                <span key={s.id} className="wheel-label" style={{ transform: `rotate(${i * step + step / 2}deg)` }}>
                  <span>{s.title.length > 16 ? `${s.title.slice(0, 15)}…` : s.title}</span>
                </span>
              ))}
            </div>
            <div className="wheel-hub" aria-hidden="true" />
          </div>
          <div aria-live="polite" style={{ textAlign: 'center', minHeight: 44 }}>
            {picked && !spinning && (
              <>
                <span className="small">La roue a choisi :</span>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{picked}</div>
              </>
            )}
          </div>
          <button type="button" className="btn primary block" aria-disabled={!canSpin} style={canSpin ? undefined : { opacity: 0.5 }} onClick={() => void spin()}>
            {spinning ? 'Ça tourne…' : unlock && !alreadySpun ? 'Lancer la roue' : (<><Icon name="lock" size={16} />&nbsp;Roue verrouillée</>)}
          </button>
          {pool.length > 8 && <span className="small" style={{ textAlign: 'center' }}>La roue montre 8 surprises tirées au hasard parmi les {pool.length}.</span>}
        </>
      ) : (
        <div className="card empty">Il faut au moins 2 surprises dans la liste pour faire tourner la roue.</div>
      )}
      <span className="small" style={{ textAlign: 'center' }}>{status}</span>

      <h3 className="h2" style={{ fontSize: 15, marginTop: 6 }}>Nos surprises{surpriseIdeas.length ? ` (${surpriseIdeas.length})` : ''}</h3>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" aria-label="Nouvelle surprise" placeholder="Petit-déjeuner au lit" maxLength={120} value={title}
          onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add() }} />
        <button type="button" className="btn primary" disabled={!title.trim()} onClick={add}>Ajouter</button>
      </div>
      {surpriseIdeas.length > 0 ? (
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
      ) : (
        <div className="card empty">Ajoutez ici les surprises que vous aimeriez recevoir.</div>
      )}
    </Sheet>
  )
}
