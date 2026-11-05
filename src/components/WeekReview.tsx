import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { addDays, weekLabel, weekStart } from '../lib/dates'
import type { Review } from '../lib/types'
import { SurpriseWheel } from './SurpriseWheel'

function readSeen(key: string): boolean {
  try { return window.localStorage.getItem(key) === '1' } catch { return false }
}

function line(r: Review | undefined) {
  if (!r) return 'pas de bilan'
  return `${r.done} fait${r.done > 1 ? 's' : ''}, ${r.missed} raté${r.missed > 1 ? 's' : ''}, ${r.xp} XP`
}

/** Bilan du lundi et surprises à offrir ou à recevoir */
export function WeekReview() {
  const { reviews, userId, partner, partnerName, me, today, run, reload } = useStore()
  const lastWeek = addDays(weekStart(today), -7)
  const seenKey = `hf-review-${lastWeek}`
  const [seen, setSeen] = useState(() => readSeen(seenKey))
  const [wheel, setWheel] = useState(false)

  const mine = reviews.find((r) => r.profile_id === userId && r.week_start === lastWeek)
  const theirs = reviews.find((r) => r.profile_id === partner?.id && r.week_start === lastWeek)
  const iOwe = reviews.filter((r) => r.profile_id === userId && r.surprise_due && !r.surprise_received_at)
  const theyOwe = reviews.filter((r) => r.profile_id === partner?.id && r.surprise_due && !r.surprise_received_at)

  const received = async (r: Review) => {
    if (await run(() => supabase.rpc('mark_surprise_received', { p_review: r.id }), 'Surprise notée comme reçue')) await reload(['reviews'])
  }

  const dismiss = () => {
    try { window.localStorage.setItem(seenKey, '1') } catch { /* rien */ }
    setSeen(true)
  }

  return (
    <>
      {mine && !seen && (
        <section aria-label="Bilan de la semaine dernière" className="card pad stack" style={{ gap: 8 }}>
          <div className="row-between" style={{ alignItems: 'center' }}>
            <h2 className="h2">Bilan de la semaine</h2>
            <button type="button" className="btn small" onClick={dismiss}>OK</button>
          </div>
          <span className="small">{weekLabel(lastWeek)}</span>
          <div className="row-between"><span style={{ fontWeight: 800 }}>{me?.display_name || 'Moi'}</span><span className="meta">{line(mine)}</span></div>
          {partner && <div className="row-between"><span style={{ fontWeight: 800 }}>{partnerName}</span><span className="meta">{line(theirs)}</span></div>}
          {!mine.surprise_due && !theirs?.surprise_due && <span className="small" style={{ color: 'var(--green-ink)', fontWeight: 800 }}>Aucune surprise due cette fois, bravo à vous deux !</span>}
        </section>
      )}

      {iOwe.map((r) => (
        <section key={r.id} aria-label="Surprise à offrir" className="card pad cream stack" style={{ gap: 4 }}>
          <span className="h2" style={{ fontSize: 15 }}>Tu dois une surprise à {partnerName}</span>
          <span className="small" style={{ color: 'var(--cream-ink)' }}>
            {r.missed} ratés {weekLabel(r.week_start).toLowerCase()}. {r.surprise_pick ? `${partnerName} a lancé la roue : ${r.surprise_pick}.` : `${partnerName} lance la roue pour choisir.`} {partnerName} confirmera dans l’app une fois la surprise reçue.
          </span>
        </section>
      ))}
      {wheel && <SurpriseWheel onClose={() => setWheel(false)} />}

      {theyOwe.map((r) => (
        <section key={r.id} aria-label="Surprise à recevoir" className="card pad stack" style={{ gap: 8, background: '#FFE3EF' }}>
          <span className="h2" style={{ fontSize: 15 }}>{partnerName} te doit une surprise !</span>
          <span className="small" style={{ color: '#8C1D55' }}>{r.missed} ratés {weekLabel(r.week_start).toLowerCase()}.</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn small primary" onClick={() => setWheel(true)}>Lancer la roue</button>
            <button type="button" className="btn small" onClick={() => received(r)}>Surprise reçue</button>
          </div>
        </section>
      ))}
    </>
  )
}
