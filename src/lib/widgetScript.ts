import { HATS, PALETTES, SPRITE } from '../components/Fish'
import { key, url } from './supabase'

const APP_URL = 'https://happy-fish-orcin.vercel.app'

/** Script à coller dans l'app Scriptable pour afficher les bocaux sur l'écran d'accueil */
export function widgetScript(token: string): string {
  const pal = Object.fromEntries(Object.entries(PALETTES).map(([k, v]) => [k, { b: v.b, l: v.l, f: v.f, h: v.h }]))
  return `// Happy Fish, widget de l'écran d'accueil
// Ne partage pas ce script : il contient ta clé personnelle de widget.
const DATA_URL = ${JSON.stringify(`${url}/functions/v1/widget?t=${token}`)}
const API_KEY = ${JSON.stringify(key)}
const APP_URL = ${JSON.stringify(APP_URL)}
const SPRITE = ${JSON.stringify(SPRITE)}
const PAL = ${JSON.stringify(pal)}
const HATS = ${JSON.stringify(HATS)}

const rnd = (a, b) => a + Math.random() * (b - a)

function fill(ctx, c, x, y, w, h) { ctx.setFillColor(new Color(c)); ctx.fillRect(new Rect(x, y, w, h)) }

// Heure de Paris (le poisson dort de 22 h à 7 h, comme dans l'app)
function parisHour() {
  try {
    const part = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Paris' })
      .formatToParts(new Date()).find((x) => x.type === 'hour')
    const h = Number(part.value)
    if (isFinite(h)) return h % 24
  } catch (e) {}
  return new Date().getHours()
}

function moodOf(f, hour) {
  if (hour >= 22 || hour < 7) return 'sleep'
  if (f.total > 0 && f.done === f.total) return 'happy'
  return 'normal'
}

// Couleur du score : rouge, orange, vert clair, vert (main = anneau et barre, text = texte lisible)
function scoreColors(done, total) {
  if (!total) return { main: '#8A8AA8', text: '#5A5A7A' }
  const r = done / total
  if (r >= 1) return { main: '#1E9E57', text: '#14803F' }
  if (r >= 0.6) return { main: '#8BC34A', text: '#4E8F12' }
  if (r >= 0.34) return { main: '#F5A524', text: '#B86E00' }
  return { main: '#E5484D', text: '#C62F35' }
}

function drawFish(ctx, x, y, px, color, hat, flip, sleep) {
  const p = PAL[color] || PAL.corail
  const map = { o: '#1B1B3A', k: '#1B1B3A', w: '#FFFFFF', b: p.b, l: p.l, f: p.f, h: p.h }
  SPRITE.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]
      let c = i === 9 && 'bhl'.includes(ch) ? (color === 'nuit' ? '#F2C66D' : '#FFFFFF') : map[ch]
      if (sleep && j === 4 && (i === 12 || i === 13)) c = p.b
      if (!c) continue
      fill(ctx, c, flip ? x + (17 - i) * px : x + i * px, y + (j + 4) * px, px, px)
    }
  })
  ;(HATS[hat] || []).forEach(([hx, hy, hw, hh, c]) => {
    fill(ctx, c, flip ? x + (18 - hx - hw) * px : x + hx * px, y + (hy + 4) * px, hw * px, hh * px)
  })
}

// Points au hasard dans le bocal, en évitant le poisson
function spots(cx, top, size, box, n, rmin, rmax) {
  const R = size / 2
  const out = []
  let tries = 0
  while (out.length < n && tries < 80) {
    tries++
    const r = rnd(rmin, rmax)
    const a = rnd(0, Math.PI * 2)
    const d = rnd(0, R - r - 4)
    const x = cx + Math.cos(a) * d
    const y = top + R + Math.sin(a) * d
    if (x + r > box.x && x - r < box.x + box.w && y + r > box.y && y - r < box.y + box.h) continue
    out.push({ x, y, r })
  }
  return out
}

function drawBowl(ctx, cx, top, size, f, mood) {
  const night = mood === 'sleep'
  const sc = scoreColors(f.done, f.total)
  // anneau : couleur du score du jour
  ctx.setFillColor(new Color(f.total > 0 ? sc.main : '#1B1B3A'))
  ctx.fillEllipse(new Rect(cx - size / 2 - 4, top - 4, size + 8, size + 8))
  ctx.setFillColor(new Color(night ? '#2A5CAA' : '#3FA7F0'))
  ctx.fillEllipse(new Rect(cx - size / 2, top, size, size))
  fill(ctx, night ? '#1E4A94' : '#2B7BD6', cx - size * 0.42, top + size * 0.62, size * 0.84, size * 0.16)
  fill(ctx, '#F2C66D', cx - size * 0.34, top + size * 0.8, size * 0.68, size * 0.1)

  // le poisson nage à un endroit différent à chaque rafraîchissement
  const px = Math.max(2, Math.floor(size / 26))
  const base = top + size * 0.26
  const flip = Math.random() < 0.5
  let dx = rnd(-7, 7)
  let dy = rnd(-14, 0)
  if (mood === 'sleep') { dx = rnd(-5, 5); dy = rnd(0, 5) }
  if (mood === 'happy') { dx = rnd(-5, 5); dy = rnd(-15, -8) }
  const fx = cx - 9 * px + dx
  const fy = base + dy
  drawFish(ctx, fx, fy, px, f.color, f.hat, flip, night)
  const box = { x: fx, y: fy + 4 * px, w: 18 * px, h: 12 * px }

  // bulles (moins quand il dort)
  const nb = mood === 'sleep' ? 2 : mood === 'happy' ? 6 : 4
  spots(cx, top, size, box, nb, 2, 4.5).forEach((s) => {
    ctx.setFillColor(new Color('#FFFFFF', 0.55))
    ctx.fillEllipse(new Rect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2))
  })

  if (mood === 'happy') {
    // il danse : étincelles
    const cols = ['#FFD166', '#FF6FAE', '#7FE3A8', '#FFFFFF']
    spots(cx, top, size, box, 5, 3, 4).forEach((s, i) => {
      const c = cols[i % cols.length]
      fill(ctx, c, s.x - 1, s.y - 4, 2, 8)
      fill(ctx, c, s.x - 4, s.y - 1, 8, 2)
    })
  }

  if (mood === 'sleep') {
    ctx.setTextColor(new Color('#FFFFFF'))
    ctx.setTextAlignedCenter()
    ctx.setFont(Font.boldSystemFont(15))
    ctx.drawTextInRect('Z', new Rect(cx + 4, top + 8, 16, 18))
    ctx.setFont(Font.boldSystemFont(11))
    ctx.drawTextInRect('z', new Rect(cx + 18, top + 22, 12, 14))
  }
}

async function load() {
  try {
    const r = new Request(DATA_URL)
    r.headers = { apikey: API_KEY }
    const d = await r.loadJSON()
    return d && d.fishes ? d : null
  } catch (e) { return null }
}

const data = await load()
const family = config.widgetFamily || 'medium'
const W = family === 'small' ? 158 : 338
const H = 158
const hour = parisHour()
const w = new ListWidget()
w.url = APP_URL
w.setPadding(0, 0, 0, 0)
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000)

const ctx = new DrawContext()
ctx.size = new Size(W, H)
ctx.opaque = true
ctx.respectScreenScale = true
fill(ctx, '#E8F4FF', 0, 0, W, H)

if (!data) {
  ctx.setFont(Font.boldSystemFont(14))
  ctx.setTextColor(new Color('#1B1B3A'))
  ctx.drawTextInRect('Happy Fish attend le réseau', new Rect(12, 64, W - 24, 40))
} else {
  const fishes = family === 'small' ? data.fishes.slice(0, 1) : data.fishes.slice(0, 2)
  const slot = W / fishes.length
  fishes.forEach((f, i) => {
    const cx = slot * i + slot / 2
    const size = family === 'small' ? 92 : 96
    const sc = scoreColors(f.done, f.total)
    drawBowl(ctx, cx, 10, size, f, moodOf(f, hour))
    ctx.setFont(Font.boldSystemFont(12))
    ctx.setTextColor(new Color('#1B1B3A'))
    ctx.setTextAlignedCenter()
    ctx.drawTextInRect(f.fish_name + ', niv. ' + f.level, new Rect(cx - slot / 2 + 4, 112, slot - 8, 16))
    ctx.setFont(Font.boldSystemFont(11))
    ctx.setTextColor(new Color(sc.text))
    const line = f.total === 0 ? 'rien de prévu' : f.done === f.total ? 'journée complète !' : f.done + ' sur ' + f.total + ' aujourd’hui'
    ctx.drawTextInRect(line, new Rect(cx - slot / 2 + 4, 128, slot - 8, 16))
    // barre de progression colorée
    const bw = Math.min(slot - 40, 110)
    fill(ctx, '#D3E3F5', cx - bw / 2, 147, bw, 6)
    if (f.total > 0 && f.done > 0) fill(ctx, sc.main, cx - bw / 2, 147, bw * f.done / f.total, 6)
  })
}

w.backgroundImage = ctx.getImage()
if (config.runsInWidget) Script.setWidget(w)
else await (family === 'small' ? w.presentSmall() : w.presentMedium())
Script.complete()
`
}
