import { missedThisWeek, tasksOfDay } from './tasks'
import type { Task } from './types'

export type Mood = 'happy' | 'sad' | 'sleep' | 'normal' | 'think'

export function parisHour(d = new Date()): number {
  const part = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Paris' })
    .formatToParts(d).find((x) => x.type === 'hour')
  const h = Number(part?.value)
  return Number.isFinite(h) ? h % 24 : 12
}

/** Humeur du poisson : il dort la nuit, danse quand la journée est complète, boude s'il y a des ratés */
export function moodOf(tasks: Task[], today: string, owner: string | undefined, hour = parisHour()): Mood {
  if (!owner) return 'normal'
  if (hour >= 22 || hour < 7) return 'sleep'
  const day = tasksOfDay(tasks, today, owner)
  if (day.length > 0 && day.every((t) => t.done_at)) return 'happy'
  if (missedThisWeek(tasks, today, owner) >= 2) return 'sad'
  return 'normal'
}

export const MOOD_LABEL: Record<Mood, string> = {
  happy: 'danse de joie',
  sad: 'boude un peu',
  sleep: 'dort',
  normal: 'nage tranquille',
  think: 'réfléchit',
}
