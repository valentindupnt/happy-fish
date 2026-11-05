// Tests du carnet des visiteurs (migration 007)
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { createDb, JULIE, OTHER, SQL_FILES, VAL } from './helpers'
import { VISITORS } from '../src/lib/visitors'
import { VISITOR_SPRITES } from '../src/components/Visitors'

let as: Awaited<ReturnType<typeof createDb>>['as']
let admin: Awaited<ReturnType<typeof createDb>>['admin']
let today: () => Promise<string>
let couple = ''
let lonely = ''

async function goal(owner: string | null, recurring = false, c = couple): Promise<string> {
  const creator = owner ?? VAL
  const [{ id }] = await admin<{ id: string }>(
    `insert into public.goals (couple_id, owner_id, created_by, title, minutes, days, recurring, week_start, created_on)
     values ($1, $2, $3, 'Objectif', 15, '{1,2,3,4,5,6,7}', $4, public.week_start(public.today_paris()), public.today_paris() - 60) returning id`,
    [c, owner, creator, recurring])
  return id
}

/** Crée n sous-objectifs sur un objectif (jours -n..-1), puis les coche un par un (comme l'app) */
async function checkMany(g: string, owner: string | null, n: number, startOffset = 1, c = couple, user = owner ?? VAL, step = 1) {
  const t = await today()
  for (let i = 0; i < n; i++) {
    const d = -(startOffset + i * step)
    const [{ id }] = await admin<{ id: string }>(
      `insert into public.tasks (goal_id, couple_id, owner_id, planned_date, date) values ($1, $2, $3, $4::date + $5::int, $4::date + $5::int) returning id`,
      [g, c, owner, t, d])
    await as(user, `select public.toggle_task($1)`, [id])
  }
}

async function found(user: string) {
  return (await as<{ visitor_id: string; profile_id: string | null }>(user, `select visitor_id, profile_id from public.visitor_found order by found_at`))
}
async function coins(user: string): Promise<number> {
  return (await as<{ coins: number }>(user, `select coins from public.fish_status where profile_id = auth.uid()`))[0].coins
}
async function pot(user: string): Promise<number> {
  return (await as<{ p: number }>(user, `select public.get_pot() as p`))[0].p
}
async function book(user: string) {
  return (await as<{ b: { duo: Record<string, number>; profiles: Record<string, Record<string, number>> } }>(user, `select public.visitor_book() as b`))[0].b
}

