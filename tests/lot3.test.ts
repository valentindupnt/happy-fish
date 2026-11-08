// Tests du lot 3 : pièces sans blocage, séries, défis au dé, idées de surprises, récap du mois
import { beforeAll, describe, expect, it } from 'vitest'
import { createDb, JULIE, OTHER, VAL } from './helpers'

let as: Awaited<ReturnType<typeof createDb>>['as']
let admin: Awaited<ReturnType<typeof createDb>>['admin']
let today: () => Promise<string>
let couple = ''

async function coins(user: string): Promise<number> {
  return (await as<{ coins: number }>(user, `select coins from public.fish_status where profile_id = auth.uid()`))[0].coins
}

async function pot(user: string): Promise<number> {
  return (await as<{ p: number }>(user, `select public.get_pot() as p`))[0].p
}

describe('Happy Fish, lot 3', () => {
  beforeAll(async () => {
    ;({ as, admin, today } = await createDb())
    await admin(`insert into auth.users (id, email) values ('${VAL}', 'v@t.fr'), ('${JULIE}', 'j@t.fr'), ('${OTHER}', 'o@t.fr')`)
    const [{ code }] = await as<{ code: string }>(VAL, `select public.create_couple('Valentin') as code`)
    await as(JULIE, `select public.join_couple($1, 'Julie')`, [code])
    await as(OTHER, `select public.create_couple('Autre')`)
    couple = (await admin<{ c: string }>(`select couple_id as c from public.profiles where id = $1`, [VAL]))[0].c
  })

  it('l’XP en réserve rapporte des pièces : la cagnotte ne peut plus se bloquer', async () => {
    await admin(`insert into public.xp_events (profile_id, amount, coins, reason) values ($1, 900, 180, 'treat')`, [VAL])
    const [f] = await as<{ level: number; level_uncapped: number }>(VAL, `select level, level_uncapped from public.fish_status where profile_id = auth.uid()`)
    expect(f).toEqual({ level: 10, level_uncapped: 14 })
    expect(await coins(VAL)).toBe(180) // 900 XP : 1 pièce pour 5 XP, réserve comprise
  })

  it('séries : un fait prolonge, un raté passé casse, un retiré ou un à venir ne compte pas', async () => {
    const t = await today()
    const [{ id: goal }] = await admin<{ id: string }>(
      `insert into public.goals (couple_id, owner_id, created_by, title, minutes, days, recurring, week_start, created_on)
       values ($1, $2, $2, 'Courir', 30, '{1,2,3,4,5,6,7}', true, public.week_start($3::date), $3::date - 20) returning id`, [couple, VAL, t])
    // il y a 9 jours : raté, puis 8 à 4 jours : faits, 3 jours : retiré, 2 et 1 jours : faits, aujourd'hui et demain : à faire
    const plan: Array<[number, 'done' | 'missed' | 'skipped' | 'todo']> = [
      [-9, 'missed'], [-8, 'done'], [-7, 'done'], [-6, 'done'], [-5, 'done'], [-4, 'done'],
      [-3, 'skipped'], [-2, 'done'], [-1, 'done'], [0, 'todo'], [1, 'todo'],
    ]
    for (const [d, s] of plan) {
      await admin(
        `insert into public.tasks (goal_id, couple_id, owner_id, planned_date, date, skipped, done_at)
         values ($1, $2, $3, $4::date + $5::int, $4::date + $5::int, $6, case when $7 then now() end)`,
        [goal, couple, VAL, t, d, s === 'skipped', s === 'done'])
    }
    let [st] = await as<{ current_streak: number; best_streak: number }>(VAL, `select * from public.goal_streaks() where goal_id = $1`, [goal])
    expect(st).toMatchObject({ current_streak: 7, best_streak: 7 })

    // un raté il y a 1 jour casse la série en cours, le record reste
    await admin(`update public.tasks set done_at = null where goal_id = $1 and date = $2::date - 1`, [goal, t])
    ;[st] = await as<{ current_streak: number; best_streak: number }>(VAL, `select * from public.goal_streaks() where goal_id = $1`, [goal])
    expect(st).toMatchObject({ current_streak: 0, best_streak: 6 })

    // Julie voit les séries du duo, l'autre couple non
    expect(await as(JULIE, `select * from public.goal_streaks() where goal_id = $1`, [goal])).toHaveLength(1)
    expect(await as(OTHER, `select * from public.goal_streaks() where goal_id = $1`, [goal])).toHaveLength(0)
  })

  it('dé des défis : refusé sans défi, puis un seul tirage par semaine', async () => {
    await expect(as(VAL, `select public.roll_challenge()`)).rejects.toThrow(/au moins un défi/)
    await as(VAL, `insert into public.challenges (couple_id, created_by, title) values ($1, auth.uid(), 'Soirée sans écran')`, [couple])
    await as(JULIE, `insert into public.challenges (couple_id, created_by, title) values ($1, auth.uid(), 'Pique-nique')`, [couple])
    const [{ r: first }] = await as<{ r: string }>(VAL, `select public.roll_challenge() as r`)
    const [{ r: again }] = await as<{ r: string }>(JULIE, `select public.roll_challenge() as r`)
    expect(again).toBe(first)
    const rolls = await as<{ title: string }>(JULIE, `select title from public.challenge_rolls`)
    expect(rolls).toHaveLength(1)
    expect(['Soirée sans écran', 'Pique-nique']).toContain(rolls[0].title)
  })

  it('défi réussi : 10 pièces dans la cagnotte, une seule fois', async () => {
    const before = await pot(VAL)
    const [{ id }] = await as<{ id: string }>(JULIE, `select id from public.challenge_rolls`)
    await as(JULIE, `select public.complete_challenge($1)`, [id])
    await as(VAL, `select public.complete_challenge($1)`, [id])
    expect(await pot(VAL)).toBe(before + 10)
  })

  it('les tirages ne s’écrivent pas à la main et restent dans le duo', async () => {
    const [{ id: ch }] = await as<{ id: string }>(VAL, `select id from public.challenges limit 1`)
    await expect(as(VAL, `insert into public.challenge_rolls (couple_id, week_start, challenge_id, title) values ($1, '2020-01-06', $2, 'x')`, [couple, ch]))
      .rejects.toThrow()
    await expect(as(VAL, `update public.challenge_rolls set done_at = null`)).rejects.toThrow()
    expect(await as(OTHER, `select * from public.challenge_rolls`)).toHaveLength(0)
    expect(await as(OTHER, `select * from public.challenges`)).toHaveLength(0)
    await expect(as(OTHER, `insert into public.challenges (couple_id, created_by, title) values ($1, auth.uid(), 'intrus')`, [couple])).rejects.toThrow()
  })

  it('les pièces de défi remplissent la cagnotte sans rien acheter tout seul', async () => {
    const left = 150 - (await pot(VAL)) - 10
    await as(VAL, `select public.contribute($1)`, [left])
    const [{ id: ch }] = await as<{ id: string }>(VAL, `select id from public.challenges limit 1`)
    await admin(`insert into public.challenge_rolls (couple_id, week_start, challenge_id, title) values ($1, '2020-01-06', $2, 'ancien')`, [couple, ch])
    const [{ id: roll }] = await as<{ id: string }>(VAL, `select id from public.challenge_rolls where week_start = '2020-01-06'`)
    await as(VAL, `select public.complete_challenge($1)`, [roll])
    const [c] = await as<{ habitat: number }>(VAL, `select habitat from public.couples`)
    expect(c.habitat).toBe(0)
    expect(await pot(VAL)).toBe(150)
    await expect(as(VAL, `select public.buy_habitat()`)).rejects.toThrow(/niveau 8/) // Julie est encore niveau 1
  })

  it('idées de surprises : partagées dans le duo, invisibles ailleurs', async () => {
    await as(JULIE, `insert into public.surprise_ideas (couple_id, created_by, title) values ($1, auth.uid(), 'Petit-déjeuner au lit')`, [couple])
    expect(await as(VAL, `select title from public.surprise_ideas`)).toHaveLength(1)
    expect(await as(OTHER, `select title from public.surprise_ideas`)).toHaveLength(0)
    await expect(as(VAL, `insert into public.surprise_ideas (couple_id, created_by, title) values ($1, $2, 'au nom de Julie')`, [couple, JULIE])).rejects.toThrow()
  })

  it('récap du mois : une ligne par personne du duo', async () => {
    const t = await today()
    const rows = await as<{ profile_id: string; done: number; minutes: number; perfect_days: number; top_category: string | null }>(
      VAL, `select * from public.month_recap($1::date)`, [t])
    expect(rows.map((r) => r.profile_id).sort()).toEqual([VAL, JULIE].sort())
    const mine = rows.find((r) => r.profile_id === VAL)!
    expect(mine.done).toBeGreaterThanOrEqual(0)
    expect(mine.minutes).toBe(mine.done * 30)
    await expect(as(OTHER, `select * from public.month_recap($1::date)`, [t])).resolves.toHaveLength(1)
  })

  it('les fonctions internes restent fermées', async () => {
    await expect(as(VAL, `select public.maybe_buy_aquarium($1)`, [couple])).rejects.toThrow(/permission/)
  })
})
