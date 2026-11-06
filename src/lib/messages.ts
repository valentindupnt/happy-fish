import type { Message } from './types'

const KEEP = 300

/**
 * Fusionne deux listes de petits mots par identifiant. Un petit mot n'est jamais supprimé par l'app :
 * un rechargement plus ancien, qui arrive en retard, ne peut donc pas faire disparaître un mot reçu entre-temps.
 */
export function mergeMessages(prev: Message[], next: Message[]): Message[] {
  const byId = new Map<string, Message>()
  for (const m of prev) byId.set(m.id, m)
  for (const m of next) byId.set(m.id, m)
  const out = [...byId.values()]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .slice(-KEEP)
  // Rien de neuf (cas du rechargement de contrôle) : on rend la liste d'avant, l'écran n'a rien à redessiner
  if (out.length === prev.length && out.every((m, i) => m === prev[i] || same(m, prev[i]))) return prev
  return out
}

function same(a: Message, b: Message): boolean {
  return a.id === b.id && a.body === b.body && a.kind === b.kind && a.created_at === b.created_at && a.image_path === b.image_path && a.task_id === b.task_id
}

/** Réseau coupé ou instable (typique au retour dans l'app) : une nouvelle tentative a des chances de réussir */
export function isNetworkError(e: unknown): boolean {
  const msg = (e as { message?: string } | null)?.message || String(e ?? '')
  return /Failed to fetch|NetworkError|Load failed|network connection was lost|fetch failed/i.test(msg)
}

/** Identifiant choisi par l'app avant l'envoi : le mot est reconnu tout de suite, et un renvoi ne crée jamais de doublon */
export function newMessageId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  const h = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  return `${h(8)}-${h(4)}-4${h(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${h(3)}-${h(12)}`
}
