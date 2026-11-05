// Tests de la migration 011 : la roue des surprises tire dans la base, une seule fois par bilan
import { beforeAll, describe, expect, it } from 'vitest'
import { createDb, JULIE, OTHER, VAL } from './helpers'

let as: Awaited<ReturnType<typeof createDb>>['as']
let admin: Awaited<ReturnType<typeof createDb>>['admin']
let review = ''
let couple = ''

describe('Happy Fish, roue des surprises', () => {
  beforeAll(async () => {
    ;({ as, admin } = await createDb())
    await admin(`insert into auth.users (id, email) values ('${VAL}', 'v@t.fr'), ('${JULIE}', 'j@t.fr'), ('${OTHER}', 'o@t.fr')`)
    const [{ code }] = await as<{ code: string }>(VAL, `select public.create_couple('Valentin') as code`)
    await as(JULIE, `select public.join_couple($1, 'Julie')`, [code])
    await as(OTHER, `select public.create_couple('Autre')`)
    couple = (await admin<{ c: string }>(`select couple_id as c from public.profiles where id = $1`, [VAL]))[0].c

    // Valentin rate 3 sous-objectifs la semaine passée : une surprise lui est due
    await admin(`update public.couples set created_at = now() - interval '21 days'`)
    const [{ goal }] = await admin<{ goal: string }>(`insert into public.goals (couple_id, owner_id, created_by, title, minutes, days, recurring, week_start, created_on)
      select couple_id, id, id, 'Test', 15, array[1,2,3], false, public.week_start(public.today_paris()) - 7, public.week_start(public.today_paris()) - 7
      from public.profiles where id = $1 returning id as goal`, [VAL])
    await admin(`select public.generate_goal_tasks($1, public.week_start(public.today_paris()) - 7)`, [goal])
    await as(VAL, `select public.ensure_reviews()`)
    review = (await admin<{ id: string }>(`select id from public.weekly_reviews where profile_id = $1`, [VAL]))[0].id
  })

  it('il faut au moins 2 surprises dans la liste', async () => {
    await expect(as(JULIE, `select public.spin_wheel($1)`, [review])).rejects.toThrow(/au moins 2/)
    for (const t of ['Petit-déjeuner au lit', 'Massage']) {
      await as(JULIE, `insert into public.surprise_ideas (couple_id, created_by, title) values ($1, auth.uid(), $2)`, [couple, t])
    }
  })

  it('celui qui a raté ne peut pas lancer la roue, un autre duo non plus', async () => {
    await expect(as(VAL, `select public.spin_wheel($1)`, [review])).rejects.toThrow(/l'autre/)
    await expect(as(OTHER, `select public.spin_wheel($1)`, [review])).rejects.toThrow(/introuvable/)
  })

  it('le tirage est gardé et la roue ne tourne qu’une fois par bilan', async () => {
    const [{ pick }] = await as<{ pick: string }>(JULIE, `select public.spin_wheel($1) as pick`, [review])
    expect(['Petit-déjeuner au lit', 'Massage']).toContain(pick)
    const [row] = await as<{ surprise_pick: string; picked: boolean }>(VAL,
      `select surprise_pick, surprise_picked_at is not null as picked from public.weekly_reviews where id = $1`, [review])
    expect(row).toEqual({ surprise_pick: pick, picked: true })
    await expect(as(JULIE, `select public.spin_wheel($1)`, [review])).rejects.toThrow(/déjà tourné/)
  })

  it('pas de roue sans surprise due', async () => {
    const [{ id }] = await admin<{ id: string }>(`select id from public.weekly_reviews where profile_id = $1`, [JULIE])
    await expect(as(VAL, `select public.spin_wheel($1)`, [id])).rejects.toThrow(/3 ratés/)
  })
})
