// Tests des GIFs dans les petits mots (migration 010) et de la banque de fichiers
import { existsSync, readdirSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { GIF_ID, GIFS } from '../src/lib/gifs'
import { createDb, JULIE, OTHER, SQL_FILES, VAL } from './helpers'

let as: Awaited<ReturnType<typeof createDb>>['as']
let admin: Awaited<ReturnType<typeof createDb>>['admin']
let couple = ''

const dir = new URL('../public/gifs/', import.meta.url)
const insertGif = (user: string, c: string, body: string | null, extra = '') =>
  as(user, `insert into public.messages (couple_id, author_id, kind, body${extra ? ', image_path' : ''}) values ($1, auth.uid(), 'gif', $2${extra ? ', $3' : ''})`,
    extra ? [c, body, extra] : [c, body])

describe('Happy Fish, banque de GIFs', () => {
  it('chaque GIF du catalogue a son fichier, un nom valide et unique', () => {
    const ids = GIFS.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toMatch(GIF_ID)
      expect(existsSync(new URL(`${id}.gif`, dir))).toBe(true)
    }
    const files = readdirSync(dir).filter((f) => f.endsWith('.gif')).map((f) => f.replace(/\.gif$/, ''))
    expect(files.sort()).toEqual([...ids].sort())
  })
})

describe('Happy Fish, GIFs dans les petits mots', () => {
  beforeAll(async () => {
    ;({ as, admin } = await createDb(SQL_FILES))
    await admin(`insert into auth.users (id, email) values ('${VAL}', 'v@t.fr'), ('${JULIE}', 'j@t.fr'), ('${OTHER}', 'o@t.fr')`)
    const [{ code }] = await as<{ code: string }>(VAL, `select public.create_couple('Valentin') as code`)
    await as(JULIE, `select public.join_couple($1, 'Julie')`, [code])
    await as(OTHER, `select public.create_couple('Seul')`)
    couple = (await admin<{ c: string }>(`select couple_id::text as c from public.profiles where id = $1`, [VAL]))[0].c
  })

  it('un GIF du duo se lit chez l’autre, pas dans un autre duo', async () => {
    await insertGif(VAL, couple, 'my-jaw')
    const rows = await as<{ body: string }>(JULIE, `select body from public.messages where kind = 'gif'`)
    expect(rows.map((r) => r.body)).toEqual(['my-jaw'])
    const seen = await as<{ n: number }>(OTHER, `select count(*)::int as n from public.messages`)
    expect(seen[0].n).toBe(0)
  })

  it('pas de GIF sans nom, avec un nom bizarre ou avec une photo', async () => {
    await expect(insertGif(VAL, couple, null)).rejects.toThrow()
    await expect(insertGif(VAL, couple, '../x')).rejects.toThrow()
    await expect(insertGif(VAL, couple, 'Bisous !')).rejects.toThrow()
    await expect(insertGif(VAL, couple, 'bisous', `${couple}/a.jpg`)).rejects.toThrow()
  })

  it('les autres messages marchent comme avant', async () => {
    await as(JULIE, `insert into public.messages (couple_id, author_id, kind, body) values ($1, auth.uid(), 'text', 'Courage !')`, [couple])
    await as(JULIE, `insert into public.messages (couple_id, author_id, kind) values ($1, auth.uid(), 'bubble')`, [couple])
    await expect(as(JULIE, `insert into public.messages (couple_id, author_id, kind) values ($1, auth.uid(), 'treat')`, [couple])).rejects.toThrow()
  })
})
