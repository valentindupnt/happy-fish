import { useRef, useState } from 'react'
import { errorText, supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { celebrate } from '../lib/fx'
import { longDay, dateOfTimestamp } from '../lib/dates'
import { PHOTO_BUCKET, photoPath, preparePhoto, usePhotoUrls } from '../lib/photos'
import { useSwipe } from '../lib/swipe'
import type { DailyQuest } from '../lib/types'
import { Coin, Flame, Icon, Sheet } from './ui'

const KEEP_MAX = 2
const coinsOf = (hard: boolean) => (hard ? 5 : 3)

/** Les 3 quêtes du jour : facultatives, validées avec un snap, rapportent des pièces */
export function QuestsCard() {
  const { dailyQuests, userId, today, couple, run, reload, toast } = useStore()
  const [managing, setManaging] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const target = useRef<DailyQuest | null>(null)

  const list = dailyQuests.filter((q) => q.profile_id === userId && q.day === today).sort((a, b) => a.slot - b.slot)
  const kept = list.filter((q) => q.kept).length

  const ask = (q: DailyQuest) => {
    target.current = q
    fileRef.current?.click()
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const q = target.current
    if (!file || !q || !couple) return
    setBusy(q.id)
    try {
      const ph = await preparePhoto(file)
      const path = photoPath(couple.id, ph.width, ph.height)
      const up = await run(() => supabase.storage.from(PHOTO_BUCKET).upload(path, ph.blob, { contentType: 'image/jpeg', cacheControl: '31536000' }))
      if (up && await run(() => supabase.rpc('complete_quest', { p_quest: q.id, p_photo: path }), `+${coinsOf(q.hard)} pièces`)) {
        celebrate()
        await reload(['quests', 'fish'])
      }
      URL.revokeObjectURL(ph.preview)
    } catch (err) {
      toast(errorText(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  const toggleKeep = async (q: DailyQuest) => {
    if (await run(() => supabase.rpc('keep_quest', { p_quest: q.id, p_keep: !q.kept }), q.kept ? undefined : 'Gardée pour demain')) await reload(['quests'])
  }

  return (
    <section aria-label="Quêtes annexes" className="card pad stack" style={{ gap: 2, borderStyle: 'dashed', padding: '10px 14px' }}>
      <div className="row-between" style={{ alignItems: 'center' }}>
        <h2 className="h2">Quêtes annexes</h2>
        <button type="button" className="btn small ghost" style={{ minHeight: 28 }} onClick={() => setManaging(true)}>Gérer</button>
      </div>
      <span className="small" style={{ marginBottom: 2 }}>Facultatif · un snap valide{list.some((q) => q.done_at) ? ` · ${kept}/${KEEP_MAX} gardées` : ''}</span>

      {list.length === 0 && <div className="card empty">Pas de quête aujourd’hui. Ajoutes-en avec « Gérer ».</div>}

      {list.map((q) => {
        const streak = q.done_at ? q.streak : q.streak_base
        return (
          <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderTop: '1px dashed var(--line)' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.25, textDecoration: q.done_at ? 'line-through' : 'none', color: q.done_at ? 'var(--muted)' : undefined }}>{q.title}</span>
            {streak > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 800, flexShrink: 0 }}><Flame size={13} />{streak}</span>}
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 800, flexShrink: 0 }} aria-label={`${coinsOf(q.hard)} pièces`}><Coin size={13} />{coinsOf(q.hard)}</span>
            {q.done_at ? (
              <button type="button" className={`btn small${q.kept ? ' primary' : ''}`} style={{ flexShrink: 0, minWidth: 68 }} aria-pressed={q.kept}
                aria-label={q.kept ? 'Gardée pour demain, appuyer pour retirer' : 'Garder pour demain'} onClick={() => toggleKeep(q)}>
                {q.kept ? 'Gardée' : 'Garder'}
              </button>
            ) : (
              <button type="button" className="btn small primary" style={{ flexShrink: 0, minWidth: 68 }} disabled={busy !== null} aria-label={`Valider avec un snap : ${q.title}`} onClick={() => ask(q)}>
                <Icon name="photo" size={16} />{busy === q.id ? '…' : 'Snap'}
              </button>
            )}
          </div>
        )
      })}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      {managing && <QuestManager onClose={() => setManaging(false)} />}
    </section>
  )
}

