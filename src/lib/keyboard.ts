import { useEffect } from 'react'

// Clavier de l'iPhone : quand il s'ouvre, seule la « zone visible » de l'écran rétrécit,
// l'app garde sa hauteur et Safari la fait glisser vers le haut. On cale donc la hauteur
// de l'app sur la zone visible (variable --app-h) et on remet la page en place.
// La classe « kb » sur <html> masque la barre d'onglets tant que le clavier est ouvert.
export function useKeyboard() {
  useEffect(() => {
    const root = document.documentElement
    const vv = window.visualViewport
    const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false
    let raf = 0
    // Après la fermeture du clavier, iOS tarde parfois à rendre sa hauteur à la zone visible,
    // et l'évènement « resize » peut manquer : on laisse un court délai, puis on revérifie.
    let settleUntil = 0

    const editing = () => {
      const el = document.activeElement as HTMLElement | null
      if (!el) return false
      if (el.tagName === 'TEXTAREA' || el.isContentEditable) return true
      return el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'file', 'range', 'color'].includes((el as HTMLInputElement).type)
    }

    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const zoomed = vv ? vv.scale > 1.01 : false
        const kbHeight = vv && !zoomed ? window.innerHeight - vv.height : 0
        // Un clavier ouvert suppose un champ actif : sans champ actif (et hors délai de fermeture),
        // la hauteur réduite est un reste périmé et on la remet à zéro.
        const kbOpen = kbHeight > 120 && (editing() || Date.now() < settleUntil)
        const open = kbOpen || (touch && editing())
        root.classList.toggle('kb', open)
        if (vv && kbOpen) {
          root.style.setProperty('--app-h', `${Math.round(vv.height)}px`)
          if (window.scrollY || vv.offsetTop) window.scrollTo(0, 0)
        } else {
          root.style.removeProperty('--app-h')
        }
      })
    }
    // Au changement de champ, focusout arrive avant focusin : on attend un instant pour éviter un clignotement
    const onFocus = () => {
      settleUntil = Date.now() + 600
      for (const ms of [30, 250, 700, 1200]) window.setTimeout(update, ms)
    }
    // Retour dans l'app (iPhone verrouillé, autre app) ou rotation : on recalcule aussi
    const onShow = () => update()
    const onVisible = () => { if (!document.hidden) update() }

    update()
    window.addEventListener('pageshow', onShow)
    window.addEventListener('resize', onShow)
    document.addEventListener('visibilitychange', onVisible)
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', onFocus)
    return () => {
      cancelAnimationFrame(raf)
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', onFocus)
      window.removeEventListener('pageshow', onShow)
      window.removeEventListener('resize', onShow)
      document.removeEventListener('visibilitychange', onVisible)
      root.classList.remove('kb')
      root.style.removeProperty('--app-h')
    }
  }, [])
}
