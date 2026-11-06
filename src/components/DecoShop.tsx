import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { LOOSE_GROUP, OWN_SLOTS, SEASON_NAME, daysUntilSeason, seasonOpen, slotsOf } from '../lib/deco'
import type { ShopItem } from '../lib/types'
import { DecoPreview } from './Deco'
import { GiftSheet } from './Gifts'
import { Coin } from './ui'

interface Group { key: string; title: string; hint?: string; items: ShopItem[]; series?: { reward: number } }

/** Le rayon des décorations perso : fonds marins, hors du commun, collections, objets de saison, vitrine */
export function DecoShop() {
  const { me, partner, partnerName, shopItems, purchases, series, today, userId, fishOf, decoSlots, run, reload, toast } = useStore()
  const [gift, setGift] = useState<{ item: ShopItem; owned: boolean } | null>(null)
  if (!me) return null
  const items = shopItems.filter((i) => i.kind === 'deco').sort((a, b) => a.position - b.position)
  if (!items.length) return null

  const owned = new Set(purchases.filter((p) => p.profile_id === userId).map((p) => p.item_id))
  const partnerOwned = new Set(purchases.filter((p) => p.profile_id === partner?.id).map((p) => p.item_id))
  const fish = fishOf(userId)
  const coins = fish.coins ?? 0
  const open = (i: ShopItem) => seasonOpen(i.season, today)

  const buy = async (it: ShopItem) => {
    const completes = Boolean(it.series) && items.filter((i) => i.series === it.series && i.id !== it.id).every((i) => owned.has(i.id))
    const reward = series.find((s) => s.id === it.series)
    const free = slotsOf(decoSlots, userId, 'own').indexOf(null)
    const ok = await run(() => supabase.rpc('buy_item', { p_item: it.id }), `${it.name} acheté`)
    if (!ok) return
    // Posé tout de suite dans le premier emplacement libre
    if (free >= 0) await supabase.rpc('set_deco', { p_place: 'own', p_slot: free, p_item: it.id })
    else toast(`Plus d’emplacement libre : pose ${it.name} depuis l’onglet Aquarium`)
    if (completes && reward) toast(`Collection « ${reward.name} » complète : +${reward.reward} pièces !`)
    await reload(['shop', 'fish', 'deco'])
  }

  const groups: Group[] = []
  const seasonal = items.filter((i) => i.season)
  for (const name of [...new Set(seasonal.map((i) => i.season!))]) {
    const list = seasonal.filter((i) => i.season === name)
    if (list.some(open)) groups.push({ key: `season-${name}`, title: `${SEASON_NAME[name] ?? name}, pour quelques jours`, hint: 'Objets de saison : ils partent le 26 décembre et restent dans ta vitrine.', items: list, series: series.find((s) => s.id === list[0].series) })
  }
  const loose = (g: 'fonds' | 'insolite') => items.filter((i) => !i.series && LOOSE_GROUP[i.id] === g)
  if (loose('fonds').length) groups.push({ key: 'fonds', title: 'Fonds marins', items: loose('fonds') })
  if (loose('insolite').length) groups.push({ key: 'insolite', title: 'Hors du commun', hint: 'Des visiteurs inattendus dans ton aquarium.', items: loose('insolite') })
  for (const s of series) {
    const list = items.filter((i) => i.series === s.id && !i.season)
    if (list.length) groups.push({ key: `series-${s.id}`, title: s.name, items: list, series: { reward: s.reward } })
  }
  const vitrine = items.filter((i) => i.season && owned.has(i.id) && !open(i))
  const soon = [...new Set(items.filter((i) => i.season && !open(i)).map((i) => i.season!))]
    .map((s) => ({ s, days: daysUntilSeason(s, today), n: items.filter((i) => i.season === s).length }))
    .filter((x) => x.days !== null)

  const card = (it: ShopItem) => {
    const mine = owned.has(it.id)
    const tooHigh = fish.level < it.min_level
    return (
      <div key={it.id} className={`shop-item${mine ? ' equipped' : tooHigh ? ' locked' : ''}`}>
        <div className="preview"><DecoPreview id={it.id} /></div>
        <span className="name">{it.name}</span>
        {mine ? <button type="button" className="btn small" disabled>À toi</button>
          : tooHigh ? <button type="button" className="btn small" disabled>Niveau {it.min_level}</button>
            : <button type="button" className="btn small primary" disabled={coins < it.price} onClick={() => buy(it)}><Coin size={12} />{it.price}</button>}
        {partner && !partnerOwned.has(it.id) && (mine || open(it)) && (
          <button type="button" className="btn small ghost" onClick={() => setGift({ item: it, owned: mine })}>Offrir</button>
        )}
      </div>
    )
  }

  return (
    <section aria-label="Décorations de mon aquarium" className="stack">
      <h2 className="h2">Décorations de mon aquarium</h2>
      <span className="small">Payées avec tes pièces et posées sur {OWN_SLOTS} emplacements. Elles te suivent au grand aquarium.</span>
      {soon.map((x) => (
        <div key={x.s} className="card pad cream">
          <span className="h2" style={{ fontSize: 14 }}>{SEASON_NAME[x.s] ?? x.s} arrive dans {x.days} jour{x.days! > 1 ? 's' : ''}</span>
          <span className="small" style={{ color: 'var(--cream-ink)' }}>{x.n} objets de saison, à acheter du 1er au 25 décembre.</span>
        </div>
      ))}
      {groups.map((g) => {
        const have = g.items.filter((i) => owned.has(i.id)).length
        return (
          <div key={g.key} className="stack" style={{ gap: 8 }}>
            <div className="row-between" style={{ alignItems: 'baseline' }}>
              <h3 className="h3" style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{g.title}</h3>
              {g.series && <span className="small" style={{ fontWeight: 800 }}>{have === g.items.length ? 'Collection complète' : `${have} / ${g.items.length}, bonus ${g.series.reward} pièces`}</span>}
            </div>
            {g.hint && <span className="small">{g.hint}</span>}
            <div className="shop-grid">{g.items.map(card)}</div>
          </div>
        )
      })}
      {vitrine.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <h3 className="h3" style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Vitrine des souvenirs</h3>
          <div className="shop-grid">
            {vitrine.map((it) => (
              <div key={it.id} className="shop-item equipped">
                <div className="preview"><DecoPreview id={it.id} /></div>
                <span className="name">{it.name}</span>
                <span className="small">Saison passée</span>
                {partner && !partnerOwned.has(it.id) && (
                  <button type="button" className="btn small ghost" onClick={() => setGift({ item: it, owned: true })}>Offrir</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {gift && <GiftSheet item={gift.item} owned={gift.owned} onClose={() => setGift(null)} />}
      {partner && <span className="small">Offre un objet à {partnerName}, acheté ou déjà à toi : il lui arrive tout de suite, avec un petit mot si tu veux.</span>}
    </section>
  )
}
