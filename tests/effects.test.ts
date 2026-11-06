// Tests des effets des messages de force (migration 014) : propres à chaque compte, valeurs vérifiées par la base
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { EFFECTS, effectOf } from '../src/lib/effects'
import { createDb, JULIE, SQL_FILES, VAL } from './helpers'

let as: Awaited<ReturnType<typeof createDb>>['as']
let admin: Awaited<ReturnType<typeof createDb>>['admin']
let couple = ''

describe('Happy Fish, catalogue des effets', () => {
  it('chaque effet a un id unique, des couleurs et des particules', () => {
    expect(new Set(EFFECTS.map((e) => e.id)).size).toBe(EFFECTS.length)
    for (const e of EFFECTS) {
      expect(e.colors.length).toBeGreaterThan(0)
      expect(effectOf(e.id)).toBe(e)
    }
    expect(effectOf('inconnu')).toBeNull()
    expect(effectOf(null)).toBeNull()
  })
})

describe('Happy Fish, effets en base', () => {
  beforeAll(async () => {
    ;({ as, admin } = await createDb(SQL_FILES))
    await admin(`insert into auth.users (id, email) values ('${VAL}', 'v@t.fr'), ('${JULIE}', 'j@t.fr')`)
    const [{ code }] = await as<{ code: string }>(VAL, `select public.create_couple('Valentin') as code`)
    await as(JULIE, `select public.join_couple($1, 'Julie')`, [code])
    couple = (await admin<{ c: string }>(`select couple_id::text as c from public.profiles where id = $1`, [VAL]))[0].c
  })

  it('les mots de chacun sont à lui seul', async () => {
    await as(VAL, `insert into public.force_messages (profile_id, body, position) values (auth.uid(), 'Solo Val', 9)`)
    const mine = await as<{ body: string; effect: string | null }>(VAL, `select body, effect from public.force_messages`)
    const hers = await as<{ body: string }>(JULIE, `select body from public.force_messages`)
    expect(mine.map((r) => r.body)).toContain('Solo Val')
    expect(hers.map((r) => r.body)).not.toContain('Solo Val')
  })

  it('on règle l’effet de son mot, pas celui de l’autre', async () => {
    const [mot] = await as<{ id: string }>(VAL, `select id from public.force_messages where body = 'Courage'`)
    await as(VAL, `update public.force_messages set effect = 'coeurs' where id = $1`, [mot.id])
    const after = await as<{ effect: string }>(VAL, `select effect from public.force_messages where id = $1`, [mot.id])
    expect(after[0].effect).toBe('coeurs')
    await as(JULIE, `update public.force_messages set effect = 'bulles' where id = $1`, [mot.id])
    const still = await as<{ effect: string }>(VAL, `select effect from public.force_messages where id = $1`, [mot.id])
    expect(still[0].effect).toBe('coeurs')
  })

  it('un compte sans aucun mot reçoit trois mots à lui, modifiables, et les autres ne bougent pas', async () => {
    await as(JULIE, `delete from public.force_messages`)
    const backfill = readFileSync(new URL('../supabase/migrations/014_force_effects.sql', import.meta.url), 'utf8').match(/insert into public\.force_messages[\s\S]*?;\n/)![0]
    await admin(backfill)
    const hers = await as<{ body: string; effect: string }>(JULIE, `select body, effect from public.force_messages order by position`)
    expect(hers.map((r) => r.body)).toEqual(['Tu gères', 'Courage', 'Fier de toi'])
    expect(hers.every((r) => r.effect === 'pop')).toBe(true)
    await as(JULIE, `update public.force_messages set body = 'Allez toi' where body = 'Courage'`)
    await as(JULIE, `delete from public.force_messages where body = 'Fier de toi'`)
    // Rejouer le remplissage ne touche pas un compte qui a déjà des mots
    await admin(backfill)
    const again = await as<{ n: number }>(JULIE, `select count(*)::int as n from public.force_messages`)
    expect(again[0].n).toBe(2)
    const val = await as<{ n: number }>(VAL, `select count(*)::int as n from public.force_messages where body = 'Solo Val'`)
    expect(val[0].n).toBe(1)
  })

  it('un effet inconnu est refusé', async () => {
    await expect(as(VAL, `update public.force_messages set effect = 'feu' where body = 'Courage'`)).rejects.toThrow()
  })

  it('un mot envoyé garde son effet et l’autre le lit', async () => {
    await as(VAL, `insert into public.messages (couple_id, author_id, kind, body, effect) values ($1, auth.uid(), 'text', 'Courage', 'coeurs')`, [couple])
    const rows = await as<{ effect: string }>(JULIE, `select effect from public.messages where body = 'Courage'`)
    expect(rows[0].effect).toBe('coeurs')
  })

  it('l’effet est réservé aux mots écrits, pas aux photos ni aux GIFs', async () => {
    await expect(as(VAL, `insert into public.messages (couple_id, author_id, kind, body, effect) values ($1, auth.uid(), 'gif', 'bisous', 'pop')`, [couple])).rejects.toThrow()
    await expect(as(VAL, `insert into public.messages (couple_id, author_id, kind, body, effect) values ($1, auth.uid(), 'text', 'x', 'feu')`, [couple])).rejects.toThrow()
  })
})
