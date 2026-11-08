// Tests du sens d'un glissement (photos du Wall of fame, clavier du chat)
import { describe, expect, it } from 'vitest'
import { swipeDirection } from '../src/lib/swipe'

describe('swipeDirection', () => {
  it('reconnaît gauche, droite et bas quand le geste est franc', () => {
    expect(swipeDirection(-120, 10)).toBe('left')
    expect(swipeDirection(120, -10)).toBe('right')
    expect(swipeDirection(5, 140)).toBe('down')
  })
  it('ignore un geste trop court, en diagonale, ou vers le haut', () => {
    expect(swipeDirection(-30, 5)).toBeNull()
    expect(swipeDirection(-100, 90)).toBeNull()
    expect(swipeDirection(60, 80)).toBeNull()
    expect(swipeDirection(0, -200)).toBeNull()
  })
})
