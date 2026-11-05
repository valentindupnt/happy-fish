// Tests de la migration 012 : quêtes annexes (tirage, snap, pièces, gardées, listes personnelles)
import { beforeAll, describe, expect, it } from 'vitest'
import { createDb, JULIE, OTHER, VAL } from './helpers'

let as: Awaited<ReturnType<typeof createDb>>['as']
let admin: Awaited<ReturnType<typeof createDb>>['admin']
let couple = ''

async function coins(user: string): Promise<number> {
  return (await as<{ coins: number }>(user, `select coins from public.fish_status where profile_id = auth.uid()`))[0].coins
}

async function mine(user: string) {
  return as<{ id: string; slot: number; title: string; hard: boolean; done_at: string | null; kept: boolean; streak: number; streak_base: number; template_id: string }>(user,
    `select id, slot, title, hard, done_at, kept, streak, streak_base, template_id from public.daily_quests
     where profile_id = auth.uid() and day = public.today_paris() order by slot`)
}

describe('Happy Fish, quêtes annexes', () => {
  beforeAll(async () => {
    ;({ as, admin } = await createDb())
    await admin(`insert into auth.users (id, email) values ('${VAL}', 'v@t.fr'), ('${JULIE}', 'j@t.fr'), ('${OTHER}', 'o@t.fr')`)
    const [{ code }] = await as<{ code: string }>(VAL, `select public.create_couple('Valentin') as code`)
    await as(JULIE, `select public.join_couple($1, 'Julie')`, [code])
    await as(OTHER, `select public.create_couple('Autre')`)
    couple = (await admin<{ c: string }>(`select couple_id as c from public.profiles where id = $1`, [VAL]))[0].c
  })

  it('le premier tirage copie la liste de départ et donne 3 quêtes, sans doublon ni double tirage', async () => {
    await as(VAL, `select public.ensure_daily_quests()`)
    await as(VAL, `select public.ensure_daily_quests()`)
    const list = await as<{ hard: boolean }>(VAL, `select hard from public.quest_templates where profile_id = auth.uid()`)
    expect(list).toHaveLength(37)
    expect(list.filter((t) => t.hard)).toHaveLength(19)
    const today = await mine(VAL)
    expect(today.map((q) => q.slot)).toEqual([1, 2, 3])
    expect(new Set(today.map((q) => q.template_id)).size).toBe(3)
  })

  it('chacun a sa liste, un autre duo ne voit rien', async () => {
    await as(JULIE, `select public.ensure_daily_quests()`)
    expect(await mine(JULIE)).toHaveLength(3)
    expect(await as(OTHER, `select id from public.daily_quests`)).toHaveLength(0)
    expect(await as(OTHER, `select id from public.quest_templates`)).toHaveLength(0)
    expect(Number((await as<{ n: number }>(VAL, `select count(distinct profile_id)::int as n from public.daily_quests`))[0].n)).toBe(2)
  })

  it('valider demande un snap dans le dossier du duo et rapporte 3 ou 5 pièces', async () => {
    const [q] = await mine(VAL)
    await expect(as(VAL, `select public.complete_quest($1, null)`, [q.id])).rejects.toThrow(/snap/)
    await expect(as(VAL, `select public.complete_quest($1, 'autre-duo/photo_10x10.jpg')`, [q.id])).rejects.toThrow(/snap/)
    await expect(as(JULIE, `select public.complete_quest($1, $2)`, [q.id, `${couple}/a_10x10.jpg`])).rejects.toThrow(/introuvable/)
    const before = await coins(VAL)
    await as(VAL, `select public.complete_quest($1, $2)`, [q.id, `${couple}/a_10x10.jpg`])
    expect((await coins(VAL)) - before).toBe(q.hard ? 5 : 3)
    await expect(as(VAL, `select public.complete_quest($1, $2)`, [q.id, `${couple}/b_10x10.jpg`])).rejects.toThrow(/déjà/)
    expect((await mine(VAL)).find((x) => x.id === q.id)).toMatchObject({ streak: 1, streak_base: 0 })
  })

  it('on ne peut pas tricher avec les pièces ni les quêtes en passant par les tables', async () => {
    const [q] = await mine(VAL)
    await expect(as(VAL, `update public.daily_quests set coins = 500 where id = $1`, [q.id])).rejects.toThrow()
    await expect(as(VAL, `insert into public.daily_quests (couple_id, profile_id, title, hard, day, slot) values ($1, auth.uid(), 'x', true, public.today_paris(), 3)`, [couple])).rejects.toThrow()
  })

  it('garder une quête : seulement après un snap, 2 au maximum', async () => {
    const quests = await mine(VAL)
    const [a, b, c] = quests
    await expect(as(VAL, `select public.keep_quest($1, true)`, [b.id])).rejects.toThrow(/snap/)
    for (const q of [b, c]) await as(VAL, `select public.complete_quest($1, $2)`, [q.id, `${couple}/${q.slot}_10x10.jpg`])
    await as(VAL, `select public.keep_quest($1, true)`, [a.id])
    await as(VAL, `select public.keep_quest($1, true)`, [b.id])
    await expect(as(VAL, `select public.keep_quest($1, true)`, [c.id])).rejects.toThrow(/2 quêtes/)
    await as(VAL, `select public.keep_quest($1, false)`, [b.id])
    await as(VAL, `select public.keep_quest($1, true)`, [c.id])
  })

  it('le lendemain, les gardées reviennent à leur place avec leur série, les autres sont retirées au hasard', async () => {
    const [a, b, c] = await mine(VAL)
    expect([a.kept, b.kept, c.kept]).toEqual([true, false, true])
    // On avance d'un jour : les quêtes d'hier deviennent celles d'« hier »
    await admin(`update public.daily_quests set day = day - 1 where profile_id = $1`, [VAL])
    await as(VAL, `select public.ensure_daily_quests()`)
    const next = await mine(VAL)
    expect(next).toHaveLength(3)
    expect(next[0]).toMatchObject({ template_id: a.template_id, streak_base: 1, done_at: null })
    expect(next[2]).toMatchObject({ template_id: c.template_id, streak_base: 1 })
    expect(next[1].template_id).not.toBe(b.template_id)
    // Valider une gardée continue la série
    await as(VAL, `select public.complete_quest($1, $2)`, [next[0].id, `${couple}/n_10x10.jpg`])
    expect((await mine(VAL))[0].streak).toBe(2)
  })

  it('une quête gardée mais retirée de la liste ne revient pas', async () => {
    const [a] = await mine(VAL)
    await as(VAL, `select public.keep_quest($1, true)`, [a.id])
    await as(VAL, `update public.quest_templates set archived = true where id = $1`, [a.template_id])
    await admin(`update public.daily_quests set day = day - 1 where profile_id = $1`, [VAL])
    await as(VAL, `select public.ensure_daily_quests()`)
    expect((await mine(VAL)).map((q) => q.template_id)).not.toContain(a.template_id)
  })

  it('ajouter et retirer ses quêtes : seulement les siennes', async () => {
    await as(VAL, `insert into public.quest_templates (couple_id, profile_id, title, hard) values ($1, auth.uid(), 'Faire un câlin de 20 secondes', false)`, [couple])
    await expect(as(VAL, `insert into public.quest_templates (couple_id, profile_id, title, hard) values ($1, $2, 'Pour Julie', false)`, [couple, JULIE])).rejects.toThrow()
    const [t] = await as<{ id: string }>(JULIE, `select id from public.quest_templates where title = 'Faire un câlin de 20 secondes'`)
    expect(t.id).toBeTruthy() // visible dans le duo
    await as(JULIE, `update public.quest_templates set archived = true where id = $1`, [t.id])
    const [still] = await as<{ archived: boolean }>(VAL, `select archived from public.quest_templates where id = $1`, [t.id])
    expect(still.archived).toBe(false) // le changement de Julie n'a rien touché
  })
})
