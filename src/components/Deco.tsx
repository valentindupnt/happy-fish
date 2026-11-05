// Les décorations de l'aquarium en pixel art. Un dessin = une ou plusieurs images (animation de 2 ou 3 images).
// Les rangées sont écrites caractère par caractère (« . » = vide), les formes simples sont tracées par de petites fonctions.

const K = '#1B1B3A'

export interface DecoArt {
  /** Une image fixe, ou plusieurs images qui s'enchaînent */
  frames: string[][]
  colors: Record<string, string>
  /** Durée d'un tour complet des images, en millisecondes */
  ms?: number
}

// ---------- Outils de dessin ----------
class Grid {
  cells: string[][]
  constructor(public w: number, public h: number) {
    this.cells = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'))
  }
  set(x: number, y: number, c: string) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y][x] = c
    return this
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c)
    return this
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
    let err = dx - dy, x = x0, y = y0
    for (;;) {
      this.set(x, y, c)
      if (x === x1 && y === y1) break
      const e2 = 2 * err
      if (e2 > -dy) { err -= dy; x += sx }
      if (e2 < dx) { err += dx; y += sy }
    }
    return this
  }
  rows() { return this.cells.map((r) => r.join('')) }
  clone() {
    const g = new Grid(this.w, this.h)
    g.cells = this.cells.map((r) => [...r])
    return g
  }
}

/** Ajoute des pixels (x, y, couleur) à des rangées déjà écrites */
function patch(rows: string[], ops: Array<[number, number, string]>): string[] {
  const g = rows.map((r) => r.split(''))
  for (const [x, y, c] of ops) if (g[y] && x >= 0 && x < g[y].length) g[y][x] = c
  return g.map((r) => r.join(''))
}

/** Centre des rangées dans une largeur plus grande */
function widen(rows: string[], w: number): string[] {
  const left = Math.floor((w - rows[0].length) / 2)
  return rows.map((r) => '.'.repeat(left) + r + '.'.repeat(w - r.length - left))
}

// ---------- Les dessins ----------
const ANCRE = [
  '...rrr...',
  '...r.r...',
  '...rrr...',
  '..rrrrr..',
  '....r....',
  '....r....',
  'r...r...r',
  'rr..r..rr',
  '.rr.r.rr.',
  '..rrrrr..',
]

const COFFRE = [
  '..dddddd..',
  '.dbbbbbbd.',
  'dbbbbbbbbd',
  'dddddddddd',
  'dbbbggbbbd',
  'dbbbggbbbd',
  'dddddddddd',
]

const COFFRE_FER = [
  '..dddddd..',
  '.dbdbbdbd.',
  'dbbdbbdbbd',
  'dddddddddd',
  'dbbdggdbbd',
  'dbbdggdbbd',
  'dddddddddd',
]

const CHATEAU = [
  '.s.s..s.s.',
  '.ssssssss.',
  '.sdsssdss.',
  '.ssssssss.',
  '.sssddsss.',
  'sssdkkdsss',
  'ssdsksksds',
  'ssssssssss',
]

const LANTERNE = [
  '...kkk...',
  '..k...k..',
  '.kkkkkkk.',
  '.kgggggk.',
  '.kgfffgk.',
  '.kgfffgk.',
  '.kgggggk.',
  '.kkkkkkk.',
  '..kkkkk..',
]

/** Une lanterne et des bulles de couleur qui montent au-dessus */
function lanterne(glass: string, glow: string, bubble: string): DecoArt {
  const head = 6
  const frames = [
    [[3, 5], [6, 3], [2, 1]],
    [[3, 4], [6, 2], [2, 0]],
    [[4, 3], [5, 1], [3, 5]],
  ].map((bubbles) => {
    const g = new Grid(9, head + LANTERNE.length)
    LANTERNE.forEach((row, y) => [...row].forEach((c, x) => c !== '.' && g.set(x, head + y, c)))
    for (const [x, y] of bubbles) g.set(x, y, 'b')
    return g.rows()
  })
  return { frames, colors: { k: '#3B3D50', g: glass, f: glow, b: bubble }, ms: 1800 }
}

const BARQUE = [
  '........m...',
  '........mm..',
  '.d......m...',
  'dbbbbbbbbbbd',
  '.dbpbbpbbpd.',
  '..dddddddd..',
]

const GALION = [
  '.......m........',
  '.......mww......',
  '.......mwwww....',
  '.......mwwwww...',
  '.......mw.www...',
  '.......mwwww....',
  '.......m........',
  '..d....m.....d..',
  '.dbbbbbbbbbbbbd.',
  'dbbpbbpbbpbbpbbd',
  '.dbbbbbbbbbbbbd.',
  '..dddddddddddd..',
]

