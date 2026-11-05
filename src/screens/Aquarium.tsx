import { useState } from 'react'
import { useStore } from '../lib/store'
import { HABITATS, habitatOf, levelProgress, nextStade, scaleOf, stadeName, stadeOf } from '../lib/xp'
import type { Profile } from '../lib/types'
import { MOOD_LABEL, moodOf } from '../lib/mood'
import { seasonalHat, seasonOf } from '../lib/season'
import { Bowl, Fish, PALETTES, SoloFish, Tank } from '../components/Fish'
import { Bar, Coin } from '../components/ui'
import { MonthRecapSheet, monthName } from '../components/MonthRecap'
import { CarnetCard, CarnetSheet, VisitorPass } from '../components/Carnet'
import { DecoEditor } from '../components/DecoEditor'
import { slotsOf } from '../lib/deco'

type View = 'duo' | 'me' | 'partner'

/** Fiche courte, pour la vue « Ensemble » */
function FishInfo({ p, owner }: { p: Profile; owner: string }) {
  const { fishOf } = useStore()
  const f = fishOf(p.id)
  const prog = levelProgress(f.xp, f.level)
  const capped = f.level_uncapped > f.level
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.fish_name}, à {owner}</span>
      <span className="small" style={{ fontWeight: 700 }}>{stadeName(f.level)}, niveau {f.level}</span>
      <Bar ratio={capped ? 1 : prog.ratio} color={PALETTES[p.fish_color]?.b} thin />
      <span className="small">{capped ? 'XP en réserve' : `${prog.into} / ${prog.needed} XP`}</span>
    </div>
  )
}

/** Fiche complète d'un poisson : stade, XP, humeur, prochain stade en silhouette */
function FishSheet({ p, owner }: { p: Profile; owner: string }) {
  const { fishOf, tasks, today } = useStore()
  const f = fishOf(p.id)
  const prog = levelProgress(f.xp, f.level)
  const capped = f.level_uncapped > f.level
  const next = nextStade(f.level)
  const mood = moodOf(tasks, today, p.id)
  return (
    <section aria-label={`Fiche de ${p.fish_name}`} className="card pad stack" style={{ gap: 10 }}>
      <div className="fish-sheet">
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="h2" style={{ fontSize: 16 }}>{p.fish_name}, à {owner}</span>
          <span className="small" style={{ fontWeight: 700 }}>{stadeName(f.level)}, niveau {f.level}, {MOOD_LABEL[mood]}</span>
          <Bar ratio={capped ? 1 : prog.ratio} color={PALETTES[p.fish_color]?.b} />
          <span className="small">
            {capped
              ? `${f.xp} XP : niveau ${f.level_uncapped} dès le prochain habitat`
              : prog.needed ? `${prog.into} / ${prog.needed} XP jusqu’au niveau ${f.level + 1}` : 'Niveau maximum, bravo'}
          </span>
        </div>
        {next && (
          <div className="next-stade" aria-label={`Prochain stade : ${next.name} au niveau ${next.level}`}>
            <Fish color={p.fish_color} stade={stadeOf(next.level)} width={52} silhouette />
            <span className="small" style={{ fontWeight: 800 }}>{next.name}</span>
            <span className="small">niv. {next.level}</span>
          </div>
        )}
      </div>
    </section>
  )
}

