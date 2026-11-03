import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { addDays, longDay } from '../lib/dates'
import { xpForMinutes } from '../lib/xp'
import { canAct } from '../lib/tasks'
import type { Task } from '../lib/types'
import { Sheet } from './ui'
import { useTaskActions } from './TaskRow'

export function TaskSheet({ task, onClose, onEncourage }: { task: Task; onClose: () => void; onEncourage: (t: Task) => void }) {
  const { userId, today, goalOf, categoryOf, nameOf, run, reload, reloadTasks } = useStore()
  const actions = useTaskActions()
  const goal = goalOf(task.goal_id)
  const [taskNote, setTaskNote] = useState(task.note || '')
  const [goalNote, setGoalNote] = useState(goal?.note || '')
  const [title, setTitle] = useState(goal?.title || '')
  const [date, setDate] = useState(task.date < today ? today : task.date)
  const [confirmStop, setConfirmStop] = useState(false)
  if (!goal) return null

  const mine = canAct(task, userId)
  const done = Boolean(task.done_at)
  const cat = categoryOf(goal.category_id)
  const owner = task.owner_id === null ? 'Objectif commun' : task.owner_id === userId ? 'Mon objectif' : `Objectif de ${nameOf(task.owner_id)}`

  const save = async () => {
    const jobs: Array<Promise<boolean>> = []
    if (taskNote !== (task.note || '')) {
      jobs.push(run(() => supabase.from('tasks').update({ note: taskNote.trim() || null }).eq('id', task.id)))
    }
    if (title.trim() && (title !== goal.title || goalNote !== (goal.note || ''))) {
      jobs.push(run(() => supabase.from('goals').update({ title: title.trim(), note: goalNote.trim() || null }).eq('id', goal.id)))
    }
    const results = await Promise.all(jobs)
    if (results.every(Boolean)) {
      if (jobs.length) {
        await Promise.all([reloadTasks(), reload(['goals'])])
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
        {owner}, {longDay(task.date).toLowerCase()}, {cat ? `${cat.name}, ` : ''}{goal.minutes} min, +{xpForMinutes(goal.minutes)} XP
        {goal.recurring ? ', chaque semaine' : ''}
        {done && task.done_by ? `. Fait par ${nameOf(task.done_by)}.` : ''}
      </p>

      {mine ? (
        <>
          {!done && (
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
            <label htmlFor="goal-note-edit">Note de l’objectif</label>
            <textarea id="goal-note-edit" className="textarea" value={goalNote} maxLength={1000} onChange={(e) => setGoalNote(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="task-note-edit">Note pour ce jour</label>
            <textarea id="task-note-edit" className="textarea" value={taskNote} maxLength={1000} onChange={(e) => setTaskNote(e.target.value)} />
          </div>
          <button type="button" className="btn primary block" onClick={save}>Enregistrer</button>

          {!done && (
            <div className="wrap">
              <button type="button" className="btn small" onClick={skip}>Retirer ce jour</button>
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
