import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { addDays } from '../lib/dates'
import { xpForMinutes } from '../lib/xp'
import { canAct } from '../lib/tasks'
import type { Task } from '../lib/types'
import { CheckMark } from './ui'

export function useTaskActions() {
  const store = useStore()
  const { run, reloadTasks, reload, today } = store
  return {
    toggle: async (task: Task) => {
      const ok = await run(() => supabase.rpc('toggle_task', { p_task: task.id }))
      if (ok) await Promise.all([reloadTasks(), reload(['fish'])])
      return ok
    },
    move: async (task: Task, date: string, label?: string) => {
      const ok = await run(() => supabase.rpc('move_task', { p_task: task.id, p_date: date }), label || 'Déplacé')
      if (ok) await Promise.all([reloadTasks(), reload(['fish'])])
      return ok
    },
    tomorrow: addDays(today, 1),
  }
}

export function TaskRow({ task, onOpen, showOwner }: { task: Task; onOpen: (t: Task) => void; showOwner?: boolean }) {
  const { userId, today, goalOf, categoryOf, nameOf } = useStore()
  const actions = useTaskActions()
  const [pop, setPop] = useState(false)
  const goal = goalOf(task.goal_id)
  if (!goal) return null
  const cat = categoryOf(goal.category_id)
  const mine = canAct(task, userId)
  const done = Boolean(task.done_at)
  const future = task.date > today
  const details = [cat?.name, `${goal.minutes} min`, goal.recurring ? 'chaque semaine' : null, task.note || goal.note ? 'une note' : null]
    .filter(Boolean)
    .join(', ')

  const onCheck = async () => {
    if (!mine) return onOpen(task)
    if (future && !done) return onOpen(task)
    setPop(true)
    setTimeout(() => setPop(false), 400)
    await actions.toggle(task)
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
        <span className="task-title">{goal.title}</span>
        <span className="small">
          {details}
          {showOwner && task.owner_id === null && ', commun'}
          {done && task.done_by && task.owner_id === null && `, coché par ${nameOf(task.done_by)}`}
        </span>
      </button>
      {done ? (
        <span className="chip green">+{xpForMinutes(goal.minutes)} XP</span>
      ) : mine && !future ? (
        <button type="button" className="btn small" onClick={() => actions.move(task, actions.tomorrow, 'Reporté à demain')}>Reporter</button>
      ) : (
        <span className="chip cream">+{xpForMinutes(goal.minutes)} XP</span>
      )}
    </li>
  )
}
