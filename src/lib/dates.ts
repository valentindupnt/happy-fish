// Dates au format AAAA-MM-JJ, toujours à l'heure de Paris
const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export function todayParis(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date())
}

function parse(d: string): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day))
}

function fmt(dt: Date): string {
  return dt.toISOString().slice(0, 10)
}

export function addDays(d: string, n: number): string {
  const x = parse(d)
  x.setUTCDate(x.getUTCDate() + n)
  return fmt(x)
}

/** 1 = lundi … 7 = dimanche */
export function isoDow(d: string): number {
  const w = parse(d).getUTCDay()
  return w === 0 ? 7 : w
}

export function weekStart(d: string): string {
  return addDays(d, 1 - isoDow(d))
}

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function dayNumber(d: string): number {
  return parse(d).getUTCDate()
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** « Mardi 3 novembre » */
export function longDay(d: string): string {
  const x = parse(d)
  return `${cap(DAYS[isoDow(d) - 1])} ${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]}`
}

/** « Mardi 3 » */
export function shortDay(d: string): string {
  return `${cap(DAYS[isoDow(d) - 1])} ${dayNumber(d)}`
}

export function dayName(d: string): string {
  return DAYS[isoDow(d) - 1]
}

/** « Du 2 au 8 novembre » */
export function weekLabel(start: string): string {
  const end = addDays(start, 6)
  const a = parse(start)
  const b = parse(end)
  if (a.getUTCMonth() === b.getUTCMonth()) return `Du ${a.getUTCDate()} au ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`
  return `Du ${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]} au ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`
}

export function monthLabel(d: string): string {
  const x = parse(d)
  return `${cap(MONTHS[x.getUTCMonth()])} ${x.getUTCFullYear()}`
}

export function monthStart(d: string): string {
  return d.slice(0, 8) + '01'
}

export function addMonths(d: string, n: number): string {
  const x = parse(monthStart(d))
  x.setUTCMonth(x.getUTCMonth() + n)
  return fmt(x)
}

export function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export function dateOfTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(iso))
}