export function Aquarium({ openShop }: { openShop: () => void }) {
  const { me, partner, partnerName, fishOf, userId, couple, coupleItems, tasks, today, decoSlots } = useStore()
  const [view, setView] = useState<View>('duo')
  const [recap, setRecap] = useState(false)
  const [carnet, setCarnet] = useState(false)
  if (!me) return null

  const myFish = fishOf(userId)
  const position = couple?.habitat ?? 0
  const habitat = habitatOf(position)
  const nextHabitat = HABITATS[position + 1]
  const season = seasonOf(today)
  const owners = [{ p: me, owner: me.display_name || 'moi' }, ...(partner ? [{ p: partner, owner: partnerName }] : [])]
  const solo = view === 'me' ? owners[0] : view === 'partner' && owners[1] ? owners[1] : null

  const fishProps = (p: Profile) => {
    const level = fishOf(p.id).level
    return { color: p.fish_color, hat: seasonalHat(p.fish_hat, season), pet: p.fish_pet, name: p.fish_name,
      mood: moodOf(tasks, today, p.id), stade: stadeOf(level), scale: scaleOf(level) }
  }

  return (
    <div className="screen">
      <header className="head">
        <div className="head-left">
          <p className="kicker">{habitat.name}</p>
          <h1 className="title">Aquarium</h1>
        </div>
        <span className="pill" aria-label={`${myFish.coins ?? 0} pièces`}><Coin /><span>{myFish.coins ?? 0}</span></span>
      </header>

      <section aria-label="Vos poissons" className="stack" style={{ gap: 10 }}>
        <div className="scene-wrap">
        {solo ? (
          <SoloFish {...fishProps(solo.p)} habitat={position} deco={slotsOf(decoSlots, solo.p.id, 'own')} />
        ) : position >= 1 ? (
          <Tank tall habitat={position} habitatName={habitat.name} fishes={owners.map(({ p }) => fishProps(p))}
            decor={coupleItems.map((c) => c.item_id)} noel={season === 'noel'}
            deco={[...slotsOf(decoSlots, me.id, 'common'), ...slotsOf(decoSlots, partner?.id, 'common')]} />
        ) : (
          <div className={`scene-bowls${partner ? '' : ' single'}`}>
            {owners.map(({ p }, i) => {
              const fp = fishProps(p)
              return <Bowl key={p.id} noel={season === 'noel'} style={p.bowl_style} flip={i === 1} {...fp} scale={fp.scale * 1.3} deco={slotsOf(decoSlots, p.id, 'own')} />
            })}
          </div>
        )}
        <VisitorPass tab={view} bowls={!solo && position < 1 && !!partner} />
        </div>
        {partner && (
          <div className="seg" role="group" aria-label="Qui regarder">
            <button type="button" aria-pressed={view === 'duo'} onClick={() => setView('duo')}>Ensemble</button>
            <button type="button" aria-pressed={view === 'me'} onClick={() => setView('me')}>{me.fish_name || 'Moi'}</button>
            <button type="button" aria-pressed={view === 'partner'} onClick={() => setView('partner')}>{partner.fish_name || partnerName}</button>
          </div>
        )}
      </section>

      {solo ? (
        <FishSheet p={solo.p} owner={solo.owner} />
      ) : partner ? (
        <section aria-label="Vos deux poissons" className="card pad duo-sheets">
          {owners.map(({ p, owner }) => <FishInfo key={p.id} p={p} owner={owner} />)}
        </section>
      ) : (
        <FishSheet p={me} owner={owners[0].owner} />
      )}

      {(solo ? solo.p.id === userId : true) && !(partner && view === 'duo' && position < 1) && (
        <DecoEditor place={partner && view === 'duo' ? 'common' : 'own'} openShop={openShop} />
      )}
      {partner && view === 'duo' && position < 1 && (
        <button type="button" className="btn" onClick={() => setView('me')}>Décorer mon bocal</button>
      )}

      <CarnetCard tab={partner ? view : 'me'} onOpen={() => setCarnet(true)} />

      <section aria-label="Notre habitat" className="card pad cream" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="h2" style={{ fontSize: 15 }}>{nextHabitat ? `Prochain habitat : ${nextHabitat.name}` : 'Vous vivez dans le lagon'}</span>
          <span className="small" style={{ color: 'var(--cream-ink)' }}>
            {nextHabitat
              ? `Vos deux poissons au niveau ${nextHabitat.minLevel} et ${nextHabitat.price} pièces dans la cagnotte.`
              : 'Le plus bel habitat, jusqu’au niveau 50.'}
          </span>
        </div>
        <button type="button" className="btn small primary" onClick={openShop}>Boutique</button>
      </section>

      <button type="button" className="btn" onClick={() => setRecap(true)}>Récap {monthName(today)}</button>
      {carnet && <CarnetSheet initial={partner ? view : 'me'} onClose={() => setCarnet(false)} />}
      {recap && <MonthRecapSheet month={`${today.slice(0, 7)}-01`} onClose={() => setRecap(false)} />}
    </div>
  )
}
