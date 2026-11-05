import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { FREE_COLORS, ItemPreview, PALETTES } from '../components/Fish'
import type { FishColor, ItemKind, ShopItem } from '../lib/types'
import { Bar, Coin, Icon } from '../components/ui'
import { HABITATS } from '../lib/xp'
import { DecoShop } from '../components/DecoShop'

const SECTIONS: Array<{ kind: ItemKind; title: string; hint?: string }> = [
  { kind: 'color', title: 'Couleurs' },
  { kind: 'bowl', title: 'Bocaux' },
  { kind: 'hat', title: 'Habits et accessoires' },
  { kind: 'pet', title: 'Familiers', hint: 'Un compagnon qui vit avec ton poisson, dès le niveau 12.' },
  { kind: 'deco', title: 'Décorations de mon aquarium' },
  { kind: 'decor', title: 'Décorations communes', hint: 'Payées avec la cagnotte. Chaque habitat ouvre les siennes.' },
]

const COLUMN: Record<string, 'fish_color' | 'bowl_style' | 'fish_hat' | 'fish_pet'> = {
  color: 'fish_color', bowl: 'bowl_style', hat: 'fish_hat', pet: 'fish_pet',
}

export function Shop({ onBack }: { onBack: () => void }) {
  const { me, partner, partnerName, couple, shopItems, purchases, coupleItems, pot, userId, fishOf, run, reload } = useStore()
  if (!me) return null
  const fish = fishOf(userId)
  const coins = fish.coins ?? 0
  const owned = new Set(purchases.filter((p) => p.profile_id === userId).map((p) => p.item_id))
  const decorOwned = new Set(coupleItems.map((c) => c.item_id))
  const position = couple?.habitat ?? 0
  const current = HABITATS[position]
  const next = HABITATS[position + 1]
  const partnerLevel = partner ? fishOf(partner.id).level : 0
  const levelsOk = Boolean(next && partner && fish.level >= next.minLevel && partnerLevel >= next.minLevel)
  const potOk = Boolean(next && pot >= next.price)

  const equipped = (kind: ItemKind, id: string) => {
    const col = COLUMN[kind]
    return col ? (me[col] ?? (kind === 'bowl' ? 'rond' : null)) === id : false
  }

  const equip = async (kind: ItemKind, id: string | null, label?: string) => {
    const col = COLUMN[kind]
    if (!col) return
    if (await run(() => supabase.from('profiles').update({ [col]: id }).eq('id', userId), label)) await reload(['profiles'])
  }

  const buy = async (it: ShopItem) => {
    if (it.scope === 'commun') {
      if (await run(() => supabase.rpc('buy_decor', { p_item: it.id }), `${it.name} ajouté à l’aquarium`)) await reload(['shop'])
      return
    }
    if (await run(() => supabase.rpc('buy_item', { p_item: it.id }), `${it.name} acheté`)) {
      await reload(['shop', 'fish'])
      await equip(it.kind, it.id)
    }
  }

  const buyHabitat = async () => {
    if (!next) return
    if (await run(() => supabase.rpc('buy_habitat'), `Bienvenue dans votre ${next.name.toLowerCase()} !`)) await reload(['couple', 'shop', 'fish'])
  }

  const contribute = async (amount: number) => {
    if (amount <= 0) return
    const ok = await run(() => supabase.rpc('contribute', { p_amount: amount }), `${amount} pièces versées dans la cagnotte`)
    if (ok) await reload(['shop', 'fish', 'couple'])
  }

  // Les gratuits d'abord : couleurs de départ et bocal rond
  const freeItems = (kind: ItemKind): ShopItem[] => {
    if (kind === 'color') return FREE_COLORS.map((c, i) => ({ id: c, kind, name: PALETTES[c].label, price: 0, min_level: 1, scope: 'perso', position: -10 + i, habitat: 0 }))
    if (kind === 'bowl') return [{ id: 'rond', kind, name: 'Bocal rond', price: 0, min_level: 1, scope: 'perso', position: -1, habitat: 0 }]
    return []
  }

  const button = (it: ShopItem) => {
    if (it.scope === 'commun') {
      if (decorOwned.has(it.id)) return <button type="button" className="btn small" disabled>Dans l’aquarium</button>
      const needed = Math.max(1, it.habitat ?? 1)
      if (position < needed) return <button type="button" className="btn small" disabled>{HABITATS[needed]?.name ?? 'Plus tard'}</button>
      return <button type="button" className="btn small primary" disabled={pot < it.price} onClick={() => buy(it)}><Coin size={12} />{it.price}</button>
    }
    const free = it.price === 0
    if (equipped(it.kind, it.id)) {
      return (it.kind === 'hat' || it.kind === 'pet')
        ? <button type="button" className="btn small" onClick={() => equip(it.kind, null, 'Retiré')}>Retirer</button>
        : <button type="button" className="btn small" disabled>Équipé</button>
    }
    if (free || owned.has(it.id)) return <button type="button" className="btn small" onClick={() => equip(it.kind, it.id, 'Équipé')}>Équiper</button>
    if (fish.level < it.min_level) return <button type="button" className="btn small" disabled>Niveau {it.min_level}</button>
    return <button type="button" className="btn small primary" disabled={coins < it.price} onClick={() => buy(it)}><Coin size={12} />{it.price}</button>
  }

  return (
    <div className="screen no-tabs">
      <header className="head-row">
        <button type="button" className="icon-btn" aria-label="Retour" onClick={onBack}><Icon name="back" /></button>
        <h1 className="title" style={{ fontSize: 15, flex: 1 }}>Boutique</h1>
        <span className="pill" aria-label={`${coins} pièces`}><Coin /><span>{coins}</span></span>
      </header>

      <section aria-label="Notre habitat" className="card pad cream stack">
        <div className="row-between" style={{ alignItems: 'center' }}>
          <h2 className="h2">Notre habitat : {current.name}</h2>
          <span style={{ fontFamily: 'var(--pixel)', fontSize: 10, color: 'var(--cream-strong)' }}>{position + 1}/{HABITATS.length}</span>
        </div>
        <div className="habitat-path" aria-hidden="true">
          {HABITATS.map((h, i) => <span key={h.id} className={i <= position ? 'on' : i === position + 1 ? 'next' : undefined} />)}
        </div>
        {next ? (
          <>
            <div className="stack" style={{ gap: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--cream-strong)' }}>Prochain : {next.name}</span>
              <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--cream-ink)' }}>{next.blurb} Le niveau maximum passe à {next.cap}.</span>
            </div>
            <div className={`cond${levelsOk ? ' ok' : ''}`}>
              <span className="dot" aria-hidden="true">{levelsOk ? '✓' : '1'}</span>
              <span>
                Vos deux poissons au niveau {next.minLevel}
                {partner ? ` (toi ${fish.level}, ${partnerName} ${partnerLevel})` : ', quand votre duo sera complet'}
              </span>
            </div>
            <div className={`cond${potOk ? ' ok' : ''}`}>
              <span className="dot" aria-hidden="true">{potOk ? '✓' : '2'}</span>
              <span style={{ flex: 1 }}>Cagnotte : {Math.min(pot, next.price)} / {next.price} pièces</span>
            </div>
            <Bar ratio={Math.min(1, pot / next.price)} color="var(--sand)" />
          </>
        ) : (
          <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--cream-ink)' }}>
            Le plus bel habitat. La cagnotte ({pot} pièces) sert aux décorations.
          </span>
        )}
        <div className="wrap">
          {[10, 25].map((n) => (
            <button key={n} type="button" className="btn small" disabled={coins < n} onClick={() => contribute(n)}>Verser {n}</button>
          ))}
          {next && !potOk && coins > 0 && (
            <button type="button" className="btn small" onClick={() => contribute(Math.min(coins, next.price - pot))}>
              Verser {Math.min(coins, next.price - pot)}
            </button>
          )}
        </div>
        {next && (
          <button type="button" className="btn primary" disabled={!levelsOk || !potOk} onClick={buyHabitat}>
            {levelsOk && potOk ? `Acheter ensemble : ${next.name}` : `${next.name} : ${next.price} pièces`}
          </button>
        )}
        <span className="small" style={{ color: 'var(--cream-ink)' }}>L’XP au-dessus du plafond reste en réserve et rapporte toujours des pièces.</span>
      </section>

      {SECTIONS.filter((sec) => !(position >= 1 && sec.kind === 'bowl')).map((sec) => {
        if (sec.kind === 'deco') return <DecoShop key="deco" />
        const items = [...freeItems(sec.kind), ...shopItems.filter((i) => i.kind === sec.kind)]
          .sort((a, b) => sec.kind === 'decor' ? (a.habitat - b.habitat) || (a.price - b.price) : (a.min_level - b.min_level) || (a.position - b.position))
        if (!items.length) return null
        return (
          <section key={sec.kind} aria-label={sec.title} className="stack">
            <h2 className="h2">{sec.title}</h2>
            {sec.hint && <span className="small">{sec.hint}</span>}
            <div className="shop-grid">
              {items.map((it) => {
                const locked = it.scope === 'perso' && it.price > 0 && !owned.has(it.id) && fish.level < it.min_level
                const isOn = it.scope === 'perso' && equipped(it.kind, it.id)
                return (
                  <div key={it.id} className={`shop-item${locked ? ' locked' : ''}${isOn ? ' equipped' : ''}`}>
                    <div className="preview"><ItemPreview kind={it.kind} id={it.id} color={me.fish_color as FishColor} /></div>
                    <span className="name">{it.name}</span>
                    {button(it)}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