describe('Happy Fish, carnet des visiteurs', () => {
  beforeAll(async () => {
    ;({ as, admin, today } = await createDb())
    await admin(`insert into auth.users (id, email) values ('${VAL}', 'v@t.fr'), ('${JULIE}', 'j@t.fr'), ('${OTHER}', 'o@t.fr')`)
    const [{ code }] = await as<{ code: string }>(VAL, `select public.create_couple('Valentin') as code`)
    await as(JULIE, `select public.join_couple($1, 'Julie')`, [code])
    await as(OTHER, `select public.create_couple('Seul')`)
    couple = (await admin<{ c: string }>(`select couple_id as c from public.profiles where id = $1`, [VAL]))[0].c
    lonely = (await admin<{ c: string }>(`select couple_id as c from public.profiles where id = $1`, [OTHER]))[0].c
  })

  it('le catalogue de la base est celui de l’app, et chaque visiteur a son dessin', async () => {
    const rows = await as<{ id: string; name: string; arrival: string; scope: string; family: string; threshold: number; reward: number }>(VAL,
      `select id, name, arrival, scope, family, threshold, reward from public.visitors order by position`)
    expect(rows).toEqual(VISITORS)
    expect(rows).toHaveLength(23)
    for (const v of VISITORS) {
      const s = VISITOR_SPRITES[v.id]
      expect(s, v.id).toBeTruthy()
      const w = s.rows[0].length
      for (const r of s.rows) expect(r.length, `${v.id} : lignes de même largeur`).toBe(w)
      for (const ch of s.rows.join('').replace(/\./g, '')) expect(s.colors[ch], `${v.id} : couleur ${ch}`).toBeTruthy()
    }
  })

  it('10 sous-objectifs cochés : le bernard-l’ermite arrive chez celui qui les a cochés, avec 5 pièces', async () => {
    const g = await goal(VAL)
    await checkMany(g, VAL, 9)
    expect(await found(VAL)).toEqual([])
    await checkMany(g, VAL, 1, 10)
    expect(await found(VAL)).toEqual([{ visitor_id: 'bernard', profile_id: VAL }])
    const [{ xp }] = await admin<{ xp: number }>(`select sum(amount)::int as xp from public.xp_events where profile_id = $1`, [VAL])
    expect(await coins(VAL)).toBe(Math.floor(xp / 5) + 5) // les pièces de l'XP, plus les 5 du visiteur
    expect((await book(JULIE)).profiles[VAL].tasks).toBe(10)
    expect((await book(JULIE)).profiles[JULIE].tasks).toBe(0)
  })

  it('décocher ne fait pas repartir un visiteur, et recocher ne le paie pas deux fois', async () => {
    const before = await coins(VAL)
    const [{ id }] = await admin<{ id: string }>(`select id from public.tasks where owner_id = $1 and done_at is not null limit 1`, [VAL])
    await as(VAL, `select public.toggle_task($1)`, [id])
    await as(VAL, `select public.toggle_task($1)`, [id])
    expect(await found(VAL)).toHaveLength(1)
    expect(await coins(VAL)).toBe(before)
  })

  it('les sous-objectifs communs comptent pour chacun et pour le duo ; 50 à deux font venir les sardines dans la cagnotte', async () => {
    const shared = await goal(null)
    await checkMany(shared, null, 10, 20, couple, JULIE, 2) // un jour sur deux : pas de série à deux
    const b = await book(VAL)
    expect(b.profiles[JULIE].tasks).toBe(10)
    expect(b.profiles[VAL].tasks).toBe(20)
    expect(b.duo.tasks).toBe(20) // 10 de Valentin + 10 communs, chacun une fois
    expect((await found(JULIE)).map((f) => f.visitor_id)).toContain('bernard')

    const potBefore = await pot(VAL)
    const mine = await goal(JULIE)
    await checkMany(mine, JULIE, 29, 40)
    expect((await found(VAL)).some((f) => f.visitor_id === 'sardines')).toBe(false)
    await checkMany(mine, JULIE, 1, 80)
    const duo = (await found(VAL)).filter((f) => f.profile_id === null)
    expect(duo.map((f) => f.visitor_id)).toEqual(['sardines'])
    expect(await pot(VAL)).toBe(potBefore + 15)
    // Julie a aussi trouvé son petit gobie (30 + 10 communs)
    expect((await found(JULIE)).filter((f) => f.profile_id === JULIE).map((f) => f.visitor_id)).toEqual(['bernard', 'gobie'])
  })

  it('séries perso : 3 jours d’affilée sur un objectif récurrent font venir le nudibranche', async () => {
    const t = await today()
    const g = await goal(VAL, true)
    const ids: string[] = []
    for (const d of [-3, -2, -1, 0]) {
      const [{ id }] = await admin<{ id: string }>(
        `insert into public.tasks (goal_id, couple_id, owner_id, planned_date, date) values ($1, $2, $3, $4::date + $5::int, $4::date + $5::int) returning id`,
        [g, couple, VAL, t, d])
      ids.push(id)
    }
    await as(VAL, `select public.toggle_task($1)`, [ids[0]])
    await as(VAL, `select public.toggle_task($1)`, [ids[1]])
    expect((await found(VAL)).some((f) => f.visitor_id === 'nudibranche')).toBe(false)
    await as(VAL, `select public.toggle_task($1)`, [ids[2]])
    expect((await found(VAL)).some((f) => f.visitor_id === 'nudibranche')).toBe(true)
    const b = await book(VAL)
    expect(b.profiles[VAL]).toMatchObject({ streak_best: 3, streak_now: 3 }) // aujourd'hui pas encore fait : la série tient
  })

  it('série à deux : 5 jours d’affilée où chacun coche font venir les poissons-perroquets', async () => {
    // Valentin a coché les jours -1 à -10 ; Julie, des communs un jour sur deux et des perso plus anciens
    // On ajoute pour Julie les jours -1 à -4 seulement : série à deux de 4
    const t = await today()
    const g = await goal(JULIE)
    for (const d of [-1, -2, -3, -4]) {
      const [{ id }] = await admin<{ id: string }>(
        `insert into public.tasks (goal_id, couple_id, owner_id, planned_date, date) values ($1, $2, $3, $4::date + $5::int, $4::date + $5::int) returning id`,
        [g, couple, JULIE, t, d])
      await as(JULIE, `select public.toggle_task($1)`, [id])
    }
    let b = await book(VAL)
    expect(b.duo).toMatchObject({ streak_best: 4, streak_now: 4 })
    expect((await found(VAL)).some((f) => f.visitor_id === 'perroquets')).toBe(false)
    const potBefore = await pot(VAL)
    const [{ id }] = await admin<{ id: string }>(
      `insert into public.tasks (goal_id, couple_id, owner_id, planned_date, date) values ($1, $2, $3, $4::date - 5, $4::date - 5) returning id`,
      [g, couple, JULIE, t])
    await as(JULIE, `select public.toggle_task($1)`, [id])
    b = await book(VAL)
    expect(b.duo.streak_best).toBe(5)
    expect((await found(JULIE)).some((f) => f.visitor_id === 'perroquets' && f.profile_id === null)).toBe(true)
    expect(await pot(VAL)).toBe(potBefore + 20)
  })

  it('seul dans son duo : des visiteurs perso, mais pas de visiteur à deux', async () => {
    const g = await goal(OTHER, false, lonely)
    await checkMany(g, OTHER, 55, 1, lonely, OTHER)
    const f = await found(OTHER)
    expect(f.map((x) => x.visitor_id)).toEqual(['bernard', 'gobie'])
    expect(f.every((x) => x.profile_id === OTHER)).toBe(true)
  })

  it('on ne voit que son duo, et on ne s’ajoute pas un visiteur en contournant l’app', async () => {
    expect((await found(OTHER)).every((x) => x.profile_id === OTHER)).toBe(true)
    expect((await found(VAL)).some((x) => x.profile_id === OTHER)).toBe(false)
    await expect(as(VAL, `insert into public.visitor_found (couple_id, profile_id, visitor_id, reward) values ($1, $2, 'baleine', 9999)`, [couple, VAL])).rejects.toThrow()
    await expect(as(VAL, `select public.check_visitors($1)`, [couple])).rejects.toThrow()
    await expect(as(VAL, `select public.visitor_progress($1)`, [lonely])).rejects.toThrow()
    await expect(as(VAL, `update public.visitors set reward = 9999`)).rejects.toThrow()
  })

  it('chacun peut couper la notification des visiteurs, et seulement la sienne', async () => {
    const [{ n }] = await as<{ n: boolean }>(VAL, `select notify_visitors as n from public.profiles where id = auth.uid()`)
    expect(n).toBe(true)
    await as(VAL, `update public.profiles set notify_visitors = false where id = auth.uid()`)
    expect((await admin<{ n: boolean }>(`select notify_visitors as n from public.profiles where id = $1`, [VAL]))[0].n).toBe(false)
    await as(VAL, `update public.profiles set notify_visitors = false where id = $1`, [JULIE])
    expect((await admin<{ n: boolean }>(`select notify_visitors as n from public.profiles where id = $1`, [JULIE]))[0].n).toBe(true)
  })

  it('appliquée sur une base déjà utilisée, la migration fait arriver les visiteurs déjà mérités', async () => {
    const { db, as: as2, admin: admin2 } = await createDb(SQL_FILES.filter((f) => !f.includes('007') && !f.includes('008')))
    await admin2(`insert into auth.users (id, email) values ('${VAL}', 'v@t.fr'), ('${JULIE}', 'j@t.fr')`)
    const [{ code }] = await as2<{ code: string }>(VAL, `select public.create_couple('Valentin') as code`)
    await as2(JULIE, `select public.join_couple($1, 'Julie')`, [code])
    const c = (await admin2<{ c: string }>(`select couple_id as c from public.profiles where id = $1`, [VAL]))[0].c
    const [{ id: g }] = await admin2<{ id: string }>(
      `insert into public.goals (couple_id, owner_id, created_by, title, minutes, days, recurring, week_start, created_on)
       values ($1, $2, $2, 'Lire', 15, '{1,2,3,4,5,6,7}', false, public.week_start(public.today_paris()), public.today_paris()) returning id`, [c, VAL])
    await admin2(`insert into public.tasks (goal_id, couple_id, owner_id, planned_date, date, done_at, done_by)
      select $1, $2, $3, public.today_paris() - n, public.today_paris() - n, now(), $3 from generate_series(1, 13) n`, [g, c, VAL])
    await db.exec(readFileSync(new URL('../supabase/migrations/007_visitors.sql', import.meta.url), 'utf8'))
    const rows = await as2<{ visitor_id: string }>(VAL, `select visitor_id from public.visitor_found`)
    expect(rows.map((r) => r.visitor_id)).toEqual(['bernard'])
    await expect(db.exec(readFileSync(new URL('../supabase/migrations/007_visitors.sql', import.meta.url), 'utf8'))).rejects.toThrow(/déjà appliquée/)
  })
})