/** Ma liste de quêtes : en ajouter, en retirer (archivées, les anciens snaps gardent leur nom) */
function QuestManager({ onClose }: { onClose: () => void }) {
  const { questTemplates, userId, couple, run, reload } = useStore()
  const [title, setTitle] = useState('')
  const [hard, setHard] = useState(false)
  const mine = questTemplates.filter((t) => t.profile_id === userId)

  const add = async () => {
    const t = title.trim()
    if (!t) return
    if (await run(() => supabase.from('quest_templates').insert({ couple_id: couple?.id, profile_id: userId, title: t, hard }), 'Quête ajoutée')) {
      setTitle('')
      await reload(['quests'])
    }
  }

  const remove = async (id: string) => {
    if (await run(() => supabase.from('quest_templates').update({ archived: true }).eq('id', id), 'Quête retirée')) await reload(['quests'])
  }

  const group = (isHard: boolean) => mine.filter((t) => t.hard === isHard)

  return (
    <Sheet title="Mes quêtes" onClose={onClose}>
      <div className="field">
        <label htmlFor="quest-title">Nouvelle quête</label>
        <input id="quest-title" className="input" value={title} maxLength={120} placeholder="Faire un câlin de 20 secondes"
          onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add() }} />
      </div>
      <div className="seg" role="group" aria-label="Difficulté">
        <button type="button" aria-pressed={!hard} onClick={() => setHard(false)}>Simple, 3 pièces</button>
        <button type="button" aria-pressed={hard} onClick={() => setHard(true)}>Dure, 5 pièces</button>
      </div>
      <button type="button" className="btn primary block" disabled={!title.trim()} onClick={add}>Ajouter</button>

      {[true, false].map((h) => (
        <div key={String(h)} className="stack" style={{ gap: 6 }}>
          <h3 className="h2" style={{ fontSize: 15 }}>{h ? 'Dures, 5 pièces' : 'Simples, 3 pièces'} ({group(h).length})</h3>
          {group(h).length > 0 ? (
            <ul className="list card">
              {group(h).map((t) => (
                <li key={t.id} className="row-between" style={{ alignItems: 'center', padding: '8px 12px', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, minWidth: 0 }}>{t.title}</span>
                  <button type="button" className="icon-btn" aria-label={`Retirer ${t.title}`} onClick={() => remove(t.id)}><Icon name="close" /></button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="card empty">Aucune quête.</div>
          )}
        </div>
      ))}
    </Sheet>
  )
}

function Snap({ url, ratio }: { url: string | undefined; ratio: string }) {
  return (
    <div style={{ aspectRatio: ratio, background: 'var(--line)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--ink)' }}>
      {url && <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
    </div>
  )
}

/** Wall of fame dans Ensemble : liste déroulante, le dernier snap de chacun et la porte vers tous les snaps */
export function WallOfFame() {
  const { dailyQuests } = useStore()
  const [open, setOpen] = useState(false)
  const count = dailyQuests.filter((q) => q.done_at && q.photo_path).length
  return (
    <>
      <div className="row-between" style={{ marginTop: 6, alignItems: 'center', gap: 8 }}>
        <button type="button" className="btn ghost" style={{ flex: 1, justifyContent: 'flex-start', padding: 0 }} aria-expanded={open} aria-controls="wall-of-fame" onClick={() => setOpen((o) => !o)}>
          <h2 className="h2" style={{ margin: 0 }}>Wall of fame{count ? ` (${count})` : ''}</h2>
          <Icon name={open ? 'up' : 'down'} size={18} />
        </button>
      </div>
      {open && <FameBody />}
    </>
  )
}

function FameBody() {
  const { dailyQuests, userId, partner, me, partnerName } = useStore()
  const [all, setAll] = useState(false)
  const done = dailyQuests.filter((q) => q.done_at && q.photo_path).sort((a, b) => (b.done_at || '').localeCompare(a.done_at || ''))
  const lastOf = (id: string | undefined) => done.find((q) => q.profile_id === id)
  const mineLast = lastOf(userId)
  const theirLast = lastOf(partner?.id)
  const urls = usePhotoUrls([mineLast?.photo_path, theirLast?.photo_path].filter((p): p is string => Boolean(p)))

  const tile = (name: string, q: DailyQuest | undefined) => (
    <div style={{ minWidth: 0 }}>
      <Snap url={q?.photo_path ? urls[q.photo_path] : undefined} ratio="3 / 4" />
      <p style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 800 }}>{name}</p>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{q ? q.title : 'Pas encore de snap'}</p>
      {q?.done_at && <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{longDay(dateOfTimestamp(q.done_at))}</p>}
    </div>
  )

  return (
    <section id="wall-of-fame" aria-label="Wall of fame" className="card pad stack" style={{ gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        {tile(me?.display_name || 'Moi', mineLast)}
        {tile(partnerName, theirLast)}
      </div>
      <button type="button" className="btn block" onClick={() => setAll(true)}>Toute la fame</button>
      {all && <FameSheet done={done} onClose={() => setAll(false)} />}
    </section>
  )
}

function FameSheet({ done, onClose }: { done: DailyQuest[]; onClose: () => void }) {
  const { nameOf } = useStore()
  const [shown, setShown] = useState(60)
  const [viewId, setViewId] = useState<string | null>(null)
  const part = done.slice(0, shown)
  const urls = usePhotoUrls(part.map((q) => q.photo_path as string))
  // Photo ouverte : glisser vers la gauche ou la droite passe à la suivante ou à la précédente (dans l'ordre du mur, sans boucler), vers le bas la ferme
  const index = viewId ? done.findIndex((q) => q.id === viewId) : -1
  const view = index >= 0 ? done[index] : null
  const go = (step: number) => { const next = done[index + step]; if (next) setViewId(next.id) }
  const swipe = useSwipe({ onLeft: () => go(1), onRight: () => go(-1), onDown: () => setViewId(null) })
  // Les voisines se chargent d'avance, pour que le défilement ne montre pas de vide
  usePhotoUrls([done[index - 1]?.photo_path, done[index + 1]?.photo_path].filter((p): p is string => Boolean(p)))

  return (
    <Sheet title="Toute la fame" onClose={onClose}>
      {part.length === 0 && <div className="card empty">Aucun snap pour l’instant. Validez une quête pour ouvrir le mur.</div>}
      <div className="gif-grid">
        {part.map((q) => (
          <button key={q.id} type="button" aria-label={`${q.title}, ${nameOf(q.profile_id)}`} onClick={() => setViewId(q.id)} style={{ padding: 0, border: 0, background: 'none' }}>
            <Snap url={urls[q.photo_path as string]} ratio="1 / 1" />
          </button>
        ))}
      </div>
      {done.length > shown && <button type="button" className="btn block" onClick={() => setShown((n) => n + 60)}>Voir plus</button>}
      {view && (
        <Sheet title={view.title} onClose={() => setViewId(null)}>
          <div {...swipe} style={{ minHeight: '60vh' }}>
            <FameView key={view.id} q={view} who={nameOf(view.profile_id)} />
          </div>
        </Sheet>
      )}
    </Sheet>
  )
}

function FameView({ q, who }: { q: DailyQuest; who: string }) {
  const urls = usePhotoUrls([q.photo_path as string])
  const url = urls[q.photo_path as string]
  return (
    <div className="stack" style={{ gap: 8 }}>
      {url ? <img src={url} alt={`Snap de ${who} : ${q.title}`} style={{ width: '100%', borderRadius: 12, border: '1px solid var(--ink)', display: 'block' }} /> : <Snap url={undefined} ratio="3 / 4" />}
      <div className="row-between" style={{ alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 800 }}>{who}</span>
        <span className="small">{q.done_at ? longDay(dateOfTimestamp(q.done_at)) : ''}</span>
      </div>
      {q.streak > 1 && <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800 }}><Flame size={16} />{q.streak} jours d’affilée</span>}
    </div>
  )
}
