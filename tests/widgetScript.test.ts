// Le script Scriptable s'exécute sans erreur : bocaux, score en couleur, humeur selon l'heure
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { widgetScript } from '../src/lib/widgetScript'

function run(family: string, payload: unknown) {
  const calls: string[] = []
  const fills: string[] = []
  const xs: number[] = []
  const ws: number[] = []
  class Color { constructor(public hex: string, public alpha = 1) {} }
  class Rect { constructor(public x: number, public y: number, public w: number, public h: number) {} }
  class Size { constructor(public w: number, public h: number) {} }
  class DrawContext {
    size: unknown; opaque = false; respectScreenScale = false
    setFillColor(c: Color) { fills.push(c.hex) }
    fillRect(r: Rect) { calls.push('rect'); xs.push(Math.round(r.x * 100)); ws.push(r.w) }
    fillEllipse() { calls.push('ellipse') }
    setFont() {} setTextColor() {} setTextAlignedCenter() {}
    drawTextInRect(t: string) { calls.push(`text:${t}`) }
    getImage() { return 'img' }
  }
  class ListWidget { url = ''; refreshAfterDate: unknown; backgroundImage: unknown; setPadding() {} presentMedium() {} presentSmall() {} }
  class Request { headers: unknown; constructor(public url: string) {} async loadJSON() { return payload } }
  const Font = { boldSystemFont: () => 'b', mediumSystemFont: () => 'm' }
  const Script = { setWidget: () => calls.push('set'), complete: () => calls.push('done') }
  const config = { widgetFamily: family, runsInWidget: true }
  const AsyncFn = Object.getPrototypeOf(async () => undefined).constructor
  const fn = new AsyncFn('Color', 'Rect', 'Size', 'DrawContext', 'ListWidget', 'Request', 'Font', 'Script', 'config', widgetScript('a'.repeat(64)))
  return fn(Color, Rect, Size, DrawContext, ListWidget, Request, Font, Script, config).then(() => ({ calls, fills, xs, ws }))
}

const payload = {
  aquarium: false, pot: 10, date: '2026-11-04',
  fishes: [
    { me: true, name: 'Valentin', fish_name: 'Pépite', color: 'corail', hat: 'casquette', level: 4, stade: 'Petit', done: 2, total: 3 },
    { me: false, name: 'Julie', fish_name: 'Mochi', color: 'rose', hat: null, level: 6, stade: 'Petit', done: 2, total: 2 },
  ],
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-04T12:00:00+01:00')) // midi à Paris
})
afterEach(() => vi.useRealTimers())

describe('widget Scriptable', () => {
  it('moyen : deux bocaux, noms et avancement', async () => {
    const { calls } = await run('medium', payload)
    expect(calls.filter((c) => c === 'ellipse').length).toBeGreaterThanOrEqual(4) // 2 bocaux + bulles
    expect(calls).toContain('text:Pépite, niv. 4')
    expect(calls).toContain('text:2 sur 3 aujourd’hui')
    expect(calls).toContain('text:journée complète !')
    expect(calls.slice(-2)).toEqual(['set', 'done'])
  })

  it('petit : seulement mon poisson ; sans réseau : un message', async () => {
    const { calls: small } = await run('small', payload)
    expect(small).toContain('text:Pépite, niv. 4')
    expect(small).not.toContain('text:Mochi, niv. 6')
    const { calls: offline } = await run('medium', null)
    expect(offline).toContain('text:Happy Fish attend le réseau')
  })

  it('le score du jour est en couleur : rouge, orange, vert clair, vert', async () => {
    const mk = (done: number, total: number) => ({ ...payload, fishes: [{ ...payload.fishes[0], done, total }] })
    expect((await run('small', mk(1, 4))).fills).toContain('#E5484D') // 25 % : rouge
    expect((await run('small', mk(3, 6))).fills).toContain('#F5A524') // 50 % : orange
    expect((await run('small', mk(4, 6))).fills).toContain('#8BC34A') // 67 % : vert clair
    expect((await run('small', mk(6, 6))).fills).toContain('#1E9E57') // 100 % : vert
    expect((await run('small', mk(0, 0))).fills).not.toContain('#E5484D') // rien de prévu : pas de score
  })

  it('la nuit le poisson dort, le jour non', async () => {
    vi.setSystemTime(new Date('2026-11-04T23:30:00+01:00'))
    const night = await run('medium', payload)
    expect(night.calls).toContain('text:Z')
    expect(night.calls).toContain('text:z')
    vi.setSystemTime(new Date('2026-11-04T06:59:00+01:00'))
    expect((await run('medium', payload)).calls).toContain('text:z')
    vi.setSystemTime(new Date('2026-11-04T07:00:00+01:00'))
    expect((await run('medium', payload)).calls).not.toContain('text:z')
  })

  it('journée complète : il danse (étincelles dorées)', async () => {
    const done = { ...payload, fishes: [{ ...payload.fishes[1] }] }
    expect((await run('small', done)).fills).toContain('#FFD166')
    expect((await run('small', payload)).fills).not.toContain('#FFD166') // 2 sur 3 : pas d'étincelles
  })

  it('la position change d’un rafraîchissement à l’autre', async () => {
    const seen = new Set<string>()
    for (let i = 0; i < 12; i++) seen.add((await run('small', payload)).xs.join(','))
    expect(seen.size).toBeGreaterThan(1)
  })

  it('le poisson grandit avec son stade', async () => {
    const mk = (level: number) => ({ ...payload, fishes: [{ ...payload.fishes[0], level, hat: null }] })
    const px = async (level: number) => {
      const { ws } = await run('small', mk(level))
      return Math.min(...ws.filter((w) => w > 0 && w < 10)) // la plus petite case du sprite
    }
    expect(await px(50)).toBeGreaterThan(await px(1))
  })
})
