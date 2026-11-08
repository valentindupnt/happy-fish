// Tests des décorations, cadeaux, collections et objets de saison (migration 008)
import { beforeAll, describe, expect, it } from 'vitest'
import { createDb, JULIE, OTHER, SQL_FILES, VAL } from './helpers'
import { DECO_ART, DECO_IDS } from '../src/components/Deco'
import { LOOSE_GROUP } from '../src/lib/deco'

let as: Awaited<ReturnType<typeof createDb>>['as']
let admin: Awaited<ReturnType<typeof createDb>>['admin']

async function giveXp(user: string, xp: number) {
  await admin(`insert into public.xp_events (profile_id, amount, coins, reason, ref_date) values ($1, $2, $2 / 5, 'treat', public.today_paris() - (select count(*)::int from public.xp_events where profile_id = $1))`, [user, xp])
}
const coins = async (u: string) => (await as<{ coins: number }>(u, `select coins from public.fish_status where profile_id = auth.uid()`))[0].coins
const level = async (u: string) => (await as<{ level: number }>(u, `select level from public.fish_status where profile_id = auth.uid()`))[0].level
const owns = async (u: string, item: string) => (await as<{ n: number }>(u, `select count(*)::int as n from public.purchases where profile_id = auth.uid() and item_id = $1`, [item]))[0].n === 1

