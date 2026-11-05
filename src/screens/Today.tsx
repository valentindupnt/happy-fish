import { useState } from 'react'
import { useStore } from '../lib/store'
import { DAY_LETTERS, dayName, dayNumber, longDay, weekDays, weekStart } from '../lib/dates'
import { HABITATS, levelProgress, stadeName, stadeOf } from '../lib/xp'
import { missedThisWeek, tasksOfDay } from '../lib/tasks'
import { MOOD_LABEL, moodOf } from '../lib/mood'
import { seasonalHat, seasonOf } from '../lib/season'
import type { Task } from '../lib/types'
import { Fish } from '../components/Fish'
import { TaskRow } from '../components/TaskRow'
import { Bar, Coin, Flame, Icon } from '../components/ui'
import { WeekReview } from '../components/WeekReview'
import { SurpriseWheel, readWheelSpun, useWheelUnlock } from '../components/SurpriseWheel'
import { MonthRecapSheet, monthName, previousMonth } from '../components/MonthRecap'

export function Today({ openTask, openAdd, goWeek, goSettings }: {
  openTask: (t: Task) => void
  openAdd: (day: string) => void
  goWeek: () => void
  goSettings: () => void
}) {
  const { me, partner, couple, userId, today, tasks, fishOf, partnerName, streaks, goals } = useStore()
  const [day, setDay] = useState(today)
  const [who, setWho] = useState<'me' | 'partner'>('me')
  const [recap, setRecap] = useState(false)
  const [surprise, setSurprise] = useState(false)
  const unlock = useWheelUnlock()
  if (!me) return null
  const wheelReady = Boolean(unlock) && !readWheelSpun(unlock?.id)

  const fish = fishOf(userId)
  const progress = levelProgress(fish.xp, fish.level)
  const capped = fish.level_uncapped > fish.level
  const nextHabitat = HABITATS[(couple?.habitat ?? 0) + 1]
  const ownerId = who === 'me' ? userId : partner?.id || ''
  const list = tasksOfDay(tasks, day, ownerId).sort((a, b) => Number(Boolean(a.done_at)) - Number(Boolean(b.done_at)))
  const done = list.filter((t) => t.done_at).length
  const missed = missedThisWeek(tasks, today, userId)
  const days = weekDays(weekStart(today))
  const mood = moodOf(tasks, today, userId)
  const mySeries = streaks
    .map((st) => ({ st, goal: goals.find((g) => g.id === st.goal_id) }))
    .filter((x) => x.goal && !x.goal.archived && (x.goal.owner_id === userId || x.goal.owner_id === null))
    .sort((a, b) => b.st.current_streak - a.st.current_streak || b.st.best_streak - a.st.best_streak)

  return (
    <div className="screen">
      <header className="head">
        <div className="head-left">
          <p className="kicker">{longDay(today)}</p>
          <h1 className="title">Aujourd’hui</h1>
        </div>
        <div className="head-row" style={{ gap: 8 }}>
          <span className="pill" aria-label={`${fish.coins ?? 0} pièces`}><Coin /><span>{fish.coins ?? 0}</span></span>
          <button type="button" className="icon-btn" aria-label="Paramètres" onClick={goSettings}><Icon name="settings" /></button>
        </div>
      </header>

      <div className="card xp-card">
        <div className="fish-tile"><Fish color={me.fish_color} hat={seasonalHat(me.fish_hat, seasonOf(today))} width={39} stade={stadeOf(fish.level)} mood={mood} label={`${me.fish_name} ${MOOD_LABEL[mood]}`} /></div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="row-between">
            <span style={{ fontSize: 15, fontWeight: 800 }}>{me.fish_name}, {stadeName(fish.level).toLowerCase()} niv. {fish.level}</span>
            <span className="meta">{capped ? `${fish.xp} XP` : `${progress.into} / ${progress.needed} XP`}</span>
          </div>
          <Bar ratio={capped ? 1 : progress.ratio} />
          {capped && <span className="small">XP en réserve : il faut {nextHabitat ? `l’habitat « ${nextHabitat.name} »` : 'l’habitat suivant'} pour grandir.</span>}
        </div>
      </div>

      <WeekReview />

      {Number(today.slice(8, 10)) <= 5 && (
        <section aria-label="Récap du mois" className="card pad stack" style={{ gap: 8, background: '#E9F0FF' }}>
          <span className="h2" style={{ fontSize: 15 }}>Votre récap {/^[aeiou]/.test(monthName(previousMonth(today))) ? 'd’' : 'de '}{monthName(previousMonth(today))} est prêt</span>
          <div><button type="button" className="btn small primary" onClick={() => setRecap(true)}>Le voir</button></div>
        </section>
      )}
      {recap && <MonthRecapSheet month={previousMonth(today)} onClose={() => setRecap(false)} />}

      {!partner && couple && (
        <div className="card pad cream stack">
          <span className="h2">Invite ton duo</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            Donne ce code pour rejoindre Happy Fish : <strong style={{ fontFamily: 'var(--pixel)', fontSize: 13 }}>{couple.invite_code}</strong>
          </span>
        </div>
      )}

      <nav className="days" aria-label="Jours de la semaine">
        {days.map((d, i) => {
          const items = tasksOfDay(tasks, d, ownerId)
          const n = items.length
          const ok = items.filter((t) => t.done_at).length
          const allDone = n > 0 && ok === n && d <= today
          return (
            <button
              key={d}
              type="button"
              className={`day${allDone ? ' done' : ''}${d === today ? ' today' : ''}`}
              aria-pressed={d === day}
              aria-label={`${dayName(d)} ${dayNumber(d)}${d === today ? ', aujourd’hui' : ''}, ${d <= today ? `${ok} sur ${n} faits` : `${n} prévus`}`}
              onClick={() => setDay(d)}
            >
              <span className="l">{DAY_LETTERS[i]}</span>
              <span className="n">{dayNumber(d)}</span>
              <span className="c">{d <= today ? `${ok}/${n}` : n}</span>
            </button>
          )
        })}
      </nav>

      {partner && (
        <div className="seg" role="group" aria-label="Voir les objectifs de">
          <button type="button" aria-pressed={who === 'me'} onClick={() => setWho('me')}>Moi</button>
          <button type="button" aria-pressed={who === 'partner'} onClick={() => setWho('partner')}>{partnerName}</button>
        </div>
      )}

      <div className="row-between">
        <h2 className="h2">{day === today ? (who === 'me' ? 'Mes sous-objectifs' : `Ceux de ${partnerName}`) : longDay(day)}</h2>
        <span className="meta">{list.length ? `${done} sur ${list.length} faits` : ''}</span>
      </div>

      {list.length ? (
        <ul className="list card">
          {list.map((t) => <TaskRow key={t.id} task={t} onOpen={openTask} showOwner />)}
        </ul>
      ) : (
        <div className="card empty">
          {who === 'me' ? 'Rien de prévu ce jour-là.' : `${partnerName} n’a rien de prévu ce jour-là.`}
          {who === 'me' && day >= today && (
            <div style={{ marginTop: 10 }}><button type="button" className="btn small primary" onClick={() => openAdd(day)}>Ajouter un objectif</button></div>
          )}
        </div>
      )}

      {who === 'me' && mySeries.length > 0 && (
        <section aria-label="Mes séries" className="card pad stack" style={{ gap: 8 }}>
          <div className="row-between" style={{ alignItems: 'center' }}>
            <h2 className="h2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Flame size={16} />Mes séries</h2>
            <span className="meta">faits d’affilée</span>
          </div>
          {mySeries.map(({ st, goal }) => (
            <div key={st.goal_id} className="row-between" style={{ alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal!.title}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span className={`streak-count${st.current_streak >= 7 ? ' hot' : ''}`}>{st.current_streak}</span>
                <span className="small">record {st.best_streak}</span>
              </span>
            </div>
          ))}
          <span className="small">Un sous-objectif reporté puis fait garde la série. Un raté la remet à zéro.</span>
        </section>
      )}

      {who === 'me' && (
        <div className="card cream" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
          <span style={{ fontFamily: 'var(--pixel)', fontSize: 14, color: 'var(--cream-strong)' }}>{Math.min(missed, 3)}/3</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{missed > 1 ? 'Ratés en jeu cette semaine' : 'Raté en jeu cette semaine'}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cream-ink)' }}>
              {missed >= 3
                ? `Tu devras une surprise à ${partnerName} dimanche, sauf si tu te rattrapes.`
                : `À 3 ratés dimanche, tu offres une surprise à ${partnerName}. Un raté reporté puis fait ne compte pas.`}
            </span>
          </div>
          <button type="button" className={`wheel-bubble${wheelReady ? ' ready' : ''}`} aria-label={wheelReady ? 'Surprise : la roue est prête' : 'Surprise : la roue est verrouillée'} onClick={() => setSurprise(true)}>
            <span className="mini-wheel" aria-hidden="true" />
            <span>Surprise</span>
          </button>
        </div>
      )}
      {surprise && <SurpriseWheel onClose={() => setSurprise(false)} />}

      <button type="button" className="btn block" style={{ width: 'calc(100% - 72px)' }} onClick={goWeek}>
        <Icon name="calendar" size={18} />Voir et préparer ma semaine
      </button>

      <button type="button" className="fab" aria-label="Ajouter un objectif" onClick={() => openAdd(day < today ? today : day)}>
        <Icon name="plus" size={26} stroke={3.2} />
      </button>
    </div>
  )
}
