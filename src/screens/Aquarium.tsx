import { useStore } from '../lib/store'
import { LEVEL_CAP_WITHOUT_AQUARIUM, levelProgress, stadeName, stadeOf } from '../lib/xp'
import type { Profile } from '../lib/types'
import { MOOD_LABEL, moodOf } from '../lib/mood'
import { seasonalHat, seasonOf } from '../lib/season'
import { Bowl, PALETTES, Tank } from '../components/Fish'
import { Bar, Coin, Icon } from '../components/ui'
import { useState } from 'react'
import { MonthRecapSheet, monthName } from '../components/MonthRecap'

function FishInfo({ p, owner }: { p: Profile; owner: string }) {
  const { fishOf, couple, tasks, today } = useStore()
  const f = fishOf(p.id)
  const prog = levelProgress(f.xp, f.level)
  const capped = !couple?.aquarium_bought && f.level_uncapped > LEVEL_CAP_WITHOUT_AQUARIUM
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 15, fontWeight: 800 }}>{p.fish_name}, à {owner}</span>
      <span className="small" style={{ fontWeight: 700 }}>{stadeName(f.level)}, niveau {f.level}, {MOOD_LABEL[moodOf(tasks, today, p.id)]}</span>
      <Bar ratio={capped ? 1 : prog.ratio} color={PALETTES[p.fish_color]?.b} thin />
      <span className="small">{capped ? `${f.xp} XP, en réserve` : `${prog.into} / ${prog.needed} XP`}</span>
    </div>
  )
}

const scaleOf = (level: number) => 1 + (stadeOf(level) - 1) * 0.3

export function Aquarium({ openShop }: { openShop: () => void }) {
  const { me, partner, partnerName, fishOf, userId, couple, coupleItems, pot, tasks, today } = useStore()
  if (!me) return null
  const myFish = fishOf(userId)
  const aquarium = Boolean(couple?.aquarium_bought)
  const season = seasonOf(today)
  const [recap, setRecap] = useState(false)
  const owners = [{ p: me, owner: me.display_name || 'moi' }, ...(partner ? [{ p: partner, owner: partnerName }] : [])]

  return (
    <div className="screen">
      <header className="head">
        <div className="head-left">
          <p className="kicker">{aquarium ? 'Notre grand aquarium' : 'Nos deux bocaux'}</p>
          <h1 className="title">Aquarium</h1>
        </div>
        <span className="pill" aria-label={`${myFish.coins ?? 0} pièces`}><Coin /><span>{myFish.coins ?? 0}</span></span>
      </header>

      <section aria-label="Vos poissons" className="card pad stack" style={{ gap: 14 }}>
        {aquarium ? (
          <Tank
            fishes={owners.map(({ p }) => ({ color: p.fish_color, hat: seasonalHat(p.fish_hat, season), pet: p.fish_pet, scale: scaleOf(fishOf(p.id).level), name: p.fish_name, mood: moodOf(tasks, today, p.id) }))}
            decor={coupleItems.map((c) => c.item_id)}
            noel={season === 'noel'}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: partner ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: 14 }}>
            {owners.map(({ p }, i) => (
              <Bowl key={p.id} noel={season === 'noel'} color={p.fish_color} hat={seasonalHat(p.fish_hat, season)} pet={p.fish_pet} style={p.bowl_style}
                scale={scaleOf(fishOf(p.id).level)} name={p.fish_name} flip={i === 1} mood={moodOf(tasks, today, p.id)} />
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: partner ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: 14 }}>
          {owners.map(({ p, owner }) => <FishInfo key={p.id} p={p} owner={owner} />)}
        </div>
        <span className="small" style={{ textAlign: 'center' }}>Touche {aquarium ? 'l’aquarium' : 'un bocal'} pour dire coucou.</span>
      </section>

      {!aquarium ? (
        <section aria-label="Grand aquarium commun" className="card pad cream stack">
          <div className="head-row" style={{ gap: 10 }}>
            <Icon name="lock" />
            <h2 className="h2" style={{ flex: 1 }}>Grand aquarium commun</h2>
            <span style={{ fontFamily: 'var(--pixel)', fontSize: 10, color: 'var(--cream-ink)' }}>{pot}/120</span>
          </div>
          <Bar ratio={Math.min(1, pot / 120)} color="var(--sand)" />
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: 'var(--cream-ink)' }}>
            Indispensable pour passer au stade Moyen, au niveau 7. Il s’achète tout seul quand la cagnotte atteint 120 pièces, et vos deux poissons y vivront ensemble.
          </p>
          <button type="button" className="btn primary" onClick={openShop}>Verser des pièces</button>
        </section>
      ) : (
        <section aria-label="Cagnotte commune" className="card pad cream" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="h2" style={{ fontSize: 15 }}>Cagnotte commune : {pot} pièces</span>
            <span className="small" style={{ color: 'var(--cream-ink)' }}>Pour les décorations de l’aquarium.</span>
          </div>
          <button type="button" className="btn small primary" onClick={openShop}>Boutique</button>
        </section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button type="button" className="btn" onClick={openShop}><Coin />Boutique</button>
        <button type="button" className="btn" onClick={() => setRecap(true)}>Récap {monthName(today)}</button>
      </div>
      {recap && <MonthRecapSheet month={`${today.slice(0, 7)}-01`} onClose={() => setRecap(false)} />}

      <section aria-label="Les stades" className="card pad stack">
        <h2 className="h2">Les stades</h2>
        <ul className="list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[['Alevin', '1 à 3'], ['Petit', '4 à 6'], ['Moyen', '7 à 9, grand aquarium'], ['Grand', '10 à 12'], ['Majestueux', '13 à 15']].map(([n, l]) => (
            <li key={n} className="row-between" style={{ fontSize: 14 }}>
              <span style={{ fontWeight: 800 }}>{n}</span>
              <span className="small">niveaux {l}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
