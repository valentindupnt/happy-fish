// Tests des photos dans les petits mots (migration 009)
import { beforeAll, describe, expect, it } from 'vitest'
import { createDb, JULIE, OTHER, SQL_FILES, VAL } from './helpers'

let as: Awaited<ReturnType<typeof createDb>>['as']
let admin: Awaited<ReturnType<typeof createDb>>['admin']
let couple = ''
let otherCouple = ''

const insertMsg = (user: string, c: string, kind: string, path: string | null, body: string | null = null) =>
  as(user, `insert into public.messages (couple_id, author_id, kind, image_path, body) values ($1, auth.uid(), $2, $3, $4)`, [c, kind, path, body])

describe('Happy Fish, photos dans les petits mots', () => {
  beforeAll(async () => {
    ;({ as, admin } = await createDb(SQL_FILES))
    await admin(`insert into auth.users (id, email) values ('${VAL}', 'v@t.fr'), ('${JULIE}', 'j@t.fr'), ('${OTHER}', 'o@t.fr')`)
    const [{ code }] = await as<{ code: string }>(VAL, `select public.create_couple('Valentin') as code`)
    await as(JULIE, `select public.join_couple($1, 'Julie')`, [code])
    await as(OTHER, `select public.create_couple('Seul')`)
    couple = (await admin<{ c: string }>(`select couple_id::text as c from public.profiles where id = $1`, [VAL]))[0].c
    otherCouple = (await admin<{ c: string }>(`select couple_id::text as c from public.profiles where id = $1`, [OTHER]))[0].c
  })

  it('une photo du duo, avec ou sans légende, se lit chez l’autre', async () => {
    await insertMsg(VAL, couple, 'image', `${couple}/a.jpg`)
    await insertMsg(VAL, couple, 'image', `${couple}/b.jpg`, 'Au sommet !')
    const rows = await as<{ image_path: string; body: string | null }>(JULIE, `select image_path, body from public.messages where kind = 'image' order by created_at, image_path`)
    expect(rows.map((r) => r.image_path)).toEqual([`${couple}/a.jpg`, `${couple}/b.jpg`])
    expect(rows[1].body).toBe('Au sommet !')
  })

  it('pas de photo hors du dossier de son duo, ni sans fichier', async () => {
    await expect(insertMsg(VAL, couple, 'image', `${otherCouple}/x.jpg`)).rejects.toThrow()
    await expect(insertMsg(VAL, couple, 'image', null)).rejects.toThrow()
    await expect(insertMsg(VAL, couple, 'text', `${couple}/x.jpg`, 'coucou')).rejects.toThrow()
  })

  it('les autres messages marchent comme avant, et un autre duo ne voit rien', async () => {
    await insertMsg(JULIE, couple, 'text', null, 'Courage !')
    await insertMsg(JULIE, couple, 'bubble', null)
    await expect(insertMsg(JULIE, couple, 'treat', null)).rejects.toThrow()
    const seen = await as<{ n: number }>(OTHER, `select count(*)::int as n from public.messages`)
    expect(seen[0].n).toBe(0)
  })
})