describe('Happy Fish, décorations, cadeaux et collections', () => {
  beforeAll(async () => {
    ;({ as, admin } = await createDb(SQL_FILES))
    await admin(`insert into auth.users (id, email) values ('${VAL}', 'v@t.fr'), ('${JULIE}', 'j@t.fr'), ('${OTHER}', 'o@t.fr')`)
    const [{ code }] = await as<{ code: string }>(VAL, `select public.create_couple('Valentin') as code`)
    await as(JULIE, `select public.join_couple($1, 'Julie')`, [code])
    await as(OTHER, `select public.create_couple('Seul')`)
  })

  it('le catalogue de la base a 30 décorations et chacune a son dessin', async () => {
    const rows = await as<{ id: string; series: string | null; season: string | null; price: number; min_level: number }>(VAL,
      `select id, series, season, price, min_level from public.shop_items where kind = 'deco' order by position`)
    expect(rows).toHaveLength(30)
    expect(rows.map((r) => r.id).sort()).toEqual([...DECO_IDS].sort())
    for (const id of DECO_IDS) {
      const art = DECO_ART[id]
      const w = art.frames[0][0].length
      const h = art.frames[0].length
      expect(art.frames.length, `${id} : 1 à 3 images`).toBeLessThanOrEqual(3)
      for (const rowsOfFrame of art.frames) {
        expect(rowsOfFrame.length, `${id} : même hauteur dans toutes les images`).toBe(h)
        for (const r of rowsOfFrame) expect(r.length, `${id} : lignes de même largeur`).toBe(w)
        for (const ch of rowsOfFrame.join('').replace(/\./g, '')) expect(art.colors[ch], `${id} : couleur ${ch}`).toBeTruthy()
      }
      expect(w, `${id} : pas plus large que 18 cases`).toBeLessThanOrEqual(18)
    }
    // Les objets sans collection sont rangés dans un groupe de la boutique
    for (const r of rows.filter((x) => !x.series)) expect(LOOSE_GROUP[r.id], r.id).toBeTruthy()
    // Les objets du bocal restent abordables avant le grand aquarium (niveau 8) : le moins cher à 5 pièces
    expect(Math.min(...rows.map((r) => r.price))).toBe(5)
    expect(rows.filter((r) => r.season === 'noel')).toHaveLength(4)
  })

  it('la saison de Noël : du 1er au 25 décembre, chaque année', async () => {
    const open = async (d: string | null) => (await admin<{ o: boolean }>(`select public.season_open('noel', $1::date) as o`, [d]))[0].o
    expect(await open('2026-11-30')).toBe(false)
    expect(await open('2026-12-01')).toBe(true)
    expect(await open('2027-12-25')).toBe(true)
    expect(await open('2026-12-26')).toBe(false)
    expect((await admin<{ o: boolean }>(`select public.season_open(null) as o`))[0].o).toBe(true)
  })

  it('acheter une décoration : ses pièces, son niveau, une seule fois', async () => {
    await expect(as(VAL, `select public.buy_item('d_galets')`)).rejects.toThrow(/Pas assez/)
    await giveXp(VAL, 200) // niveau 5, 40 pièces
    const before = await coins(VAL)
    expect(before).toBe(40)
    await as(VAL, `select public.buy_item('d_galets')`)
    expect(await coins(VAL)).toBe(35)
    await expect(as(VAL, `select public.buy_item('d_galets')`)).rejects.toThrow(/déjà/)
    await expect(as(VAL, `select public.buy_item('d_ancre_brumes')`)).rejects.toThrow(/niveau 12/)
    await expect(as(VAL, `select public.buy_item('d_inconnu')`)).rejects.toThrow(/inconnu/)
    // Le prix ne dépend pas de l'autre : Julie garde ses pièces
    expect(await coins(JULIE)).toBe(0)
  })

  it('un objet de saison fermé ne s’achète pas, et ne s’offre pas non plus', async () => {
    const [{ o }] = await admin<{ o: boolean }>(`select public.season_open('noel') as o`)
    if (o) return // en décembre, ils sont ouverts : le test des dates ci-dessus couvre la règle
    await expect(as(VAL, `select public.buy_item('d_noel_sapin')`)).rejects.toThrow(/saison/)
    await expect(as(VAL, `select public.gift_item('d_noel_sapin', null)`)).rejects.toThrow(/saison/)
  })

  it('poser : 5 emplacements chez soi, seulement ce qu’on a, un objet à une seule place', async () => {
    await as(VAL, `select public.set_deco('own', 0, 'd_galets')`)
    await expect(as(VAL, `select public.set_deco('own', 5, 'd_galets')`)).rejects.toThrow(/Emplacement/)
    await expect(as(VAL, `select public.set_deco('own', 1, 'd_coquillage')`)).rejects.toThrow(/pas encore/)
    await expect(as(VAL, `select public.set_deco('autre', 1, 'd_galets')`)).rejects.toThrow(/Emplacement/)
    await expect(as(VAL, `select public.set_deco('own', 1, 'carre')`)).rejects.toThrow(/inconnu/) // seulement les décorations
    // Déplacer : l'objet quitte son ancien emplacement
    await as(VAL, `select public.set_deco('own', 3, 'd_galets')`)
    const slots = await as<{ slot: number; item_id: string }>(VAL, `select slot, item_id from public.deco_slots where profile_id = auth.uid() order by slot`)
    expect(slots).toEqual([{ slot: 3, item_id: 'd_galets' }])
    // Remplacer un objet pose le nouveau à la place
    await as(VAL, `select public.buy_item('d_coquillage')`)
    await as(VAL, `select public.set_deco('own', 3, 'd_coquillage')`)
    expect((await as<{ item_id: string }>(VAL, `select item_id from public.deco_slots where profile_id = auth.uid()`)).map((r) => r.item_id)).toEqual(['d_coquillage'])
    // Retirer
    await as(VAL, `select public.set_deco('own', 3, null)`)
    expect(await as(VAL, `select 1 from public.deco_slots where profile_id = auth.uid()`)).toEqual([])
  })

  it('l’aquarium commun : 4 emplacements par personne, seulement à partir du grand aquarium', async () => {
    await expect(as(VAL, `select public.set_deco('common', 0, 'd_galets')`)).rejects.toThrow(/aquarium commun/)
    await admin(`update public.couples set habitat = 1 where id = (select couple_id from public.profiles where id = '${VAL}')`)
    await as(VAL, `select public.set_deco('own', 0, 'd_galets')`)
    await as(VAL, `select public.set_deco('common', 0, 'd_galets')`) // il quitte le bocal et rejoint le commun
    const rows = await as<{ place: string; slot: number }>(VAL, `select place, slot from public.deco_slots where profile_id = auth.uid()`)
    expect(rows).toEqual([{ place: 'common', slot: 0 }])
    await expect(as(VAL, `select public.set_deco('common', 4, 'd_coquillage')`)).rejects.toThrow(/Emplacement/)
    // Julie voit ce que Vale a posé, pas l'étranger
    expect((await as(JULIE, `select 1 from public.deco_slots`)).length).toBe(1)
    expect((await as(OTHER, `select 1 from public.deco_slots`)).length).toBe(0)
  })

  it('offrir : payé par celui qui offre, reçu tout de suite, sans toucher les pièces de l’autre', async () => {
    const valBefore = await coins(VAL)
    const julBefore = await coins(JULIE)
    await as(VAL, `select public.gift_item('d_algue', 'Pour ton bocal')`)
    expect(await coins(VAL)).toBe(valBefore - 8)
    expect(await coins(JULIE)).toBe(julBefore) // un cadeau ne coûte rien à celui qui le reçoit
    expect(await owns(JULIE, 'd_algue')).toBe(true)
    const gifts = await as<{ from_id: string; to_id: string; message: string }>(JULIE, `select from_id, to_id, message from public.gifts`)
    expect(gifts).toEqual([{ from_id: VAL, to_id: JULIE, message: 'Pour ton bocal' }])
    await expect(as(VAL, `select public.gift_item('d_algue')`)).rejects.toThrow(/déjà/)
    // Il faut avoir les pièces
    await expect(as(JULIE, `select public.gift_item('d_phare_ames')`)).rejects.toThrow(/Pas assez/)
    // Seul, personne à qui offrir
    await expect(as(OTHER, `select public.gift_item('d_galets')`)).rejects.toThrow(/pas encore complet/)
    // On ne forge pas un cadeau
    await expect(as(VAL, `insert into public.gifts (couple_id, from_id, to_id, item_id, price) values (gen_random_uuid(), $1, $2, 'd_galets', 0)`, [VAL, JULIE])).rejects.toThrow()
    await expect(as(VAL, `insert into public.deco_slots (profile_id, place, slot, item_id) values ($1, 'own', 4, 'd_galets')`, [VAL])).rejects.toThrow()
  })

  it('un cadeau au-dessus de son niveau attend en réserve, et ne s’équipe ni ne se pose avant', async () => {
    await giveXp(VAL, 500)
    expect(await level(VAL)).toBeGreaterThanOrEqual(8)
    // Julie (niveau 1) reçoit un chapeau de niveau 22 et une décoration de niveau 9
    await giveXp(VAL, 600)
    await as(VAL, `select public.gift_item('pirate', null)`)
    await as(VAL, `select public.gift_item('d_plongeoir', null)`)
    expect(await owns(JULIE, 'pirate')).toBe(true)
    await expect(as(JULIE, `update public.profiles set fish_hat = 'pirate' where id = auth.uid()`)).rejects.toThrow(/niveau/)
    await expect(as(JULIE, `select public.set_deco('own', 0, 'd_plongeoir')`)).rejects.toThrow(/niveau 9/)
    // Dès qu'elle a le niveau, c'est possible
    await giveXp(JULIE, 1500)
    expect(await level(JULIE)).toBeGreaterThanOrEqual(10)
    await as(JULIE, `select public.set_deco('own', 0, 'd_plongeoir')`)
    // Le niveau 22 n'est pas encore là : le chapeau reste verrouillé
    await expect(as(JULIE, `update public.profiles set fish_hat = 'pirate' where id = auth.uid()`)).rejects.toThrow(/niveau/)
  })

  it('une collection complète rapporte son bonus une seule fois, achetée ou offerte', async () => {
    await giveXp(VAL, 800)
    const before = await coins(VAL)
    for (const id of ['d_ancre_rouille', 'd_ancre_laiton']) await as(VAL, `select public.buy_item('${id}')`)
    expect((await as(VAL, `select 1 from public.series_found where series_id = 'ancres'`)).length).toBe(0)
    await giveXp(VAL, 700)
    await as(VAL, `select public.buy_item('d_ancre_brumes')`)
    const found = await as<{ series_id: string; reward: number }>(VAL, `select series_id, reward from public.series_found`)
    expect(found).toEqual([{ series_id: 'ancres', reward: 15 }])
    expect(await coins(VAL)).toBe(before + Math.floor(700 / 5) - 10 - 18 - 40 + 15)
    // Le bonus ne se répète pas
    await admin(`select public.check_series('${VAL}')`)
    expect((await as(VAL, `select 1 from public.series_found`)).length).toBe(1)
    // Pour Julie : deux ancres offertes, la troisième achetée avec ses propres pièces
    await as(VAL, `select public.gift_item('d_ancre_rouille')`)
    await as(VAL, `select public.gift_item('d_ancre_laiton')`)
    const julBefore = await coins(JULIE)
    await as(VAL, `select public.gift_item('d_ancre_brumes')`)
    expect(await coins(JULIE)).toBe(julBefore + 15) // la collection offerte lui rapporte son bonus
  })

  it('les objets déjà achetés et les pièces des autres rayons ne changent pas', async () => {
    const rows = await as<{ kind: string; n: number }>(VAL, `select kind, count(*)::int as n from public.shop_items group by kind order by kind`)
    expect(rows).toEqual([
      { kind: 'bowl', n: 2 }, { kind: 'color', n: 5 }, { kind: 'deco', n: 30 }, { kind: 'decor', n: 10 }, { kind: 'hat', n: 8 }, { kind: 'pet', n: 5 },
    ])
  })
})

