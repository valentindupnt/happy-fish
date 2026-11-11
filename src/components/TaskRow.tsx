import { useState } from 'react'
import type React from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { addDays } from '../lib/dates'
import { rewardLabel } from '../lib/xp'
import { canAct, isBlocked, tasksOfDay } from '../lib/tasks'
import { burstFrom, celebrate } from '../lib/fx'
import type { Task } from '../lib/types'
import { CheckMark, Flame } from './ui'

function Clock() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  )
}

export function useTaskActions() {
  const store = useStore()
  const { run, reloadTasks, reload, today, queueToggle } = store
  return {
    toggle: async (task: Task) => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        queueToggle(task)
        return true
      }
      const ok = await run(() => supabase.rpc('toggle_task', { p_task: task.id }))
      if (ok) await Promise.all([reloadTasks(), reload(['fish', 'streaks'])])
      return ok
    },
    move: async (task: Task, date: string, label?: string) => {
      const ok = await run(() => supabase.rpc('move_task', { p_task: task.id, p_date: date }), label || 'Déplacé')
      if (ok) await Promise.all([reloadTasks(), reload(['fish', 'streaks'])])
      return ok
    },
    tomorrow: addDays(today, 1),
  }
}

export function TaskRow({ task, onOpen, showOwner }: { task: Task; onOpen: (t: Task) => void; showOwner?: boolean }) {
  const { userId, today, goalOf, categoryOf, nameOf, tasks, streaks } = useStore()
  const actions = useTaskActions()
  const [pop, setPop] = useState(false)
  const goal = goalOf(task.goal_id)
  if (!goal) return null
  const cat = categoryOf(goal.category_id)
  const mine = canAct(task, userId)
  const done = Boolean(task.done_at)
  const blocked = isBlocked(task)
  const future = task.date > today
  const streak = goal.recurring ? streaks.find((x) => x.goal_id === goal.id)?.current_streak ?? 0 : 0
  const reports = Math.min(task.postponed ?? 0, 2)
  const details = [cat?.name, `${goal.minutes} min`, goal.recurring ? 'chaque semaine' : null, reports ? `reporté ${reports} fois` : null, blocked ? 'bloqué, à faire' : null, task.note || goal.note ? 'une note' : null]
    .filter(Boolean)
    .join(', ')

  const onCheck = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!mine) return onOpen(task)
    if (future && !done) return onOpen(task)
    const btn = e.currentTarget
    setPop(true)
    setTimeout(() => setPop(false), 400)
    // La dernière coche du jour : grande pluie de bulles
    const lastOfDay = !done && task.date === today
      && tasksOfDay(tasks, today, userId).filter((t) => !t.done_at && t.id !== task.id).length === 0
    if (!done) burstFrom(btn)
    const ok = await actions.toggle(task)
    if (ok && lastOfDay) celebrate()
  }

  return (
    <li className={done ? 'task is-done' : 'task'}>
      <button
        type="button"
        className={`check${done ? ' on' : ''}${pop ? ' pop' : ''}`}
        aria-label={`${done ? 'Décocher' : 'Cocher'} ${goal.title}`}
        aria-pressed={done}
        disabled={!mine}
        onClick={onCheck}
      >
        {done && <CheckMark />}
      </button>
      <button type="button" className="task-main" onClick={() => onOpen(task)}>
        <span className="task-title">
          {goal.title}
          {reports > 0 && (
            <span className="report-clocks" aria-hidden="true">{Array.from({ length: reports }, (_, i) => <Clock key={i} />)}</span>
          )}
          {streak >= 2 && (
            <span className="streak-badge" aria-label={`série de ${streak}`}><Flame size={12} />{streak}</span>
          )}
        </span>
        <span className="small">
          {details}
          {showOwner && task.owner_id === null && ', commun'}
          {done && task.done_by && task.owner_id === null && `, coché par ${nameOf(task.done_by)}`}
        </span>
      </button>
      {done ? (
        <span className="chip green">{rewardLabel(goal.minutes)}</span>
      ) : blocked ? (
        <span className="chip cream">À faire</span>
      ) : mine && !future ? (
        <button type="button" className="btn small" onClick={() => actions.move(task, actions.tomorrow, 'Reporté à demain')}>Reporter</button>
      ) : (
        <span className="chip cream">{rewardLabel(goal.minutes)}</span>
      )}
    </li>
  )
}
