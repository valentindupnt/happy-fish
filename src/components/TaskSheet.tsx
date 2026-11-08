import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { addDays, DAY_LETTERS, longDay, weekStart } from '../lib/dates'
import { rewardLabel } from '../lib/xp'
import { canAct, isBlocked } from '../lib/tasks'
import { MAX_POSTPONED } from '../lib/types'
import type { Task } from '../lib/types'
import { Sheet, Switch } from './ui'
import { useTaskActions } from './TaskRow'
import { startFocus, unlockAudio } from './FocusTimer'
import type { FocusState } from './FocusTimer'

const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

export function TaskSheet({ task, onClose, onEncourage, onFocus }: { task: Task; onClose: () => void; onEncourage: (t: Task) => void; onFocus: (f: FocusState) => void }) {
  const { userId, today, goalOf, categoryOf, nameOf, run, reload, reloadTasks } = useStore()
  const actions = useTaskActions()
  const goal = goalOf(task.goal_id)
  const [taskNote, setTaskNote] = useState(task.note || '')
  const [goalNote, setGoalNote] = useState(goal?.note || '')
  const [title, setTitle] = useState(goal?.title || '')
  const [minutes, setMinutes] = useState(String(goal?.minutes ?? 15))
  const [date, setDate] = useState(task.date < today ? today : task.date)
  const [confirmStop, setConfirmStop] = useState(false)
  const [days, setDays] = useState<number[]>(goal?.days ?? [])
  const [recurring, setRecurring] = useState(Boolean(goal?.recurring))
  if (!goal) return null

  const mine = canAct(task, userId)
  const done = Boolean(task.done_at)
  const cat = categoryOf(goal.category_id)
  const owner = task.owner_id === null ? 'Objectif commun' : task.owner_id === userId ? 'Mon objectif' : `Objectif de ${nameOf(task.owner_id)}`

  const minutesOk = Number.isFinite(Math.round(Number(minutes))) && Math.round(Number(minutes)) >= 1 && Math.round(Number(minutes)) <= 600
  const postponed = task.postponed ?? 0
  const blocked = isBlocked(task)
  // Un objectif ponctuel d'une semaine passée n'a plus de jours à changer : on peut seulement le répéter
  const pastOneShot = !goal.recurring && goal.week_start < weekStart(today)
  const sameDays = days.length === goal.days.length && days.every((d) => goal.days.includes(d))
  const scheduleChanged = recurring !== goal.recurring || (!pastOneShot && !sameDays)
  const scheduleOk = days.length > 0
  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()))

  const save = async () => {
    const jobs: Array<Promise<boolean>> = []
    if (taskNote !== (task.note || '')) {
      jobs.push(run(() => supabase.from('tasks').update({ note: taskNote.trim() || null }).eq('id', task.id)))
    }
    const min = Math.round(Number(minutes))
    if (!minutesOk) return
    if (title.trim() && (title !== goal.title || goalNote !== (goal.note || '') || min !== goal.minutes)) {
      jobs.push(run(() => supabase.from('goals').update({ title: title.trim(), note: goalNote.trim() || null, minutes: min }).eq('id', goal.id)))
    }
    if (scheduleChanged) {
      if (!scheduleOk) return
      jobs.push(run(() => supabase.rpc('update_goal', { p_goal: goal.id, p_days: pastOneShot ? goal.days : days, p_recurring: recurring }), 'Objectif modifié'))
    }
    const results = await Promise.all(jobs)
    if (results.every(Boolean)) {
      if (jobs.length) {
        await Promise.all([reloadTasks(), reload(['goals', 'fish', 'streaks'])])
      }
      onClose()
    }
  }

  const skip = async () => {
    const ok = await run(() => supabase.rpc('skip_task', { p_task: task.id }), 'Retiré pour ce jour')
    if (ok) { await Promise.all([reloadTasks(), reload(['fish'])]); onClose() }
  }

  const stop = async () => {
    const ok = await run(() => supabase.rpc('archive_goal', { p_goal: goal.id }), 'Objectif arrêté, l’XP gagnée reste')
    if (ok) { await Promise.all([reloadTasks(), reload(['goals', 'fish'])]); onClose() }
  }

  return (
    <Sheet title={goal.title} onClose={onClose}>
      <p className="small" style={{ margin: 0 }}>
        {owner}, {longDay(task.date).toLowerCase()}, {cat ? `${cat.name}, ` : ''}{goal.minutes} min, {rewardLabel(goal.minutes)}
        {goal.recurring ? ', chaque semaine' : ''}
        {done && task.done_by ? `. Fait par ${nameOf(task.done_by)}.` : ''}
      </p>
      {!done && blocked && (
        <p className="small" style={{ margin: 0, fontWeight: 700 }}>Bloqué : déjà reporté {MAX_POSTPONED} fois, il doit être fait.</p>
      )}
      {!done && !blocked && postponed > 0 && (
        <p className="small" style={{ margin: 0 }}>Reporté {postponed} fois sur {MAX_POSTPONED}. Au {MAX_POSTPONED}e report, il est bloqué et doit être fait.</p>
      )}

      {mine ? (
        <>
          {!done && task.date <= today && (
            <button type="button" className="btn primary block" onClick={() => { unlockAudio(); onFocus(startFocus(task.id, goal.minutes)) }}>
              Lancer le minuteur, {goal.minutes} min
            </button>
          )}
          {!done && !blocked && (
            <div className="card pad stack">
              <span className="h2" style={{ fontSize: 15 }}>Déplacer</span>
              <div className="wrap">
                {task.date !== today && (
                  <button type="button" className="btn small" onClick={async () => { if (await actions.move(task, today, 'Déplacé à aujourd’hui')) onClose() }}>Aujourd’hui</button>
                )}
                <button type="button" className="btn small" onClick={async () => { if (await actions.move(task, addDays(task.date < today ? today : task.date, 1), 'Reporté au lendemain')) onClose() }}>Au lendemain</button>
              </div>
              <div className="field">
                <label htmlFor="move-date">Ou un autre jour</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input id="move-date" className="input" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
                  <button type="button" className="btn" disabled={!date || date === task.date} onClick={async () => { if (await actions.move(task, date)) onClose() }}>OK</button>
                </div>
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="goal-title-edit">Nom de l’objectif</label>
            <input id="goal-title-edit" className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="goal-minutes-edit">Durée (minutes)</label>
            <input id="goal-minutes-edit" className="input" type="number" inputMode="numeric" min={1} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            <span className="small">
              {Number(minutes) >= 1 && Number(minutes) <= 600 ? `${rewardLabel(Math.round(Number(minutes)))}${done ? ' : l’XP et les pièces déjà gagnées ne changent pas.' : ''}` : 'Entre 1 et 600 minutes'}
              {goal.recurring ? ' Vaut pour tous les jours de cet objectif.' : ''}
            </span>
          </div>
          <div className="field">
            {!pastOneShot && (
              <>
                <span className="label" id="edit-days-label">Quels jours</span>
                <div className="weekday-picker" role="group" aria-labelledby="edit-days-label">
                  {DAY_LETTERS.map((l, i) => (
                    <button key={i} type="button" aria-pressed={days.includes(i + 1)} aria-label={DAY_NAMES[i]} onClick={() => toggleDay(i + 1)}>{l}</button>
                  ))}
                </div>
              </>
            )}
            <Switch checked={recurring} onChange={setRecurring} label="Répéter chaque semaine" />
            {scheduleChanged && (
              <span className="small">
                {scheduleOk ? 'Vaut à partir d’aujourd’hui : l’historique et ce qui est déjà fait ne changent pas. Un sous-objectif bloqué reste.' : 'Choisis au moins un jour'}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="goal-note-edit">Note de l’objectif</label>
            <textarea id="goal-note-edit" className="textarea" value={goalNote} maxLength={1000} onChange={(e) => setGoalNote(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="task-note-edit">Note pour ce jour</label>
            <textarea id="task-note-edit" className="textarea" value={taskNote} maxLength={1000} onChange={(e) => setTaskNote(e.target.value)} />
          </div>
          <button type="button" className="btn primary block" disabled={!minutesOk || (scheduleChanged && !scheduleOk)} onClick={save}>Enregistrer</button>

          {!done && (
            <div className="wrap">
              {!blocked && <button type="button" className="btn small" onClick={skip}>Retirer ce jour</button>}
              {(goal.owner_id === null || goal.owner_id === userId) && !confirmStop && (
                <button type="button" className="btn small danger" onClick={() => setConfirmStop(true)}>Arrêter l’objectif</button>
              )}
            </div>
          )}
          {confirmStop && (
            <div className="card pad cream stack">
              <span style={{ fontSize: 14, fontWeight: 700 }}>
                Arrêter « {goal.title} » ? Les jours à venir disparaissent, l’XP déjà gagnée reste.
              </span>
              <div className="wrap">
                <button type="button" className="btn small dark" onClick={stop}>Oui, arrêter</button>
                <button type="button" className="btn small" onClick={() => setConfirmStop(false)}>Non</button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {(goal.note || task.note) && (
            <div className="card pad">
              {goal.note && <p style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap' }}>{goal.note}</p>}
              {task.note && <p style={{ margin: goal.note ? '8px 0 0' : 0, fontSize: 14, whiteSpace: 'pre-wrap' }}>{task.note}</p>}
            </div>
          )}
          <button type="button" className="btn primary block" onClick={() => onEncourage(task)}>Encourager {nameOf(task.owner_id)}</button>
        </>
      )}
    </Sheet>
  )
}
