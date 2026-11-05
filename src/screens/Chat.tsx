import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { dateOfTimestamp, longDay, timeLabel } from '../lib/dates'
import { PHOTO_BUCKET, photoPath, photoRatio, preparePhoto, usePhotoUrls } from '../lib/photos'
import type { PreparedPhoto } from '../lib/photos'
import { Fish } from '../components/Fish'
import { BubbleIcon, Icon, TreatIcon } from '../components/ui'

// Un message envoyé s'affiche tout de suite, avant la réponse du serveur
interface Pending {
  tempId: string
  realId?: string
  kind: 'text' | 'image'
  body: string | null
  taskId: string | null
  createdAt: string
  preview?: string
  ratio?: number
}

interface Item {
  key: string
  mine: boolean
  kind: 'text' | 'image' | 'bubble' | 'treat'
  body: string | null
  taskId: string | null
  createdAt: string
  imagePath?: string | null
  preview?: string
  ratio?: number
  sending?: boolean
}

const GROUP_GAP = 5 * 60 * 1000
const isWord = (i: Item) => i.kind === 'text' || i.kind === 'image'
const touch = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false)

export function Chat({ refTaskId, clearRef }: { refTaskId: string | null; clearRef: () => void }) {
  const { me, partner, partnerName, userId, messages, force, today, run, reload, tasks, goalOf, couple, toast } = useStore()
  const [text, setText] = useState('')
  const [pending, setPending] = useState<Pending[]>([])
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [jump, setJump] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const atBottom = useRef(true)
  const previews = useRef<string[]>([])
  const openedAt = useRef(Date.now())

  useEffect(() => { if (refTaskId) inputRef.current?.focus() }, [refTaskId])
  useEffect(() => () => { previews.current.forEach((u) => URL.revokeObjectURL(u)) }, [])

  // Hauteur du champ : suit le texte, jusqu'à 5 lignes environ
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [text])

  const treatsLeft = Math.max(0, 3 - messages.filter((m) => m.author_id === userId && m.kind === 'treat' && dateOfTimestamp(m.created_at) === today).length)
  const refTask = refTaskId ? tasks.find((t) => t.id === refTaskId) : null
  const refTitle = (taskId: string | null) => {
    if (!taskId) return null
    const t = tasks.find((x) => x.id === taskId)
    return t ? goalOf(t.goal_id)?.title || null : null
  }
  const doneToday = tasks.filter((t) => t.date === today && t.done_at && (t.owner_id === partner?.id || t.owner_id === null)).length

  // Messages de la base, puis ceux encore en route
  const items: Item[] = useMemo(() => {
    const byReal = new Map(pending.filter((p) => p.realId).map((p) => [p.realId as string, p]))
    const known = new Set(messages.map((m) => m.id))
    const list: Item[] = messages.map((m) => {
      const p = byReal.get(m.id)
      return {
        key: p?.tempId || m.id, mine: m.author_id === userId, kind: m.kind, body: m.body, taskId: m.task_id,
        createdAt: m.created_at, imagePath: m.image_path, preview: p?.preview, ratio: m.image_path ? photoRatio(m.image_path) : undefined,
      }
    })
    for (const p of pending) {
      if (p.realId && known.has(p.realId)) continue
      list.push({ key: p.tempId, mine: true, kind: p.kind, body: p.body, taskId: p.taskId, createdAt: p.createdAt, preview: p.preview, ratio: p.ratio, sending: !p.realId })
    }
    return list
  }, [messages, pending, userId])

  const urls = usePhotoUrls(useMemo(() => items.filter((i) => i.imagePath).map((i) => i.imagePath as string), [items]))

  // Défilement : on reste collé en bas, sauf si on est remonté lire
  const toBottom = (smooth: boolean) => {
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }
  const onScroll = () => {
    const el = listRef.current
    if (!el) return
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (atBottom.current) setJump(false)
  }
  useLayoutEffect(() => { toBottom(false) }, [])
  const last = items[items.length - 1]
  useLayoutEffect(() => {
    if (!last) return
    if (atBottom.current || last.mine) toBottom(true)
    else setJump(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.key])
  // Le clavier qui s'ouvre réduit la liste : on garde le dernier message visible
  useEffect(() => {
    const el = listRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => { if (atBottom.current) toBottom(false) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const addPending = (p: Pending) => setPending((ps) => [...ps, p])
  const settle = (tempId: string, realId: string | undefined) => {
    if (realId) {
      setPending((ps) => ps.map((x) => (x.tempId === tempId ? { ...x, realId } : x)))
      reload(['messages'])
    } else {
      setPending((ps) => ps.filter((x) => x.tempId !== tempId))
    }
  }
  const insertMessage = async (row: Record<string, unknown>) => {
    let id: string | undefined
    const ok = await run(async () => {
      const res = await supabase.from('messages').insert({ couple_id: couple?.id, author_id: userId, ...row }).select('id').single()
      id = (res.data as { id: string } | null)?.id
      return res
    })
    return ok ? id : undefined
  }

  const sendText = async (raw: string) => {
    const body = raw.trim()
    if (!body || !couple) return
    const tempId = `tmp-${Date.now()}-${Math.random()}`
    const taskId = refTaskId
    addPending({ tempId, kind: 'text', body, taskId, createdAt: new Date().toISOString() })
    setText('')
    clearRef()
    atBottom.current = true
    const id = await insertMessage({ kind: 'text', body, task_id: taskId })
    settle(tempId, id)
    if (!id) setText((t) => t || body)
  }

  const sendPhoto = async () => {
    if (!photo || !couple) return
    const ph = photo
    const caption = text.trim() || null
    const path = photoPath(couple.id, ph.width, ph.height)
    const tempId = `tmp-${Date.now()}-${Math.random()}`
    addPending({ tempId, kind: 'image', body: caption, taskId: null, createdAt: new Date().toISOString(), preview: ph.preview, ratio: ph.width / ph.height })
    setPhoto(null)
    setText('')
    atBottom.current = true
    const uploaded = await run(() => supabase.storage.from(PHOTO_BUCKET).upload(path, ph.blob, { contentType: 'image/jpeg', cacheControl: '31536000' }))
    const id = uploaded ? await insertMessage({ kind: 'image', image_path: path, body: caption }) : undefined
    settle(tempId, id)
    if (!id) { setPhoto(ph); setText((t) => t || caption || '') }
  }

  const submit = () => (photo ? sendPhoto() : sendText(text))

  const pickPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const ph = await preparePhoto(file)
      previews.current.push(ph.preview)
      setPhoto(ph)
      inputRef.current?.focus()
    } catch {
      toast('Cette photo n’a pas pu être ouverte', 'error')
    }
  }

  const bubble = async () => {
    if (await run(() => supabase.from('messages').insert({ couple_id: couple?.id, author_id: userId, kind: 'bubble' }))) {
      atBottom.current = true
      await reload(['messages'])
    }
  }

  const treat = async () => {
    if (await run(() => supabase.rpc('send_treat'))) {
      atBottom.current = true
      await reload(['messages', 'fish'])
    }
  }

  const canSend = Boolean(photo || text.trim())
  const showForce = force.length > 0 && !text && !photo
  // Garde le clavier ouvert quand on touche un bouton du champ
  const keep = { onMouseDown: (e: { preventDefault: () => void }) => e.preventDefault() }

  return (
    <div className="chat-screen">
      <header className="chat-head">
        <div className="fish-tile" style={{ width: 40, height: 32, borderRadius: 9 }}>
          {partner && <Fish color={partner.fish_color} width={28} label={`Poisson de ${partnerName}`} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 className="chat-name">{partner ? partnerName : 'Petits mots'}</h1>
          <p className="chat-sub">
            {partner ? `${doneToday} objectif${doneToday > 1 ? 's' : ''} coché${doneToday > 1 ? 's' : ''} aujourd’hui` : 'Ton duo n’a pas encore rejoint l’app'}
          </p>
        </div>
      </header>

      <div className="chat-list" ref={listRef} onScroll={onScroll} aria-live="polite">
        {items.length === 0 && <div className="empty">Envoie le premier petit mot à {partnerName}.</div>}
        {items.map((m, i) => {
          const prev = items[i - 1]
          const next = items[i + 1]
          const day = dateOfTimestamp(m.createdAt)
          const sep = !prev || dateOfTimestamp(prev.createdAt) !== day ? (day === today ? 'Aujourd’hui' : longDay(day)) : null
          const same = (o: Item | undefined) =>
            !!o && isWord(o) && o.mine === m.mine && dateOfTimestamp(o.createdAt) === day &&
            Math.abs(Date.parse(o.createdAt) - Date.parse(m.createdAt)) < GROUP_GAP
          const first = !same(prev) || !!sep
          const lastOfGroup = !same(next) || (!!next && dateOfTimestamp(next.createdAt) !== day)
          const side = m.mine ? 'me' : 'them'
          const ref = refTitle(m.taskId)
          const src = (m.imagePath && urls[m.imagePath]) || m.preview
          return (
            <div key={m.key} style={{ display: 'contents' }}>
              {sep && <p className="chat-day">{sep}</p>}
              {isWord(m) ? (
                <div className={`msg-row ${side}${first ? ' first' : ''}${Date.parse(m.createdAt) > openedAt.current ? ' fresh' : ''}`}>
                  <div className={`msg ${side}${first ? ' first' : ''}${lastOfGroup ? ' last' : ''}${m.kind === 'image' ? ' has-photo' : ''}${m.sending ? ' sending' : ''}`}>
                    {ref && <div className="ref">Sur {m.mine ? `l’objectif de ${partnerName}` : 'ton objectif'} : {ref}</div>}
                    {m.kind === 'image' && (
                      <button type="button" className="msg-photo" style={{ aspectRatio: String(m.ratio || 1), width: `min(240px, 62vw, ${Math.round(320 * (m.ratio || 1))}px)` }} onClick={() => src && setViewing(src)} aria-label="Voir la photo en grand">
                        {src && <img src={src} alt="" loading="lazy" decoding="async" />}
                      </button>
                    )}
                    {m.body && <div className="msg-text">{m.body}</div>}
                  </div>
                  {lastOfGroup && <div className="msg-time">{m.sending ? 'Envoi…' : timeLabel(m.createdAt)}</div>}
                </div>
              ) : m.kind === 'treat' ? (
                <div className="gesture treat"><TreatIcon size={14} />{m.mine ? `Friandise envoyée à ${partnerName}` : `${partnerName} t’a envoyé une friandise`}</div>
              ) : (
                <div className="gesture bubble"><BubbleIcon size={14} />{m.mine ? `Bulle envoyée à ${partnerName}` : `${partnerName} t’a envoyé une bulle`}</div>
              )}
            </div>
          )
        })}
      </div>

      <div className="composer">
        {jump && (
          <button type="button" className="chat-jump" onClick={() => { atBottom.current = true; setJump(false); toBottom(true) }}>
            <Icon name="down" size={16} stroke={2.6} /> Nouveau message
          </button>
        )}
        {!partner && (
          <span className="small" style={{ fontWeight: 700 }}>
            {me?.partner_nickname || 'Ton duo'} verra tes mots en rejoignant votre duo avec le code{' '}
            <strong style={{ fontFamily: 'var(--pixel)', fontSize: 11 }}>{couple?.invite_code}</strong>.
            Les bulles et friandises s’ouvriront à ce moment-là.
          </span>
        )}
        {refTask && (
          <div className="composer-ref">
            <span>Sur l’objectif : {goalOf(refTask.goal_id)?.title}</span>
            <button type="button" aria-label="Retirer l’objectif" onClick={clearRef}><Icon name="close" size={14} stroke={2.6} /></button>
          </div>
        )}
        {showForce && (
          <div className="force-row" aria-label="Messages de force">
            {force.map((f) => (
              <button key={f.id} type="button" className="force-chip" {...keep} onClick={() => sendText(f.body)}>{f.body}</button>
            ))}
          </div>
        )}
        <div className="composer-box">
          {photo && (
            <div className="composer-photo">
              <img src={photo.preview} alt="Photo à envoyer" />
              <button type="button" aria-label="Retirer la photo" onClick={() => setPhoto(null)}><Icon name="close" size={12} stroke={3} /></button>
            </div>
          )}
          <label htmlFor="mot" className="sr-only">Écrire un petit mot</label>
          <textarea
            id="mot"
            ref={inputRef}
            className="composer-input"
            rows={1}
            placeholder={photo ? 'Ajouter une légende…' : `Un petit mot pour ${partnerName}…`}
            value={text}
            maxLength={1000}
            enterKeyHint={touch ? 'enter' : 'send'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Sur iPhone, Retour va à la ligne (comme Messages) ; sur ordinateur, Entrée envoie
              if (!touch && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() }
            }}
          />
          <div className="composer-tools">
            <button type="button" className="tool" aria-label="Envoyer une photo" onClick={() => fileRef.current?.click()}><Icon name="photo" size={20} /></button>
            <button type="button" className="tool" aria-label="Envoyer une bulle" disabled={!partner} {...keep} onClick={bubble}><BubbleIcon size={19} /></button>
            <button type="button" className="tool" aria-label={`Envoyer une friandise, ${treatsLeft} restante${treatsLeft > 1 ? 's' : ''} aujourd’hui`} disabled={!partner || treatsLeft === 0} {...keep} onClick={treat}>
              <TreatIcon size={19} /><span className="tool-count">{treatsLeft}</span>
            </button>
            <button type="button" className="send-btn" aria-label="Envoyer" disabled={!canSend} {...keep} onClick={submit}><Icon name="up" size={18} stroke={2.8} /></button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
        </div>
      </div>

      {viewing && createPortal(
        <div className="photo-viewer" role="dialog" aria-label="Photo" onClick={() => setViewing(null)}>
          <img src={viewing} alt="" />
          <button type="button" className="photo-close" aria-label="Fermer"><Icon name="close" size={22} stroke={2.6} /></button>
        </div>,
        document.body,
      )}
    </div>
  )
}
