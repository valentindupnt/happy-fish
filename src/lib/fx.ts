// Petites bulles qui éclatent à l'écran (coche d'un sous-objectif, journée complète)
function reduced(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

export function burst(x: number, y: number, count = 9, spread = 70) {
  if (reduced() || typeof document === 'undefined') return
  const layer = document.createElement('div')
  layer.className = 'fx-layer'
  layer.setAttribute('aria-hidden', 'true')
  for (let i = 0; i < count; i++) {
    const b = document.createElement('span')
    const size = 6 + Math.round(Math.random() * 12)
    b.className = 'fx-bubble'
    b.style.left = `${x - size / 2}px`
    b.style.top = `${y - size / 2}px`
    b.style.width = `${size}px`
    b.style.height = `${size}px`
    b.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * spread * 2)}px`)
    b.style.setProperty('--dy', `${-40 - Math.round(Math.random() * spread * 1.6)}px`)
    b.style.animationDelay = `${Math.round(Math.random() * 120)}ms`
    layer.appendChild(b)
  }
  document.body.appendChild(layer)
  window.setTimeout(() => layer.remove(), 1400)
}

export function burstFrom(el: Element | null, count?: number, spread?: number) {
  if (!el) return
  const r = el.getBoundingClientRect()
  burst(r.left + r.width / 2, r.top + r.height / 2, count, spread)
}

/** Grande pluie de bulles depuis le bas de l'écran */
export function celebrate() {
  if (reduced()) return
  const w = window.innerWidth
  const h = window.innerHeight
  for (let i = 0; i < 5; i++) {
    window.setTimeout(() => burst(w * (0.15 + 0.175 * i), h * 0.75, 10, 90), i * 90)
  }
}
