import { addDays, weekStart } from './dates'
import type { Task } from './types'

/** Sous-objectifs visibles d'une personne un jour donné (les siens et les communs) */
export function tasksOfDay(tasks: Task[], day: string, owner: string): Task[] {
  return tasks.filter((t) => t.date === day && !t.skipped && (t.owner_id === owner || t.owner_id === null))
}

export function tasksOfWeek(tasks: Task[], start: string, owner: string | null): Task[] {
  const end = addDays(start, 6)
  return tasks.filter((t) => t.date >= start && t.date <= end && !t.skipped && (owner === null ? t.owner_id === null : t.owner_id === owner || t.owner_id === null))
}

/** Ratés de la semaine en cours : jours passés, pas faits */
export function missedThisWeek(tasks: Task[], today: string, owner: string): number {
  const start = weekStart(today)
  return tasks.filter((t) => t.date >= start && t.date < today && !t.skipped && !t.done_at && (t.owner_id === owner || t.owner_id === null)).length
}

export function canAct(task: Task, me: string): boolean {
  return task.owner_id === null || task.owner_id === me
}
