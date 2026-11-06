import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { dateOfTimestamp, longDay, timeLabel } from '../lib/dates'
import { isNetworkError, newMessageId } from '../lib/messages'
import { PHOTO_BUCKET, photoPath, photoRatio, preparePhoto, usePhotoUrls } from '../lib/photos'
import type { PreparedPhoto } from '../lib/photos'
import { Fish } from '../components/Fish'
import { GIF_SERIES, gifLabel, gifSrc, isKnownGif } from '../lib/gifs'
import { BURST, EFFECTS, FX_BG, FX_CHIP_BG, FX_CHIP_FG, FX_FG, effectOf } from '../lib/effects'
import type { EffectDef } from '../lib/effects'
import { BubbleIcon, Icon, TreatIcon } from '../components/ui'

// Un message envoyé s'affiche tout de suite, avant la réponse du serveur
interface Pending {
  tempId: string
  /** Identifiant choisi avant l'envoi : le mot est reconnu dès qu'il arrive de la base */
  realId: string
  sent?: boolean
  kind: 'text' | 'image' | 'gif'
  body: string | null
  taskId: string | null
  createdAt: string
  preview?: string
  ratio?: number
  effect?: string | null
}

interface Item {
  key: string
  mine: boolean
  kind: 'text' | 'image' | 'gif' | 'bubble' | 'treat'
  body: string | null
  taskId: string | null
  createdAt: string
  imagePath?: string | null
  preview?: string
  ratio?: number
  effect?: string | null
  sending?: boolean
}

const GROUP_GAP = 5 * 60 * 1000
// Mots affichés à l'ouverture : assez pour lire, peu pour ouvrir vite
const PAGE = 60
const isWord = (i: Item) => i.kind === 'text' || i.kind === 'image' || i.kind === 'gif'
const touch = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false)

