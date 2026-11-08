// Mêmes règles que dans la base (supabase/migrations/006_progression.sql, pièces : 016_coins_per_goal.sql)
export const STADES = ['Alevin', 'Petit', 'Juvénile', 'Moyen', 'Grand', 'Adulte', 'Majestueux', 'Ancien', 'Légendaire', 'Mythique']
export const MAX_LEVEL = 50
export const LEVELS_PER_STADE = 5

export interface Habitat { id: string; name: string; minLevel: number; price: number; cap: number; blurb: string }

/** Les 5 habitats, dans l'ordre : chacun s'achète avec la cagnotte quand les deux poissons ont le niveau requis */
export const HABITATS: Habitat[] = [
  { id: 'bocaux', name: 'Deux bocaux', minLevel: 1, price: 0, cap: 10, blurb: 'Chacun son bocal pour commencer.' },
  { id: 'aquarium', name: 'Aquarium à deux', minLevel: 8, price: 150, cap: 20, blurb: 'Vos poissons vivent enfin ensemble, et les premières décorations arrivent.' },
  { id: 'grand', name: 'Grand aquarium', minLevel: 18, price: 350, cap: 30, blurb: 'Plus de place, des rochers et une forêt d’algues.' },
  { id: 'recif', name: 'Récif', minLevel: 28, price: 500, cap: 40, blurb: 'Coraux et anémones, l’eau devient turquoise.' },
  { id: 'lagon', name: 'Lagon', minLevel: 38, price: 700, cap: 50, blurb: 'La lumière du jour, une épave, et la route vers le niveau 50.' },
]

export function habitatOf(position: number | null | undefined): Habitat {
  return HABITATS[Math.max(0, Math.min(HABITATS.length - 1, position ?? 0))]
}

/** XP cumulée pour atteindre un niveau : 30 pour le niveau 2, puis 6 de plus à chaque niveau */
export function xpToReach(level: number): number {
  return 30 * (level - 1) + 3 * (level - 1) * (level - 2)
}

export function levelFromXp(xp: number, cap = MAX_LEVEL): number {
  let n = 1
  while (n < Math.min(cap, MAX_LEVEL) && xp >= xpToReach(n + 1)) n++
  return n
}

export function xpForMinutes(minutes: number): number {
  return Math.min(24, Math.max(1, Math.floor(minutes / 5)))
}

/** Pièces d'un sous-objectif réussi selon son temps : moins de 15 min 0, 15 à 29 min 1, 30 à 45 min 2, plus de 45 min 3 (migration 016) */
export function coinsForMinutes(minutes: number): number {
  if (minutes > 45) return 3
  if (minutes >= 30) return 2
  if (minutes >= 15) return 1
  return 0
}

/** Gain d'un sous-objectif en toutes lettres : « +3 XP » ou « +3 XP, +2 pièces » */
export function rewardLabel(minutes: number): string {
  const c = coinsForMinutes(minutes)
  return `+${xpForMinutes(minutes)} XP${c > 0 ? `, +${c} pièce${c > 1 ? 's' : ''}` : ''}`
}

/** Ancien barème (1 pièce pour 5 XP), gardé pour les pièces gagnées avant la migration 016 */
export function coinsFromXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / 5)
}

export function stadeOf(level: number): number {
  return Math.min(STADES.length, Math.floor((level - 1) / LEVELS_PER_STADE) + 1)
}

export function stadeName(level: number): string {
  return STADES[stadeOf(level) - 1]
}

/** Premier niveau du stade suivant, ou null au dernier stade */
export function nextStade(level: number): { name: string; level: number } | null {
  const s = stadeOf(level)
  if (s >= STADES.length) return null
  return { name: STADES[s], level: s * LEVELS_PER_STADE + 1 }
}

/** Taille du poisson à l'écran selon son stade */
export function scaleOf(level: number): number {
  return 1 + (stadeOf(level) - 1) * 0.12
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
