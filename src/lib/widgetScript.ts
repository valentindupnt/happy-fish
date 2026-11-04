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

function fill(ctx, c, x, y, w, h) { ctx.setFillColor(new Color(c)); ctx.fillRect(new Rect(x, y, w, h)) }

function drawFish(ctx, x, y, px, color, hat, flip) {
  const p = PAL[color] || PAL.corail
  const map = { o: '#1B1B3A', k: '#1B1B3A', w: '#FFFFFF', b: p.b, l: p.l, f: p.f, h: p.h }
  SPRITE.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]
      const c = i === 9 && 'bhl'.includes(ch) ? (color === 'nuit' ? '#F2C66D' : '#FFFFFF') : map[ch]
      if (!c) continue
      fill(ctx, c, flip ? x + (17 - i) * px : x + i * px, y + (j + 4) * px, px, px)
    }
  })
  ;(HATS[hat] || []).forEach(([hx, hy, hw, hh, c]) => {
    fill(ctx, c, flip ? x + (18 - hx - hw) * px : x + hx * px, y + (hy + 4) * px, hw * px, hh * px)
  })
}

function drawBowl(ctx, cx, top, size, f, flip) {
  ctx.setFillColor(new Color('#1B1B3A'))
  ctx.fillEllipse(new Rect(cx - size / 2 - 3, top - 3, size + 6, size + 6))
  ctx.setFillColor(new Color('#3FA7F0'))
  ctx.fillEllipse(new Rect(cx - size / 2, top, size, size))
  fill(ctx, '#2B7BD6', cx - size * 0.42, top + size * 0.62, size * 0.84, size * 0.16)
  fill(ctx, '#F2C66D', cx - size * 0.34, top + size * 0.8, size * 0.68, size * 0.1)
  const px = Math.max(2, Math.floor(size / 26))
  drawFish(ctx, cx - 9 * px, top + size * 0.26, px, f.color, f.hat, flip)
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
    drawBowl(ctx, cx, 10, size, f, i === 1)
    ctx.setFont(Font.boldSystemFont(12))
    ctx.setTextColor(new Color('#1B1B3A'))
    ctx.setTextAlignedCenter()
    ctx.drawTextInRect(f.fish_name + ', niv. ' + f.level, new Rect(cx - slot / 2 + 4, 112, slot - 8, 16))
    ctx.setFont(Font.mediumSystemFont(11))
    ctx.setTextColor(new Color(f.total > 0 && f.done === f.total ? '#1E9E57' : '#5A5A7A'))
    const line = f.total === 0 ? 'rien de prévu' : f.done === f.total ? 'journée complète !' : f.done + ' sur ' + f.total + ' aujourd’hui'
    ctx.drawTextInRect(line, new Rect(cx - slot / 2 + 4, 128, slot - 8, 16))
  })
}

w.backgroundImage = ctx.getImage()
if (config.runsInWidget) Script.setWidget(w)
else await (family === 'small' ? w.presentSmall() : w.presentMedium())
Script.complete()
`
}
