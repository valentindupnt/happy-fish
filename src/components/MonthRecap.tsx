import { useEffect, useState } from 'react'
import { supabase, errorText } from '../lib/supabase'
import { useStore } from '../lib/store'
import type { MonthRecap as Recap } from '../lib/types'
import { Fish } from './Fish'
import { Flame, Sheet } from './ui'

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export function monthName(iso: string): string {
  return MONTHS[Number(iso.slice(5, 7)) - 1]
}

/** Premier jour du mois précédent */
export function previousMonth(today: string): string {
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7))
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`
}

function hours(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

function de(month: string): string {
  return /^[aeiou]/.test(monthName(month)) ? `d’${monthName(month)}` : `de ${monthName(month)}`
}

export function MonthRecapSheet({ month: initial, onClose }: { month: string; onClose: () => void }) {
  const { me, partner, today, nameOf, fishOf } = useStore()
  const [month, setMonth] = useState(initial)
  const [rows, setRows] = useState<Recap[] | null>(null)
  const [error, setError] = useState('')
  const current = `${today.slice(0, 7)}-01`
  const prev = previousMonth(today)

  useEffect(() => {
    let alive = true
    setRows(null)
    setError('')
    supabase.rpc('month_recap', { p_month: month }).then(({ data, error: e }) => {
      if (!alive) return
      if (e) setError(errorText(e))
      else setRows((data as Recap[]) || [])
    })
    return () => { alive = false }
  }, [month])

  const people = [me, partner].filter(Boolean) as NonNullable<typeof me>[]
  const of = (id: string) => rows?.find((r) => r.profile_id === id)
  const champion = (key: keyof Recap) => {
    if (!rows || rows.length < 2) return null
    const [a, b] = rows
    const va = Number(a[key]); const vb = Number(b[key])
    if (va === vb) return null
    return va > vb ? a.profile_id : b.profile_id
  }
  const total = rows?.reduce((s, r) => s + r.minutes, 0) || 0

  const lines: Array<{ key: keyof Recap; label: string; fmt?: (v: number) => string }> = [
    { key: 'minutes', label: 'Temps investi', fmt: hours },
    { key: 'done', label: 'Sous-objectifs faits' },
    { key: 'perfect_days', label: 'Jours parfaits' },
    { key: 'xp', label: 'XP gagnée' },
    { key: 'messages', label: 'Petits mots' },
    { key: 'treats', label: 'Bulles et friandises' },
  ]

  return (
    <Sheet title={`Récap ${de(month)}`} onClose={onClose}>
      <div className="seg" role="group" aria-label="Mois">
        <button type="button" aria-pressed={month === prev} onClick={() => setMonth(prev)}>{monthName(prev)}</button>
        <button type="button" aria-pressed={month === current} onClick={() => setMonth(current)}>{monthName(current)} (en cours)</button>
      </div>

      {error && <div className="card empty">{error}</div>}
      {!rows && !error && <div className="card empty">Le poisson fait ses comptes…</div>}

      {rows && (
        <>
          <div className="recap-hero">
            <div className="recap-fishes">
              {people.map((p, i) => <Fish key={p.id} color={p.fish_color} hat={p.fish_hat} width={52} flip={i === 1} mood={total > 0 ? 'happy' : 'normal'} />)}
            </div>
            <span className="recap-big">{hours(total)}</span>
            <span className="small">investies ensemble {month === current ? 'depuis le début du mois' : `en ${monthName(month)}`}</span>
          </div>

          <div className="recap-grid" style={{ gridTemplateColumns: `minmax(0, 1.3fr) repeat(${people.length}, minmax(0, 1fr))` }}>
            <span />
            {people.map((p) => <span key={p.id} className="recap-head">{nameOf(p.id)}</span>)}
            {lines.map((l) => {
              const win = champion(l.key)
              return [
                <span key={`${l.key}-l`} className="recap-label">{l.label}</span>,
                ...people.map((p) => {
                  const v = Number(of(p.id)?.[l.key] ?? 0)
                  return (
                    <span key={`${l.key}-${p.id}`} className={`recap-val${win === p.id ? ' win' : ''}`}>
                      {l.fmt ? l.fmt(v) : v}
                    </span>
                  )
                }),
              ]
            })}
            <span className="recap-label">Catégorie préférée</span>
            {people.map((p) => <span key={`cat-${p.id}`} className="recap-val" style={{ fontSize: 12 }}>{of(p.id)?.top_category || 'aucune'}</span>)}
          </div>

          <div className="card pad cream stack" style={{ gap: 6 }}>
            {people.map((p) => {
              const r = of(p.id)
              const f = fishOf(p.id)
              return (
                <span key={p.id} style={{ fontSize: 13, fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Flame size={12} />{verdict(nameOf(p.id), r, f.level)}
                </span>
              )
            })}
          </div>
          <span className="small" style={{ textAlign: 'center' }}>En gras, celui ou celle qui mène sur chaque ligne.</span>
        </>
      )}
    </Sheet>
  )
}

function verdict(name: string, r: Recap | undefined, level: number): string {
  if (!r || r.done === 0) return `${name} : le mois ne fait que commencer, à toi de jouer !`
  if (r.perfect_days >= 10) return `${name} : ${r.perfect_days} jours parfaits, un vrai requin de la régularité.`
  if (r.minutes >= 600) return `${name} : plus de 10 heures investies, ton poisson niveau ${level} te dit merci.`
  if (r.messages + r.treats >= 30) return `${name} : champion des petits mots, ça fait chaud au cœur.`
  return `${name} : ${r.done} sous-objectifs cochés, belle nage !`
}
