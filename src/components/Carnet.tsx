import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { EMPTY_GAUGES, VISITORS, conditionText, nextOf, rewardText, visitorById } from '../lib/visitors'
import type { Gauges, Visitor, VisitorFamily, VisitorFound, VisitorScope } from '../lib/visitors'
import { VisitorSprite } from './Visitors'
import { Bar, Coin, Sheet } from './ui'

export type CarnetTab = 'duo' | 'me' | 'partner'

/** Les visiteurs trouvés d'un carnet : à deux, ou perso d'une personne */
function foundIn(found: VisitorFound[], scope: VisitorScope, profileId?: string) {
  return new Map(found.filter((f) => (scope === 'duo' ? f.profile_id === null : f.profile_id === profileId)).map((f) => [f.visitor_id, f]))
}

function useCarnet(tab: CarnetTab) {
  const { userId, partner, visitorsFound, visitorBook } = useStore()
  const scope: VisitorScope = tab === 'duo' ? 'duo' : 'perso'
  const profileId = tab === 'me' ? userId : tab === 'partner' ? partner?.id : undefined
  const gauges: Gauges = (scope === 'duo' ? visitorBook?.duo : profileId ? visitorBook?.profiles[profileId] : undefined) || EMPTY_GAUGES
  const found = foundIn(visitorsFound, scope, profileId)
  return { scope, gauges, found }
}

/** La jauge d'une famille : valeur, prochain visiteur, barre */
function Gauge({ scope, family, gauges, found }: { scope: VisitorScope; family: VisitorFamily; gauges: Gauges; found: Map<string, VisitorFound> }) {
  const n = nextOf(scope, family, gauges, new Set(found.keys()))
  const title = family === 'tasks'
    ? (scope === 'duo' ? 'Sous-objectifs cochés à deux' : 'Sous-objectifs cochés')
    : (scope === 'duo' ? 'Série à deux' : 'Meilleure série')
  const value = family === 'tasks' ? `${n.value.toLocaleString('fr-FR')}` : `${n.value} jour${n.value > 1 ? 's' : ''}`
  const now = family === 'streak' && gauges.streak_now > 0 && gauges.streak_now < gauges.streak_best ? `, en cours : ${gauges.streak_now}` : ''
  return (
    <div className="gauge">
      <div className="gauge-head">
        <span className="small" style={{ fontWeight: 800 }}>{title}</span>
        <span className="small" style={{ fontWeight: 800 }}>{value}{now}</span>
      </div>
      <Bar ratio={n.ratio} thin color={family === 'tasks' ? '#2ECC71' : '#FF8C1A'} />
      <span className="small">
        {n.next
          ? `Prochain visiteur : ${n.next.name} à ${family === 'tasks' ? n.next.threshold.toLocaleString('fr-FR') : `${n.next.threshold} jours`}`
          : 'Tous les visiteurs de cette famille sont là, bravo'}
      </span>
    </div>
  )
}

function VisitorCell({ v, f }: { v: Visitor; f?: VisitorFound }) {
  return (
    <li className={f ? 'visitor-cell found' : 'visitor-cell'}>
      <div className="visitor-pic"><VisitorSprite id={v.id} px={4} max={66} silhouette={!f} /></div>
      <span className="visitor-name">{v.name}</span>
      <span className="visitor-sub">
        {f ? <><Coin size={10} /> {v.reward}{v.scope === 'duo' ? ' en cagnotte' : ''}</> : conditionText(v)}
      </span>
    </li>
  )
}

function Family({ scope, family, found }: { scope: VisitorScope; family: VisitorFamily; found: Map<string, VisitorFound> }) {
  const list = VISITORS.filter((v) => v.scope === scope && v.family === family)
  return (
    <ul className="visitor-grid" aria-label={family === 'tasks' ? 'Visiteurs des sous-objectifs' : 'Visiteurs des séries'}>
      {list.map((v) => <VisitorCell key={v.id} v={v} f={found.get(v.id)} />)}
    </ul>
  )
}

