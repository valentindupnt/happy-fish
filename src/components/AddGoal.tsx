import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { addDays, DAY_LETTERS, isoDow, weekLabel, weekStart } from '../lib/dates'
import { rewardLabel } from '../lib/xp'
import { Sheet, Switch } from './ui'

const MINUTES = [5, 10, 15, 20, 30, 45, 60, 90, 120]
const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

export interface AddGoalInit {
  day: string
  common?: boolean
  title?: string
  note?: string
}

export function AddGoal({ init, onClose }: { init: AddGoalInit; onClose: () => void }) {
  const { categories, suggestions, today, run, reload, loadWeek, partner, partnerName } = useStore()
  const week = weekStart(init.day < today ? today : init.day)
  const [common, setCommon] = useState(Boolean(init.common))
  const [title, setTitle] = useState(init.title || '')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [minutes, setMinutes] = useState(15)
  const [days, setDays] = useState<number[]>([isoDow(init.day < today ? today : init.day)])
  const [recurring, setRecurring] = useState(false)
  const [note, setNote] = useState(init.note || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const dayDisabled = (d: number) => addDays(week, d - 1) < today
  const allDays = [1, 2, 3, 4, 5, 6, 7].filter((d) => !dayDisabled(d) || recurring)
  const shown = useMemo(
    () => suggestions.filter((s) => !categoryId || s.category_id === categoryId).slice(0, 12),
    [suggestions, categoryId],
  )

  const toggleDay = (d: number) => {
    setError('')
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()))
  }

  const submit = async () => {
    if (!title.trim()) return setError('Donne un nom à ton objectif')
    const effective = days.filter((d) => recurring || !dayDisabled(d))
    if (!effective.length) return setError('Choisis au moins un jour')
    setSaving(true)
    const ok = await run(
      () => supabase.rpc('create_goal', {
        p_title: title.trim(),
        p_minutes: minutes,
        p_days: effective,
        p_recurring: recurring,
        p_week: week,
        p_category: categoryId,
        p_note: note.trim() || null,
        p_common: common,
      }),
      'Objectif ajouté',
    )
    setSaving(false)
    if (ok) {
      await reload(['goals'])
      await loadWeek(week)
      onClose()
    }
  }

  const summary = days.length === 7
    ? 'tous les jours'
    : days.map((d) => DAY_NAMES[d - 1]).join(', ')

  return (
    <Sheet title="Nouvel objectif" onClose={onClose}>
      {partner && (
        <div className="seg" role="group" aria-label="Pour qui">
          <button type="button" aria-pressed={!common} onClick={() => setCommon(false)}>Pour moi</button>
          <button type="button" aria-pressed={common} onClick={() => setCommon(true)}>Avec {partnerName}</button>
        </div>
      )}

      <div className="field">
        <label htmlFor="goal-title">Objectif</label>
        <input id="goal-title" className="input" value={title} maxLength={120} placeholder="Faire la vaisselle" onChange={(e) => { setTitle(e.target.value); setError('') }} />
      </div>

      <div className="field">
        <span className="label" id="cat-label">Catégorie</span>
        <div className="wrap" role="group" aria-labelledby="cat-label">
          {categories.map((c) => (
            <button key={c.id} type="button" className="tag" aria-pressed={categoryId === c.id} onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}>
              <span className="dot" style={{ background: c.color, marginRight: 6 }} />{c.name}
            </button>
          ))}
        </div>
      </div>

      {shown.length > 0 && (
        <div className="field">
          <span className="label" id="sugg-label">Suggestions</span>
          <div className="wrap" role="group" aria-labelledby="sugg-label">
            {shown.map((s) => (
              <button key={s.id} type="button" className="tag" onClick={() => { setTitle(s.title); setMinutes(s.minutes); if (s.category_id) setCategoryId(s.category_id); setError('') }}>
                {s.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <span className="label" id="min-label">Temps : {minutes} min, soit {rewardLabel(minutes)}</span>
        <div className="wrap" role="group" aria-labelledby="min-label">
          {MINUTES.map((m) => (
            <button key={m} type="button" className="tag" aria-pressed={minutes === m} onClick={() => setMinutes(m)}>
              {m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}`}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="label" id="days-label">Quels jours ({weekLabel(week).toLowerCase()})</span>
        <div className="weekday-picker" role="group" aria-labelledby="days-label">
          {DAY_LETTERS.map((l, i) => {
            const d = i + 1
            const off = dayDisabled(d) && !recurring
            return (
              <button key={d} type="button" aria-pressed={days.includes(d)} aria-label={DAY_NAMES[i]} disabled={off} onClick={() => toggleDay(d)}>{l}</button>
            )
          })}
        </div>
        <div className="wrap">
          <button type="button" className="btn small" onClick={() => setDays(allDays)}>Tous les jours</button>
          <span className="small" style={{ alignSelf: 'center' }}>{days.length ? summary : 'aucun jour'}</span>
        </div>
      </div>

      <Switch checked={recurring} onChange={setRecurring} label="Répéter chaque semaine" />

      <div className="field">
        <label htmlFor="goal-note">Note (optionnelle)</label>
        <textarea id="goal-note" className="textarea" value={note} maxLength={1000} placeholder="Un détail, un lien…" onChange={(e) => setNote(e.target.value)} />
      </div>

      {error && <p role="alert" style={{ margin: 0, color: '#A3201A', fontSize: 13, fontWeight: 700 }}>{error}</p>}
      <button type="button" className="btn primary block" disabled={saving} onClick={submit}>{saving ? 'Ajout…' : 'Ajouter'}</button>
    </Sheet>
  )
}
