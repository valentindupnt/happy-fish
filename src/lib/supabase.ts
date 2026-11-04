import { createClient } from '@supabase/supabase-js'

const env = import.meta.env as Record<string, string | undefined>

// Projet Supabase « happy-fish ». La clé publishable est publique par nature
// (elle est livrée dans l'app) : la sécurité repose sur les règles de la base.
// Les variables d'environnement, si elles existent, ont la priorité.
const PROJECT_URL = 'https://ovdieabdnbhghkjsfzcn.supabase.co'
const PUBLISHABLE_KEY = 'sb_publishable_QPAcygMKBRtC1qHxQ_r6vw_ndE8XZhU'

export const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || PROJECT_URL
export const key =
  env.VITE_SUPABASE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  PUBLISHABLE_KEY

export const configured = Boolean(url && key)

export const supabase = createClient(url || 'https://non-configure.supabase.co', key || 'non-configure', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

/** Message d'erreur lisible, en français quand il vient de nos fonctions */
export function errorText(e: unknown): string {
  if (!e) return 'Une erreur est survenue'
  const msg = (e as { message?: string }).message || String(e)
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Pas de réseau, réessaie dans un instant'
  return msg
}
