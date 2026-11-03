import { createClient } from '@supabase/supabase-js'

const env = import.meta.env as Record<string, string | undefined>

// En local : VITE_… ; sur Vercel : variables créées par l'intégration Supabase
const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const key =
  env.VITE_SUPABASE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY

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
