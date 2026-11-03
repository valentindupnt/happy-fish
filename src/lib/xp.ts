// Mêmes règles que dans la base (supabase/schema.sql)
export const STADES = ['Alevin', 'Petit', 'Moyen', 'Grand', 'Majestueux']
export const MAX_LEVEL = 15
export const LEVEL_CAP_WITHOUT_AQUARIUM = 6

export function xpToReach(level: number): number {
  return 60 * (level - 1) + 15 * (level - 1) * (level - 2)
}

export function xpForMinutes(minutes: number): number {
  return Math.min(24, Math.max(1, Math.floor(minutes / 5)))
}

export function stadeOf(level: number): number {
  return Math.floor((level - 1) / 3) + 1
}

export function stadeName(level: number): string {
  return STADES[stadeOf(level) - 1]
}

/** 10 pièces par niveau gagné, +25 à chaque nouveau stade */
export function coinsEarned(level: number): number {
  return 10 * (level - 1) + 25 * (stadeOf(level) - 1)
}

/** Avancement dans le niveau en cours */
export function levelProgress(xp: number, level: number) {
  if (level >= MAX_LEVEL) return { into: 0, needed: 0, ratio: 1 }
  const start = xpToReach(level)
  const end = xpToReach(level + 1)
  const into = Math.max(0, xp - start)
  const needed = end - start
  return { into: Math.min(into, needed), needed, ratio: Math.min(1, into / needed) }
}
