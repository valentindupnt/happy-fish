import { useStore } from '../lib/store'
import { coinsEarned, LEVEL_CAP_WITHOUT_AQUARIUM, levelProgress, stadeName, stadeOf } from '../lib/xp'
import type { Profile } from '../lib/types'
import { Bowl, PALETTES } from '../components/Fish'
import { Bar, Coin, Icon } from '../components/ui'

function FishCard({ p, owner, flip }: { p: Profile; owner: string; flip?: boolean }) {
  const { fishOf, couple } = useStore()
  const f = fishOf(p.id)
  const prog = levelProgress(f.xp, f.level)
  const capped = !couple?.aquarium_bought && f.level_uncapped > LEVEL_CAP_WITHOUT_AQUARIUM
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <Bowl color={p.fish_color} scale={1 + (stadeOf(f.level) - 1) * 0.3} name={p.fish_name} flip={flip} />
      <span style={{ fontSize: 15, fontWeight: 800 }}>{p.fish_name}, à {owner}</span>
      <span className="small" style={{ fontWeight: 700 }}>{stadeName(f.level)}, niveau {f.level}</span>
      <Bar ratio={capped ? 1 : prog.ratio} color={PALETTES[p.fish_color].b} thin />
      <span className="small">{capped ? `${f.xp} XP, en réserve` : `${prog.into} / ${prog.needed} XP`}</span>
    </div>
  )
}

export function Aquarium() {
  const { me, partner, partnerName, fishOf, userId } = useStore()
  if (!me) return null
  const myLevel = fishOf(userId).level
  const sumCoins = coinsEarned(myLevel) + (partner ? coinsEarned(fishOf(partner.id).level) : 0)

  return (
    <div className="screen">
      <header className="head">
        <div className="head-left">
          <p className="kicker">Nos deux bocaux</p>
          <h1 className="title">Aquarium</h1>
        </div>
        <span className="pill" aria-label={`${coinsEarned(myLevel)} pièces`}><Coin /><span>{coinsEarned(myLevel)}</span></span>
      </header>

      <section aria-label="Vos poissons" className="card pad" style={{ display: 'grid', gridTemplateColumns: partner ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: 14 }}>
        <FishCard p={me} owner={me.display_name || 'moi'} />
        {partner && <FishCard p={partner} owner={partnerName} flip />}
      </section>

      <section aria-label="Grand aquarium commun" className="card pad cream stack">
        <div className="head-row" style={{ gap: 10 }}>
          <Icon name="lock" />
          <h2 className="h2">Grand aquarium commun</h2>
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: 'var(--cream-ink)' }}>
          Indispensable pour passer au stade Moyen, au niveau 7. Vous l’achèterez ensemble avec vos pièces
          (120 au total), et vos deux poissons y vivront ensemble. Vous avez déjà {sumCoins} pièces à vous deux.
        </p>
        <span className="small" style={{ color: 'var(--cream-ink)', fontWeight: 700 }}>
          La boutique et la cagnotte arrivent avec la prochaine mise à jour. Votre XP continue de s’accumuler en attendant.
        </span>
      </section>

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
