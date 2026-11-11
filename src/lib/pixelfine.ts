// Moteur « pixels fins » (étape R1) : affine un dessin écrit en 18 × 12 vers une grille 36 × 24.
// Module pur, sans React : il prend une grille de couleurs et rend une grille de couleurs.
// 1) doublement des pixels avec lissage des diagonales (Scale2x), 2) ombrage : reflet en haut, ombre en bas.

/** Une case : couleur '#RRGGBB' ou null (transparent) */
export type Cell = string | null
export interface Grid { w: number; h: number; ox: number; oy: number; cells: Cell[] }

/** Couleur du contour et de la pupille dans les sprites */
export const OUTLINE = '#1B1B3A'

export function makeGrid(w: number, h: number, ox = 0, oy = 0): Grid {
  return { w, h, ox, oy, cells: new Array<Cell>(w * h).fill(null) }
}

/** Lit une case (coordonnées du dessin, pas de la grille) ; hors cadre = transparent */
export function getCell(g: Grid, x: number, y: number): Cell {
  const gx = x - g.ox
  const gy = y - g.oy
  if (gx < 0 || gy < 0 || gx >= g.w || gy >= g.h) return null
  return g.cells[gy * g.w + gx]
}

export function setCell(g: Grid, x: number, y: number, c: Cell): void {
  const gx = x - g.ox
  const gy = y - g.oy
  if (gx < 0 || gy < 0 || gx >= g.w || gy >= g.h) return
  g.cells[gy * g.w + gx] = c
}

/** Scale2x (AdvMAME2x) : chaque pixel devient 2 × 2, les diagonales sont adoucies. */
export function scale2x(g: Grid): Grid {
  const out = makeGrid(g.w * 2, g.h * 2, g.ox * 2, g.oy * 2)
  const at = (x: number, y: number): Cell => getCell(g, x, y)
  for (let y = g.oy; y < g.oy + g.h; y++) {
    for (let x = g.ox; x < g.ox + g.w; x++) {
      const p = at(x, y)
      const a = at(x, y - 1)
      const b = at(x + 1, y)
      const c = at(x - 1, y)
      const d = at(x, y + 1)
      let e0 = p, e1 = p, e2 = p, e3 = p
      if (c === a && c !== d && a !== b) e0 = a
      if (a === b && a !== c && b !== d) e1 = b
      if (d === c && d !== b && c !== a) e2 = c
      if (b === d && b !== a && d !== c) e3 = d
      setCell(out, x * 2, y * 2, e0)
      setCell(out, x * 2 + 1, y * 2, e1)
      setCell(out, x * 2, y * 2 + 1, e2)
      setCell(out, x * 2 + 1, y * 2 + 1, e3)
    }
  }
  return out
}

const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase()

/** Mélange c vers t (0 = c, 1 = t) */
export function mix(c: string, t: string, k: number): string {
  const [r1, g1, b1] = hex(c)
  const [r2, g2, b2] = hex(t)
  return toHex(r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k)
}

/** Ombrage : une case est « bord haut » si la case au-dessus est vide ou contour, « bord bas » pour celle du dessous.
 *  Les cases de contour et de pupille ne changent pas. Une seule rangée est éclaircie ou assombrie. */
export function shade(g: Grid, opts: { light?: number; dark?: number } = {}): Grid {
  const light = opts.light ?? 0.28
  const dark = opts.dark ?? 0.28
  const out: Grid = { ...g, cells: g.cells.slice() }
  const edge = (c: Cell) => c === null || c === OUTLINE
  for (let y = g.oy; y < g.oy + g.h; y++) {
    for (let x = g.ox; x < g.ox + g.w; x++) {
      const c = getCell(g, x, y)
      if (!c || c === OUTLINE || c === '#FFFFFF') continue
      const up = edge(getCell(g, x, y - 1))
      const down = edge(getCell(g, x, y + 1))
      if (up && !down) setCell(out, x, y, mix(c, '#FFFFFF', light))
      else if (down && !up) setCell(out, x, y, mix(c, OUTLINE, dark))
    }
  }
  return out
}

/** Chaîne complète : 18 × 12 (et ses débords) vers 36 × 24 ombré */
export function refine(g: Grid): Grid {
  return shade(scale2x(g))
}

/** Regroupe les cases en rectangles horizontaux (pour un rendu SVG léger) */
export function toRuns(g: Grid): Array<{ x: number; y: number; w: number; c: string }> {
  const runs: Array<{ x: number; y: number; w: number; c: string }> = []
  for (let y = g.oy; y < g.oy + g.h; y++) {
    let x = g.ox
    while (x < g.ox + g.w) {
      const c = getCell(g, x, y)
      if (!c) { x++; continue }
      let w = 1
      while (x + w < g.ox + g.w && getCell(g, x + w, y) === c) w++
      runs.push({ x, y, w, c })
      x += w
    }
  }
  return runs
}
