import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { FREE_COLORS, ItemPreview, PALETTES } from '../components/Fish'
import type { FishColor, ItemKind, ShopItem } from '../lib/types'
import { Bar, Coin, Icon } from '../components/ui'

const SECTIONS: Array<{ kind: ItemKind; title: string; hint?: string }> = [
  { kind: 'color', title: 'Couleurs' },
  { kind: 'bowl', title: 'Bocaux' },
  { kind: 'hat', title: 'Habits et accessoires' },
  { kind: 'pet', title: 'Familiers', hint: 'Un compagnon qui vit avec ton poisson, dès le niveau 8.' },
  { kind: 'decor', title: 'Décorations communes', hint: 'Payées avec la cagnotte, pour le grand aquarium.' },
]

const COLUMN: Record<string, 'fish_color' | 'bowl_style' | 'fish_hat' | 'fish_pet'> = {
  color: 'fish_color', bowl: 'bowl_style', hat: 'fish_hat', pet: 'fish_pet',
}

export function Shop({ onBack }: { onBack: () => void }) {
  const { me, couple, shopItems, purchases, coupleItems, pot, userId, fishOf, run, reload } = useStore()
  if (!me) return null
  const fish = fishOf(userId)
  const coins = fish.coins ?? 0
  const owned = new Set(purchases.filter((p) => p.profile_id === userId).map((p) => p.item_id))
  const decorOwned = new Set(coupleItems.map((c) => c.item_id))
  const aquarium = Boolean(couple?.aquarium_bought)

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

  const contribute = async (amount: number) => {
    if (amount <= 0) return
    const ok = await run(() => supabase.rpc('contribute', { p_amount: amount }), `${amount} pièces versées dans la cagnotte`)
    if (ok) await reload(['shop', 'fish', 'couple'])
  }

  // Les gratuits d'abord : couleurs de départ et bocal rond
  const freeItems = (kind: ItemKind): ShopItem[] => {
    if (kind === 'color') return FREE_COLORS.map((c, i) => ({ id: c, kind, name: PALETTES[c].label, price: 0, min_level: 1, scope: 'perso', position: -10 + i }))
    if (kind === 'bowl') return [{ id: 'rond', kind, name: 'Bocal rond', price: 0, min_level: 1, scope: 'perso', position: -1 }]
    return []
  }

  const button = (it: ShopItem) => {
    if (it.scope === 'commun') {
      if (decorOwned.has(it.id)) return <button type="button" className="btn small" disabled>Dans l’aquarium</button>
      if (!aquarium) return <button type="button" className="btn small" disabled>Après l’aquarium</button>
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

      <section aria-label="Cagnotte commune" className="card pad cream stack">
        <div className="row-between" style={{ alignItems: 'center' }}>
          <h2 className="h2">{aquarium ? 'Cagnotte commune' : 'Grand aquarium commun'}</h2>
          <span style={{ fontFamily: 'var(--pixel)', fontSize: 11, color: 'var(--cream-strong)' }}>{aquarium ? pot : `${pot}/120`}</span>
        </div>
        {!aquarium && <Bar ratio={Math.min(1, pot / 120)} color="var(--sand)" />}
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: 'var(--cream-ink)' }}>
          {aquarium
            ? 'Vos pièces communes, pour décorer le grand aquarium.'
            : 'Indispensable pour passer au stade Moyen. Il s’achète tout seul dès que la cagnotte atteint 120 pièces. Même au niveau 6, l’XP en réserve continue de vous rapporter des pièces.'}
        </p>
        <div className="wrap">
          {[10, 25].map((n) => (
            <button key={n} type="button" className="btn small" disabled={coins < n} onClick={() => contribute(n)}>Verser {n}</button>
          ))}
          {!aquarium && coins > 0 && (
            <button type="button" className="btn small primary" onClick={() => contribute(Math.min(coins, 120 - pot))}>
              Verser {Math.min(coins, 120 - pot)}
            </button>
          )}
        </div>
      </section>

      {SECTIONS.filter((sec) => !(aquarium && sec.kind === 'bowl')).map((sec) => {
        const items = [...freeItems(sec.kind), ...shopItems.filter((i) => i.kind === sec.kind)]
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
