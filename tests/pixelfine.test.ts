// Tests du moteur « pixels fins » (étape R1)
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { Fish, fishGrid, fineRuns, HATS, PALETTES, STADE_PARTS } from '../src/components/Fish'
import type { FishColor } from '../src/lib/types'
import { getCell, makeGrid, mix, OUTLINE, refine, scale2x, setCell, shade, toRuns } from '../src/lib/pixelfine'

describe('pixelfine', () => {
  it('double la taille et garde le décalage du dessin', () => {
    const g = makeGrid(20, 16, -1, -4)
    setCell(g, 0, 0, '#FF0000')
    const r = scale2x(g)
    expect([r.w, r.h, r.ox, r.oy]).toEqual([40, 32, -2, -8])
    expect(getCell(r, 0, 0)).toBe('#FF0000')
  })

  it('un pixel isolé donne un carré 2 × 2 de la même couleur', () => {
    const g = makeGrid(3, 3)
    setCell(g, 1, 1, '#00FF00')
    const r = scale2x(g)
    for (const [x, y] of [[2, 2], [3, 2], [2, 3], [3, 3]]) expect(getCell(r, x, y)).toBe('#00FF00')
  })

  it('une diagonale est adoucie (le coin du pixel est rempli)', () => {
    const g = makeGrid(3, 3)
    setCell(g, 0, 0, '#111111')
    setCell(g, 1, 1, '#111111')
    setCell(g, 2, 2, '#111111')
    const r = scale2x(g)
    expect(getCell(r, 1, 2)).toBe('#111111')
  })

  it('l\'ombrage éclaire le bord haut, assombrit le bord bas et laisse le contour', () => {
    const g = makeGrid(1, 5)
    setCell(g, 0, 0, OUTLINE)
    setCell(g, 0, 1, '#808080')
    setCell(g, 0, 2, '#808080')
    setCell(g, 0, 3, '#808080')
    setCell(g, 0, 4, OUTLINE)
    const s = shade(g)
    expect(getCell(s, 0, 0)).toBe(OUTLINE)
    expect(getCell(s, 0, 1)).toBe(mix('#808080', '#FFFFFF', 0.28))
    expect(getCell(s, 0, 2)).toBe('#808080')
    expect(getCell(s, 0, 3)).toBe(mix('#808080', OUTLINE, 0.28))
  })

  it('refine ne sort jamais du cadre et ne change pas la grille d\'origine', () => {
    const g = makeGrid(20, 16, -1, -4)
    setCell(g, 5, 5, '#FF8C1A')
    const copie = g.cells.slice()
    const r = refine(g)
    expect(g.cells).toEqual(copie)
    expect([r.w, r.h]).toEqual([40, 32])
  })

  it('toRuns regroupe les cases voisines de même couleur', () => {
    const g = makeGrid(4, 1)
    for (let x = 0; x < 3; x++) setCell(g, x, 0, '#123456')
    expect(toRuns(g)).toEqual([{ x: 0, y: 0, w: 3, c: '#123456' }])
  })

  describe('poisson fin', () => {
    const colors = Object.keys(PALETTES) as FishColor[]

    it('le poisson de base : grille 36 × 24 attendue (contour, œil, corps)', () => {
      const f = refine(fishGrid('corail', 1))
      expect([f.w, f.h]).toEqual([40, 32])
      // l'œil : le blanc du dessin d'origine (12,4) devient un bloc 2 × 2 dont le coin est arrondi (Scale2x), la pupille (13,4) reste pleine
      const blanc = [[24, 8], [25, 8], [24, 9], [25, 9]].filter(([x, y]) => getCell(f, x, y) === '#FFFFFF')
      expect(blanc.length).toBeGreaterThanOrEqual(2)
      expect(getCell(f, 27, 9)).toBe(OUTLINE)
      // le contour de la queue (1,3) → (2..3, 6..7)
      expect(getCell(f, 2, 7)).toBe(OUTLINE)
      // le corps garde la couleur du poisson au milieu
      expect(getCell(f, 14, 11)).toBe('#FF8C1A')
    })

    it('chaque stade n\'ajoute que des détails (jamais de pixel perdu)', () => {
      let prev = 0
      for (let s = 1; s <= 10; s++) {
        const n = fishGrid('corail', s).cells.filter(Boolean).length
        expect(n).toBeGreaterThanOrEqual(prev)
        prev = n
      }
    })

    it('rien n\'est rogné par le cadre : stades, chapeaux et humeurs tiennent dedans', () => {
      const inside = (x: number, y: number, w: number, h: number) => x >= -1 && y >= -4 && x + w <= 19 && y + h <= 12
      for (const [, parts] of STADE_PARTS) for (const [x, y, w, h] of parts) expect(inside(x, y, w, h)).toBe(true)
      for (const [name, px] of Object.entries(HATS)) for (const [x, y, w, h] of px) expect(inside(x, y, w, h), name).toBe(true)
    })

    it('les 10 couleurs, 10 stades et 9 chapeaux se dessinent, en cache et sans trou', () => {
      for (const c of colors) {
        for (let s = 1; s <= 10; s++) {
          const a = fineRuns(c, s, 'normal', null, false)
          expect(a.length).toBeGreaterThan(20)
          expect(fineRuns(c, s, 'normal', null, false)).toBe(a)
        }
        for (const h of Object.keys(HATS)) expect(fineRuns(c, 5, 'normal', h, false).length).toBeGreaterThan(20)
      }
    })

    it('le chapeau et l\'humeur changent bien le dessin, la silhouette est unie', () => {
      const base = fineRuns('rose', 3, 'normal', null, false)
      expect(fineRuns('rose', 3, 'normal', 'couronne', false)).not.toEqual(base)
      for (const m of ['sleep', 'happy', 'think'] as const) expect(fineRuns('rose', 3, m, null, false)).not.toEqual(base)
      expect(new Set(fineRuns('rose', 3, 'normal', 'couronne', true).map((r) => r.c))).toEqual(new Set([OUTLINE]))
    })

    it('le composant rend un SVG en 36 × 32 avec ses animations d\'humeur', () => {
      const html = renderToStaticMarkup(createElement(Fish, { color: 'ocean', stade: 10, mood: 'sad', width: 80 }))
      expect(html).toContain('viewBox="0 -8 36 32"')
      expect(html).toContain('fish-tear')
      expect(html).toContain('fish-aura')
    })
  })
})
