import { useEffect, useState } from 'react'

declare const __BUILD_ID__: string

const CHECK_EVERY = 10 * 60 * 1000

// Vrai quand une version plus récente de l'app est en ligne. Aucun rechargement automatique.
export function useUpdateAvailable(): boolean {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    if (import.meta.env.DEV) return
    let stopped = false
    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { id?: string }
        if (!stopped && data.id && data.id !== __BUILD_ID__) setAvailable(true)
      } catch {
        /* hors ligne : on réessaiera */
      }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    check()
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(check, CHECK_EVERY)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [])
  return available
}
