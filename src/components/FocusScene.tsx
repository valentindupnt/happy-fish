import { useEffect, useRef, useState } from 'react'
import { BUBBLE_ART, DESK_X, fishSpot, progressOf, thinkBubble } from '../lib/focusMode'
import type { FishColor } from '../lib/types'
import { Fish, Sprite } from './Fish'

// Scène du mode Focus (étape F1) : le bocal sombre du minuteur, avec une bibliothèque au fond et un bureau.
// Le poisson fait des allers-retours entre son bureau (où il réfléchit) et le reste du bocal (où il se balade).

const BUBBLE_COLORS = { o: '#1B1B3A', g: '#4D8EEA', y: '#F2B705', h: '#FFF3B0' }
const LAMP = {
  rows: ['.oooo...', 'oyyyyo..', 'oyyyyo..', '.oggo...', '..go....', '..go....', '..go....', '.oggo...', 'oggggo..'],
  colors: { o: '#1B1B3A', y: '#FFD76A', g: '#8A94B8' },
}
const NOTEBOOK = {
  rows: ['oooooooooooo', 'owwwwwowwwwo', 'oooooooooooo'],
  colors: { o: '#1B1B3A', w: '#FFFFFF' },
}
const PENCIL = {
  rows: ['yyyyyypk', 'yyyyyypk'],
  colors: { y: '#F2B705', p: '#F4B6A0', k: '#1B1B3A' },
}

// Bibliothèque : 3 étagères de livres de hauteurs et de couleurs variées (toujours les mêmes)
const BOOK_COLORS = ['#C0392B', '#2E86C1', '#F2B705', '#27AE60', '#8E44AD', '#E67E22', '#16A085', '#D35400']
const BOOK_W = [2, 3, 2, 2, 3, 2, 3, 2, 2, 3]
const BOOK_H = [6, 5, 7, 6, 5, 7, 6, 7, 5, 6]
function Library() {
  const shelves = [0, 1, 2].map((row) => {
    const books: { x: number; w: number; h: number; c: string }[] = []
    let x = 2
    for (let i = 0; x < 77; i++) {
      const k = row * 4 + i
      const w = BOOK_W[(k * 3) % BOOK_W.length]
      if (x + w > 78) break
      books.push({ x, w, h: BOOK_H[(k * 7 + row) % BOOK_H.length], c: BOOK_COLORS[(k * 5 + row * 3) % BOOK_COLORS.length] })
      x += w
    }
    return { row, books }
  })
  return (
    <svg className="fscene-library" viewBox="0 0 80 28" shapeRendering="crispEdges" aria-hidden="true">
      <rect x={0} y={0} width={80} height={28} fill="#3A2412" />
      <rect x={1} y={1} width={78} height={26} fill="#1A1020" />
      {shelves.map(({ row, books }) => (
        <g key={row}>
          {books.map((b, i) => <rect key={i} x={b.x} y={8 + row * 9 - b.h} width={b.w} height={b.h} fill={b.c} />)}
          <rect x={1} y={8 + row * 9} width={78} height={1} fill="#6B3E1E" />
        </g>
      ))}
    </svg>
  )
}

export function FocusScene({ color, hat, stade, elapsed, total, done = false, lamp = true, notebook = true }: {
  color: FishColor; hat?: string | null; stade: number; elapsed: number; total: number; done?: boolean; lamp?: boolean; notebook?: boolean
}) {
  const ratio = progressOf(total - elapsed, total)
  const bubble = thinkBubble(ratio)
  const spot = fishSpot(elapsed, total)
  const atDesk = spot.at === 'desk'
  const x = spot.at === 'swim' ? spot.x : DESK_X

  // Le poisson regarde du côté où il va (vers la gauche s'il recule), et fait face au bureau en y arrivant
  const [turn, setTurn] = useState(false)
  const lastX = useRef(DESK_X)
  useEffect(() => {
    if (x !== lastX.current) { setTurn(x < lastX.current); lastX.current = x }
  }, [x])

  return (
    <div className="fscene" aria-hidden="true">
      <Library />
      {lamp && <div className="fscene-halo" />}
      <div className="fscene-desk">
        {lamp && <div className="fscene-lamp"><Sprite rows={LAMP.rows} colors={LAMP.colors} width={44} /></div>}
        {notebook && (
          <div className="fscene-notebook">
            <Sprite rows={NOTEBOOK.rows} colors={NOTEBOOK.colors} width={84} />
            <div className={`fscene-pencil${atDesk && bubble === 'bulb' ? ' is-writing' : ''}`}><Sprite rows={PENCIL.rows} colors={PENCIL.colors} width={32} /></div>
          </div>
        )}
      </div>
      {!done && atDesk && (
        <div className={`fscene-bubble is-${bubble}`} data-bubble={bubble}>
          <Sprite rows={BUBBLE_ART[bubble]} colors={BUBBLE_COLORS} width={bubble === 'dots' ? 42 : 50} />
          <span className="fscene-bubble-tail a" />
          <span className="fscene-bubble-tail b" />
        </div>
      )}
      <div
        className={`fscene-fish${atDesk ? ' at-desk' : ' is-swimming'}`}
        data-spot={spot.at}
        style={{ left: `${x * 100}%`, top: spot.at === 'swim' ? `${spot.y * 100}%` : undefined }}
      >
        <div className="fscene-bob">
          <Fish color={color} hat={hat} stade={stade} width={104} flip={!atDesk && turn} mood={done ? 'happy' : atDesk ? 'think' : 'normal'} />
        </div>
      </div>
    </div>
  )
}