const FANTOME = [
  '.........m........',
  '.........mww......',
  '........wmwwww....',
  '.......wwmwwwww...',
  '.......w.mw.www...',
  '.......wwmwwwww...',
  '........wmwwww....',
  '.........m........',
  '..h......m......h.',
  '.hbbbbbbbbbbbbbbh.',
  'hbbbebbbebbbebbbbh',
  '.hbbbbbbbbbbbbbbh.',
  '..hhhhhhhhhhhhhh..',
]

const PHARE_TOUR = [
  '...yyy...',
  '..kyyyk..',
  '..kkkkk..',
  '...rrr...',
  '...www...',
  '..rrrrr..',
  '..wwwww..',
  '..rrrrr..',
  '.wwwwwww.',
  '.rrrrrrr.',
  '.wwwwwww.',
  'ddddddddd',
]

const PHARE_AMES_TOUR = [
  '....g....',
  '...ggg...',
  '..kkkkk..',
  '..kgggk..',
  '..kkkkk..',
  '...sss...',
  '...sns...',
  '..sssss..',
  '..snsns..',
  '.sssssss.',
  '.snsssns.',
  'ddddddddd',
]

const ROUE = [
  '..ttt..',
  '.t...t.',
  't.....t',
  't.....t',
  't.....t',
  '.t...t.',
  '..ttt..',
]

function veloFrames(): string[][] {
  const frame = (spokes: 'plus' | 'cross') => {
    const g = new Grid(17, 9)
    for (const x0 of [0, 10]) ROUE.forEach((row, y) => [...row].forEach((c, x) => c === 't' && g.set(x0 + x, 2 + y, 't')))
    for (const cx of [3, 13]) {
      if (spokes === 'plus') g.rect(cx - 2, 5, 5, 1, 'g').rect(cx, 3, 1, 5, 'g')
      else g.line(cx - 2, 3, cx + 2, 7, 'g').line(cx - 2, 7, cx + 2, 3, 'g')
      g.set(cx, 5, 'h')
    }
    g.line(3, 5, 8, 5, 'f').line(3, 5, 7, 2, 'f').line(8, 5, 7, 2, 'f').line(7, 2, 12, 2, 'f').line(8, 5, 12, 2, 'f').line(12, 2, 13, 5, 'f')
    g.rect(5, 1, 4, 1, 'k').rect(11, 0, 3, 1, 'k').set(12, 1, 'k')
    return g.rows()
  }
  return [frame('plus'), frame('cross')]
}

function parasol(): string[] {
  const g = new Grid(13, 15)
  const canopy = [
    '.....rwr.....',
    '...rwrwrwr...',
    '.rwrwrwrwrwr.',
    'rwrwrwrwrwrwr',
  ]
  canopy.forEach((row, y) => [...row].forEach((c, x) => c !== '.' && g.set(x, y, c)))
  g.rect(6, 4, 1, 9, 'p')
  g.rect(3, 12, 7, 1, 's').rect(1, 13, 11, 1, 's').rect(0, 14, 13, 1, 'd')
  g.set(4, 12, 'd').set(8, 13, 'd')
  return g.rows()
}

function eolienne(): string[][] {
  const base = () => {
    const g = new Grid(13, 17)
    g.rect(6, 6, 1, 10, 'w').rect(5, 16, 3, 1, 'd').set(5, 15, 'w').set(7, 15, 'w')
    return g
  }
  const f0 = base()
  f0.line(6, 5, 6, 0, 'b').line(6, 5, 2, 9, 'b').line(6, 5, 10, 9, 'b').set(6, 5, 'h')
  const f1 = base()
  f1.line(6, 5, 12, 2, 'b').line(6, 5, 0, 2, 'b').line(6, 5, 6, 11, 'b').set(6, 5, 'h')
  return [f0.rows(), f1.rows()]
}

function banc(): string[][] {
  const frame = (up: boolean) => {
    const g = new Grid(16, 11)
    const bar = up ? 2 : 4
    g.rect(2, 4, 1, 7, 'm').rect(13, 4, 1, 7, 'm')
    g.rect(4, 8, 8, 1, 'p').rect(4, 9, 8, 1, 'd').rect(5, 10, 1, 1, 'd').rect(10, 10, 1, 1, 'd')
    g.rect(0, bar, 16, 1, 'm')
    g.rect(0, bar - 2, 2, 5, 'x').rect(14, bar - 2, 2, 5, 'x').rect(2, bar - 1, 1, 3, 'x').rect(13, bar - 1, 1, 3, 'x')
    return g.rows()
  }
  return [frame(false), frame(true)]
}