/** Le carnet complet : à deux, le mien, celui de Julie */
export function CarnetSheet({ initial, onClose }: { initial: CarnetTab; onClose: () => void }) {
  const { me, partner, partnerName } = useStore()
  const [tab, setTab] = useState<CarnetTab>(partner ? initial : 'me')
  const { scope, gauges, found } = useCarnet(tab)
  const total = VISITORS.filter((v) => v.scope === scope).length
  return (
    <Sheet title="Carnet des visiteurs" onClose={onClose}>
      <div className="stack" style={{ gap: 12 }}>
        {partner && (
          <div className="seg" role="group" aria-label="Quel carnet">
            <button type="button" aria-pressed={tab === 'duo'} onClick={() => setTab('duo')}>À deux</button>
            <button type="button" aria-pressed={tab === 'me'} onClick={() => setTab('me')}>{me?.display_name || 'Moi'}</button>
            <button type="button" aria-pressed={tab === 'partner'} onClick={() => setTab('partner')}>{partnerName}</button>
          </div>
        )}
        <p className="small" style={{ margin: 0 }}>
          {scope === 'duo'
            ? `Ils arrivent par vos efforts communs et versent leurs pièces dans la cagnotte. ${found.size} sur ${total} trouvés.`
            : `Ils arrivent par ${tab === 'me' ? 'tes' : 'ses'} sous-objectifs et ${tab === 'me' ? 'tes' : 'ses'} séries, et rapportent des pièces. ${found.size} sur ${total} trouvés.`}
        </p>
        <Gauge scope={scope} family="tasks" gauges={gauges} found={found} />
        <Family scope={scope} family="tasks" found={found} />
        <Gauge scope={scope} family="streak" gauges={gauges} found={found} />
        <Family scope={scope} family="streak" found={found} />
        <p className="small" style={{ margin: 0 }}>
          Un visiteur trouvé passe de temps en temps {scope === 'duo' ? 'chez vous deux' : tab === 'me' ? 'dans ton bocal' : 'dans son bocal'}, et à coup sûr les jours où la journée est complète.
        </p>
      </div>
    </Sheet>
  )
}

