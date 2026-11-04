// Tests du widget : jeton secret par personne, données lisibles seulement côté serveur
import { beforeAll, describe, expect, it } from 'vitest'
import { createDb, JULIE, OTHER, VAL } from './helpers'

let as: Awaited<ReturnType<typeof createDb>>['as']
let admin: Awaited<ReturnType<typeof createDb>>['admin']

describe('Happy Fish, widget', () => {
  beforeAll(async () => {
    ;({ as, admin } = await createDb())
    await admin(`insert into auth.users (id, email) values ('${VAL}', 'v@t.fr'), ('${JULIE}', 'j@t.fr'), ('${OTHER}', 'o@t.fr')`)
    const [{ code }] = await as<{ code: string }>(VAL, `select public.create_couple('Valentin') as code`)
    await as(JULIE, `select public.join_couple($1, 'Julie')`, [code])
    await as(OTHER, `select public.create_couple('Autre')`)
  })

  it('le jeton est créé une fois, stable, et change sur demande', async () => {
    const [{ t: a }] = await as<{ t: string }>(VAL, `select public.my_widget_token() as t`)
    const [{ t: b }] = await as<{ t: string }>(VAL, `select public.my_widget_token() as t`)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(b).toBe(a)
    const [{ t: c }] = await as<{ t: string }>(VAL, `select public.reset_widget_token() as t`)
    expect(c).not.toBe(a)
    expect((await admin<{ d: unknown }>(`select public.widget_data($1) as d`, [a]))[0].d).toBeNull()
  })

  it('le widget montre les deux poissons du duo, moi en premier', async () => {
    const [{ t }] = await as<{ t: string }>(JULIE, `select public.my_widget_token() as t`)
    const [{ d }] = await admin<{ d: { fishes: Array<{ me: boolean; name: string; level: number; stade: string }>; aquarium: boolean } }>(`select public.widget_data($1) as d`, [t])
    expect(d.fishes).toHaveLength(2)
    expect(d.fishes[0]).toMatchObject({ me: true, name: 'Julie', level: 1, stade: 'Alevin' })
    expect(d.fishes[1].name).toBe('Valentin')
    expect(d.aquarium).toBe(false)
  })

  it('personne ne lit les jetons ni les données du widget depuis l’app', async () => {
    await expect(as(VAL, `select * from public.widget_tokens`)).rejects.toThrow(/permission/)
    await expect(as(OTHER, `select public.widget_data('x')`)).rejects.toThrow(/permission/)
  })
})
