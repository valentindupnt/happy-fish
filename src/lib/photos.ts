import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export const PHOTO_BUCKET = 'chat-images'
const MAX_SIDE = 1600
const QUALITY = 0.8
const URL_LIFETIME = 60 * 60 * 24 * 7 // une semaine

export interface PreparedPhoto {
  blob: Blob
  width: number
  height: number
  preview: string // adresse locale, pour l'aperçu avant et pendant l'envoi
}

// Réduit la photo (1 600 px de côté au plus, JPEG) : environ 300 Ko au lieu de plusieurs Mo
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const src = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = src
    await img.decode()
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const width = Math.max(1, Math.round(img.naturalWidth * scale))
    const height = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Impossible de lire cette photo')
    ctx.drawImage(img, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', QUALITY))
    if (!blob) throw new Error('Impossible de lire cette photo')
    return { blob, width, height, preview: URL.createObjectURL(blob) }
  } finally {
    URL.revokeObjectURL(src)
  }
}

// Retourne la photo de gauche à droite (les selfies arrivent en miroir par rapport à l'aperçu)
export async function mirrorPhoto(ph: PreparedPhoto): Promise<PreparedPhoto> {
  const img = new Image()
  img.src = ph.preview
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = ph.width
  canvas.height = ph.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Impossible de retourner cette photo')
  ctx.translate(ph.width, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(img, 0, 0, ph.width, ph.height)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', QUALITY))
  if (!blob) throw new Error('Impossible de retourner cette photo')
  URL.revokeObjectURL(ph.preview)
  return { blob, width: ph.width, height: ph.height, preview: URL.createObjectURL(blob) }
}

// Le nom du fichier garde ses dimensions : la place de la photo est réservée avant son chargement
export function photoPath(coupleId: string, width: number, height: number): string {
  const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${coupleId}/${id}_${width}x${height}.jpg`
}

export function photoRatio(path: string | null | undefined): number {
  const m = path?.match(/_(\d+)x(\d+)\.\w+$/)
  if (!m) return 1
  const r = Number(m[1]) / Number(m[2])
  return Number.isFinite(r) && r > 0 ? Math.min(Math.max(r, 0.4), 2.5) : 1
}

// Adresses temporaires des photos (l'espace de stockage est privé), gardées en mémoire
const cache = new Map<string, { url: string; until: number }>()
const waiting = new Set<string>()
const listeners = new Set<() => void>()

async function fetchUrls(paths: string[]) {
  const todo = paths.filter((p) => !waiting.has(p))
  if (!todo.length) return
  todo.forEach((p) => waiting.add(p))
  try {
    const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(todo, URL_LIFETIME)
    const until = Date.now() + (URL_LIFETIME - 3600) * 1000
    for (const row of data || []) if (row.path && row.signedUrl) cache.set(row.path, { url: row.signedUrl, until })
  } catch {
    /* hors ligne : on réessaiera au prochain affichage */
  } finally {
    todo.forEach((p) => waiting.delete(p))
    listeners.forEach((l) => l())
  }
}

export function usePhotoUrls(paths: string[]): Record<string, string> {
  const [, setTick] = useState(0)
  const key = paths.join('|')
  useEffect(() => {
    const l = () => setTick((t) => t + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])
  useEffect(() => {
    const now = Date.now()
    const missing = paths.filter((p) => { const c = cache.get(p); return !c || c.until < now })
    if (missing.length) fetchUrls(missing)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const out: Record<string, string> = {}
  for (const p of paths) { const c = cache.get(p); if (c) out[p] = c.url }
  return out
}