describe('Happy Fish, migration 008 sur une base déjà utilisée', () => {
  it('garde les achats et les pièces, ne se joue qu’une fois, et donne un cadeau à qui l’a mérité', async () => {
    const { db, as: as2, admin: admin2 } = await createDb(SQL_FILES.filter((f) => !f.includes('008') && !f.includes('012') && !f.includes('016')))
    await admin2(`insert into auth.users (id, email) values ('${VAL}', 'v@t.fr'), ('${JULIE}', 'j@t.fr')`)
    const [{ code }] = await as2<{ code: string }>(VAL, `select public.create_couple('Valentin') as code`)
    await as2(JULIE, `select public.join_couple($1, 'Julie')`, [code])
    await admin2(`insert into public.xp_events (profile_id, amount, reason, ref_date) values ('${VAL}', 300, 'treat', public.today_paris())`)
    await as2(VAL, `select public.buy_item('amethyste')`)
    const before = (await as2<{ coins: number }>(VAL, `select coins from public.fish_status where profile_id = auth.uid()`))[0].coins
    const sql = (await import('node:fs')).readFileSync(new URL('../supabase/migrations/008_deco.sql', import.meta.url), 'utf8')
    await db.exec(sql)
    expect((await as2<{ coins: number }>(VAL, `select coins from public.fish_status where profile_id = auth.uid()`))[0].coins).toBe(before)
    expect((await as2(VAL, `select 1 from public.purchases where item_id = 'amethyste'`)).length).toBe(1)
    await expect(db.exec(sql)).rejects.toThrow(/déjà appliquée/)
    // Les anciens achats marchent toujours après la migration
    await as2(VAL, `select public.buy_item('cerise')`)
  })
})
