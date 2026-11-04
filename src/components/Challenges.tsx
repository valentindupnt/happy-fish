import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { weekStart } from '../lib/dates'
import { celebrate } from '../lib/fx'
import { Fish } from './Fish'
import { Coin, Icon, Sheet } from './ui'

// Dé pixel art : 7 × 7, points selon la face
const PIPS: Record<number, Array<[number, number]>> = {
  1: [[3, 3]],
  2: [[1, 1], [5, 5]],
  3: [[1, 1], [3, 3], [5, 5]],
  4: [[1, 1], [5, 1], [1, 5], [5, 5]],
  5: [[1, 1], [5, 1], [3, 3], [1, 5], [5, 5]],
  6: [[1, 1], [5, 1], [1, 3], [5, 3], [1, 5], [5, 5]],
}

export function Die({ face, size = 44, rolling = false }: { face: number; size?: number; rolling?: boolean }) {
  return (
    <svg className={rolling ? 'die rolling' : 'die'} width={size} height={size} viewBox="-1 -1 9 9" shapeRendering="crispEdges" aria-hidden="true">
      <rect x={-0.5} y={-0.5} width={8} height={8} rx={1} fill="#FFFFFF" stroke="#1B1B3A" strokeWidth={1} />
      {PIPS[face].map(([x, y], i) => <rect key={i} x={x} y={y} width={1} height={1} fill="#1B1B3A" />)}
    </svg>
  )
}

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms))

export function Challenges() {
  const { me, challenges, rolls, today, nameOf, run, reload, couple } = useStore()
  const [face, setFace] = useState(5)
  const [rolling, setRolling] = useState(false)
  const [managing, setManaging] = useState(false)
  const week = weekStart(today)
  const current = rolls.find((r) => r.week_start === week)

  const roll = async () => {
    if (rolling) return
    setRolling(true)
    const spin = window.setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 90)
    const [ok] = await Promise.all([run(() => supabase.rpc('roll_challenge')), wait(1300)])
    window.clearInterval(spin)
    setFace(1 + Math.floor(Math.random() * 6))
    if (ok) await reload(['challenges'])
    setRolling(false)
  }

  const complete = async () => {
    if (!current) return
    if (await run(() => supabase.rpc('complete_challenge', { p_roll: current.id }), 'Défi réussi, 10 pièces dans la cagnotte !')) {
      celebrate()
      await reload(['challenges', 'shop', 'couple', 'fish'])
    }
  }

  return (
    <section aria-label="Défi de la semaine" className="card pad stack challenge-card">
      <div className="row-between" style={{ alignItems: 'center' }}>
        <h2 className="h2">Défi de la semaine</h2>
        <button type="button" className="btn small ghost" onClick={() => setManaging(true)}>
          Nos défis ({challenges.length})
        </button>
      </div>

      {current ? (
        <div className="stack" style={{ gap: 10 }}>
          <div className="challenge-result">
            <Die face={face} size={36} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>{current.title}</span>
              <span className="small">
                Tiré par {nameOf(current.rolled_by)}
                {current.done_at ? `, réussi grâce à ${nameOf(current.done_by)}` : ''}
              </span>
            </div>
          </div>
          {current.done_at ? (
            <span className="small" style={{ color: 'var(--green-ink)', fontWeight: 800 }}>Réussi ! 10 pièces sont allées dans la cagnotte. Nouveau lancer lundi.</span>
          ) : (
            <button type="button" className="btn primary" onClick={complete}>
              Défi réussi, <Coin size={12} /> +10 pour la cagnotte
            </button>
          )}
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          <div className="dice-stage" aria-live="polite">
            <div className={rolling ? 'dice-fish throwing' : 'dice-fish'}>
              <Fish color={me?.fish_color || 'corail'} hat={me?.fish_hat} width={52} mood={rolling ? 'happy' : 'normal'} />
            </div>
            <div className={rolling ? 'dice-die tossed' : 'dice-die'}><Die face={face} rolling={rolling} /></div>
          </div>
          <span className="small" style={{ textAlign: 'center' }}>
            {challenges.length
              ? 'Le poisson lance le dé et choisit un défi parmi les vôtres. Un seul lancer par semaine !'
              : 'Ajoutez d’abord vos idées de défis, autant que vous voulez.'}
          </span>
          {challenges.length ? (
            <button type="button" className="btn primary" disabled={rolling || !couple} onClick={roll}>{rolling ? 'Le dé roule…' : 'Lancer le dé'}</button>
          ) : (
            <button type="button" className="btn primary" onClick={() => setManaging(true)}>Ajouter des défis</button>
          )}
        </div>
      )}

      {managing && <ChallengeSheet onClose={() => setManaging(false)} />}
    </section>
  )
}

function ChallengeSheet({ onClose }: { onClose: () => void }) {
  const { challenges, couple, userId, run, reload, nameOf } = useStore()
  const [title, setTitle] = useState('')

  const add = async () => {
    const t = title.trim()
    if (!t) return
    if (await run(() => supabase.from('challenges').insert({ couple_id: couple?.id, created_by: userId, title: t }))) {
      setTitle('')
      await reload(['challenges'])
    }
  }

  const remove = async (id: string) => {
    if (await run(() => supabase.from('challenges').update({ archived: true }).eq('id', id), 'Défi retiré')) await reload(['challenges'])
  }

  return (
    <Sheet title="Nos défis" onClose={onClose}>
      <span className="small">Chacun ajoute les défis qu’il veut. Le dé tire au hasard parmi tous ceux de la liste.</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" aria-label="Nouveau défi" placeholder="Une soirée sans écran" maxLength={120} value={title}
          onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add() }} />
        <button type="button" className="btn primary" disabled={!title.trim()} onClick={add}>Ajouter</button>
      </div>
      {challenges.length ? (
        <ul className="list card">
          {challenges.map((c) => (
            <li key={c.id} className="row-between" style={{ alignItems: 'center', padding: '10px 12px', gap: 8 }}>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{c.title}</span>
                <span className="small">par {nameOf(c.created_by)}</span>
              </span>
              {c.created_by === userId && (
                <button type="button" className="icon-btn" aria-label={`Retirer ${c.title}`} onClick={() => remove(c.id)}><Icon name="close" /></button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="card empty">Aucun défi pour l’instant. Quelques idées : un pique-nique, une recette jamais faite, une balade sans téléphone.</div>
      )}
    </Sheet>
  )
}
