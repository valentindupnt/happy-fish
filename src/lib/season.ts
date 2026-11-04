// Saisons : décor automatique selon la date (décembre = Noël)
export type Season = 'noel' | null

export function seasonOf(today: string): Season {
  try {
    const forced = new URLSearchParams(window.location.search).get('saison')
    if (forced === 'noel') return 'noel'
  } catch { /* rien */ }
  return today.slice(5, 7) === '12' ? 'noel' : null
}

/** En décembre, un bonnet de Noël pour les poissons qui n'ont pas d'accessoire */
export function seasonalHat(hat: string | null | undefined, season: Season): string | null {
  if (hat) return hat
  return season === 'noel' ? 'noel' : null
}
