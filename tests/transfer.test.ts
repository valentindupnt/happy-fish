// Tests de « offrir un objet de son inventaire » (migration 013)
import { beforeAll, describe, expect, it } from 'vitest'
import { createDb, JULIE, OTHER, SQL_FILES, VAL } from './helpers'

let as: Awaited<ReturnType<typeof createDb>>['as']
let admin: Awaited<ReturnType<typeof createDb>>['admin']

async function giveXp(user: string, xp: number) {
  await admin(`insert into public.xp_events (profile_id, amount, coins, reason, ref_date) values ($1, $2, $2 / 5, 'treat', public.today_paris() - (select count(*)::int from public.xp_events where profile_id = $1))`, [user, xp])
}
const coins = async (u: string) => (await as<{ coins: number }>(u, `select coins from public.fish_status where profile_id = auth.uid()`))[0].coins
const owns = async (u: string, item: string) => (await as<{ n: number }>(u, `select count(*)::int as n from public.purchases where profile_id = auth.uid() and item_id = $1`, [item]))[0].n === 1

describe('Happy Fish, offrir un objet de son inventaire', () => {
  beforeAll(async () => {
    ;({ as, admin } = await createDb(SQL_FILES))
    await admin(`insert into auth.users (id, email) values ('${VAL}', 'v@t.fr'), ('${JULIE}', 'j@t.fr'), ('${OTHER}', 'o@t.fr')`)
    const [{ code }] = await as<{ code: string }>(VAL, `select public.create_couple('Valentin') as code`)
    await as(JULIE, `select public.join_couple($1, 'Julie')`, [code])
    await as(OTHER, `select public.create_couple('Seul')`)
    // Le plafond de niveau dépend de l'habitat : on ouvre le plus grand pour que 9 000 XP montent jusqu'au niveau 50
    await admin(`update public.couples set habitat = 4 where id = (select couple_id from public.profiles where id = '${VAL}')`)
    await giveXp(VAL, 9000)
  })

  it('un habit passe de l’un à l’autre : retiré du poisson, aucune pièce échangée, un cadeau enregistré', async () => {
    await as(VAL, `select public.buy_item('bandeau')`)
    await as(VAL, `update public.profiles set fish_hat = 'bandeau' where id = auth.uid()`)
    const paid = (await as<{ price: number }>(VAL, `select price from public.purchases where profile_id = auth.uid() and item_id = 'bandeau'`))[0].price
    expect(paid).toBeGreaterThan(0)
    const valCoins = await coins(VAL)
    const julCoins = await coins(JULIE)
    await as(VAL, `select public.transfer_item('bandeau', 'Il te va mieux qu’à moi')`)
    expect(await owns(VAL, 'bandeau')).toBe(false)
    expect(await owns(JULIE, 'bandeau')).toBe(true)
    expect((await as<{ fish_hat: string | null }>(VAL, `select fish_hat from public.profiles where id = auth.uid()`))[0].fish_hat).toBeNull()
    expect(await coins(VAL)).toBe(valCoins)
    expect(await coins(JULIE)).toBe(julCoins)
    const gifts = await as<{ from_id: string; to_id: string; price: number; message: string }>(JULIE, `select from_id, to_id, price, message from public.gifts where item_id = 'bandeau'`)
    expect(gifts).toEqual([{ from_id: VAL, to_id: JULIE, price: paid, message: 'Il te va mieux qu’à moi' }])
    // Offrir puis re-offrir en boucle ne fait pas gagner de pièces : le prix payé reste dépensé
    expect(await coins(VAL)).toBe(valCoins)
    // Il n'est plus à lui : on ne peut ni le ré-offrir, ni l'équiper
    await expect(as(VAL, `select public.transfer_item('bandeau')`)).rejects.toThrow(/ne l'as pas|ne l’as pas/)
    await expect(as(VAL, `update public.profiles set fish_hat = 'bandeau' where id = auth.uid()`)).rejects.toThrow()
  })

  it('un familier et une décoration posée quittent aussi le poisson et l’aquarium', async () => {
    await as(VAL, `select public.buy_item('crevette')`)
    await as(VAL, `update public.profiles set fish_pet = 'crevette' where id = auth.uid()`)
    await as(VAL, `select public.transfer_item('crevette', null)`)
    expect((await as<{ fish_pet: string | null }>(VAL, `select fish_pet from public.profiles where id = auth.uid()`))[0].fish_pet).toBeNull()
    expect(await owns(JULIE, 'crevette')).toBe(true)

    await as(VAL, `select public.buy_item('d_galets')`)
    await as(VAL, `select public.set_deco('own', 0, 'd_galets')`)
    await as(VAL, `select public.transfer_item('d_galets', null)`)
    expect((await as(VAL, `select 1 from public.deco_slots where profile_id = auth.uid()`)).length).toBe(0)
    expect(await owns(JULIE, 'd_galets')).toBe(true)
  })

  it('refuse ce qui n’est pas à soi, ce que l’autre a déjà, les couleurs et le duo incomplet', async () => {
    await expect(as(VAL, `select public.transfer_item('casquette')`)).rejects.toThrow(/ne l.as pas/)
    await as(VAL, `select public.buy_item('lunettes')`)
    await as(JULIE, `select public.buy_item('lunettes')`).catch(async () => {
      await admin(`insert into public.purchases (profile_id, item_id, price) values ('${JULIE}', 'lunettes', 0)`)
    })
    await expect(as(VAL, `select public.transfer_item('lunettes')`)).rejects.toThrow(/déjà/)
    await expect(as(VAL, `select public.transfer_item('rond')`)).rejects.toThrow(/ne peut pas être offert/)
    await expect(as(OTHER, `select public.transfer_item('bandeau')`)).rejects.toThrow(/pas encore complet/)
  })

  it('un objet trop haut pour l’autre l’attend en réserve', async () => {
    await as(VAL, `select public.buy_item('couronne')`)
    await as(VAL, `select public.transfer_item('couronne')`)
    expect(await owns(JULIE, 'couronne')).toBe(true)
    await expect(as(JULIE, `update public.profiles set fish_hat = 'couronne' where id = auth.uid()`)).rejects.toThrow(/niveau/)
  })
})
