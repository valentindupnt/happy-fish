import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { stadeOf } from '../lib/xp'
import { celebrate } from '../lib/fx'
import { Fish } from './Fish'

// Minuteur plein écran : écran noir, le poisson nage partout, le chrono au centre.
// L'heure de fin est gardée dans le téléphone : si l'app se ferme, le minuteur reprend où il en était.

const KEY = 'hf-focus'

export interface FocusState { taskId: string; endAt: number | null; left: number; total: number }

export function readFocus(): FocusState | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as FocusState) : null
  } catch { return null }
}

function saveFocus(f: FocusState | null) {
  try {
    if (f) window.localStorage.setItem(KEY, JSON.stringify(f))
    else window.localStorage.removeItem(KEY)
  } catch { /* rien */ }
}

export function startFocus(taskId: string, minutes: number): FocusState {
  const total = minutes * 60_000
  const f = { taskId, endAt: Date.now() + total, left: total, total }
  saveFocus(f)
  return f
}

function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// Petit carillon joué à la fin (le son n'est permis qu'après un geste, d'où la création au démarrage)
let audio: AudioContext | null = null
export function unlockAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!audio && AC) audio = new AC()
    void audio?.resume()
  } catch { /* rien */ }
}
function chime() {
  if (!audio) return
  const t0 = audio.currentTime
  ;[659, 784, 988].forEach((f, i) => {
    const o = audio!.createOscillator()
    const g = audio!.createGain()
    o.type = 'square'
    o.frequency.value = f
    g.gain.setValueAtTime(0.0001, t0 + i * 0.16)
    g.gain.exponentialRampToValueAtTime(0.08, t0 + i * 0.16 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.16 + 0.3)
    o.connect(g).connect(audio!.destination)
    o.start(t0 + i * 0.16)
    o.stop(t0 + i * 0.16 + 0.32)
  })
}

export function FocusTimer({ focus, onClose }: { focus: FocusState; onClose: () => void }) {
  const { me, goalOf, tasks, run, reloadTasks, reload, fishOf, userId } = useStore()
  const [f, setF] = useState<FocusState>(focus)
  const [now, setNow] = useState(Date.now())
  const [finished, setFinished] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState('')
  const lock = useRef<{ release: () => Promise<void> } | null>(null)
  const task = tasks.find((t) => t.id === f.taskId)
  const goal = task ? goalOf(task.goal_id) : undefined

  const left = f.endAt ? f.endAt - now : f.left
  const paused = f.endAt === null

  // Garder l'écran allumé pendant le minuteur
  const keepAwake = useCallback(async () => {
    try {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
      if (wl && document.visibilityState === 'visible') lock.current = await wl.request('screen')
    } catch { /* rien */ }
  }, [])

  useEffect(() => {
    void keepAwake()
    const onVis = () => { if (document.visibilityState === 'visible') { setNow(Date.now()); void keepAwake() } }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      void lock.current?.release().catch(() => undefined)
    }
  }, [keepAwake])

  useEffect(() => {
    if (paused || finished) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [paused, finished])

  const finish = useCallback(async () => {
    setFinished(true)
    saveFocus(null)
    chime()
    try { navigator.vibrate?.([120, 80, 120]) } catch { /* rien */ }
    if (task && !task.done_at) {
      const ok = await run(() => supabase.rpc('toggle_task', { p_task: task.id }))
      if (ok) {
        celebrate()
        await Promise.all([reloadTasks(), reload(['fish', 'streaks'])])
      }
    } else {
      celebrate()
    }
  }, [task, run, reloadTasks, reload])

  useEffect(() => {
    if (!finished && !paused && left <= 0) void finish()
  }, [left, paused, finished, finish])

  const update = (next: FocusState) => { setF(next); saveFocus(next) }
  const togglePause = () => {
    if (paused) update({ ...f, endAt: Date.now() + f.left })
    else update({ ...f, endAt: null, left: Math.max(0, left) })
  }
  // Change la durée en cours de route : delta en ms (le temps restant ne descend pas sous 1 minute)
  const adjust = (delta: number) => {
    const cur = Math.max(0, left)
    const d = Math.max(delta, 60_000 - cur)
    if (paused) update({ ...f, left: f.left + d, total: Math.max(60_000, f.total + d) })
    else update({ ...f, endAt: (f.endAt || Date.now()) + d, total: Math.max(60_000, f.total + d) })
  }
  const applyEdit = () => {
    const m = Math.round(Number(editVal))
    if (Number.isFinite(m) && m >= 1 && m <= 600) adjust(m * 60_000 - Math.max(0, left))
    setEditing(false)
  }
  const stop = () => { saveFocus(null); onClose() }

  const ratio = Math.min(1, Math.max(0, 1 - left / f.total))

  return createPortal(
    <div className={`focus${paused ? ' is-paused' : ''}`} role="dialog" aria-modal="true" aria-label="Minuteur">
      <div className="focus-swim-x" aria-hidden="true">
        <div className="focus-swim-y">
          <Fish color={me?.fish_color || 'corail'} hat={me?.fish_hat} stade={stadeOf(fishOf(userId).level)} width={96} mood={finished ? 'happy' : 'normal'} />
        </div>
      </div>
      <div className="focus-bubble focus-bubble-a" />
      <div className="focus-bubble focus-bubble-b" />
      <div className="focus-bubble focus-bubble-c" />

      <div className="focus-center">
        <span className="focus-title">{goal?.title || 'Concentration'}</span>
        <span className="focus-time" role="timer" aria-live="off">{finished ? 'Bravo !' : mmss(left)}</span>
        <div className="focus-bar"><div style={{ width: `${ratio * 100}%` }} /></div>
        {!finished && editing && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', pointerEvents: 'auto' }}>
            <input
              className="input"
              style={{ width: 90, textAlign: 'center' }}
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              autoFocus
              aria-label="Minutes restantes"
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applyEdit() }}
            />
            <span className="focus-hint">min restantes</span>
            <button type="button" className="focus-btn primary" onClick={applyEdit}>OK</button>
          </div>
        )}
        <span className="focus-hint">
          {finished ? 'Sous-objectif coché, ton poisson est fier de toi.' : paused ? 'En pause' : 'Garde l’app ouverte, l’écran reste allumé.'}
        </span>
      </div>

      <div className="focus-actions">
        {finished ? (
          <button type="button" className="focus-btn primary" onClick={onClose}>Retour</button>
        ) : confirmStop ? (
          <>
            <button type="button" className="focus-btn" onClick={stop}>Oui, arrêter</button>
            <button type="button" className="focus-btn primary" onClick={() => setConfirmStop(false)}>Continuer</button>
          </>
        ) : (
          <>
            <button type="button" className="focus-btn" onClick={() => setConfirmStop(true)}>Arrêter</button>
            <button type="button" className="focus-btn" aria-label="Retirer 5 minutes" onClick={() => adjust(-300_000)}>−5</button>
            <button type="button" className="focus-btn" aria-label="Ajouter 5 minutes" onClick={() => adjust(300_000)}>+5</button>
            <button type="button" className="focus-btn" onClick={() => { setEditVal(String(Math.max(1, Math.ceil(Math.max(0, left) / 60_000)))); setEditing((e) => !e) }}>Durée</button>
            <button type="button" className="focus-btn primary" onClick={togglePause}>{paused ? 'Reprendre' : 'Pause'}</button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
