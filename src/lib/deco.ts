// Les décorations : le catalogue (noms, prix, niveaux) vient de la base, les dessins sont dans components/Deco.tsx

export const OWN_SLOTS = 5
export const COMMON_SLOTS = 4

export type DecoPlace = 'own' | 'common'

export interface DecoSlot { profile_id: string; place: DecoPlace; slot: number; item_id: string }
export interface SeriesDef { id: string; name: string; reward: number }
export interface SeriesFound { profile_id: string; series_id: string; reward: number }
export interface Gift {
  id: string
  from_id: string
  to_id: string
  item_id: string
  price: number
  message: string | null
  created_at: string
}

/** Les emplacements d'une personne, dans l'ordre, avec des trous (null) pour les emplacements vides */
export function slotsOf(slots: DecoSlot[], profileId: string | undefined, place: DecoPlace): Array<string | null> {
  const n = place === 'own' ? OWN_SLOTS : COMMON_SLOTS
  const out: Array<string | null> = Array.from({ length: n }, () => null)
  if (!profileId) return out
  for (const s of slots) if (s.profile_id === profileId && s.place === place && s.slot >= 0 && s.slot < n) out[s.slot] = s.item_id
  return out
}

/** Les objets de saison ne s'achètent que pendant leur saison (Noël : du 1er au 25 décembre) */
export function seasonOpen(season: string | null | undefined, today: string): boolean {
  if (!season) return true
  if (season === 'noel') {
    let forced = false
    try { forced = new URLSearchParams(window.location.search).get('saison') === 'noel' } catch { /* rien */ }
    return forced || (today.slice(5, 7) === '12' && Number(today.slice(8, 10)) <= 25)
  }
  return false
}

/** Nombre de jours avant l'ouverture d'une saison, si elle est proche */
export function daysUntilSeason(season: string, today: string): number | null {
  if (season !== 'noel' || seasonOpen(season, today)) return null
  const year = Number(today.slice(0, 4))
  const target = Date.UTC(today.slice(5, 7) === '12' ? year + 1 : year, 11, 1)
  const now = Date.UTC(year, Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)))
  const days = Math.round((target - now) / 86400000)
  return days > 0 && days <= 30 ? days : null
}

export const SEASON_NAME: Record<string, string> = { noel: 'Noël' }

/** Les décorations sans collection, rangées en deux groupes */
export const LOOSE_GROUP: Record<string, 'fonds' | 'insolite'> = {
  d_galets: 'fonds', d_coquillage: 'fonds', d_algue: 'fonds', d_etoile: 'fonds',
  d_velo: 'insolite', d_parasol: 'insolite', d_eolienne: 'insolite', d_banc: 'insolite', d_plongeoir: 'insolite', d_gode: 'insolite',
}
