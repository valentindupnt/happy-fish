import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { weekStart } from '../lib/dates'
import { tasksOfWeek } from '../lib/tasks'
import type { Task, Wish } from '../lib/types'
import { TaskRow } from '../components/TaskRow'
import { Icon, Sheet } from '../components/ui'
import type { AddGoalInit } from '../components/AddGoal'

function safeLink(link: string | null): string | null {
  if (!link) return null
  const l = link.trim()
  if (/^https?:\/\//i.test(l)) return l
  if (/^[\w-]+(\.[\w-]+)+/.test(l)) return `https://${l}`
  return null
}

export function Together({ openTask, openAdd }: { openTask: (t: Task) => void; openAdd: (init: AddGoalInit) => void }) {
  const { tasks, today, wishes, nameOf, run, reload, userId } = useStore()
  const [editing, setEditing] = useState<Wish | 'new' | null>(null)
  const common = tasksOfWeek(tasks, weekStart(today), null).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="screen">
      <header className="head-left">
        <p className="kicker">Nos objectifs et nos envies</p>
        <h1 className="title">Ensemble</h1>
      </header>

      <div className="row-between">
        <h2 className="h2">Objectifs communs</h2>
        <span className="meta">XP pour les deux</span>
      </div>
      {common.length ? (
        <ul className="list card">{common.map((t) => <TaskRow key={t.id} task={t} onOpen={openTask} />)}</ul>
      ) : (
        <div className="card empty">Aucun objectif commun cette semaine.</div>
      )}
      <button type="button" className="btn" onClick={() => openAdd({ day: today, common: true })}>
        <Icon name="plus" size={18} />Ajouter un objectif commun
      </button>

      <div className="row-between" style={{ marginTop: 6 }}>
        <h2 className="h2">Nos envies</h2>
        <span className="meta">{wishes.length} envie{wishes.length > 1 ? 's' : ''}</span>
      </div>

      {wishes.map((w) => {
        const href = safeLink(w.link)
        return (
          <article key={w.id} className="card pad stack" style={{ gap: 8 }}>
            <div className="row-between" style={{ alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{w.title}</h3>
              <span className="small" style={{ fontWeight: 700 }}>par {nameOf(w.created_by)}</span>
            </div>
            {w.note && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>{w.note}</p>}
            <div className="row-between" style={{ alignItems: 'center' }}>
              <div className="wrap">
                {href && (
                  <a href={href} target="_blank" rel="noreferrer" className="tag" style={{ background: 'var(--line)', borderColor: 'transparent', color: 'var(--blue-ink)', fontWeight: 800, textDecoration: 'none' }}>
                    <Icon name="link" size={14} stroke={2.5} />&nbsp;Lien
                  </a>
                )}
                {w.created_by === userId && (
                  <button type="button" className="btn small ghost" aria-label={`Modifier ${w.title}`} onClick={() => setEditing(w)}><Icon name="edit" size={16} /></button>
                )}
              </div>
              <button type="button" className="btn small primary" onClick={() => openAdd({ day: today, common: true, title: w.title, note: [w.note, w.link].filter(Boolean).join('\n') })}>
                En faire un objectif
              </button>
            </div>
          </article>
        )
      })}

      <button type="button" className="btn" style={{ borderStyle: 'dashed' }} onClick={() => setEditing('new')}>
        <Icon name="plus" size={18} />Ajouter une envie
      </button>

      {editing && (
        <WishSheet
          wish={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { await reload(['wishes']); setEditing(null) }}
          run={run}
        />
      )}
    </div>
  )
}

function WishSheet({ wish, onClose, onSaved, run }: {
  wish: Wish | null
  onClose: () => void
  onSaved: () => Promise<void>
  run: ReturnType<typeof useStore>['run']
}) {
  const { me, couple } = useStore()
  const [title, setTitle] = useState(wish?.title || '')
  const [note, setNote] = useState(wish?.note || '')
  const [link, setLink] = useState(wish?.link || '')
  const [error, setError] = useState('')

  const save = async () => {
    if (!title.trim()) return setError('Donne un nom à cette envie')
    const row = { title: title.trim(), note: note.trim() || null, link: link.trim() || null }
    const ok = wish
      ? await run(() => supabase.from('wishes').update(row).eq('id', wish.id), 'Envie modifiée')
      : await run(() => supabase.from('wishes').insert({ ...row, couple_id: couple?.id, created_by: me?.id }), 'Envie ajoutée')
    if (ok) await onSaved()
  }

  const remove = async () => {
    if (!wish) return
    if (await run(() => supabase.from('wishes').delete().eq('id', wish.id), 'Envie supprimée')) await onSaved()
  }

  return (
    <Sheet title={wish ? 'Modifier l’envie' : 'Nouvelle envie'} onClose={onClose}>
      <div className="field">
        <label htmlFor="wish-title">Nom</label>
        <input id="wish-title" className="input" value={title} maxLength={120} placeholder="Week-end à la mer" onChange={(e) => { setTitle(e.target.value); setError('') }} />
      </div>
      <div className="field">
        <label htmlFor="wish-note">Notes</label>
        <textarea id="wish-note" className="textarea" value={note} maxLength={1000} placeholder="Quand, avec qui, une idée…" onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="wish-link">Lien (optionnel)</label>
        <input id="wish-link" className="input" type="url" inputMode="url" value={link} maxLength={500} placeholder="https://…" onChange={(e) => setLink(e.target.value)} />
      </div>
      {error && <p role="alert" style={{ margin: 0, color: '#A3201A', fontSize: 13, fontWeight: 700 }}>{error}</p>}
      <button type="button" className="btn primary block" onClick={save}>Enregistrer</button>
      {wish && <button type="button" className="btn block danger" onClick={remove}>Supprimer cette envie</button>}
    </Sheet>
  )
}
