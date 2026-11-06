// Tests des petits mots côté app : fusion des rechargements, nouvel essai réseau, identifiant choisi avant l'envoi
import { describe, expect, it } from 'vitest'
import { isNetworkError, mergeMessages, newMessageId } from '../src/lib/messages'
import type { Message } from '../src/lib/types'

const msg = (n: number, over: Partial<Message> = {}): Message => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, author_id: 'a', kind: 'text', body: `mot ${n}`, task_id: null,
  created_at: new Date(Date.UTC(2026, 10, 6, 8, 0, n)).toISOString(), ...over,
})

describe('petits mots', () => {
  it('un rechargement en retard ne fait pas disparaître un mot reçu entre-temps', () => {
    const recent = [msg(1), msg(2), msg(3)] // état courant : le mot 3 vient d'arriver
    const stale = [msg(1), msg(2)] // rechargement parti avant l'arrivée du mot 3
    expect(mergeMessages(recent, stale).map((m) => m.id)).toEqual(recent.map((m) => m.id))
  })

  it('pas de doublon, ordre chronologique, la version la plus récente d’un mot l’emporte', () => {
    const out = mergeMessages([msg(2), msg(1)], [msg(3), msg(2, { body: 'modifié' })])
    expect(out.map((m) => m.body)).toEqual(['mot 1', 'modifié', 'mot 3'])
  })

  it('garde les 300 derniers mots', () => {
    const many = Array.from({ length: 350 }, (_, i) => msg(i + 1))
    const out = mergeMessages([], many)
    expect(out).toHaveLength(300)
    expect(out[0].body).toBe('mot 51')
    expect(out.at(-1)!.body).toBe('mot 350')
  })

  it('reconnaît une coupure de réseau, pas une vraie erreur de la base', () => {
    for (const m of ['TypeError: Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.', 'The network connection was lost.']) {
      expect(isNetworkError({ message: m })).toBe(true)
    }
    expect(isNetworkError({ message: 'new row violates row-level security policy' })).toBe(false)
    expect(isNetworkError(null)).toBe(false)
  })

  it('l’identifiant d’un nouveau mot est un UUID valide et unique', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newMessageId()))
    expect(ids.size).toBe(50)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('rien de neuf au rechargement : la même liste est rendue, l’écran ne redessine rien', () => {
    const mk = (id: string, t: string) => ({ id, author_id: 'a', kind: 'text' as const, body: id, task_id: null, image_path: null, created_at: t })
    const prev = [mk('1', '2026-11-01T10:00:00Z'), mk('2', '2026-11-01T10:01:00Z')]
    const copy = prev.map((m) => ({ ...m }))
    expect(mergeMessages(prev, copy)).toBe(prev)
    const more = mergeMessages(prev, [...copy, mk('3', '2026-11-01T10:02:00Z')])
    expect(more).not.toBe(prev)
    expect(more.map((m) => m.id)).toEqual(['1', '2', '3'])
  })
})
