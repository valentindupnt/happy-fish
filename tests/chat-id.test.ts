// Un petit mot peut être envoyé avec un identifiant choisi par l'app : un renvoi est refusé proprement (code 23505), jamais doublé
import { beforeAll, describe, expect, it } from 'vitest'
import { createDb, JULIE, OTHER, VAL } from './helpers'

let as: Awaited<ReturnType<typeof createDb>>['as']
let admin: Awaited<ReturnType<typeof createDb>>['admin']
let couple = ''
const ID = '12345678-1234-4234-8234-123456789012'

describe('Happy Fish, petits mots avec identifiant choisi par l’app', () => {
  beforeAll(async () => {
    ;({ as, admin } = await createDb())
    await admin(`insert into auth.users (id, email) values ('${VAL}', 'v@t.fr'), ('${JULIE}', 'j@t.fr'), ('${OTHER}', 'o@t.fr')`)
    const [{ code }] = await as<{ code: string }>(VAL, `select public.create_couple('Valentin') as code`)
    await as(JULIE, `select public.join_couple($1, 'Julie')`, [code])
    await as(OTHER, `select public.create_couple('Autre')`)
    couple = (await admin<{ c: string }>(`select couple_id as c from public.profiles where id = $1`, [VAL]))[0].c
  })

  it('le mot est enregistré avec cet identifiant, et le renvoyer ne crée pas de doublon', async () => {
    await as(VAL, `insert into public.messages (id, couple_id, author_id, kind, body) values ($1, $2, auth.uid(), 'text', 'Coucou')`, [ID, couple])
    await expect(as(VAL, `insert into public.messages (id, couple_id, author_id, kind, body) values ($1, $2, auth.uid(), 'text', 'Coucou')`, [ID, couple]))
      .rejects.toMatchObject({ code: '23505' })
    expect(await as(JULIE, `select id from public.messages where id = $1`, [ID])).toHaveLength(1)
  })

  it('un identifiant choisi ne permet pas d’écrire au nom de l’autre ni dans un autre duo', async () => {
    await expect(as(VAL, `insert into public.messages (id, couple_id, author_id, kind, body) values (gen_random_uuid(), $1, $2, 'text', 'faux')`, [couple, JULIE])).rejects.toThrow()
    await expect(as(OTHER, `insert into public.messages (id, couple_id, author_id, kind, body) values (gen_random_uuid(), $1, auth.uid(), 'text', 'intrus')`, [couple])).rejects.toThrow()
  })
})
