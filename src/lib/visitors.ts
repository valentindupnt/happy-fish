// Le carnet des visiteurs : même catalogue que dans la base (supabase/migrations/007_visitors.sql)
export type VisitorScope = 'perso' | 'duo'
export type VisitorFamily = 'tasks' | 'streak'

export interface Visitor {
  id: string
  name: string
  arrival: string
  scope: VisitorScope
  family: VisitorFamily
  threshold: number
  reward: number
}

export const VISITORS: Visitor[] = [
  { id: 'bernard', name: 'Bernard-l’ermite', arrival: 'Un bernard-l’ermite est arrivé', scope: 'perso', family: 'tasks', threshold: 10, reward: 5 },
  { id: 'gobie', name: 'Petit gobie', arrival: 'Un petit gobie est arrivé', scope: 'perso', family: 'tasks', threshold: 30, reward: 10 },
  { id: 'chirurgien', name: 'Poisson-chirurgien', arrival: 'Un poisson-chirurgien est arrivé', scope: 'perso', family: 'tasks', threshold: 75, reward: 15 },
  { id: 'papillon', name: 'Poisson-papillon', arrival: 'Un poisson-papillon est arrivé', scope: 'perso', family: 'tasks', threshold: 150, reward: 20 },
  { id: 'ange', name: 'Poisson-ange', arrival: 'Un poisson-ange est arrivé', scope: 'perso', family: 'tasks', threshold: 300, reward: 30 },
  { id: 'meduse', name: 'Méduse', arrival: 'Une méduse est arrivée', scope: 'perso', family: 'tasks', threshold: 500, reward: 40 },
  { id: 'lion', name: 'Poisson-lion', arrival: 'Un poisson-lion est arrivé', scope: 'perso', family: 'tasks', threshold: 800, reward: 50 },
  { id: 'calamar', name: 'Calamar', arrival: 'Un calamar est arrivé', scope: 'perso', family: 'tasks', threshold: 1200, reward: 60 },
  { id: 'nudibranche', name: 'Nudibranche', arrival: 'Un nudibranche est arrivé', scope: 'perso', family: 'streak', threshold: 3, reward: 5 },
  { id: 'globe', name: 'Poisson-globe', arrival: 'Un poisson-globe est arrivé', scope: 'perso', family: 'streak', threshold: 7, reward: 10 },
  { id: 'murene', name: 'Murène', arrival: 'Une murène est arrivée', scope: 'perso', family: 'streak', threshold: 14, reward: 20 },
  { id: 'seiche', name: 'Seiche', arrival: 'Une seiche est arrivée', scope: 'perso', family: 'streak', threshold: 30, reward: 30 },
  { id: 'espadon', name: 'Espadon', arrival: 'Un espadon est arrivé', scope: 'perso', family: 'streak', threshold: 60, reward: 50 },
  { id: 'lune', name: 'Poisson-lune', arrival: 'Un poisson-lune est arrivé', scope: 'perso', family: 'streak', threshold: 100, reward: 80 },
  { id: 'sardines', name: 'Banc de sardines', arrival: 'Un banc de sardines est arrivé', scope: 'duo', family: 'tasks', threshold: 50, reward: 15 },
  { id: 'clowns', name: 'Poissons-clowns', arrival: 'Des poissons-clowns sont arrivés', scope: 'duo', family: 'tasks', threshold: 200, reward: 30 },
  { id: 'hippocampes', name: 'Hippocampes', arrival: 'Des hippocampes sont arrivés', scope: 'duo', family: 'tasks', threshold: 500, reward: 50 },
  { id: 'tortue', name: 'Tortue', arrival: 'Une tortue est arrivée', scope: 'duo', family: 'tasks', threshold: 1000, reward: 80 },
  { id: 'dauphin', name: 'Dauphin', arrival: 'Un dauphin est arrivé', scope: 'duo', family: 'tasks', threshold: 2000, reward: 120 },
  { id: 'perroquets', name: 'Poissons-perroquets', arrival: 'Des poissons-perroquets sont arrivés', scope: 'duo', family: 'streak', threshold: 5, reward: 20 },
  { id: 'manta', name: 'Raie manta', arrival: 'Une raie manta est arrivée', scope: 'duo', family: 'streak', threshold: 21, reward: 50 },
  { id: 'requin', name: 'Requin-léopard', arrival: 'Un requin-léopard est arrivé', scope: 'duo', family: 'streak', threshold: 50, reward: 100 },
  { id: 'baleine', name: 'Baleine', arrival: 'Une baleine est arrivée', scope: 'duo', family: 'streak', threshold: 100, reward: 150 },
]

export const visitorById = (id: string) => VISITORS.find((v) => v.id === id)

export interface Gauges { tasks: number; streak_best: number; streak_now: number }
export interface VisitorBook { duo: Gauges; profiles: Record<string, Gauges> }

export const EMPTY_GAUGES: Gauges = { tasks: 0, streak_best: 0, streak_now: 0 }

export interface VisitorFound {
  id: string
  profile_id: string | null
  visitor_id: string
  reward: number
  found_at: string
}

/** Ce que la jauge compte pour une famille */
export function gaugeValue(g: Gauges, family: VisitorFamily): number {
  return family === 'tasks' ? g.tasks : g.streak_best
}

/** Condition lisible : « 30 sous-objectifs cochés », « 7 jours de série » */
export function conditionText(v: Visitor): string {
  if (v.family === 'tasks') {
    return v.scope === 'duo' ? `${v.threshold.toLocaleString('fr-FR')} sous-objectifs cochés à deux` : `${v.threshold.toLocaleString('fr-FR')} sous-objectifs cochés`
  }
  return v.scope === 'duo' ? `${v.threshold} jours de série à deux` : `${v.threshold} jours de série sur un objectif`
}

export function rewardText(v: Visitor): string {
  return v.scope === 'duo' ? `+${v.reward} pièces dans la cagnotte` : `+${v.reward} pièces`
}

/** Prochain visiteur à trouver dans une famille, avec l'avancement */
export function nextOf(scope: VisitorScope, family: VisitorFamily, g: Gauges, found: Set<string>) {
  const list = VISITORS.filter((v) => v.scope === scope && v.family === family)
  const value = gaugeValue(g, family)
  const next = list.find((v) => !found.has(v.id))
  if (!next) return { next: null, value, prev: list.at(-1)?.threshold ?? 0, ratio: 1 }
  const idx = list.indexOf(next)
  const prev = idx > 0 ? list[idx - 1].threshold : 0
  const ratio = Math.max(0, Math.min(1, (value - prev) / (next.threshold - prev)))
  return { next, value, prev, ratio }
}
