// Planche avant / après de l'étape R1 : npx tsx scripts/r1-board.ts <dossier de sortie> [dossier de pngjs]
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { fishGrid, PALETTES } from '../src/components/Fish'
import { refine, type Grid } from '../src/lib/pixelfine'
import type { FishColor } from '../src/lib/types'

const out = process.argv[2] ?? '.'
const require = createRequire((process.argv[3] ?? process.cwd()) + '/')
const { PNG } = require('pngjs')

const BG = [63, 167, 240]
const hexRgb = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]

const colors = Object.keys(PALETTES) as FishColor[]
const CELL_W = 20 * 6 // en pixels d'écran : 120 de large pour les deux versions
const CELL_H = 16 * 6
const GAP = 8

/** Dessine une grille dans l'image, chaque case de grille = k pixels d'écran */
function blit(png: any, g: Grid, px: number, py: number, k: number) {
  for (let gy = 0; gy < g.h; gy++) {
    for (let gx = 0; gx < g.w; gx++) {
      const c = g.cells[gy * g.w + gx]
      if (!c) continue
      const [r, gr, b] = hexRgb(c)
      for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
        const o = ((py + gy * k + j) * png.width + (px + gx * k + i)) << 2
        png.data[o] = r; png.data[o + 1] = gr; png.data[o + 2] = b; png.data[o + 3] = 255
      }
    }
  }
}

function board(name: string, items: Array<{ color: FishColor; stade: number }>) {
  const cols = items.length
  const w = cols * (CELL_W + GAP) + GAP
  const h = 2 * (CELL_H + GAP) + GAP
  const png = new PNG({ width: w, height: h })
  for (let i = 0; i < w * h; i++) { png.data[i * 4] = BG[0]; png.data[i * 4 + 1] = BG[1]; png.data[i * 4 + 2] = BG[2]; png.data[i * 4 + 3] = 255 }
  items.forEach((it, i) => {
    const before = fishGrid(it.color, it.stade)
    const after = refine(before)
    const x = GAP + i * (CELL_W + GAP)
    blit(png, before, x, GAP, 6) // avant : 20 × 16 cases de 6 px
    blit(png, after, x, GAP * 2 + CELL_H, 3) // après : 40 × 32 cases de 3 px, même taille à l'écran
  })
  writeFileSync(`${out}/${name}.png`, PNG.sync.write(png))
}

board('r1-stades', Array.from({ length: 10 }, (_, i) => ({ color: 'corail' as FishColor, stade: i + 1 })))
board('r1-couleurs', colors.map((c) => ({ color: c, stade: 6 })))
