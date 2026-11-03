import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useStore } from '../lib/store'

const ICONS: Record<string, ReactNode> = {
  today: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 12l3 3 5-6" /></>,
  together: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  fish: <><path d="M5 12c3-4 6-5 9-5 3 0 5 2 7 5-2 3-4 5-7 5-3 0-6-1-9-5z" /><path d="M5 12L2 8M5 12l-3 4" /><circle cx="16" cy="11" r="1" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  next: <path d="M9 5l7 7-7 7" />,
  plus: <path d="M12 4v16M4 12h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  send: <path d="M4 12h14M12 5l7 7-7 7" />,
  link: <path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1" />,
  lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4z" />,
}

export function Icon({ name, size = 22, stroke = 2.2 }: { name: keyof typeof ICONS | string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

export function CheckMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8l3 3 7-7" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="square" />
    </svg>
  )
}

export function Coin({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="6" fill="#F2C66D" stroke="#1B1B3A" strokeWidth="1.5" />
      <rect x="6" y="4" width="2" height="6" fill="#1B1B3A" />
    </svg>
  )
}

export function TreatIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3" y="5" width="10" height="7" fill="#F2C66D" stroke="#1B1B3A" strokeWidth="1.5" />
      <rect x="1" y="7" width="2" height="3" fill="#FF5E3A" />
      <rect x="13" y="7" width="2" height="3" fill="#FF5E3A" />
    </svg>
  )
}

export function BubbleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="6" cy="9" r="4" fill="#FFFFFF" stroke="#1B1B3A" strokeWidth="1.5" />
      <circle cx="12" cy="4" r="2" fill="#FFFFFF" stroke="#1B1B3A" strokeWidth="1.5" />
    </svg>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="h2">{title}</h2>
          <button type="button" className="icon-btn" aria-label="Fermer" onClick={onClose}><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="switch-row">
      <span style={{ fontSize: 14, fontWeight: 700 }}>{label}</span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)}>
        <span />
      </button>
    </div>
  )
}

export function Toasts() {
  const { toasts } = useStore()
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={t.tone === 'error' ? 'toast error' : 'toast'} role={t.tone === 'error' ? 'alert' : 'status'}>{t.text}</div>
      ))}
    </div>
  )
}

export function Bar({ ratio, color, thin }: { ratio: number; color?: string; thin?: boolean }) {
  return (
    <div className={thin ? 'bar thin' : 'bar'} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
      <div style={{ width: `${Math.round(ratio * 100)}%`, background: color }} />
    </div>
  )
}
