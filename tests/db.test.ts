// Tests des règles de la base, sans Supabase : Postgres embarqué (PGlite)
// avec un faux schéma "auth" qui imite celui de Supabase.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
const seed = readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8')

const AUTH_STUB = `
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key, email text);
  create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  end $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`

const VAL = '00000000-0000-0000-0000-00000000000a'
const JULIE = '00000000-0000-0000-0000-00000000000b'
const OTHER = '00000000-0000-0000-0000-00000000000c'
const INTRUDER = '00000000-0000-0000-0000-00000000000d'

let db: PGlite

async function as<T>(user: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user}', false); set role authenticated;`)
  try {
    const res = await db.query<T>(sql, params)
    return res.rows
  } finally {
    await db.exec(`reset role;`)
  }
}

async function admin<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`reset role;`)
  return (await db.query<T>(sql, params)).rows
}

async function xpOf(user: string): Promise<number> {
  const rows = await admin<{ xp: number }>(`select coalesce(sum(amount), 0)::int as xp from public.xp_events where profile_id = $1`, [user])
  return rows[0].xp
}

async function today(): Promise<string> {
  const rows = await admin<{ d: string }>(`select public.today_paris()::text as d`)
  return rows[0].d
}

describe('Happy Fish, règles de la base', () => {
  let code = ''

  beforeAll(async () => {
    db = new PGlite()
    await db.exec(AUTH_STUB)
    await db.exec(schema)
    await db.exec(seed)
    await admin(`insert into auth.users (id, email) values
      ('${VAL}', 'val@test.fr'), ('${JULIE}', 'julie@test.fr'),
      ('${OTHER}', 'autre@test.fr'), ('${INTRUDER}', 'intrus@test.fr')`)
  })

  it('crée un profil à chaque inscription', async () => {
    const rows = await admin<{ n: number }>(`select count(*)::int as n from public.profiles`)
    expect(rows[0].n).toBe(4)
  })

  it('crée un duo, copie catégories, suggestions et messages de force', async () => {
    const rows = await as<{ code: string }>(VAL, `select public.create_couple('Valentin') as code`)
    code = rows[0].code
    expect(code).toMatch(/^[0-9A-F]{6}$/)
    const cats = await as<{ n: number }>(VAL, `select count(*)::int as n from public.categories`)
    expect(cats[0].n).toBe(7)
    const sugg = await as<{ n: number }>(VAL, `select count(*)::int as n from public.suggestions`)
    expect(sugg[0].n).toBe(19)
    const force = await as<{ n: number }>(VAL, `select count(*)::int as n from public.force_messages`)
    expect(force[0].n).toBe(3)
  })

  it('Julie rejoint le duo avec le code, un troisième ne peut pas', async () => {
    await as(JULIE, `select public.join_couple($1, 'Julie')`, [code.toLowerCase()])
    const me = await as<{ fish_color: string }>(JULIE, `select fish_color from public.profiles where id = auth.uid()`)
    expect(me[0].fish_color).toBe('rose')
    await expect(as(INTRUDER, `select public.join_couple($1, 'Intrus')`, [code])).rejects.toThrow(/complet/)
  })

  it('un objectif quotidien créé aujourd’hui ne crée pas de jours déjà passés', async () => {
    const d = await today()
    await as(VAL, `select public.create_goal('Lire 20 minutes', 20, array[1,2,3,4,5,6,7], true, $1::date)`, [d])
    const rows = await as<{ min: string; n: number }>(VAL,
      `select min(t.date)::text as min, count(*)::int as n from public.tasks t join public.goals g on g.id = t.goal_id where g.title = 'Lire 20 minutes'`)
    expect(rows[0].min).toBe(d)
    const isodow = await admin<{ n: number }>(`select extract(isodow from public.today_paris())::int as n`)
    expect(rows[0].n).toBe(8 - isodow[0].n)
  })

  it('ensure_week ne crée pas de doublons et prépare la semaine suivante', async () => {
    const d = await today()
    await as(VAL, `select public.ensure_week($1::date)`, [d])
    await as(VAL, `select public.ensure_week($1::date + 7)`, [d])
    await as(VAL, `select public.ensure_week($1::date + 7)`, [d])
    const rows = await as<{ n: number }>(VAL,
      `select count(*)::int as n from public.tasks where date between public.week_start($1::date + 7) and public.week_start($1::date + 7) + 6`, [d])
    expect(rows[0].n).toBe(7)
  })

  it('cocher donne l’XP selon le temps, plus le bonus journée, et décocher la retire', async () => {
    const d = await today()
    const [task] = await as<{ id: string }>(VAL, `select id from public.tasks where date = $1::date and owner_id = auth.uid()`, [d])
    await as(VAL, `select public.toggle_task($1)`, [task.id])
    // 20 min = 4 XP, seul sous-objectif du jour donc journée complète = +5
    expect(await xpOf(VAL)).toBe(9)
    await as(VAL, `select public.toggle_task($1)`, [task.id])
    expect(await xpOf(VAL)).toBe(0)
  })

  it('le temps est plafonné à 24 XP (2 h)', async () => {
    const rows = await admin<{ a: number; b: number; c: number }>(
      `select public.xp_for_minutes(3) as a, public.xp_for_minutes(45) as b, public.xp_for_minutes(400) as c`)
    expect(rows[0]).toEqual({ a: 1, b: 9, c: 24 })
  })

  it('un objectif commun donne l’XP aux deux', async () => {
    const d = await today()
    const isodow = (await admin<{ n: number }>(`select extract(isodow from public.today_paris())::int as n`))[0].n
    await as(JULIE, `select public.create_goal('Dîner ensemble', 60, array[$2::int], false, $1::date, null, null, true)`, [d, isodow])
    const [task] = await as<{ id: string }>(JULIE,
      `select t.id from public.tasks t join public.goals g on g.id = t.goal_id where g.title = 'Dîner ensemble'`)
    const before = await xpOf(VAL)
    await as(JULIE, `select public.toggle_task($1)`, [task.id])
    expect(await xpOf(JULIE)).toBeGreaterThanOrEqual(12)
    expect((await xpOf(VAL)) - before).toBe(12)
  })

  it('on ne coche pas un objectif perso de l’autre', async () => {
    const d = await today()
    const [task] = await as<{ id: string }>(VAL, `select id from public.tasks where date = $1::date and owner_id = auth.uid()`, [d])
    await expect(as(JULIE, `select public.toggle_task($1)`, [task.id])).rejects.toThrow(/que tes objectifs/)
  })

  it('on ne coche pas un jour à venir, et on ne reporte pas dans le passé', async () => {
    const d = await today()
    const [future] = await as<{ id: string }>(VAL, `select id from public.tasks where date > $1::date and owner_id = auth.uid() limit 1`, [d])
    await expect(as(VAL, `select public.toggle_task($1)`, [future.id])).rejects.toThrow(/Pas encore/)
    await expect(as(VAL, `select public.move_task($1, $2::date - 1)`, [future.id, d])).rejects.toThrow(/aujourd/)
    await as(VAL, `select public.move_task($1, $2::date)`, [future.id, d])
    const [moved] = await as<{ date: string }>(VAL, `select date::text from public.tasks where id = $1`, [future.id])
    expect(moved.date).toBe(d)
  })

  it('on ne modifie pas la coche ou l’XP en direct', async () => {
    const d = await today()
    await expect(as(VAL, `update public.tasks set done_at = now() where date = $1::date`, [d])).rejects.toThrow(/permission/)
    await expect(as(VAL, `insert into public.xp_events (profile_id, amount, reason) values (auth.uid(), 999, 'task')`)).rejects.toThrow(/permission/)
    await expect(as(VAL, `insert into public.messages (couple_id, author_id, kind) values (public.my_couple(), auth.uid(), 'treat')`)).rejects.toThrow()
  })

  it('friandise : +2 XP pour l’autre, 3 par jour au maximum', async () => {
    const before = await xpOf(JULIE)
    await as(VAL, `select public.send_treat()`)
    await as(VAL, `select public.send_treat()`)
    await as(VAL, `select public.send_treat()`)
    expect((await xpOf(JULIE)) - before).toBe(6)
    await expect(as(VAL, `select public.send_treat()`)).rejects.toThrow(/demain/)
  })

  it('les petits mots texte et bulle passent, et l’autre les lit', async () => {
    await as(VAL, `insert into public.messages (couple_id, author_id, kind, body) values (public.my_couple(), auth.uid(), 'text', 'Courage')`)
    await as(VAL, `insert into public.messages (couple_id, author_id, kind) values (public.my_couple(), auth.uid(), 'bubble')`)
    const rows = await as<{ n: number }>(JULIE, `select count(*)::int as n from public.messages`)
    expect(rows[0].n).toBe(5)
  })

  it('un autre duo ne voit rien du nôtre', async () => {
    await as(OTHER, `select public.create_couple('Autre')`)
    const seen = await as<{ n: number }>(OTHER,
      `select (select count(*) from public.tasks) + (select count(*) from public.messages) + (select count(*) from public.goals)
        + (select count(*) from public.profiles where id <> auth.uid()) + (select count(*) from public.xp_events) as n`)
    expect(Number(seen[0].n)).toBe(0)
    const [task] = await as<{ id: string }>(VAL, `select id from public.tasks limit 1`)
    await expect(as(OTHER, `select public.toggle_task($1)`, [task.id])).rejects.toThrow(/introuvable/)
  })

  it('sans grand aquarium, le poisson reste au niveau 6 et garde l’XP en réserve', async () => {
    await admin(`insert into public.xp_events (profile_id, amount, reason) values ($1, 2000, 'treat')`, [VAL])
    const [fish] = await as<{ level: number; level_uncapped: number }>(VAL,
      `select level, level_uncapped from public.fish_status where profile_id = auth.uid()`)
    expect(fish.level).toBe(6)
    expect(fish.level_uncapped).toBeGreaterThan(6)
    await admin(`update public.couples set aquarium_bought = true where id = (select couple_id from public.profiles where id = $1)`, [VAL])
    const [after] = await as<{ level: number }>(VAL, `select level from public.fish_status where profile_id = auth.uid()`)
    expect(after.level).toBe(fish.level_uncapped)
  })

  it('les paliers de niveau suivent le barème du cadrage', async () => {
    const rows = await admin<{ l1: number; l2: number; l4: number; l7: number; l13: number }>(
      `select public.xp_to_reach(1) as l1, public.xp_to_reach(2) as l2, public.xp_to_reach(4) as l4,
              public.xp_to_reach(7) as l7, public.xp_to_reach(13) as l13`)
    expect(rows[0]).toEqual({ l1: 0, l2: 60, l4: 270, l7: 810, l13: 2700 })
  })

  it('arrêter un objectif garde l’XP gagnée et retire les occurrences à venir', async () => {
    const [goal] = await as<{ id: string }>(VAL, `select id from public.goals where title = 'Lire 20 minutes'`)
    const before = await xpOf(VAL)
    await as(VAL, `select public.archive_goal($1)`, [goal.id])
    const rows = await as<{ n: number }>(VAL,
      `select count(*)::int as n from public.tasks where goal_id = $1 and done_at is null`, [goal.id])
    expect(rows[0].n).toBe(0)
    expect(await xpOf(VAL)).toBe(before)
  })
})
