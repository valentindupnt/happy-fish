import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { dateOfTimestamp, longDay, timeLabel } from '../lib/dates'
import { Fish } from '../components/Fish'
import { BubbleIcon, Icon, TreatIcon } from '../components/ui'

export function Chat({ refTaskId, clearRef }: { refTaskId: string | null; clearRef: () => void }) {
  const { me, partner, partnerName, userId, messages, force, today, run, reload, tasks, goalOf, couple } = useStore()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages.length])
  useEffect(() => { if (refTaskId) inputRef.current?.focus() }, [refTaskId])

  const treatsLeft = Math.max(0, 3 - messages.filter((m) => m.author_id === userId && m.kind === 'treat' && dateOfTimestamp(m.created_at) === today).length)
  const refTask = refTaskId ? tasks.find((t) => t.id === refTaskId) : null
  const refTitle = (taskId: string | null) => {
    if (!taskId) return null
    const t = tasks.find((x) => x.id === taskId)
    return t ? goalOf(t.goal_id)?.title || null : null
  }
  const doneToday = tasks.filter((t) => t.date === today && t.done_at && (t.owner_id === partner?.id || t.owner_id === null)).length

  const send = async (body: string) => {
    const clean = body.trim()
    if (!clean || sending) return
    setSending(true)
    const ok = await run(() => supabase.from('messages').insert({ couple_id: couple?.id, author_id: userId, kind: 'text', body: clean, task_id: refTaskId }))
    setSending(false)
    if (ok) {
      setText('')
      clearRef()
      await reload(['messages'])
    }
  }

  const bubble = async () => {
    if (await run(() => supabase.from('messages').insert({ couple_id: couple?.id, author_id: userId, kind: 'bubble' }), `Bulle envoyée à ${partnerName}`)) {
      await reload(['messages'])
    }
  }

  const treat = async () => {
    if (await run(() => supabase.rpc('send_treat'), `Friandise envoyée, +2 XP pour ${partnerName}`)) {
      await reload(['messages', 'fish'])
    }
  }

  let lastDay = ''
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <header className="head-row" style={{ padding: 'calc(16px + var(--safe-top)) 20px 14px', background: 'var(--card)', borderBottom: '2px solid var(--ink)', flexShrink: 0 }}>
        <div className="fish-tile" style={{ width: 48, height: 40, border: '2px solid var(--ink)' }}>
          {partner && <Fish color={partner.fish_color} width={34} label={`Poisson de ${partnerName}`} />}
        </div>
        <div className="head-left" style={{ gap: 6 }}>
          <h1 className="title" style={{ fontSize: 14 }}>Petits mots</h1>
          <span className="meta" style={{ fontWeight: 600 }}>
            {partner ? `Avec ${partnerName}, ${doneToday} objectif${doneToday > 1 ? 's' : ''} coché${doneToday > 1 ? 's' : ''} aujourd’hui` : 'Ton duo n’a pas encore rejoint l’app'}
          </span>
        </div>
      </header>

      <div className="chat" aria-live="polite" style={{ minHeight: 0 }}>
        {messages.length === 0 && <div className="empty">Envoie le premier petit mot à {partnerName}.</div>}
        {messages.map((m) => {
          const day = dateOfTimestamp(m.created_at)
          const sep = day !== lastDay ? (day === today ? 'Aujourd’hui' : longDay(day)) : null
          lastDay = day
          const mine = m.author_id === userId
          const ref = refTitle(m.task_id)
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {sep && <p style={{ margin: 0, alignSelf: 'center', padding: '3px 10px', background: 'var(--line)', borderRadius: 999, fontSize: 12, fontWeight: 700, color: 'var(--blue-ink)' }}>{sep}</p>}
              {m.kind === 'text' ? (
                <div className={mine ? 'msg me' : 'msg them'}>
                  {ref && <div className="ref">Sur {mine ? `l’objectif de ${partnerName}` : 'ton objectif'} : {ref}</div>}
                  {m.body}
                  <div className="msg-time">{timeLabel(m.created_at)}</div>
                </div>
              ) : m.kind === 'treat' ? (
                <div className="gesture treat"><TreatIcon />{mine ? `Tu as envoyé une friandise à ${partnerName}` : `${partnerName} t’a envoyé une friandise, +2 XP`}</div>
              ) : (
                <div className="gesture bubble"><BubbleIcon />{mine ? `Tu as envoyé une bulle à ${partnerName}` : `${partnerName} t’a envoyé une bulle`}</div>
              )}
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      <div className="composer">
        {!partner && (
          <span className="small" style={{ fontWeight: 700 }}>
            {me?.partner_nickname || 'Ton duo'} verra tes mots en rejoignant votre duo avec le code{' '}
            <strong style={{ fontFamily: 'var(--pixel)', fontSize: 11 }}>{couple?.invite_code}</strong>.
            Les bulles et friandises s’ouvriront à ce moment-là.
          </span>
        )}
        {refTask && (
          <div className="row-between" style={{ alignItems: 'center' }}>
            <span className="ref" style={{ margin: 0 }}>Sur l’objectif : {goalOf(refTask.goal_id)?.title}</span>
            <button type="button" className="btn small ghost" onClick={clearRef}>Retirer</button>
          </div>
        )}
        {force.length > 0 && (
          <div className="wrap">
            {force.map((f) => (
              <button key={f.id} type="button" className="tag" disabled={sending} onClick={() => send(f.body)}>{f.body}</button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <button type="button" className="icon-btn" style={{ background: 'var(--line)' }} aria-label="Envoyer une bulle" disabled={!partner} onClick={bubble}><BubbleIcon size={22} /></button>
          <button type="button" className="icon-btn" style={{ background: 'var(--cream)', position: 'relative' }} aria-label={`Envoyer une friandise, ${treatsLeft} restante${treatsLeft > 1 ? 's' : ''} aujourd’hui`} disabled={!partner || treatsLeft === 0} onClick={treat}>
            <TreatIcon size={22} />
            <span className="badge" style={{ top: -8, right: -8, background: 'var(--ink)' }}>{treatsLeft}</span>
          </button>
          <label htmlFor="mot" className="sr-only">Écrire un petit mot</label>
          <textarea
            id="mot"
            ref={inputRef}
            className="input"
            rows={1}
            style={{ flex: 1, minWidth: 0, padding: '10px 12px', resize: 'none', lineHeight: 1.35 }}
            placeholder={me ? 'Un petit mot…' : ''}
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text) } }}
          />
          <button type="button" className="icon-btn" style={{ background: 'var(--orange)' }} aria-label="Envoyer" disabled={!text.trim() || sending} onClick={() => send(text)}><Icon name="send" size={20} stroke={2.6} /></button>
        </div>
      </div>
    </div>
  )
}
