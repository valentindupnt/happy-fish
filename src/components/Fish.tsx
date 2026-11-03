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
  amethyste: { label: 'Améthyste', b: '#9B6BDF', l: '#E2D3F7', f: '#6A3FB0', h: '#C3A6EE' },
  cerise: { label: 'Cerise', b: '#E0304E', l: '#FFD0D8', f: '#9E1530', h: '#F27A8E' },
  menthe: { label: 'Menthe', b: '#5ED3B3', l: '#D5F5EC', f: '#2A9C7E', h: '#9BE6D2' },
  nuit: { label: 'Nuit étoilée', b: '#2B2D5C', l: '#8C8FC9', f: '#4B4E8C', h: '#F2C66D' },
  or: { label: 'Or', b: '#E8B92E', l: '#FFF0B8', f: '#B8860B', h: '#FFD966' },
}

export const FREE_COLORS: FishColor[] = ['corail', 'rose', 'lagon', 'ocean', 'soleil']

// Accessoires dessinés au-dessus de la tête : [x, y, largeur, hauteur, couleur]
type Px = [number, number, number, number, string]
const HATS: Record<string, Px[]> = {
  bandeau: [[7, 3, 7, 1, '#E0304E'], [6, 2, 1, 1, '#E0304E'], [5, 3, 1, 1, '#E0304E']],
  lunettes: [[9, 4, 2, 1, '#1B1B3A'], [11, 4, 4, 2, '#1B1B3A'], [12, 4, 2, 1, '#8DD3FF']],
  casquette: [[9, -1, 3, 1, '#3F7DE8'], [8, 0, 5, 2, '#3F7DE8'], [13, 1, 3, 1, '#1B4F8C'], [10, 0, 1, 1, '#FFFFFF']],
  pirate: [[9, -2, 4, 2, '#1B1B3A'], [7, 0, 8, 2, '#1B1B3A'], [10, 0, 2, 1, '#FFFFFF']],
  couronne: [[8, -2, 1, 2, '#E8B92E'], [10, -2, 2, 2, '#E8B92E'], [13, -2, 1, 2, '#E8B92E'], [8, 0, 6, 2, '#E8B92E'], [10, 0, 2, 1, '#E0304E']],
}

interface Run { x: number; y: number; w: number; c: string }

function runsFor(color: FishColor): Run[] {
  const p = PALETTES[color] || PALETTES.corail
  const colorOf = (ch: string, x: number) => {
    if (x === 9 && 'bhl'.includes(ch)) return color === 'nuit' ? '#F2C66D' : '#FFFFFF'
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

/** Le poisson pixel art (avec son accessoire éventuel). Hauteur = largeur × 16/18. */
export function Fish({ color, width = 54, flip = false, label, hat }: { color: FishColor; width?: number; flip?: boolean; label?: string; hat?: string | null }) {
  if (!cache.has(color)) cache.set(color, runsFor(color))
  const runs = cache.get(color)!
  return (
    <svg
      viewBox="0 -4 18 16"
      width={width}
      height={(width * 16) / 18}
      shapeRendering="crispEdges"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ transform: flip ? 'scaleX(-1)' : undefined, display: 'block' }}
    >
      {runs.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.c} />)}
      {hat && HATS[hat]?.map(([x, y, w, h, c], i) => <rect key={`h${i}`} x={x} y={y} width={w} height={h} fill={c} />)}
    </svg>
  )
}

// Petits sprites : un caractère par pixel, « . » = vide
function Sprite({ rows, colors, width, label }: { rows: string[]; colors: Record<string, string>; width: number; label?: string }) {
  const w = rows[0].length
  const h = rows.length
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={width} height={(width * h) / w} shapeRendering="crispEdges"
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ display: 'block' }}>
      {rows.flatMap((row, y) => [...row].map((ch, x) => (colors[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={colors[ch]} /> : null)))}
    </svg>
  )
}

const PETS: Record<string, { rows: string[]; colors: Record<string, string> }> = {
  crevette: {
    rows: ['..pppp....', '.p....p...', 'p.pppppp..', '.pppppppok', '..pppppp..', '...p.p.p..'],
    colors: { p: '#FF8FA3', o: '#1B1B3A', k: '#1B1B3A' },
  },
  escargot: {
    rows: ['...ssss...', '..s.ss.s..', '..s.s..s..', '..ss..ss..', 'gggssssgk.', 'gggggggggg'],
    colors: { s: '#B5651D', g: '#9CC59A', k: '#1B1B3A' },
  },
  crabe: {
    rows: ['r........r', 'rr..k.k.rr', '.r..r.r.r.', '..rrrrrr..', '.rrrrrrrr.', 'r.r....r.r'],
    colors: { r: '#E0304E', k: '#1B1B3A' },
  },
}