export function Chat({ refTaskId, clearRef }: { refTaskId: string | null; clearRef: () => void }) {
  const { me, partner, partnerName, userId, messages, force, today, run, reload, tasks, goalOf, couple, toast } = useStore()
  const [text, setText] = useState('')
  const [pending, setPending] = useState<Pending[]>([])
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [jump, setJump] = useState(false)
  const [gifsOpen, setGifsOpen] = useState(false)
  // Mot de force touché : une petite barre propose les effets avant l'envoi
  const [picking, setPicking] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const atBottom = useRef(true)
  // Fenêtre affichée : les PAGE derniers mots, puis on remonte par paquets (à partir du mot « startKey »)
  const [startKey, setStartKey] = useState<string | null>(null)
  const restoreFromBottom = useRef<number | null>(null)
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
  // Titres des objectifs cités, calculés une fois (et non à chaque lettre tapée)
  const titles = useMemo(() => {
    const ids = new Set(messages.map((m) => m.task_id).filter(Boolean) as string[])
    const map: Record<string, string> = {}
    for (const t of tasks) if (ids.has(t.id)) { const g = goalOf(t.goal_id); if (g) map[t.id] = g.title }
    return map
  }, [messages, tasks, goalOf])
  const doneToday = tasks.filter((t) => t.date === today && t.done_at && (t.owner_id === partner?.id || t.owner_id === null)).length

  // Messages de la base, puis ceux encore en route
  const items: Item[] = useMemo(() => {
    const byReal = new Map(pending.filter((p) => p.realId).map((p) => [p.realId as string, p]))
    const known = new Set(messages.map((m) => m.id))
    const list: Item[] = messages.map((m) => {
      const p = byReal.get(m.id)
      return {
        key: p?.tempId || m.id, mine: m.author_id === userId, kind: m.kind, body: m.body, taskId: m.task_id,
        createdAt: m.created_at, imagePath: m.image_path, effect: m.effect, preview: p?.preview, ratio: m.image_path ? photoRatio(m.image_path) : undefined,
      }
    })
    for (const p of pending) {
      if (p.realId && known.has(p.realId)) continue
      list.push({ key: p.tempId, mine: true, kind: p.kind, body: p.body, taskId: p.taskId, createdAt: p.createdAt, preview: p.preview, ratio: p.ratio, effect: p.effect, sending: !p.sent })
    }
    return list
  }, [messages, pending, userId])


  const visible = useMemo(() => {
    const i = startKey ? items.findIndex((x) => x.key === startKey) : -1
    return i >= 0 ? items.slice(i) : items.slice(-PAGE)
  }, [items, startKey])
  const hidden = items.length - visible.length
  const showMore = () => {
    const el = listRef.current
    if (!el || hidden <= 0 || restoreFromBottom.current !== null) return
    restoreFromBottom.current = el.scrollHeight - el.scrollTop
    setStartKey(items[Math.max(0, hidden - PAGE)].key)
  }
  // Après l'ajout des mots plus anciens, on garde sous les yeux ce qu'on lisait
  useLayoutEffect(() => {
    const el = listRef.current
    if (el && restoreFromBottom.current !== null) {
      el.scrollTop = el.scrollHeight - restoreFromBottom.current
      restoreFromBottom.current = null
    }
  }, [visible.length])

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
    // Remonté lire : la fenêtre ne glisse plus quand un mot arrive (rien ne bouge sous les yeux)
    else if (startKey === null && visible[0]) setStartKey(visible[0].key)
    // Près du haut : on ajoute les mots précédents
    if (el.scrollTop < 240 && hidden > 0) showMore()
  }
  useLayoutEffect(() => { toBottom(false) }, [])
  const last = items[items.length - 1]
  useLayoutEffect(() => {
    if (!last) return
    if (atBottom.current || last.mine) {
      toBottom(true)
      // Un défilement animé peut être interrompu par un changement de taille (clavier, champ qui rétrécit) :
      // on vérifie à la fin qu'on est bien arrivé en bas.
      const t = window.setTimeout(() => { if (atBottom.current) toBottom(false) }, 450)
      return () => window.clearTimeout(t)
    }
    setJump(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.key])
  // Filet de sécurité : la connexion en direct peut se couper sans prévenir, on revérifie les mots toutes les 25 s
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false) void reload(['messages'])
    }, 25000)
    return () => window.clearInterval(id)
  }, [reload])
  // Le clavier qui s'ouvre réduit la liste : on garde le dernier message visible
  useEffect(() => {
    const el = listRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => { if (atBottom.current) toBottom(false) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const addPending = (p: Pending) => setPending((ps) => [...ps, p])
  const settle = (tempId: string, ok: boolean) => {
    if (ok) {
      setPending((ps) => ps.map((x) => (x.tempId === tempId ? { ...x, sent: true } : x)))
      reload(['messages'])
    } else {
      setPending((ps) => ps.filter((x) => x.tempId !== tempId))
    }
  }
  // L'identifiant est choisi ici : si la réponse se perd (réseau instable), une seconde tentative ne crée pas de doublon
  const insertMessage = async (id: string, row: Record<string, unknown>) => {
    const payload = { id, couple_id: couple?.id, author_id: userId, ...row }
    const ok = await run(async () => {
      let { error } = await supabase.from('messages').insert(payload)
      if (error && isNetworkError(error)) {
        await new Promise((r) => window.setTimeout(r, 900))
        ;({ error } = await supabase.from('messages').insert(payload))
      }
      // Déjà enregistré par la première tentative : c'est un succès
      if (error && (error as { code?: string }).code === '23505') return { error: null }
      return { error }
    })
    return ok
  }

  const sendText = async (raw: string, effect: string | null = null) => {
    const body = raw.trim()
    if (!body || !couple) return
    const tempId = `tmp-${Date.now()}-${Math.random()}`
    const id = newMessageId()
    const taskId = refTaskId
    addPending({ tempId, realId: id, kind: 'text', body, taskId, effect, createdAt: new Date().toISOString() })
    setText('')
    clearRef()
    atBottom.current = true
    const ok = await insertMessage(id, { kind: 'text', body, task_id: taskId, ...(effect ? { effect } : {}) })
    settle(tempId, ok)
    if (!ok) setText((t) => t || body)
  }

  const sendPhoto = async () => {
    if (!photo || !couple) return
    const ph = photo
    const caption = text.trim() || null
    const path = photoPath(couple.id, ph.width, ph.height)
    const tempId = `tmp-${Date.now()}-${Math.random()}`
    const id = newMessageId()
    addPending({ tempId, realId: id, kind: 'image', body: caption, taskId: null, createdAt: new Date().toISOString(), preview: ph.preview, ratio: ph.width / ph.height })
    setPhoto(null)
    setText('')
    atBottom.current = true
    const uploaded = await run(() => supabase.storage.from(PHOTO_BUCKET).upload(path, ph.blob, { contentType: 'image/jpeg', cacheControl: '31536000' }))
    const ok = uploaded ? await insertMessage(id, { kind: 'image', image_path: path, body: caption }) : false
    settle(tempId, ok)
    if (!ok) { setPhoto(ph); setText((t) => t || caption || '') }
  }

  const sendGif = async (gifId: string) => {
    if (!couple) return
    const tempId = `tmp-${Date.now()}-${Math.random()}`
    const id = newMessageId()
    addPending({ tempId, realId: id, kind: 'gif', body: gifId, taskId: null, createdAt: new Date().toISOString() })
    setGifsOpen(false)
    atBottom.current = true
    settle(tempId, await insertMessage(id, { kind: 'gif', body: gifId }))
  }

  const toggleGifs = () => {
    setGifsOpen((o) => !o)
    inputRef.current?.blur()
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
  const showForce = force.length > 0 && !text && !photo && !gifsOpen
  const pickedWord = showForce ? force.find((f) => f.id === picking) ?? null : null
  const sendForce = (body: string, effect: string | null) => { setPicking(null); void sendText(body, effect) }
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
        {hidden > 0 && (
          <button type="button" className="btn small chat-more" onClick={showMore}>Voir les mots précédents</button>
        )}
        <MessageList items={visible} today={today} partnerName={partnerName} titles={titles} openedAt={openedAt.current} onView={setViewing} />
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
              <button key={f.id} type="button" className={`force-chip${picking === f.id ? ' on' : ''}`} aria-expanded={picking === f.id} {...keep} onClick={() => setPicking((p) => (p === f.id ? null : f.id))}>{f.body}</button>
            ))}
          </div>
        )}
        {pickedWord && (
          <div className="fx-bar" role="group" aria-label={`Effet pour « ${pickedWord.body} »`}>
            <span className="fx-bar-title">Envoyer avec</span>
            <div className="fx-bar-row">
              {EFFECTS.map((e) => (
                <button key={e.id} type="button" className={`fx-pick${pickedWord.effect === e.id ? ' usual' : ''}`} style={{ background: FX_CHIP_BG, color: FX_CHIP_FG }} {...keep} onClick={() => sendForce(pickedWord.body, e.id)}>{e.label}</button>
              ))}
              <button type="button" className="fx-pick plain" {...keep} onClick={() => sendForce(pickedWord.body, null)}>Sans effet</button>
            </div>
          </div>
        )}
        {gifsOpen && (
          <div className="gif-picker" role="dialog" aria-label="Choisir un GIF">
            {GIF_SERIES.map((serie) => (
              <section key={serie.id} className="gif-serie">
                <h2 className="gif-serie-title">{serie.title}</h2>
                <div className="gif-grid">
                  {serie.gifs.map((g) => (
                    <button key={g.id} type="button" className="gif-pick" aria-label={`Envoyer le GIF : ${g.label}`} onClick={() => sendGif(g.id)}>
                      <img src={gifSrc(g.id)} alt="" width={384} height={336} loading="lazy" decoding="async" />
                    </button>
                  ))}
                </div>
              </section>
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
            <button type="button" className={`tool gif-tool${gifsOpen ? ' on' : ''}`} aria-label={gifsOpen ? 'Fermer les GIFs' : 'Envoyer un GIF'} aria-expanded={gifsOpen} disabled={!couple} onClick={toggleGifs}>GIF</button>
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

// La liste ne se redessine que si les messages changent : taper une lettre ne la touche pas
/** Pluie de pixels autour d'un mot fort qui vient d'arriver (disparaît seule, une seule fois) */
function Burst({ fx }: { fx: EffectDef }) {
  return (
    <span className="fx-burst" aria-hidden="true">
      <span className="fx-shine" />
      {BURST.map(([dx, dy], k) => (
        <svg key={k} className="fx-spark" viewBox="0 0 7 6" shapeRendering="crispEdges"
          style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, animationDelay: `${(k % 3) * 0.05}s` } as CSSProperties}>
          <Pixels shape={fx.shape} c={fx.colors[k % fx.colors.length]} />
        </svg>
      ))}
    </span>
  )
}

function Pixels({ shape, c }: { shape: EffectDef['shape']; c: string }) {
  if (shape === 'heart') return <><rect x="1" y="0" width="2" height="1" fill={c} /><rect x="4" y="0" width="2" height="1" fill={c} /><rect x="0" y="1" width="7" height="2" fill={c} /><rect x="1" y="3" width="5" height="1" fill={c} /><rect x="2" y="4" width="3" height="1" fill={c} /><rect x="3" y="5" width="1" height="1" fill={c} /></>
  if (shape === 'bubble') return <><rect x="2" y="0" width="3" height="1" fill={c} /><rect x="2" y="5" width="3" height="1" fill={c} /><rect x="1" y="1" width="1" height="4" fill={c} /><rect x="5" y="1" width="1" height="4" fill={c} /></>
  if (shape === 'square') return <rect x="1" y="1" width="5" height="4" fill={c} />
  return <><rect x="3" y="0" width="1" height="6" fill={c} /><rect x="0" y="2" width="7" height="2" fill={c} /><rect x="2" y="1" width="3" height="4" fill={c} /></>
}

const MessageList = memo(function MessageList({ items, today, partnerName, titles, openedAt, onView }: {
  items: Item[]
  today: string
  partnerName: string
  titles: Record<string, string>
  openedAt: number
  onView: (src: string) => void
}) {
  const urls = usePhotoUrls(useMemo(() => items.filter((i) => i.imagePath).map((i) => i.imagePath as string), [items]))
  return (
    <>
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
        const ref = m.taskId ? titles[m.taskId] || null : null
        const src = (m.imagePath && urls[m.imagePath]) || m.preview
        const fx = m.kind === 'text' ? effectOf(m.effect) : null
        const fresh = Date.parse(m.createdAt) > openedAt
        return (
          <div key={m.key} style={{ display: 'contents' }}>
            {sep && <p className="chat-day">{sep}</p>}
            {isWord(m) ? (
              <div className={`msg-row ${side}${first ? ' first' : ''}${Date.parse(m.createdAt) > openedAt ? ' fresh' : ''}`}>
                <div className={`msg ${side}${first ? ' first' : ''}${lastOfGroup ? ' last' : ''}${m.kind === 'image' ? ' has-photo' : ''}${m.kind === 'gif' && isKnownGif(m.body) ? ' has-gif' : ''}${fx ? ' has-fx' : ''}${fx && fresh ? ' fx-in' : ''}${m.sending ? ' sending' : ''}`} style={fx ? { background: FX_BG, color: FX_FG } : undefined}>
                  {fx && <span className="fx-label">Mot fort</span>}
                  {ref && <div className="ref">Sur {m.mine ? `l’objectif de ${partnerName}` : 'ton objectif'} : {ref}</div>}
                  {m.kind === 'image' && (
                    <button type="button" className="msg-photo" style={{ aspectRatio: String(m.ratio || 1), width: `min(240px, 62vw, ${Math.round(320 * (m.ratio || 1))}px)` }} onClick={() => src && onView(src)} aria-label="Voir la photo en grand">
                      {src && <img src={src} alt="" loading="lazy" decoding="async" />}
                    </button>
                  )}
                  {m.kind === 'gif' && isKnownGif(m.body) ? (
                    <img className="msg-gif" src={gifSrc(m.body as string)} alt={gifLabel(m.body)} width={384} height={336} loading="lazy" decoding="async" />
                  ) : m.kind === 'gif' ? (
                    <div className="msg-text">GIF</div>
                  ) : (
                    m.body && <div className="msg-text">{m.body}</div>
                  )}
                  {fx && fresh && <Burst fx={fx} />}
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
    </>
  )
})
