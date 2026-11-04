import { useState } from 'react'
import type { ReactNode } from 'react'
import type { FishColor } from '../lib/types'
import type { Mood } from '../lib/mood'

// Sprite 18 × 12 : o contour, b corps, l ventre, f nageoires, h reflet, w blanc de l'œil, k pupille
export const SPRITE = [
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
export type Px = [number, number, number, number, string]
export const HATS: Record<string, Px[]> = {
  bandeau: [[7, 3, 7, 1, '#E0304E'], [6, 2, 1, 1, '#E0304E'], [5, 3, 1, 1, '#E0304E']],
  lunettes: [[9, 4, 2, 1, '#1B1B3A'], [11, 4, 4, 2, '#1B1B3A'], [12, 4, 2, 1, '#8DD3FF']],
  casquette: [[9, -1, 3, 1, '#3F7DE8'], [8, 0, 5, 2, '#3F7DE8'], [13, 1, 3, 1, '#1B4F8C'], [10, 0, 1, 1, '#FFFFFF']],
  pirate: [[9, -2, 4, 2, '#1B1B3A'], [7, 0, 8, 2, '#1B1B3A'], [10, 0, 2, 1, '#FFFFFF']],
  noel: [[8, 1, 7, 1, '#FFFFFF'], [9, -1, 5, 2, '#E0304E'], [10, -2, 3, 1, '#E0304E'], [7, -2, 2, 1, '#E0304E'], [6, -2, 1, 1, '#FFFFFF']],
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

/** Le poisson pixel art (avec son accessoire et son humeur). Hauteur = largeur × 16/18. */
export function Fish({ color, width = 54, flip = false, label, hat, mood = 'normal' }: {
  color: FishColor; width?: number; flip?: boolean; label?: string; hat?: string | null; mood?: Mood
}) {
  if (!cache.has(color)) cache.set(color, runsFor(color))
  const runs = cache.get(color)!
  const body = (PALETTES[color] || PALETTES.corail).b
  return (
    <svg
      viewBox="0 -4 18 16"
      width={width}
      height={(width * 16) / 18}
      shapeRendering="crispEdges"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ transform: flip ? 'scaleX(-1)' : undefined, display: 'block', overflow: 'visible' }}
    >
      <g className={`fish-body mood-${mood}`}>
        {runs.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.c} />)}
        {mood === 'sleep' && (
          <>
            <rect x={12} y={4} width={2} height={2} fill={body} />
            <rect x={12} y={5} width={2} height={1} fill="#1B1B3A" />
          </>
        )}
        {mood === 'happy' && (
          <>
            <rect x={12} y={4} width={2} height={1} fill="#1B1B3A" />
            <rect x={12} y={5} width={2} height={1} fill={body} />
            <rect x={11} y={5} width={1} height={1} fill="#1B1B3A" />
          </>
        )}
        {mood === 'sad' && <rect className="fish-tear" x={13} y={6} width={1} height={2} fill="#8DD3FF" />}
        {hat && HATS[hat]?.map(([x, y, w, h, c], i) => <rect key={`h${i}`} x={x} y={y} width={w} height={h} fill={c} />)}
      </g>
      {mood === 'sleep' && (
        <g className="fish-z" fill="#FFFFFF">
          <rect x={15} y={-4} width={3} height={1} /><rect x={16} y={-3} width={1} height={1} /><rect x={15} y={-2} width={3} height={1} />
          <rect x={13} y={-1} width={2} height={1} opacity={0.7} />
        </g>
      )}
      {mood === 'happy' && (
        <g className="fish-spark" fill="#FFE08F">
          <rect x={1} y={-3} width={3} height={1} /><rect x={2} y={-4} width={1} height={3} />
          <rect x={16} y={9} width={2} height={1} opacity={0.8} />
        </g>
      )}
    </svg>
  )
}

/** Un poisson qui réagit quand on le touche : petit saut et un cœur */
export function useBoop(): [boolean, () => void] {
  const [boop, setBoop] = useState(false)
  const trigger = () => {
    if (boop) return
    setBoop(true)
    window.setTimeout(() => setBoop(false), 900)
  }
  return [boop, trigger]
}