function plongeoir(): string[] {
  const g = new Grid(15, 16)
  g.rect(1, 2, 1, 14, 'm').rect(4, 2, 1, 14, 'm')
  for (let y = 4; y <= 14; y += 3) g.rect(1, y, 4, 1, 'm')
  g.rect(0, 1, 15, 1, 'c').rect(0, 2, 15, 1, 'w').rect(5, 3, 1, 1, 'm')
  g.rect(0, 15, 6, 1, 'd')
  g.rect(12, 0, 1, 1, 'h')
  return g.rows()
}

function gode(): string[][] {
  const frame = (v: boolean) => {
    const g = new Grid(10, 13)
    g.rect(4, 1, 3, 1, 'p').rect(3, 2, 5, 7, 'p').rect(2, 9, 7, 2, 'q').rect(3, 11, 5, 1, 'q')
    g.rect(4, 2, 1, 5, 'h').set(7, 8, 'q')
    if (v) g.set(1, 3, 'v').set(0, 5, 'v').set(9, 3, 'v').set(9, 5, 'v').set(1, 7, 'v').set(8, 7, 'v')
    return g.rows()
  }
  return [frame(false), frame(true)]
}

const SAPIN = [
  '....y....',
  '...ggg...',
  '..gRggb..',
  '...ggg...',
  '..ggyRg..',
  '.gbgggRg.',
  '..ggggg..',
  '.gRggbggg',
  'ggggyggRg',
  '....t....',
  '....t....',
]

const ETOILE_NOEL = [
  '....y....',
  '...yyy...',
  'yyyyyyyyy',
  '.yyyyyyy.',
  '..yyyyy..',
  '..yy.yy..',
  '.yy...yy.',
]

function guirlande(): string[][] {
  const frame = (on: boolean) => {
    const g = new Grid(16, 6)
    g.line(0, 0, 4, 3, 'k').line(4, 3, 8, 4, 'k').line(8, 4, 12, 3, 'k').line(12, 3, 15, 0, 'k')
    const bulbs: Array<[number, number]> = [[2, 2], [5, 4], [8, 5], [11, 4], [14, 2]]
    bulbs.forEach(([x, y], i) => g.set(x, y, (i % 2 === 0) === on ? 'r' : 'y'))
    return g.rows()
  }
  return [frame(true), frame(false)]
}

const CADEAU = [
  '..rr.rr..',
  '.r.rrr.r.',
  '..rrrrr..',
  'bbbbybbbb',
  'bbbbybbbb',
  'yyyyyyyyy',
  'bbbbybbbb',
  'bbbbybbbb',
  'bbbbybbbb',
]

const COFFRE_ETOILES = [
  '.s........s.',
  '....s.s.....',
  '....yyyy....',
  '...yyyyyy...',
  '.dddyyyyddd.',
  '.dbbbbbbbbd.',
  'dddddddddddd',
  'dbbbbggbbbbd',
  'dbbbbggbbbbd',
  'dddddddddddd',
]

