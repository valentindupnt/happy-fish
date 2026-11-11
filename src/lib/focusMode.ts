// Mode Focus du minuteur (étape F1) : règles pures, sans écran ni réseau.
// Le Focus vit dans le téléphone, comme le minuteur : aucune migration.

export type TimerMode = 'classic' | 'focus'

/** Ce que contient la bulle de pensée du poisson */
export type ThinkBubble = 'dots' | 'gear' | 'bulb'

/** Seuils de la bulle, en part du temps écoulé : « … » avant 50 %, engrenage de 50 à 90 %, ampoule ensuite */
export const GEAR_FROM = 0.5
export const BULB_FROM = 0.9

/** Bulle de pensée selon l'avancement (0 = début, 1 = fin) */
export function thinkBubble(ratio: number): ThinkBubble {
  const r = Number.isFinite(ratio) ? ratio : 0
  if (r >= BULB_FROM) return 'bulb'
  if (r >= GEAR_FROM) return 'gear'
  return 'dots'
}

/** Un minuteur enregistré avant le mode Focus n'a pas de mode : c'est le minuteur classique */
export function modeOf(f: { mode?: TimerMode } | null | undefined): TimerMode {
  return f?.mode === 'focus' ? 'focus' : 'classic'
}

/** Avancement d'un minuteur, entre 0 et 1 */
export function progressOf(left: number, total: number): number {
  if (!(total > 0)) return 0
  return Math.min(1, Math.max(0, 1 - left / total))
}

// Allers-retours du poisson entre son bureau et le reste du bocal.
// Tout se calcule à partir du temps écoulé (jamais avec un compteur) : le minuteur reprend au bon endroit après une fermeture de l'app.
export const DESK_MS = 150_000    // au bureau : 2 min 30
export const STROLL_MS = 90_000   // balade : 1 min 30
export const STROLL_STEP_MS = 15_000 // pendant la balade, le poisson change de coin toutes les 15 s

/** Coins du bocal visités pendant une balade, en part de la largeur et de la hauteur de l'écran */
export const WAYPOINTS: ReadonlyArray<readonly [number, number]> = [
  [0.2, 0.42], [0.78, 0.55], [0.3, 0.72], [0.7, 0.36], [0.15, 0.6], [0.55, 0.78], [0.85, 0.7],
]
/** Place du poisson quand il est au bureau (part de la largeur) */
export const DESK_X = 0.72

export type FishSpot = { at: 'desk' } | { at: 'swim'; x: number; y: number; step: number }

/** Où est le poisson ? Au bureau au début, entre deux balades, et dans les 10 derniers % du minuteur. */
export function fishSpot(elapsedMs: number, totalMs: number): FishSpot {
  const e = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0
  if (progressOf(totalMs - e, totalMs) >= BULB_FROM) return { at: 'desk' }
  const cycle = DESK_MS + STROLL_MS
  const into = e % cycle
  if (into < DESK_MS) return { at: 'desk' }
  const n = Math.floor(e / cycle)
  const step = Math.floor((into - DESK_MS) / STROLL_STEP_MS)
  const [x, y] = WAYPOINTS[(n * 5 + step * 3 + 1) % WAYPOINTS.length]
  return { at: 'swim', x, y, step }
}

// Dessins de la bulle, en pixels (une lettre = une couleur) : o contour, w fond, g engrenage, y ampoule, h reflet
export const BUBBLE_ART: Record<ThinkBubble, string[]> = {
  dots: [
    '.........',
    '.........',
    'oo.oo.oo.',
    'oo.oo.oo.',
    '.........',
  ],
  gear: [
    '....g....',
    '.g.ggg.g.',
    '..ggggg..',
    '.gg...gg.',
    'ggg...ggg',
    '.gg...gg.',
    '..ggggg..',
    '.g.ggg.g.',
    '....g....',
  ],
  bulb: [
    '..yyyyy..',
    '.yhhyyyy.',
    '.yhyyyyy.',
    '.yyyyyyy.',
    '..yyyyy..',
    '...ooo...',
    '...ooo...',
  ],
}
