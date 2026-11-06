// Effets des messages de force : un seul violet pour tous, chaque effet a sa pluie de pixels.
// Le message garde seulement l'id de l'effet (vérifié par la base, migration 014).

export type EffectId = 'pop' | 'coeurs' | 'bulles' | 'confettis'
export type Shape = 'star' | 'heart' | 'bubble' | 'square'

export interface EffectDef {
  id: EffectId
  label: string
  shape: Shape
  /** Couleurs des particules, tour à tour */
  colors: string[]
}

/** Couleur de la bulle d'un mot fort et du texte dessus */
export const FX_BG = '#7B4FD6'
export const FX_FG = '#FFFFFF'
/** Pastille claire (barre d'effets, réglages) */
export const FX_CHIP_BG = '#EDE3FF'
export const FX_CHIP_FG = '#3E1F8A'

const VIOLETS = ['#E9DEFF', '#FFFFFF', '#C3A6EE', '#A583E6']

export const EFFECTS: EffectDef[] = [
  { id: 'pop', label: 'Pop', shape: 'star', colors: VIOLETS },
  { id: 'coeurs', label: 'Cœurs', shape: 'heart', colors: VIOLETS },
  { id: 'bulles', label: 'Bulles', shape: 'bubble', colors: VIOLETS },
  { id: 'confettis', label: 'Confettis', shape: 'square', colors: VIOLETS },
]

const byId = new Map(EFFECTS.map((e) => [e.id as string, e]))
export const effectOf = (id: string | null | undefined) => (id ? byId.get(id) ?? null : null)

/** Direction (en px) de chacune des 10 particules */
export const BURST: [number, number][] = [[-70, -34], [-34, -48], [0, -54], [34, -48], [70, -34], [-80, 6], [80, 6], [-50, 30], [50, 30], [0, 40]]
