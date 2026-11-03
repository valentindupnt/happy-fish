import type { FishColor } from '../lib/types'

// Sprite 18 × 12 : o contour, b corps, l ventre, f nageoires, h reflet, w blanc de l'œil, k pupille
const SPRITE = [
  '........ooo.......',
  '.......offfo......',
  '..oo..obbbbboo....',
  '.offoobbhhbbbbo...',
  '.offfobbbbbbwkbo..',
  '..offobbbbbbkkbbo.',
  '..offobbllllbbbbo.',
  '.offfobllllllbbo..',
  '.offoobblllbbbo...',
  '..oo..oobbbboo....',
  '.......offo.......',
  '........oo........',
]

export const PALETTES: Record<FishColor, { label: string; b: string; l: string; f: string; h: string }> = {
  corail: { label: 'Corail', b: '#FF8C1A', l: '#FFE0A3', f: '#FF5E3A', h: '#FFB866' },
  rose: { label: 'Rose', b: '#FF6FAE', l: '#FFD3E6', f: '#C2378A', h: '#FF9CC8' },
  lagon: { label: 'Lagon', b: '#2ECC71', l: '#C9F5DC', f: '#1E9E57', h: '#7FE3A8' },
  ocean: { label: 'Océan', b: '#4D8EEA', l: '#CFE1FB', f: '#1B4F8C', h: '#8DB7F2' },
  soleil: { label: 'Soleil', b: '#F2C66D', l: '#FFF1C9', f: '#D99A2B', h: '#FFE08F' },
}

interface Run { x: number; y: number; w: number; c: string }

function runsFor(color: FishColor): Run[] {
  const p = PALETTES[color]
  const colorOf = (ch: string, x: number) => {
    if (x === 9 && 'bhl'.includes(ch)) return '#FFFFFF'
    switch (ch) {
      case 'o': case 'k': return '#1B1B3A'
      case 'w': return '#FFFFFF'
      case 'b': return p.b
      case 'l': return p.l
      case 'f': return p.f
      case 'h': return p.h
      default: return ''
    }
  }
  const runs: Run[] = []
  SPRITE.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const c = colorOf(row[x], x)
      if (!c) { x++; continue }
      let w = 1
      while (x + w < row.length && colorOf(row[x + w], x + w) === c) w++
      runs.push({ x, y, w, c })
      x += w
    }
  })
  return runs
}

const cache = new Map<FishColor, Run[]>()

export function Fish({ color, width = 54, flip = false, label }: { color: FishColor; width?: number; flip?: boolean; label?: string }) {
  if (!cache.has(color)) cache.set(color, runsFor(color))
  const runs = cache.get(color)!
  return (
    <svg
      viewBox="0 0 18 12"
      width={width}
      height={(width * 12) / 18}
      shapeRendering="crispEdges"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ transform: flip ? 'scaleX(-1)' : undefined, display: 'block' }}
    >
      {runs.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.c} />
      ))}
    </svg>
  )
}

/** Petit bocal pixel art avec un poisson qui nage */
export function Bowl({ color, scale = 1, name, flip = false }: { color: FishColor; scale?: number; name: string; flip?: boolean }) {
  return (
    <div className="bowl" aria-label={`${name} dans son bocal`} role="img">
      <div className="bowl-rim" />
      <div className="bowl-glass">
        <div className="bowl-water" />
        <div className="bowl-sand" />
        <div className="bowl-plant bowl-plant-a" />
        <div className="bowl-plant bowl-plant-b" />
        <div className="bowl-bubble bowl-bubble-a" />
        <div className="bowl-bubble bowl-bubble-b" />
        <div className={flip ? 'bowl-fish swim-rev' : 'bowl-fish swim'}>
          <Fish color={color} width={Math.round(48 * scale)} />
        </div>
      </div>
    </div>
  )
}