/** Résumé du carnet sur l'écran Aquarium : les visiteurs d'une personne (les siens et ceux à deux) */
export function CarnetCard({ tab, onOpen }: { tab: CarnetTab; onOpen: () => void }) {
  const { userId, partner, partnerName, visitorsFound, visitorBook } = useStore()
  const who = tab === 'partner' && partner ? partner.id : userId
  const mine = foundIn(visitorsFound, 'perso', who)
  const duo = foundIn(visitorsFound, 'duo')
  const g = visitorBook?.profiles[who] || EMPTY_GAUGES
  const gd = visitorBook?.duo || EMPTY_GAUGES
  const ids = new Set([...mine.keys(), ...duo.keys()])
  const shown = [...visitorsFound]
    .filter((f) => f.profile_id === null || f.profile_id === who)
    .sort((a, b) => b.found_at.localeCompare(a.found_at))
    .slice(0, 5)
    .map((f) => visitorById(f.visitor_id))
    .filter((v): v is Visitor => !!v)
  const candidates = [
    nextOf('perso', 'tasks', g, new Set(mine.keys())), nextOf('perso', 'streak', g, new Set(mine.keys())),
    ...(partner ? [nextOf('duo', 'tasks', gd, new Set(duo.keys())), nextOf('duo', 'streak', gd, new Set(duo.keys()))] : []),
  ]
  const closest = candidates.filter((x) => x.next).sort((x, y) => y.ratio - x.ratio)[0]
  const label = tab === 'partner' ? `Ceux de ${partnerName}` : 'Les miens et ceux à deux'
  return (
    <section aria-label="Carnet des visiteurs" className="card pad stack" style={{ gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="h2" style={{ fontSize: 15, flex: 1 }}>Carnet des visiteurs</span>
        <span className="small" style={{ fontWeight: 800 }}>{ids.size} / {VISITORS.length}</span>
      </div>
      <span className="small" style={{ marginTop: -6 }}>{label}</span>
      <div className="carnet-strip">
        {shown.map((v) => <VisitorSprite key={v.id} id={v.id} px={3} max={48} label={v.name} />)}
        {closest?.next && <VisitorSprite id={closest.next.id} px={3} max={48} silhouette label={`${closest.next.name}, pas encore trouvé`} />}
      </div>
      {closest?.next && (
        <div className="stack" style={{ gap: 4 }}>
          <Bar ratio={closest.ratio} thin color={closest.next.family === 'tasks' ? '#2ECC71' : '#FF8C1A'} />
          <span className="small">
            Prochain : {closest.next.name}{closest.next.scope === 'duo' ? ' (à deux)' : ''}, {closest.value.toLocaleString('fr-FR')} / {closest.next.threshold.toLocaleString('fr-FR')}
            {closest.next.family === 'tasks' ? ' sous-objectifs' : ' jours de série'}
          </span>
        </div>
      )}
      <button type="button" className="btn small" onClick={onOpen}>Ouvrir le carnet</button>
    </section>
  )
}

/** Un visiteur trouvé traverse parfois la scène : une fois sur trois, et à coup sûr si ma journée est complète */
export function VisitorPass({ tab, bowls }: { tab: CarnetTab; bowls: boolean }) {
  const { visitorsFound, userId, partner, tasks, today } = useStore()
  const [pass, setPass] = useState<{ v: Visitor; side: 'left' | 'right' | 'full'; key: number } | null>(null)
  const decided = useRef(false)
  const dayComplete = useMemo(() => {
    const mine = tasks.filter((t) => t.date === today && !t.skipped && (t.owner_id === userId || t.owner_id === null))
    return mine.length > 0 && mine.every((t) => t.done_at)
  }, [tasks, today, userId])

  useEffect(() => {
    if (decided.current || !visitorsFound.length) return
    decided.current = true
    if (!dayComplete && Math.random() >= 1 / 3) return
    const pool = visitorsFound.filter((f) =>
      f.profile_id === null || (tab !== 'partner' && f.profile_id === userId) || (tab !== 'me' && f.profile_id === partner?.id))
    if (!pool.length) return
    const f = pool[Math.floor(Math.random() * pool.length)]
    const v = visitorById(f.visitor_id)
    if (!v) return
    const side = !bowls || tab !== 'duo' || f.profile_id === null ? 'full' : f.profile_id === userId ? 'left' : 'right'
    const timer = window.setTimeout(() => setPass({ v, side, key: Date.now() }), 1200)
    return () => window.clearTimeout(timer)
  }, [visitorsFound, dayComplete, tab, userId, partner, bowls])

  if (!pass) return null
  const big = pass.v.scope === 'duo' // les visiteurs à deux sont plus grands
  return (
    <div className={`visitor-pass pass-${pass.side}${bowls ? ' in-bowls' : ''}`} aria-hidden="true" key={pass.key} onAnimationEnd={() => setPass(null)}>
      <div className="visitor-pass-inner">
        <VisitorSprite id={pass.v.id} px={big ? 3.4 : 3} max={big ? 72 : 48} />
        <span className="visitor-pass-name">{pass.v.name}</span>
      </div>
    </div>
  )
}

const seenKey = (u: string) => `hf-seen-visitors-${u}`
function readSeen(u: string): string[] {
  try { return JSON.parse(window.localStorage.getItem(seenKey(u)) || '[]') as string[] } catch { return [] }
}
function writeSeen(u: string, ids: string[]) {
  try { window.localStorage.setItem(seenKey(u), JSON.stringify(ids.slice(-100))) } catch { /* rien */ }
}

/** « Un bernard-l'ermite est arrivé ! » : s'affiche une fois pour chaque nouveau visiteur (de moins de 7 jours) */
export function VisitorArrival({ onOpenCarnet }: { onOpenCarnet: () => void }) {
  const { visitorsFound, userId } = useStore()
  const [seen, setSeen] = useState<string[]>(() => readSeen(userId))
  const fresh = visitorsFound.filter((f) =>
    (f.profile_id === null || f.profile_id === userId) && !seen.includes(f.id)
    && Date.now() - new Date(f.found_at).getTime() < 7 * 24 * 3600 * 1000)
  if (!fresh.length) return null
  const close = () => {
    const next = [...seen, ...fresh.map((f) => f.id)]
    setSeen(next)
    writeSeen(userId, next)
  }
  const list = fresh.map((f) => ({ f, v: visitorById(f.visitor_id) })).filter((x): x is { f: VisitorFound; v: Visitor } => !!x.v)
  const title = list.length === 1 ? 'Un nouveau visiteur' : `${list.length} nouveaux visiteurs`
  return (
    <Sheet title={title} onClose={close}>
      <div className="stack" style={{ gap: 14 }}>
        {list.map(({ f, v }) => (
          <div key={f.id} className="arrival">
            <div className="arrival-pic"><VisitorSprite id={v.id} px={list.length === 1 ? 7 : 5} max={list.length === 1 ? 120 : 76} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="h2" style={{ fontSize: 16 }}>{v.arrival} !</span>
              <span className="small">{v.scope === 'duo' ? 'Grâce à vous deux.' : 'Grâce à tes efforts.'} {rewardText(v)}.</span>
            </div>
          </div>
        ))}
        <p className="small" style={{ margin: 0 }}>Ils passeront de temps en temps dans l’aquarium.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" style={{ flex: 1 }} onClick={close}>Super</button>
          <button type="button" className="btn primary" style={{ flex: 1 }} onClick={() => { close(); onOpenCarnet() }}>Voir le carnet</button>
        </div>
      </div>
    </Sheet>
  )
}