export function Pet({ kind, width = 30 }: { kind: string; width?: number }) {
  const p = PETS[kind]
  if (!p) return null
  return <Sprite rows={p.rows} colors={p.colors} width={width} />
}

const DECOR: Record<string, { rows: string[]; colors: Record<string, string> }> = {
  plante: {
    rows: ['..g...g.', '.gg..gg.', '.g..gg..', 'gg..g..g', '.g.gg.gg', '.gggg.g.', '..ggggg.', '...ggg..', '...gg...', '...gg...'],
    colors: { g: '#2ECC71' },
  },
  coquillage: {
    rows: ['...cccc...', '..cdcdcdc.', '.cdcdcdcdc', '.cdcdcdcdc', '..ccccccc.', '....cc....'],
    colors: { c: '#FFE9D6', d: '#E8B98F' },
  },
  tresor: {
    rows: ['.bbbbbbbb.', 'bggggggggb', 'bbbbyybbbb', 'bnnnyynnnb', 'bnnnnnnnnb', 'bbbbbbbbbb'],
    colors: { b: '#6B3E1E', g: '#F2C66D', y: '#E8B92E', n: '#8B5A2B' },
  },
  chateau: {
    rows: ['g.g....g.g', 'ggg....ggg', 'ggg.gg.ggg', 'gggggggggg', 'ggggkkgggg', 'gggkkkkggg', 'gggkkkkggg'],
    colors: { g: '#A7B1C2', k: '#1B1B3A' },
  },
}

export function Decor({ kind, width = 40 }: { kind: string; width?: number }) {
  const d = DECOR[kind]
  if (!d) return null
  return <Sprite rows={d.rows} colors={d.colors} width={width} />
}

/** Aperçu boutique d'un objet */
export function ItemPreview({ kind, id, color }: { kind: string; id: string; color: FishColor }) {
  if (kind === 'color') return <Fish color={id as FishColor} width={44} />
  if (kind === 'hat') return <Fish color={color} hat={id} width={44} />
  if (kind === 'pet') return <Pet kind={id} width={36} />
  if (kind === 'decor') return <Decor kind={id} width={34} />
  return (
    <div className={`mini-bowl ${id}`} aria-hidden="true"><div /></div>
  )
}

/** Petit bocal pixel art avec un poisson qui nage */
export function Bowl({ color, scale = 1, name, flip = false, hat, pet, style = 'rond' }: {
  color: FishColor; scale?: number; name: string; flip?: boolean; hat?: string | null; pet?: string | null; style?: string
}) {
  return (
    <div className={`bowl bowl-${style}`} aria-label={`${name} dans son bocal`} role="img">
      <div className="bowl-rim" />
      <div className="bowl-glass">
        <div className="bowl-water" />
        <div className="bowl-sand" />
        <div className="bowl-plant bowl-plant-a" />
        <div className="bowl-plant bowl-plant-b" />
        <div className="bowl-bubble bowl-bubble-a" />
        <div className="bowl-bubble bowl-bubble-b" />
        {pet && <div className="bowl-pet"><Pet kind={pet} width={22} /></div>}
        <div className={flip ? 'bowl-fish swim-rev' : 'bowl-fish swim'}>
          <Fish color={color} width={Math.round(48 * scale)} hat={hat} />
        </div>
      </div>
    </div>
  )
}

export interface TankFish { color: FishColor; hat?: string | null; pet?: string | null; scale: number; name: string }

/** Le grand aquarium commun */
export function Tank({ fishes, decor }: { fishes: TankFish[]; decor: string[] }) {
  return (
    <div className="tank" role="img" aria-label={`Grand aquarium avec ${fishes.map((f) => f.name).join(' et ')}`}>
      <div className="tank-water" />
      <div className="tank-sand" />
      <div className="tank-decor">
        {decor.map((d) => <Decor key={d} kind={d} width={d === 'plante' ? 34 : 40} />)}
      </div>
      <div className="tank-pets">
        {fishes.filter((f) => f.pet).map((f) => <Pet key={f.name} kind={f.pet!} width={26} />)}
      </div>
      <div className="bowl-bubble bowl-bubble-a" />
      <div className="bowl-bubble bowl-bubble-b" />
      {fishes.map((f, i) => (
        <div key={f.name} className={`tank-fish tank-fish-${i}`}>
          <Fish color={f.color} hat={f.hat} width={Math.round(46 * f.scale)} />
        </div>
      ))}
    </div>
  )
}
