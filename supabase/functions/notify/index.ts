// Happy Fish : envoi des notifications (fonction Supabase, Deno)
// Appelée par la base (nouveau petit mot, objectif coché, tâche horaire)
// avec l'en-tête x-hook-secret, ou par l'app pour une notification de test.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const APP_URL = 'https://happy-fish-orcin.vercel.app'
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Profile = {
  id: string
  couple_id: string | null
  display_name: string
  partner_nickname: string | null
  notify_messages: boolean
  notify_gestures: boolean
  notify_checks: boolean
  notify_evening: boolean
  notify_weekly: boolean
  notify_visitors?: boolean
}

let config: Record<string, string> | null = null
async function loadConfig() {
  if (config) return config
  const { data, error } = await db.rpc('push_config')
  if (error) throw error
  config = data as Record<string, string>
  webpush.setVapidDetails(APP_URL, config.hf_vapid_public, config.hf_vapid_private)
  return config
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

/** Date, heure et jour de la semaine à Paris */
function parisNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekday: parts.weekday as string }
}

function addDays(d: string, n: number) {
  const x = new Date(`${d}T12:00:00Z`)
  x.setUTCDate(x.getUTCDate() + n)
  return x.toISOString().slice(0, 10)
}

async function profilesOf(coupleId: string): Promise<Profile[]> {
  const { data } = await db.from('profiles').select('*').eq('couple_id', coupleId)
  return (data ?? []) as Profile[]
}

/** Nom de l'autre, tel que le destinataire l'a surnommé */
function nameFor(recipient: Profile, other: Profile | undefined) {
  return recipient.partner_nickname || other?.display_name || 'Ton duo'
}

async function send(profileId: string, title: string, body: string, url = '/') {
  const { data: subs } = await db.from('push_subscriptions').select('*').eq('profile_id', profileId)
  let sent = 0
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title, body, url }),
        { TTL: 6 * 3600, urgency: 'normal' },
      )
      sent++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('id', s.id)
      else console.error('envoi refusé', status, (e as Error).message)
    }
  }
  return sent
}

/** Vrai la première fois seulement (évite les doublons de rappels) */
async function firstTime(profileId: string, kind: string, ref: string) {
  const { error } = await db.from('notifications_log').insert({ profile_id: profileId, kind, ref })
  return !error
}

async function onMessage(id: string) {
  const { data: msg } = await db.from('messages').select('*').eq('id', id).single()
  if (!msg) return
  const people = await profilesOf(msg.couple_id)
  const author = people.find((p) => p.id === msg.author_id)
  for (const r of people.filter((p) => p.id !== msg.author_id)) {
    if (msg.kind === 'text' && !r.notify_messages) continue
    if (msg.kind !== 'text' && !r.notify_gestures) continue
    const name = nameFor(r, author)
    const body = msg.kind === 'text'
      ? String(msg.body || '').slice(0, 160)
      : msg.kind === 'treat'
        ? 't’a envoyé une friandise : +1 XP pour ton poisson'
        : 't’a envoyé une bulle'
    await send(r.id, name, body, '/?tab=chat')
  }
}

async function onCheck(id: string) {
  const { data: task } = await db.from('tasks').select('*, goals(title)').eq('id', id).single()
  if (!task || !task.done_by) return
  const people = await profilesOf(task.couple_id)
  const actor = people.find((p) => p.id === task.done_by)
  const title = (task.goals as { title: string } | null)?.title || 'un objectif'
  for (const r of people.filter((p) => p.id !== task.done_by && p.notify_checks)) {
    await send(r.id, nameFor(r, actor), `a coché « ${title} »`)
  }
}

/** Un visiteur est arrivé : à celui qui l'a trouvé, ou aux deux pour un visiteur à deux */
async function onVisitor(id: string) {
  const { data: f } = await db.from('visitor_found').select('*, visitors(arrival, scope)').eq('id', id).single()
  if (!f) return
  const v = f.visitors as { arrival: string; scope: string } | null
  if (!v) return
  const people = await profilesOf(f.couple_id)
  const to = (f.profile_id ? people.filter((p) => p.id === f.profile_id) : people).filter((p) => p.notify_visitors !== false)
  const body = f.profile_id
    ? `Grâce à tes efforts. +${f.reward} pièces pour toi.`
    : `Grâce à vous deux. +${f.reward} pièces dans la cagnotte.`
  for (const r of to) await send(r.id, `${v.arrival} !`, body, '/?tab=aquarium')
}

async function onTick() {
  const now = parisNow()
  let count = 0

  if (now.hour === 20) {
    const { data: people } = await db.from('profiles').select('*').eq('notify_evening', true).not('couple_id', 'is', null)
    for (const r of (people ?? []) as Profile[]) {
      const { data: left } = await db.from('tasks').select('id, owner_id')
        .eq('couple_id', r.couple_id!).eq('date', now.date).eq('skipped', false).is('done_at', null)
      const mine = (left ?? []).filter((t) => t.owner_id === r.id || t.owner_id === null).length
      if (mine > 0 && await firstTime(r.id, 'evening', now.date)) {
        count += await send(r.id, 'Happy Fish', mine === 1
          ? 'Il te reste 1 sous-objectif aujourd’hui. Ton poisson compte sur toi !'
          : `Il te reste ${mine} sous-objectifs aujourd’hui. Ton poisson compte sur toi !`)
      }
    }
  }

  if (now.weekday === 'Mon' && now.hour === 8) {
    const lastWeek = addDays(now.date, -7)
    const { data: couples } = await db.from('couples').select('id')
    for (const c of couples ?? []) {
      await db.rpc('compute_reviews', { p_couple: c.id, p_week: lastWeek })
      const people = await profilesOf(c.id)
      const { data: reviews } = await db.from('weekly_reviews').select('*').eq('couple_id', c.id).eq('week_start', lastWeek)
      for (const r of people.filter((p) => p.notify_weekly)) {
        const mine = reviews?.find((x) => x.profile_id === r.id)
        if (!mine || !(await firstTime(r.id, 'weekly', lastWeek))) continue
        const other = people.find((p) => p.id !== r.id)
        const theirs = reviews?.find((x) => x.profile_id === other?.id)
        let body = `${mine.done} sous-objectif${mine.done > 1 ? 's' : ''} faits, ${mine.xp} XP gagnés.`
        if (mine.surprise_due) body += ` Tu dois une surprise à ${nameFor(r, other)}.`
        else if (theirs?.surprise_due) body += ` ${nameFor(r, other)} te doit une surprise !`
        count += await send(r.id, 'Le bilan de ta semaine', body)
      }
    }
  }
  return count
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const cfg = await loadConfig()
    const payload = await req.json().catch(() => ({}))

    // Appels de la base
    if (req.headers.get('x-hook-secret') === cfg.hf_hook_secret && cfg.hf_hook_secret) {
      if (payload.type === 'message') await onMessage(payload.id)
      else if (payload.type === 'check') await onCheck(payload.id)
      else if (payload.type === 'visitor') await onVisitor(payload.id)
      else if (payload.type === 'tick') return json({ sent: await onTick() })
      return json({ ok: true })
    }

    // Notification de test demandée depuis l'app, par l'utilisateur connecté
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (payload.type === 'test' && token) {
      const { data } = await db.auth.getUser(token)
      if (!data.user) return json({ error: 'Non connecté' }, 401)
      const sent = await send(data.user.id, 'Happy Fish', 'Les notifications marchent sur cet appareil !')
      return json({ sent })
    }
    return json({ error: 'Non autorisé' }, 401)
  } catch (e) {
    console.error(e)
    return json({ error: (e as Error).message }, 500)
  }
})
