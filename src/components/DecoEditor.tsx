import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { COMMON_SLOTS, OWN_SLOTS, slotsOf } from '../lib/deco'
import type { DecoPlace } from '../lib/deco'
import type { ShopItem } from '../lib/types'
import { DecoPreview } from './Deco'
import { GiftSheet } from './Gifts'
import { Sheet } from './ui'

/** Poser les décorations de son aquarium (5 emplacements) ou de l'aquarium commun (4 par personne) */
export function DecoEditor({ place, openShop }: { place: DecoPlace; openShop: () => void }) {
  const { me, partner, partnerName, shopItems, purchases, decoSlots, userId, fishOf, run, reload } = useStore()
  const [slot, setSlot] = useState<number | null>(null)
  const [gift, setGift] = useState<ShopItem | null>(null)
  if (!me) return null
  const decos = shopItems.filter((i) => i.kind === 'deco')
  if (!decos.length) return null // base pas encore migrée
  const mine = slotsOf(decoSlots, userId, place)
  const theirs = slotsOf(decoSlots, partner?.id, place)
  const owned = new Set(purchases.filter((p) => p.profile_id === userId).map((p) => p.item_id))
  const partnerOwned = new Set(purchases.filter((p) => p.profile_id === partner?.id).map((p) => p.item_id))
  const myItems = decos.filter((i) => owned.has(i.id)).sort((a, b) => a.position - b.position)
  const level = fishOf(userId).level
  const nameOf = (id: string) => decos.find((i) => i.id === id)?.name ?? ''
  const where = (id: string): string => {
    const own = slotsOf(decoSlots, userId, 'own').includes(id)
    const common = slotsOf(decoSlots, userId, 'common').includes(id)
    if (place === 'own' && common) return 'dans le commun'
    if (place === 'common' && own) return 'dans ton aquarium'
    return ''
  }

  const set = async (n: number, item: string | null, label?: string) => {
    const ok = await run(() => supabase.rpc('set_deco', { p_place: place, p_slot: n, p_item: item }), label)
    if (ok) {
      await reload(['deco'])
      setSlot(null)
    }
  }

  const title = place === 'own' ? 'Ma déco' : 'Le décor commun'
  const total = place === 'own' ? OWN_SLOTS : COMMON_SLOTS
  const current = slot !== null ? mine[slot] : null

  return (
    <section aria-label={title} className="card pad stack" style={{ gap: 10 }}>
      <div className="row-between" style={{ alignItems: 'center' }}>
        <h2 className="h2" style={{ fontSize: 15 }}>{title}</h2>
        <span className="small" style={{ fontWeight: 800 }}>{mine.filter(Boolean).length} / {total}</span>
      </div>
      <div className="deco-picks" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
        {mine.map((id, i) => (
          <button key={i} type="button" className={id ? 'deco-pick full' : 'deco-pick'} aria-label={id ? `Emplacement ${i + 1} : ${nameOf(id)}` : `Emplacement ${i + 1}, vide`} onClick={() => setSlot(i)}>
            {id ? <DecoPreview id={id} /> : <span aria-hidden="true">+</span>}
          </button>
        ))}
      </div>
      {place === 'common' && partner && theirs.some(Boolean) && (
        <span className="small">{partnerName} a posé : {theirs.filter((x): x is string => Boolean(x)).map(nameOf).join(', ')}.</span>
      )}
      <span className="small">
        {place === 'own'
          ? 'Touche un emplacement pour poser, changer ou offrir un objet. Au grand aquarium, ta déco te suit.'
          : 'Chacun pose jusqu’à 4 objets pris dans sa collection : ils quittent alors son propre aquarium.'}
      </span>

      {slot !== null && (
        <Sheet title={`Emplacement ${slot + 1}`} onClose={() => setSlot(null)}>
          <div className="stack" style={{ gap: 12 }}>
            {myItems.length === 0 ? (
              <>
                <span className="small">Tu n’as pas encore de décoration. La boutique en propose pour 5 pièces et plus.</span>
                <button type="button" className="btn primary" onClick={() => { setSlot(null); openShop() }}>Aller à la boutique</button>
              </>
            ) : (
              <div className="shop-grid">
                {myItems.map((it) => {
                  const tooHigh = level < it.min_level
                  const here = current === it.id
                  return (
                    <div key={it.id} className="stack" style={{ gap: 4 }}>
                      <button type="button" className={`shop-item pick${here ? ' equipped' : ''}${tooHigh ? ' locked' : ''}`} disabled={tooHigh}
                        onClick={() => set(slot, it.id, `${it.name} posé`)}>
                        <div className="preview"><DecoPreview id={it.id} /></div>
                        <span className="name">{it.name}</span>
                        <span className="small">{tooHigh ? `Niveau ${it.min_level}` : here ? 'Ici' : where(it.id)}</span>
                      </button>
                      {partner && !partnerOwned.has(it.id) && (
                        <button type="button" className="btn small ghost" onClick={() => { setSlot(null); setGift(it) }}>Offrir à {partnerName}</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {current && <button type="button" className="btn" onClick={() => set(slot, null, 'Retiré')}>Retirer cet objet</button>}
          </div>
        </Sheet>
      )}
      {gift && <GiftSheet item={gift} owned onClose={() => setGift(null)} />}
    </section>
  )
}
