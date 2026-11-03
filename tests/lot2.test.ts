// Tests du lot 2 : pièces, boutique, cagnotte, grand aquarium, bilans et surprise
import { beforeAll, describe, expect, it } from 'vitest'
import { createDb, JULIE, OTHER, VAL } from './helpers'

let as: Awaited<ReturnType<typeof createDb>>['as']
let admin: Awaited<ReturnType<typeof createDb>>['admin']

async function coins(user: string): Promise<number> {
  return (await as<{ coins: number }>(user, `select coins from public.fish_status where profile_id = auth.uid()`))[0].coins
}

async function giveXp(user: string, amount: number) {
  await admin(`insert into public.xp_events (profile_id, amount, reason) values ($1, $2, 'treat')`, [user, amount])
}

describe('Happy Fish, lot 2', () => {
  beforeAll(async () => {
    ;({ as, admin } = await createDb())
    await admin(`insert into auth.users (id, email) values ('${VAL}', 'v@t.fr'), ('${JULIE}', 'j@t.fr'), ('${OTHER}', 'o@t.fr')`)
    const [{ code }] = await as<{ code: string }>(VAL, `select public.create_couple('Valentin') as code`)
    await as(JULIE, `select public.join_couple($1, 'Julie')`, [code])
    await as(OTHER, `select public.create_couple('Autre')`)
  })

  it('les pièces suivent les niveaux : 10 par niveau, +25 par stade', async () => {
    expect(await coins(VAL)).toBe(0)
    await giveXp(VAL, 300) // niveau 4 (270 XP), stade Petit
    expect(await coins(VAL)).toBe(55)
  })

  it('acheter une couleur retire les pièces, une seule fois', async () => {
    const [{ left }] = await as<{ left: number }>(VAL, `select public.buy_item('amethyste') as left`)
    expect(left).toBe(40)
    await expect(as(VAL, `select public.buy_item('amethyste')`)).rejects.toThrow(/déjà/)
  })

  it('un objet au-dessus de son niveau est refusé', async () => {
    await expect(as(VAL, `select public.buy_item('or')`)).rejects.toThrow(/niveau 6/)
    await expect(as(VAL, `select public.buy_item('crevette')`)).rejects.toThrow(/niveau 8/)
  })

  it('pas assez de pièces : refusé', async () => {
    await expect(as(JULIE, `select public.buy_item('amethyste')`)).rejects.toThrow(/Pas assez/)
  })

  it('on équipe seulement ce qu’on a acheté', async () => {
    await as(VAL, `update public.profiles set fish_color = 'amethyste' where id = auth.uid()`)
    await expect(as(VAL, `update public.profiles set fish_color = 'cerise' where id = auth.uid()`)).rejects.toThrow(/Achète/)
    await expect(as(VAL, `update public.profiles set fish_hat = 'bandeau' where id = auth.uid()`)).rejects.toThrow(/Achète/)
    await as(VAL, `select public.buy_item('bandeau')`)
    await as(VAL, `update public.profiles set fish_hat = 'bandeau' where id = auth.uid()`)
    await as(VAL, `update public.profiles set fish_color = 'lagon' where id = auth.uid()`) // couleur gratuite
    const [p] = await as<{ fish_hat: string; fish_color: string }>(VAL, `select fish_hat, fish_color from public.profiles where id = auth.uid()`)
    expect(p).toEqual({ fish_hat: 'bandeau', fish_color: 'lagon' })
  })

  it('les décorations communes attendent le grand aquarium', async () => {
    await expect(as(VAL, `select public.buy_decor('plante')`)).rejects.toThrow(/grand aquarium/)
  })

  it('la cagnotte achète le grand aquarium toute seule à 120 pièces', async () => {
    await giveXp(JULIE, 610) // niveau 6, plafond sans aquarium : 75 pièces
    expect(await coins(JULIE)).toBe(75)
    await expect(as(VAL, `select public.contribute(999)`)).rejects.toThrow(/Pas assez/)
    await as(VAL, `select public.contribute(20)`)
    const [{ pot }] = await as<{ pot: number }>(JULIE, `select public.contribute(75) as pot`)
    expect(pot).toBe(95)
    await giveXp(VAL, 400) // niveau 6 : 75 pièces gagnées, 35 dépensées, 20 versées
    expect(await coins(VAL)).toBe(20)
    const [{ pot: p2 }] = await as<{ pot: number }>(VAL, `select public.contribute(15) as pot`)
    expect(p2).toBe(110)
    const [c0] = await as<{ aquarium_bought: boolean }>(VAL, `select aquarium_bought from public.couples`)
    expect(c0.aquarium_bought).toBe(false)
    // 5 pièces de plus (versement simulé), puis le versement qui fait passer à 120
    await admin(`insert into public.pot_events (couple_id, amount, reason) select couple_id, 5, 'contribution' from public.profiles where id = $1`, [VAL])
    const [{ pot: after }] = await as<{ pot: number }>(VAL, `select public.contribute(5) as pot`)
    expect(after).toBe(0)
    const [c] = await as<{ aquarium_bought: boolean }>(VAL, `select aquarium_bought from public.couples`)
    expect(c.aquarium_bought).toBe(true)
  })

  it('avec le grand aquarium, l’XP en réserve fait monter le niveau', async () => {
    await giveXp(JULIE, 300) // 910 XP : niveau 7, bloqué à 6 sans aquarium
    const [f] = await as<{ level: number }>(JULIE, `select level from public.fish_status where profile_id = auth.uid()`)
    expect(f.level).toBe(7)
  })

  it('les décorations se paient avec la cagnotte', async () => {
    await expect(as(VAL, `select public.buy_decor('chateau')`)).rejects.toThrow(/cagnotte/)
    await as(JULIE, `select public.contribute(10)`)
    const [{ pot }] = await as<{ pot: number }>(VAL, `select public.buy_decor('plante') as pot`)
    expect(pot).toBe(0)
    const items = await as<{ item_id: string }>(JULIE, `select item_id from public.couple_items`)
    expect(items.map((i) => i.item_id)).toEqual(['plante'])
  })

  it('un autre duo ne voit ni nos achats, ni notre cagnotte, ni nos pièces', async () => {
    const [seen] = await as<{ n: number }>(OTHER, `select (select count(*) from public.purchases) + (select count(*) from public.pot_events)
      + (select count(*) from public.couple_items) as n`)
    expect(Number(seen.n)).toBe(0)
    const [c] = await as<{ coins: number | null }>(OTHER, `select public.coins_visible($1) as coins`, [VAL])
    expect(c.coins).toBeNull()
  })

  it('le bilan de la semaine passée compte les ratés et la surprise', async () => {
    // Semaine passée simulée : duo créé il y a 3 semaines, 4 sous-objectifs dont 1 fait
    await admin(`update public.couples set created_at = now() - interval '21 days'`)
    const [{ goal }] = await admin<{ goal: string }>(`insert into public.goals (couple_id, owner_id, created_by, title, minutes, days, recurring, week_start, created_on)
      select couple_id, id, id, 'Test', 15, array[1,2,3,4], false, public.week_start(public.today_paris()) - 7, public.week_start(public.today_paris()) - 7
      from public.profiles where id = $1 returning id as goal`, [VAL])
    await admin(`select public.generate_goal_tasks($1, public.week_start(public.today_paris()) - 7)`, [goal])
    await admin(`update public.tasks set done_at = now() where goal_id = $1 and planned_date = public.week_start(public.today_paris()) - 7`, [goal])

    await as(VAL, `select public.ensure_reviews()`)
    await as(VAL, `select public.ensure_reviews()`) // pas de doublon
    const rows = await as<{ profile_id: string; done: number; missed: number; surprise_due: boolean; id: string }>(VAL,
      `select id, profile_id, done, missed, surprise_due from public.weekly_reviews order by profile_id`)
    expect(rows).toHaveLength(2)
    const mine = rows.find((r) => r.profile_id === VAL)!
    expect(mine).toMatchObject({ done: 1, missed: 3, surprise_due: true })
    expect(rows.find((r) => r.profile_id === JULIE)!.surprise_due).toBe(false)

    await expect(as(VAL, `select public.mark_surprise_received($1)`, [mine.id])).rejects.toThrow(/l'autre/)
    await as(JULIE, `select public.mark_surprise_received($1)`, [mine.id])
    const [after] = await as<{ ok: boolean }>(VAL, `select surprise_received_at is not null as ok from public.weekly_reviews where id = $1`, [mine.id])
    expect(after.ok).toBe(true)
  })

  it('les abonnements aux notifications restent privés', async () => {
    await as(VAL, `insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth) values (auth.uid(), 'https://push.example/1', 'k', 'a')`)
    const seen = await as<{ n: number }>(JULIE, `select count(*)::int as n from public.push_subscriptions`)
    expect(seen[0].n).toBe(0)
    await expect(as(JULIE, `insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth) values ($1, 'https://push.example/2', 'k', 'a')`, [VAL]))
      .rejects.toThrow()
    await expect(as(VAL, `select * from public.notifications_log`)).rejects.toThrow(/permission/)
  })
})