export const DECO_ART: Record<string, DecoArt> = {
  d_galets: {
    frames: [['...ww.....', '..gggg.gg.', '.gwgggdgwg', 'gggdgggggd']],
    colors: { g: '#A7B1C2', d: '#6B6E80', w: '#D9DEE8' },
  },
  d_coquillage: {
    frames: [['...cccc...', '..cdcdcc..', '.cdcdcdcc.', 'cdcdcdcdcc', '.cccccccc.', '...dddd...']],
    colors: { c: '#FFE9D6', d: '#E8A98F' },
  },
  d_algue: {
    frames: [
      ['..g...g.', '..gg..g.', '...g.gg.', '..gg.g..', '.gg..gg.', '.g..gg..', '.gg.g...', '..gdg...', '..dddg..'],
      ['.g...g..', '.gg..gg.', '..g.gg..', '..gg.g..', '.gg..gg.', '.g..gg..', '.gg.g...', '..gdg...', '..dddg..'],
    ],
    colors: { g: '#2ECC71', d: '#1E9E57' },
    ms: 2400,
  },
  d_etoile: {
    frames: [['....o....', '...ooo...', 'ooooooooo', '.ooolooo.', '..ooooo..', '.ooo.ooo.', 'oo.....oo']],
    colors: { o: '#FF8C1A', l: '#FFC266' },
  },
  d_ancre_rouille: {
    frames: [patch(ANCRE, [[4, 3, 'o'], [4, 7, 'o'], [2, 8, 'o'], [8, 6, 'o']])],
    colors: { r: '#8B5A2B', o: '#C0703A' },
  },
  d_ancre_laiton: {
    frames: [patch(ANCRE, [[3, 3, 'h'], [4, 5, 'h'], [1, 7, 'h'], [3, 0, 'h']])],
    colors: { r: '#E8B92E', h: '#FFE08F' },
  },
  d_ancre_brumes: {
    frames: [
      patch(ANCRE, [[4, 4, 'g'], [4, 6, 'g'], [4, 8, 'g'], [4, 1, 'g']]),
      patch(ANCRE, [[4, 5, 'g'], [4, 7, 'g'], [3, 3, 'g'], [5, 3, 'g'], [4, 1, 'g']]),
    ],
    colors: { r: '#6A3FB0', g: '#8DD3FF' },
    ms: 1600,
  },
  d_coffre_bois: {
    frames: [COFFRE],
    colors: { d: '#6B3E1E', b: '#8B5A2B', g: '#F2C66D' },
  },
  d_coffre_fer: {
    frames: [COFFRE_FER],
    colors: { d: '#2E3048', b: '#5A5D78', g: '#F2C66D' },
  },
  d_coffre_etoiles: {
    frames: [
      COFFRE_ETOILES,
      patch(COFFRE_ETOILES, [[1, 0, '.'], [10, 0, '.'], [4, 1, '.'], [6, 1, '.'], [9, 0, 's'], [2, 1, 's'], [7, 1, 's']]),
    ],
    colors: { d: '#4B2E8C', b: '#6A3FB0', g: '#F2C66D', y: '#FFE08F', s: '#FFFFFF' },
    ms: 1400,
  },
  d_chateau_sable: {
    frames: [CHATEAU],
    colors: { s: '#E8C27A', d: '#C9A04A', k: '#8B6B2E' },
  },
  d_chateau_drapeau: {
    frames: [patch(['....f.....', '....fF....', ...CHATEAU], [])],
    colors: { s: '#E8C27A', d: '#C9A04A', k: '#8B6B2E', f: '#E0304E', F: '#E0304E' },
  },
  d_lanterne_rose: lanterne('#FFD3E6', '#FF6FAE', '#FF9CC8'),
  d_lanterne_verte: lanterne('#C9F5DC', '#2ECC71', '#7FE3A8'),
  d_lanterne_violette: lanterne('#E2D3F7', '#9B6BDF', '#C3A6EE'),
  d_epave_barque: {
    frames: [BARQUE],
    colors: { m: '#8B5A2B', d: '#4A2A12', b: '#6B3E1E', p: '#8B5A2B' },
  },
  d_epave_galion: {
    frames: [GALION],
    colors: { m: '#8B5A2B', w: '#E8D9B0', b: '#6B3E1E', d: '#4A2A12', p: '#8B5A2B' },
  },
  d_epave_fantome: {
    frames: [FANTOME, patch(FANTOME, [[4, 10, 'b'], [8, 10, 'b'], [12, 10, 'b'], [5, 10, 'e'], [9, 10, 'e'], [13, 10, 'e']])],
    colors: { m: '#7FA3C9', w: '#BFEFFF', b: '#3B4A7A', h: '#8DD3FF', e: '#FFE08F' },
    ms: 1800,
  },
  d_phare: {
    frames: [
      widen(PHARE_TOUR, 15),
      patch(widen(PHARE_TOUR, 15), [[0, 1, 'y'], [1, 1, 'y'], [2, 1, 'y'], [12, 1, 'y'], [13, 1, 'y'], [14, 1, 'y']]),
    ],
    colors: { y: '#FFE08F', k: '#3B3D50', r: '#E0304E', w: '#FFFFFF', d: '#6B6E80' },
    ms: 1600,
  },
  d_phare_ames: {
    frames: [
      widen(PHARE_AMES_TOUR, 15),
      patch(widen(PHARE_AMES_TOUR, 15), [[7, 0, '.'], [7, 1, 'g'], [3, 2, 'g'], [11, 2, 'g'], [7, 6, 'g'], [7, 8, 'g']]),
    ],
    colors: { g: '#8DD3FF', k: '#2E3048', s: '#6A5BB0', n: '#B8A6F2', d: '#4B4E8C' },
    ms: 1700,
  },
  d_velo: {
    frames: veloFrames(),
    colors: { t: K, g: '#A7B1C2', h: '#E8B92E', f: '#2EC4B6', k: K },
    ms: 700,
  },
  d_parasol: {
    frames: [parasol()],
    colors: { r: '#E0304E', w: '#FFFFFF', p: '#8B5A2B', s: '#E8C27A', d: '#C9A04A' },
  },
  d_eolienne: {
    frames: eolienne(),
    colors: { w: '#F2F4F8', d: '#A7B1C2', b: '#FFFFFF', h: '#E0304E' },
    ms: 900,
  },
  d_banc: {
    frames: banc(),
    colors: { m: '#A7B1C2', p: '#E0304E', d: '#6B6E80', x: '#2E3048' },
    ms: 1800,
  },
  d_plongeoir: {
    frames: [plongeoir()],
    colors: { m: '#A7B1C2', c: '#3F7DE8', w: '#FFFFFF', d: '#6B6E80', h: '#FFE08F' },
  },
  d_gode: {
    frames: gode(),
    colors: { p: '#FF6FAE', q: '#C2378A', h: '#FFD3E6', v: '#FFE08F' },
    ms: 300,
  },
  d_noel_sapin: {
    frames: [SAPIN, patch(SAPIN, [[0, 0, '.'], [4, 0, 'y'], [3, 2, 'R'], [5, 2, 'y'], [2, 4, 'b'], [4, 4, 'R']])],
    colors: { g: '#1E9E57', y: '#FFE08F', R: '#E0304E', b: '#4D8EEA', t: '#6B3E1E' },
    ms: 1200,
  },
  d_noel_etoile: {
    frames: [ETOILE_NOEL, patch(ETOILE_NOEL, [[4, 3, 'w'], [4, 1, 'w']])],
    colors: { y: '#FFE08F', w: '#FFFFFF' },
    ms: 1000,
  },
  d_noel_guirlande: {
    frames: guirlande(),
    colors: { k: '#2E3048', r: '#FF5E8A', y: '#FFE08F' },
    ms: 1000,
  },
  d_noel_cadeau: {
    frames: [CADEAU],
    colors: { r: '#E0304E', b: '#3F7DE8', y: '#FFE08F' },
  },
}

