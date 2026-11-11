// Tests du mode Focus (étape F1) : bulle de pensée, mode enregistré, scène
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { BUBBLE_ART, BULB_FROM, DESK_MS, DESK_X, GEAR_FROM, STROLL_MS, STROLL_STEP_MS, WAYPOINTS, fishSpot, modeOf, progressOf, thinkBubble } from '../src/lib/focusMode'
import { FocusScene } from '../src/components/FocusScene'
import { readFocus, startFocus } from '../src/components/FocusTimer'

// Un petit localStorage de remplacement : les tests tournent sans navigateur
const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  ;(globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
    },
  }
})

describe('bulle de pensée', () => {
  it('« … » avant 50 %, engrenage de 50 à 90 %, ampoule ensuite', () => {
    expect(thinkBubble(0)).toBe('dots')
    expect(thinkBubble(0.49)).toBe('dots')
    expect(thinkBubble(GEAR_FROM)).toBe('gear')
    expect(thinkBubble(0.89)).toBe('gear')
    expect(thinkBubble(BULB_FROM)).toBe('bulb')
    expect(thinkBubble(1)).toBe('bulb')
  })

  it('les seuils sont 50 % et 90 %', () => {
    expect([GEAR_FROM, BULB_FROM]).toEqual([0.5, 0.9])
  })

  it('reste sur « … » si la valeur est absurde', () => {
    expect(thinkBubble(Number.NaN)).toBe('dots')
    expect(thinkBubble(-1)).toBe('dots')
  })

  it('suit un vrai minuteur de 25 minutes : ampoule dans les 2 min 30 de fin', () => {
    const total = 25 * 60_000
    expect(thinkBubble(progressOf(total, total))).toBe('dots')
    expect(thinkBubble(progressOf(12 * 60_000, total))).toBe('gear')
    expect(thinkBubble(progressOf(150_000, total))).toBe('bulb')
    expect(thinkBubble(progressOf(0, total))).toBe('bulb')
  })

  it('avancement borné entre 0 et 1', () => {
    expect(progressOf(10, 0)).toBe(0)
    expect(progressOf(-5000, 1000)).toBe(1)
    expect(progressOf(5000, 1000)).toBe(0)
  })

  it('chaque dessin a des lignes de même largeur', () => {
    for (const rows of Object.values(BUBBLE_ART)) expect(new Set(rows.map((r) => r.length)).size).toBe(1)
  })
})

describe('mode du minuteur', () => {
  it('un minuteur sans mode est un minuteur classique', () => {
    expect(modeOf({})).toBe('classic')
    expect(modeOf(null)).toBe('classic')
    expect(modeOf({ mode: 'focus' })).toBe('focus')
  })

  it('startFocus garde le mode choisi, classique par défaut', () => {
    expect(startFocus('t1', 25).mode).toBe('classic')
    expect(startFocus('t1', 25, 'focus').mode).toBe('focus')
  })

  it('le minuteur reprend après la fermeture de l’app, avec son mode', () => {
    const f = startFocus('t1', 25, 'focus')
    const back = readFocus()
    expect(back).toEqual(f)
    expect(modeOf(back)).toBe('focus')
    expect(back!.endAt! - Date.now()).toBeGreaterThan(24 * 60_000)
  })

  it('un ancien minuteur enregistré sans mode se rouvre en classique', () => {
    store.set('hf-focus', JSON.stringify({ taskId: 't1', endAt: Date.now() + 60_000, left: 60_000, total: 60_000 }))
    expect(modeOf(readFocus())).toBe('classic')
  })
})

