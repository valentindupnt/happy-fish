// Tests de la progression longue (migration 006) : 50 niveaux, 10 stades, 5 habitats
import { beforeAll, describe, expect, it } from 'vitest'
import { createDb, JULIE, OTHER, VAL } from './helpers'
import { HABITATS, MAX_LEVEL, coinsFromXp, levelFromXp, stadeName, xpToReach } from '../src/lib/xp'

let as: Awaited<ReturnType<typeof createDb>>['as']
let admin: Awaited<ReturnType<typeof createDb>>['admin']

async function giveXp(user: string, amount: number) {
  await admin(`insert into public.xp_events (profile_id, amount, coins, reason) values ($1, $2, $2 / 5, 'task')`, [user, amount])
}
async function level(user: string): Promise<number> {
  return (await as<{ level: number }>(user, `select level from public.fish_status where profile_id = auth.uid()`))[0].level
}

describe('Happy Fish, progression longue', () => {
  beforeAll(async () => {
    ;({ as, admin } = await createDb())
    await admin(`insert into auth.users (id, email) values ('${VAL}', 'v@t.fr'), ('${JULIE}', 'j@t.fr'), ('${OTHER}', 'o@t.fr')`)
    await as(OTHER, `select public.create_couple('Seul')`)
  })

  it('l’app et la base ont le même barème, niveau par niveau', async () => {
    const rows = await admin<{ n: number; xp: number; stade: string }>(
      `select n, public.xp_to_reach(n) as xp, public.stade_name(n) as stade from generate_series(1, 50) n`)
    for (const r of rows) {
      expect(r.xp).toBe(xpToReach(r.n))
      expect(r.stade).toBe(stadeName(r.n))
    }
    for (const xp of [0, 29, 30, 500, 3306, 9000]) {
      const [{ l, c }] = await admin<{ l: number; c: number }>(`select public.level_from_xp($1, 50) as l, public.coins_from_xp($1) as c`, [xp])
      expect(l).toBe(levelFromXp(xp))
      expect(c).toBe(coinsFromXp(xp))
    }
    expect(levelFromXp(1e6)).toBe(MAX_LEVEL)
  })

  it('les habitats de la base sont ceux de l’app', async () => {
    const rows = await as<{ position: number; name: string; min_level: number; price: number; level_cap: number }>(OTHER,
      `select position, name, min_level, price, level_cap from public.habitats order by position`)
    expect(rows).toEqual(HABITATS.map((h, i) => ({ position: i, name: h.name, min_level: h.minLevel, price: h.price, level_cap: h.cap })))
  })

  it('10 stades de 5 niveaux', async () => {
    const [r] = await admin<{ a: string; b: string; c: string; d: string }>(
      `select public.stade_name(5) as a, public.stade_name(6) as b, public.stade_name(46) as c, public.stade_name(50) as d`)
    expect(r).toEqual({ a: 'Alevin', b: 'Petit', c: 'Mythique', d: 'Mythique' })
  })

  it('un duo incomplet ne peut pas acheter d’habitat', async () => {
    await giveXp(OTHER, 2000)
    await as(OTHER, `select public.contribute(200)`)
    await expect(as(OTHER, `select public.buy_habitat()`)).rejects.toThrow(/pas encore complet/)
  })

  it('chaque habitat relève le plafond, jusqu’au lagon et au niveau 50', async () => {
    const [{ code }] = await as<{ code: string }>(VAL, `select public.create_couple('Valentin') as code`)
    await as(JULIE, `select public.join_couple($1, 'Julie')`, [code])
    await giveXp(VAL, 9000)
    await giveXp(JULIE, 9000)
    expect(await level(VAL)).toBe(10)
    // 1 800 pièces chacun : de quoi payer les 4 habitats (1 700) à deux
    await as(VAL, `select public.contribute(900)`)
    await as(JULIE, `select public.contribute(900)`)
    const caps = []
    for (let i = 1; i <= 4; i++) {
      await as(i % 2 ? VAL : JULIE, `select public.buy_habitat()`)
      caps.push(await level(JULIE))
    }
    expect(caps).toEqual([20, 30, 40, 50])
    await expect(as(VAL, `select public.buy_habitat()`)).rejects.toThrow(/plus bel habitat/)
    const [{ p }] = await as<{ p: number }>(VAL, `select public.get_pot() as p`)
    expect(p).toBe(1800 - 1700)
  })

  it('on ne change pas d’habitat en contournant l’app', async () => {
    await expect(as(VAL, `update public.couples set habitat = 0`)).rejects.toThrow()
    await expect(as(VAL, `insert into public.habitats (position, id, name, min_level, price, level_cap) values (9, 'x', 'x', 1, 0, 99)`)).rejects.toThrow()
  })
})
