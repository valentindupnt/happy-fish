import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { addDays, addMonths, DAY_LETTERS, dayNumber, isoDow, monthLabel, monthStart, shortDay, weekDays, weekLabel, weekStart } from '../lib/dates'
import { tasksOfDay, tasksOfWeek } from '../lib/tasks'
import type { Task } from '../lib/types'
import { TaskRow } from '../components/TaskRow'
import { Icon } from '../components/ui'

export function Week({ onBack, openTask, openAdd }: { onBack: () => void; openTask: (t: Task) => void; openAdd: (day: string) => void }) {
  const { userId, partner, partnerName, today, tasks, goalOf, loadWeek } = useStore()
  const [start, setStart] = useState(weekStart(today))
  const [mode, setMode] = useState<'week' | 'month'>('week')
  const [month, setMonth] = useState(monthStart(today))
  const [who, setWho] = useState<'me' | 'partner'>('me')
  const ownerId = who === 'me' ? userId : partner?.id || ''

  useEffect(() => { loadWeek(start) }, [start, loadWeek])
  useEffect(() => {
    if (mode !== 'month') return
    const first = weekStart(month)
    for (let i = 0; i < 6; i++) loadWeek(addDays(first, i * 7))
  }, [mode, month, loadWeek])

  const weekTasks = tasksOfWeek(tasks, start, ownerId)
  const summary = useMemo(() => {
    const byGoal = new Map<string, { title: string; done: number; total: number }>()
    for (const t of weekTasks) {
      const g = goalOf(t.goal_id)
      if (!g) continue
      const cur = byGoal.get(g.id) || { title: g.title, done: 0, total: 0 }
      cur.total++
      if (t.done_at) cur.done++
      byGoal.set(g.id, cur)
    }
    return [...byGoal.values()].sort((a, b) => b.total - a.total)
  }, [weekTasks, goalOf])

  const isFuture = start > weekStart(today)
  const isPast = addDays(start, 6) < today
  const showPrep = who === 'me' && (isFuture || (start === weekStart(today) && isoDow(today) === 1) || weekTasks.length === 0)

  return (
    <div className="screen">
      <header className="head-row">
        <button type="button" className="icon-btn" aria-label="Retour" onClick={onBack}><Icon name="back" /></button>
        <div className="head-left" style={{ flex: 1 }}>
          <h1 className="title" style={{ fontSize: 15 }}>{who === 'me' ? 'Ma semaine' : `Semaine de ${partnerName}`}</h1>
          <span className="meta">{mode === 'week' ? weekLabel(start) : monthLabel(month)}</span>
        </div>
        <button type="button" className="icon-btn" aria-label={mode === 'week' ? 'Semaine précédente' : 'Mois précédent'}
          onClick={() => (mode === 'week' ? setStart(addDays(start, -7)) : setMonth(addMonths(month, -1)))}><Icon name="back" size={18} /></button>
        <button type="button" className="icon-btn" aria-label={mode === 'week' ? 'Semaine suivante' : 'Mois suivant'}
          onClick={() => (mode === 'week' ? setStart(addDays(start, 7)) : setMonth(addMonths(month, 1)))}><Icon name="next" size={18} /></button>
      </header>

      <div className="seg" role="group" aria-label="Affichage">
        <button type="button" aria-pressed={mode === 'week'} onClick={() => setMode('week')}>Semaine</button>
        <button type="button" aria-pressed={mode === 'month'} onClick={() => { setMonth(monthStart(start)); setMode('month') }}>Mois</button>
      </div>
      {partner && (
        <div className="seg" role="group" aria-label="Personne">
          <button type="button" aria-pressed={who === 'me'} onClick={() => setWho('me')}>Moi</button>
          <button type="button" aria-pressed={who === 'partner'} onClick={() => setWho('partner')}>{partnerName}</button>
        </div>
      )}

      {mode === 'month' ? (
        <MonthGrid month={month} ownerId={ownerId} onPick={(d) => { setStart(weekStart(d)); setMode('week') }} />
      ) : (
        <>
          {showPrep && !isPast && (
            <section className="card pad cream stack" aria-label="Préparer la semaine">
              <h2 className="h2">Prépare ta semaine</h2>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: 'var(--cream-ink)' }}>
                Ajoute tes objectifs et place-les sur les jours. Les objectifs récurrents sont déjà posés.
              </p>
              <div className="wrap">
                <button type="button" className="btn primary" onClick={() => openAdd(start < today ? today : start)}>Ajouter un objectif</button>
              </div>
            </section>
          )}

          {summary.length > 0 && (
            <section className="stack" aria-label="Objectifs de la semaine">
              <h2 className="h2">Objectifs de la semaine</h2>
              <div className="wrap">
                {summary.map((s) => (
                  <span key={s.title} className="tag" style={{ fontWeight: 800 }}>{s.title} {s.done}/{s.total}</span>
                ))}
              </div>
            </section>
          )}

          {weekDays(start).map((d) => {
            const items = tasksOfDay(tasks, d, ownerId)
            const done = items.filter((t) => t.done_at).length
            const isToday = d === today
            const past = d < today
            if (past && items.length > 0 && done === items.length && !isToday) {
              return (
                <section key={d} aria-label={shortDay(d)} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--green-bg)' }}>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>{shortDay(d)}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--green-ink)' }}>{done} sur {items.length} faits</span>
                </section>
              )
            }
            return (
              <section key={d} aria-label={shortDay(d)} className="card" style={{ overflow: 'hidden', borderWidth: isToday ? 3 : 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 8px 8px 14px', background: isToday ? 'var(--ink)' : undefined, color: isToday ? '#fff' : undefined, borderBottom: items.length && !isToday ? '1px solid var(--line)' : undefined }}>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>{shortDay(d)}{isToday ? ', aujourd’hui' : ''}</span>
                  {who === 'me' && !past ? (
                    <button type="button" className="btn small" aria-label={`Ajouter un objectif ${shortDay(d)}`} onClick={() => openAdd(d)}>Ajouter</button>
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 800, color: isToday ? '#FFD39E' : 'var(--muted)' }}>{items.length ? `${done} sur ${items.length}` : ''}</span>
                  )}
                </div>
                {items.length > 0 ? (
                  <ul className="list">{items.map((t) => <TaskRow key={t.id} task={t} onOpen={openTask} showOwner />)}</ul>
                ) : (
                  <div className="empty" style={{ padding: 10 }}>Rien de prévu</div>
                )}
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}

function MonthGrid({ month, ownerId, onPick }: { month: string; ownerId: string; onPick: (d: string) => void }) {
  const { tasks, today } = useStore()
  const first = weekStart(month)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i))
  const lastRowNeeded = cells.findLastIndex((d) => d.slice(0, 7) === month.slice(0, 7))
  const visible = cells.slice(0, Math.ceil((lastRowNeeded + 1) / 7) * 7)
  return (
    <div className="card pad">
      <div className="month">
        {DAY_LETTERS.map((l, i) => <span key={i} className="wd" aria-hidden="true">{l}</span>)}
        {visible.map((d) => {
          const items = tasksOfDay(tasks, d, ownerId)
          const done = items.filter((t) => t.done_at).length
          const out = d.slice(0, 7) !== month.slice(0, 7)
          const cls = ['mday', out ? 'out' : '', d === today ? 'today' : items.length && done === items.length && d <= today ? 'done' : ''].join(' ')
          return (
            <button key={d} type="button" className={cls} aria-label={`${shortDay(d)}, ${items.length} sous-objectifs, ${done} faits`} onClick={() => onPick(d)}>
              <span className="n">{dayNumber(d)}</span>
              <span className="c">{items.length ? (d <= today ? `${done}/${items.length}` : items.length) : ''}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