describe('allers-retours du poisson', () => {
  const total = 25 * 60_000
  const MIN = 60_000

  it('au bureau au début, puis en balade après 2 min 30', () => {
    expect(fishSpot(0, total).at).toBe('desk')
    expect(fishSpot(DESK_MS - 1, total).at).toBe('desk')
    expect(fishSpot(DESK_MS, total).at).toBe('swim')
  })

  it('revient au bureau après 1 min 30 de balade, puis repart', () => {
    expect(fishSpot(DESK_MS + STROLL_MS - 1, total).at).toBe('swim')
    expect(fishSpot(DESK_MS + STROLL_MS, total).at).toBe('desk')
    expect(fishSpot(2 * DESK_MS + STROLL_MS, total).at).toBe('swim')
  })

  it('change de coin toutes les 15 secondes pendant la balade, sans rester au même', () => {
    const spots = Array.from({ length: STROLL_MS / STROLL_STEP_MS }, (_, i) => fishSpot(DESK_MS + i * STROLL_STEP_MS, total))
    for (const sp of spots) expect(sp.at).toBe('swim')
    for (let i = 1; i < spots.length; i++) {
      const a = spots[i - 1] as { x: number; y: number }
      const b = spots[i] as { x: number; y: number }
      expect([a.x, a.y]).not.toEqual([b.x, b.y])
    }
  })

  it('les coins visités sont dans l’écran et loin du bureau (ou au moins distincts de sa place)', () => {
    for (const [x, y] of WAYPOINTS) {
      expect(x).toBeGreaterThan(0.05); expect(x).toBeLessThan(0.95)
      expect(y).toBeGreaterThan(0.25); expect(y).toBeLessThan(0.85)
    }
    expect(DESK_X).toBeGreaterThan(0.5)
  })

  it('dans les 10 derniers % il est toujours au bureau, pour que l’ampoule se voie', () => {
    const start = total * BULB_FROM
    for (let e = start; e <= total; e += 5_000) expect(fishSpot(e, total).at).toBe('desk')
    // avec un autre minuteur, mêmes règles : 40 min, la fin tombe en pleine balade sans la règle
    const t40 = 40 * MIN
    for (let e = t40 * BULB_FROM; e <= t40; e += 5_000) expect(fishSpot(e, t40).at).toBe('desk')
  })

  it('un court minuteur de 5 min : bureau, balade, puis bureau pour la fin', () => {
    const t5 = 5 * MIN
    expect(fishSpot(MIN, t5).at).toBe('desk')
    expect(fishSpot(3 * MIN, t5).at).toBe('swim')
    expect(fishSpot(4.6 * MIN, t5).at).toBe('desk')
  })

  it('ne dépend que du temps écoulé : même instant, même place, après une reprise', () => {
    expect(fishSpot(200_000, total)).toEqual(fishSpot(200_000, total))
  })

  it('valeurs absurdes : reste au bureau', () => {
    expect(fishSpot(Number.NaN, total).at).toBe('desk')
    expect(fishSpot(-5, total).at).toBe('desk')
  })
})

describe('scène Focus', () => {
  const total = 25 * 60_000
  const html = (elapsed: number, done = false) =>
    renderToStaticMarkup(createElement(FocusScene, { color: 'corail', stade: 3, elapsed, total, done }))

  it('au bureau, affiche la bulle qui correspond à l’avancement', () => {
    expect(html(0.05 * total)).toContain('data-bubble="dots"')
    expect(html(0.97 * total)).toContain('data-bubble="bulb"')
  })

  it('l’engrenage apparaît à la moitié quand le poisson est au bureau', () => {
    // 50 % de 25 min = 12 min 30 s : cycle de 4 min, on y est à 0 min 30 s dans le 4e cycle, donc au bureau
    expect(html(0.5 * total)).toContain('data-bubble="gear"')
  })

  it('le poisson réfléchit au bureau, sans bulle ni humeur « pense » quand il se balade', () => {
    const desk = html(10_000)
    expect(desk).toContain('mood-think')
    expect(desk).toContain('data-spot="desk"')
    const swim = html(DESK_MS + 5_000)
    expect(swim).toContain('data-spot="swim"')
    expect(swim).not.toContain('mood-think')
    expect(swim).not.toContain('data-bubble')
  })

  it('la bibliothèque et le bureau sont toujours là', () => {
    const h = html(10_000)
    expect(h).toContain('fscene-library')
    expect(h).toContain('fscene-desk')
  })

  it('à la fin, plus de bulle et le poisson se réjouit', () => {
    const h = html(total, true)
    expect(h).not.toContain('data-bubble')
    expect(h).toContain('mood-happy')
  })
})
