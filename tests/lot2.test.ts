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

  it('les pièces suivent l’XP : 1 pièce pour 5 XP', async () => {
    expect(await coins(VAL)).toBe(0)
    await giveXp(VAL, 300) // niveau 7
    expect(await coins(VAL)).toBe(60)
  })

  it('acheter une couleur retire les pièces, une seule fois', async () => {
    const [{ left }] = await as<{ left: number }>(VAL, `select public.buy_item('amethyste') as left`)
    expect(left).toBe(45)
    await expect(as(VAL, `select public.buy_item('amethyste')`)).rejects.toThrow(/déjà/)
  })

  it('un objet au-dessus de son niveau est refusé', async () => {
    await expect(as(VAL, `select public.buy_item('or')`)).rejects.toThrow(/niveau 30/)
    await expect(as(VAL, `select public.buy_item('crevette')`)).rejects.toThrow(/niveau 12/)
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

  it('les décorations communes attendent l’aquarium à deux', async () => {
    await expect(as(VAL, `select public.buy_decor('plante')`)).rejects.toThrow(/Aquarium à deux/)
  })

  it('l’aquarium à deux s’achète ensemble : les deux poissons au niveau 8 et 150 pièces', async () => {
    await giveXp(JULIE, 610) // niveau 11, plafonné à 10 dans les bocaux : 122 pièces
    expect(await coins(JULIE)).toBe(122)
    await expect(as(VAL, `select public.contribute(999)`)).rejects.toThrow(/Pas assez/)
    await as(VAL, `select public.contribute(20)`)
    const [{ pot }] = await as<{ pot: number }>(JULIE, `select public.contribute(122) as pot`)
    expect(pot).toBe(142)
    // la cagnotte ne déclenche plus d'achat toute seule
    const [c0] = await as<{ habitat: number }>(VAL, `select habitat from public.couples`)
    expect(c0.habitat).toBe(0)
    await expect(as(VAL, `select public.buy_habitat()`)).rejects.toThrow(/niveau 8/) // Valentin est niveau 7
    await giveXp(VAL, 100) // 400 XP : niveau 8, 20 pièces de plus
    await expect(as(VAL, `select public.buy_habitat()`)).rejects.toThrow(/cagnotte/)
    await as(VAL, `select public.contribute(8)`)
    const [{ h }] = await as<{ h: number }>(JULIE, `select public.buy_habitat() as h`)
    expect(h).toBe(1)
    const [c] = await as<{ habitat: number; aquarium_bought: boolean }>(VAL, `select habitat, aquarium_bought from public.couples`)
    expect(c).toEqual({ habitat: 1, aquarium_bought: true })
    const [{ p }] = await as<{ p: number }>(VAL, `select public.get_pot() as p`)
    expect(p).toBe(0)
    await expect(as(VAL, `select public.buy_habitat()`)).rejects.toThrow(/niveau 18/)
  })

  it('avec l’aquarium à deux, l’XP en réserve fait monter le niveau', async () => {
    const [f] = await as<{ level: number }>(JULIE, `select level from public.fish_status where profile_id = auth.uid()`)
    expect(f.level).toBe(11)
  })

  it('les décorations se paient avec la cagnotte, et celles du récif attendent le récif', async () => {
    await expect(as(VAL, `select public.buy_decor('chateau')`)).rejects.toThrow(/cagnotte/)
    await expect(as(VAL, `select public.buy_decor('corail')`)).rejects.toThrow(/Récif/)
    await giveXp(JULIE, 100) // 20 pièces
    await as(JULIE, `select public.contribute(15)`)
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
