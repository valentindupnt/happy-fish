// Tests de la migration 016 : les pièces se gagnent par sous-objectif réussi, selon son temps
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { coinsForMinutes } from '../src/lib/xp'
import { createDb, JULIE, SQL_FILES, VAL } from './helpers'

let as: Awaited<ReturnType<typeof createDb>>['as']
let admin: Awaited<ReturnType<typeof createDb>>['admin']
let today: () => Promise<string>

const coins = async (u: string) => (await as<{ coins: number }>(u, `select coins from public.fish_status where profile_id = auth.uid()`))[0].coins

async function taskFor(user: string, title: string, minutes: number, common = false): Promise<string> {
  const d = await today()
  const isodow = (await admin<{ n: number }>(`select extract(isodow from public.today_paris())::int as n`))[0].n
  await as(user, `select public.create_goal($1, $2, array[$4::int], false, $3::date, null, null, $5)`, [title, minutes, d, isodow, common])
  const [t] = await as<{ id: string }>(user, `select t.id from public.tasks t join public.goals g on g.id = t.goal_id where g.title = $1`, [title])
  return t.id
}

describe('Happy Fish, pièces par sous-objectif (migration 016)', () => {
  beforeAll(async () => {
    ;({ as, admin, today } = await createDb())
    await admin(`insert into auth.users (id, email) values ('${VAL}', 'v@t.fr'), ('${JULIE}', 'j@t.fr')`)
    const [{ code }] = await as<{ code: string }>(VAL, `select public.create_couple('Valentin') as code`)
    await as(JULIE, `select public.join_couple($1, 'Julie')`, [code])
  })

  it('le barème : 5 à 14 min 0, 15 à 29 min 1, 30 à 45 min 2, plus de 45 min 3 (base et app identiques)', async () => {
    for (const m of [1, 5, 10, 14, 15, 20, 29, 30, 45, 46, 60, 90, 120, 600]) {
      const [{ c }] = await admin<{ c: number }>(`select public.coins_for_minutes($1) as c`, [m])
      expect(c, `${m} min`).toBe(coinsForMinutes(m))
    }
    expect([5, 10, 15, 20, 30, 45, 60, 90, 120].map(coinsForMinutes)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 3])
  })

  it('cocher donne les pièces du temps, décocher les retire, et les bonus ne rapportent rien', async () => {
    const small = await taskFor(VAL, 'Étirements', 10)
    const mid = await taskFor(VAL, 'Lecture', 20)
    const long = await taskFor(VAL, 'Vélo', 90)
    expect(await coins(VAL)).toBe(0)
    await as(VAL, `select public.toggle_task($1)`, [small])
    expect(await coins(VAL)).toBe(0)
    await as(VAL, `select public.toggle_task($1)`, [mid])
    expect(await coins(VAL)).toBe(1)
    await as(VAL, `select public.toggle_task($1)`, [long]) // journée complète : +5 XP, mais aucune pièce de plus
    expect(await coins(VAL)).toBe(4)
    await as(VAL, `select public.toggle_task($1)`, [long])
    expect(await coins(VAL)).toBe(1)
    await as(VAL, `select public.toggle_task($1)`, [mid])
    expect(await coins(VAL)).toBe(0)
  })

  it('la friandise donne de l’XP à l’autre mais pas de pièce', async () => {
    const before = await coins(JULIE)
    await as(VAL, `select public.send_treat()`)
    expect(await coins(JULIE)).toBe(before)
  })

  it('un objectif commun donne les mêmes pièces aux deux', async () => {
    const t = await taskFor(JULIE, 'Dîner ensemble', 60, true)
    const [v, j] = [await coins(VAL), await coins(JULIE)]
    await as(JULIE, `select public.toggle_task($1)`, [t])
    expect(await coins(VAL)).toBe(v + 3)
    expect(await coins(JULIE)).toBe(j + 3)
    await as(VAL, `select public.toggle_task($1)`, [t])
    expect(await coins(VAL)).toBe(v)
    expect(await coins(JULIE)).toBe(j)
  })

  it('l’XP en réserve ne rapporte plus de pièces', async () => {
    const before = await coins(VAL)
    await admin(`insert into public.xp_events (profile_id, amount, reason) values ($1, 900, 'treat')`, [VAL])
    expect(await coins(VAL)).toBe(before)
  })

  it('sur une base déjà utilisée, les pièces déjà gagnées ne bougent pas', async () => {
    const { db, as: as2, admin: admin2 } = await createDb(SQL_FILES.filter((f) => !f.includes('016')))
    await admin2(`insert into auth.users (id, email) values ('${VAL}', 'v@t.fr'), ('${JULIE}', 'j@t.fr')`)
    const [{ code }] = await as2<{ code: string }>(VAL, `select public.create_couple('Valentin') as code`)
    await as2(JULIE, `select public.join_couple($1, 'Julie')`, [code])
    await admin2(`insert into public.xp_events (profile_id, amount, reason) values ('${VAL}', 237, 'treat')`)
    await as2(VAL, `select public.buy_item('amethyste')`)
    const bal = async () => (await as2<{ coins: number }>(VAL, `select coins from public.fish_status where profile_id = auth.uid()`))[0].coins
    const before = await bal()
    expect(before).toBeGreaterThan(0)
    const sql = readFileSync(new URL('../supabase/migrations/016_coins_per_goal.sql', import.meta.url), 'utf8')
    await db.exec(sql)
    expect(await bal()).toBe(before)
    expect((await as2<{ coins: number }>(JULIE, `select coins from public.fish_status where profile_id = auth.uid()`))[0].coins).toBe(0)
    expect((await as2<{ xp: number }>(VAL, `select xp from public.fish_status where profile_id = auth.uid()`))[0].xp).toBe(237)
    await expect(db.exec(sql)).rejects.toThrow()
  })
})
