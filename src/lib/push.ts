import { supabase } from './supabase'

// Clé publique VAPID (la clé privée est rangée dans le Vault de Supabase)
const VAPID_PUBLIC = 'BE8dQcELb40chJOpKgfFDL1I0dAJZJDUQehqSTP1B9F1Oe56GOK9PGihQSKI5fU-yA1jZVEjk673USFJDayo2MM'

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

export function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

export async function pushState(): Promise<PushState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return isIos() && !isStandalone() ? 'needs-install' : 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function b64(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** À appeler depuis un geste (bouton) : demande l'autorisation et enregistre l'appareil */
export async function enablePush(profileId: string): Promise<PushState> {
  const reg = (await navigator.serviceWorker.getRegistration()) || (await registerServiceWorker())
  if (!reg) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC) }))
  const { error } = await supabase.from('push_subscriptions').upsert(
    { profile_id: profileId, endpoint: sub.endpoint, p256dh: b64(sub.getKey('p256dh')), auth: b64(sub.getKey('auth')) },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
  return 'on'
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export async function sendTestPush(): Promise<number> {
  const { data, error } = await supabase.functions.invoke('notify', { body: { type: 'test' } })
  if (error) throw error
  return (data as { sent?: number })?.sent ?? 0
}
