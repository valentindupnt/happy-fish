import { useRef } from 'react'
import type { TouchEvent } from 'react'

export type SwipeDirection = 'left' | 'right' | 'down' | null

const MIN_DISTANCE = 60
const MIN_RATIO = 1.5

/** Sens d'un glissement : franc (60 px au moins) et nettement horizontal ou vertical, sinon rien */
export function swipeDirection(dx: number, dy: number): SwipeDirection {
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ax >= MIN_DISTANCE && ax >= ay * MIN_RATIO) return dx < 0 ? 'left' : 'right'
  if (dy >= MIN_DISTANCE && dy >= ax * MIN_RATIO) return 'down'
  return null
}

interface Handlers {
  onLeft?: () => void
  onRight?: () => void
  onDown?: () => void
}

/** Détecte un glissement au doigt sans bouton. « left » : le doigt va vers la gauche. À poser sur un élément. */
export function useSwipe({ onLeft, onRight, onDown }: Handlers) {
  const start = useRef<{ x: number; y: number; sheetTop: number } | null>(null)
  return {
    onTouchStart: (e: TouchEvent<HTMLElement>) => {
      // Deux doigts (zoom) : pas un glissement
      if (e.touches.length !== 1) { start.current = null; return }
      const t = e.touches[0]
      const sheet = (e.target as HTMLElement).closest?.('.sheet') as HTMLElement | null
      start.current = { x: t.clientX, y: t.clientY, sheetTop: sheet?.scrollTop ?? 0 }
    },
    onTouchEnd: (e: TouchEvent<HTMLElement>) => {
      const s = start.current
      start.current = null
      if (!s || e.changedTouches.length !== 1) return
      const t = e.changedTouches[0]
      const dir = swipeDirection(t.clientX - s.x, t.clientY - s.y)
      if (dir === 'left') onLeft?.()
      else if (dir === 'right') onRight?.()
      // Vers le bas : seulement si la feuille n'était pas défilée, sinon le doigt fait remonter son contenu
      else if (dir === 'down' && s.sheetTop <= 0) onDown?.()
    },
    onTouchCancel: () => { start.current = null },
  }
}