/** Les identifiants de décoration connus de l'appli */
export const DECO_IDS = Object.keys(DECO_ART)

/** Un dessin de décoration. La largeur suit --dpx (taille d'un pixel) de la scène, ou `px` en pixels. */
export function DecoSvg({ id, px, label }: { id: string; px?: number; label?: string }) {
  const art = DECO_ART[id]
  if (!art) return null
  const w = art.frames[0][0].length
  const h = art.frames[0].length
  const n = art.frames.length
  const ms = art.ms ?? 1500
  return (
    <svg viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      style={{ width: px ? w * px : `calc(var(--dpx, 2px) * ${w})`, height: 'auto', display: 'block', overflow: 'visible' }}>
      {art.frames.map((rows, i) => (
        <g key={i} className={n > 1 ? `deco-frame deco-n${n}` : undefined}
          style={n > 1 ? { animationDuration: `${ms}ms`, animationDelay: i === 0 ? '0ms' : `-${Math.round((ms * (n - i)) / n)}ms` } : undefined}>
          {rows.flatMap((row, y) => {
            const out = []
            let x = 0
            while (x < row.length) {
              const c = row[x]
              if (!art.colors[c]) { x++; continue }
              let run = 1
              while (x + run < row.length && row[x + run] === c) run++
              out.push(<rect key={`${x}-${y}`} x={x} y={y} width={run} height={1} fill={art.colors[c]} />)
              x += run
            }
            return out
          })}
        </g>
      ))}
    </svg>
  )
}

/** Aperçu dans la boutique et dans les listes */
export function DecoPreview({ id }: { id: string }) {
  const art = DECO_ART[id]
  if (!art) return null
  const w = art.frames[0][0].length
  const h = art.frames[0].length
  const px = Math.max(1, Math.min(3, Math.floor(44 / Math.max(w, h))))
  return <DecoSvg id={id} px={px} />
}

/** Les décorations posées dans une scène : une rangée au pied du décor */
export function DecoRow({ slots, className = '' }: { slots: Array<string | null | undefined>; className?: string }) {
  if (!slots.some((s) => s && DECO_ART[s])) return null
  return (
    <div className={`deco-row ${className}`.trim()} aria-hidden="true">
      {slots.map((id, i) => <span key={i} className="deco-slot">{id ? <DecoSvg id={id} /> : null}</span>)}
    </div>
  )
}
