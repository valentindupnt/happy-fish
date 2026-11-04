// Happy Fish : données du widget iPhone (Scriptable)
// GET /functions/v1/widget?t=<jeton> : renvoie les poissons du duo et l'avancement du jour.
// Le jeton est personnel ; sans jeton valide, rien n'est renvoyé.
import { createClient } from 'npm:@supabase/supabase-js@2'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') return json({ error: 'Méthode non permise' }, 405)
  const token = new URL(req.url).searchParams.get('t') || ''
  if (!/^[0-9a-f]{64}$/.test(token)) return json({ error: 'Jeton invalide' }, 401)
  const { data, error } = await db.rpc('widget_data', { p_token: token })
  if (error) return json({ error: 'Erreur du serveur' }, 500)
  if (!data) return json({ error: 'Jeton inconnu, recopie le script depuis l’app' }, 401)
  return json(data)
})