function Heart() {
  return (
    <svg className="boop-heart" viewBox="0 0 7 6" width={16} height={14} shapeRendering="crispEdges" aria-hidden="true">
      {['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'].flatMap((row, y) =>
        [...row].map((c, x) => (c === 'r' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#FF5E8A" /> : null)))}
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
  sapin: {
    rows: ['....y....', '...ggg...', '..gRgbg..', '...ggg...', '..ggyRg..', '.gbgggRg.', '..ggggg..', '.gRggbggg', 'ggggyggRg', '....t....', '....t....'],
    colors: { g: '#1E9E57', y: '#FFE08F', R: '#E0304E', b: '#4D8EEA', t: '#6B3E1E' },
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

/** Flocons qui tombent (décor de Noël) */
export function Snow({ count = 7 }: { count?: number }) {
  return (
    <div className="snow" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} style={{ left: `${(i * 97) % 100}%`, animationDelay: `${(i * 1.3) % 6}s`, animationDuration: `${5 + (i % 3) * 1.5}s` }} />
      ))}
    </div>
  )
}

/** Petit bocal pixel art avec un poisson qui nage */
export function Bowl({ color, scale = 1, name, flip = false, hat, pet, style = 'rond', mood = 'normal', noel = false }: {
  color: FishColor; scale?: number; name: string; flip?: boolean; hat?: string | null; pet?: string | null; style?: string; mood?: Mood; noel?: boolean
}) {
  const [boop, trigger] = useBoop()
  return (
    <button type="button" className={`bowl bowl-${style}${mood === 'sleep' ? ' sleepy' : ''}`} aria-label={`${name} dans son bocal, toucher pour lui dire coucou`} onClick={trigger}>
      <div className="bowl-rim" />
      <div className="bowl-glass">
        <div className="bowl-water" />
        <div className="bowl-sand" />
        {noel ? <div className="bowl-sapin"><Decor kind="sapin" width={22} /></div> : <div className="bowl-plant bowl-plant-a" />}
        <div className="bowl-plant bowl-plant-b" />
        {noel && <Snow count={5} />}
        <div className="bowl-bubble bowl-bubble-a" />
        <div className="bowl-bubble bowl-bubble-b" />
        {pet && <div className="bowl-pet"><Pet kind={pet} width={22} /></div>}
        <div className={flip ? 'bowl-fish swim-rev' : 'bowl-fish swim'}>
          <div className={boop ? 'boop' : undefined}>
            <Fish color={color} width={Math.round(48 * scale)} hat={hat} mood={boop ? 'happy' : mood} />
          </div>
          {boop && <Heart />}
        </div>
      </div>
    </button>
  )
}

export interface TankFish { color: FishColor; hat?: string | null; pet?: string | null; scale: number; name: string; mood?: Mood }

/** Le grand aquarium commun */
export function Tank({ fishes, decor, children, noel = false }: { fishes: TankFish[]; decor: string[]; children?: ReactNode; noel?: boolean }) {
  const [boop, trigger] = useBoop()
  return (
    <button type="button" className="tank" aria-label={`Grand aquarium avec ${fishes.map((f) => f.name).join(' et ')}, toucher pour leur dire coucou`} onClick={trigger}>
      <div className="tank-water" />
      <div className="tank-sand" />
      <div className="tank-decor">
        {(noel ? [...decor, 'sapin'] : decor).map((d) => <Decor key={d} kind={d} width={d === 'plante' ? 34 : d === 'sapin' ? 38 : 40} />)}
      </div>
      {noel && <Snow count={10} />}
      {noel && <div className="tank-garland" aria-hidden="true" />}
      <div className="tank-pets">
        {fishes.filter((f) => f.pet).map((f) => <Pet key={f.name} kind={f.pet!} width={26} />)}
      </div>
      <div className="bowl-bubble bowl-bubble-a" />
      <div className="bowl-bubble bowl-bubble-b" />
      {fishes.map((f, i) => (
        <div key={f.name} className={`tank-fish tank-fish-${i}${f.mood === 'sleep' ? ' sleepy' : ''}`}>
          <div className={boop ? 'boop' : undefined}>
            <Fish color={f.color} hat={f.hat} width={Math.round(46 * f.scale)} mood={boop ? 'happy' : f.mood} />
          </div>
          {boop && <Heart />}
        </div>
      ))}
      {children}
    </button>
  )
}
