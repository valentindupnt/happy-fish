// Le script Scriptable s'exécute sans erreur et dessine les deux bocaux
import { describe, expect, it } from 'vitest'
import { widgetScript } from '../src/lib/widgetScript'

function run(family: string, payload: unknown) {
  const calls: string[] = []
  class Color { constructor(public hex: string) {} }
  class Rect { constructor(public x: number, public y: number, public w: number, public h: number) {} }
  class Size { constructor(public w: number, public h: number) {} }
  class DrawContext {
    size: unknown; opaque = false; respectScreenScale = false
    setFillColor() {} fillRect() { calls.push('rect') } fillEllipse() { calls.push('ellipse') }
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
  return fn(Color, Rect, Size, DrawContext, ListWidget, Request, Font, Script, config).then(() => calls)
}

const payload = {
  aquarium: false, pot: 10, date: '2026-11-04',
  fishes: [
    { me: true, name: 'Valentin', fish_name: 'Pépite', color: 'corail', hat: 'casquette', level: 4, stade: 'Petit', done: 2, total: 3 },
    { me: false, name: 'Julie', fish_name: 'Mochi', color: 'rose', hat: null, level: 6, stade: 'Petit', done: 2, total: 2 },
  ],
}

describe('widget Scriptable', () => {
  it('moyen : deux bocaux, noms et avancement', async () => {
    const calls = await run('medium', payload)
    expect(calls.filter((c) => c === 'ellipse')).toHaveLength(4)
    expect(calls).toContain('text:Pépite, niv. 4')
    expect(calls).toContain('text:2 sur 3 aujourd’hui')
    expect(calls).toContain('text:journée complète !')
    expect(calls.slice(-2)).toEqual(['set', 'done'])
  })

  it('petit : seulement mon poisson ; sans réseau : un message', async () => {
    const small = await run('small', payload)
    expect(small).toContain('text:Pépite, niv. 4')
    expect(small).not.toContain('text:Mochi, niv. 6')
    const offline = await run('medium', null)
    expect(offline).toContain('text:Happy Fish attend le réseau')
  })
})
