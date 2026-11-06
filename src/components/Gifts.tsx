import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import type { ShopItem } from '../lib/types'
import { ItemPreview } from './Fish'
import { Coin, Sheet } from './ui'

/**
 * Offrir un objet à l'autre, avec un petit mot facultatif.
 * Par défaut il est payé avec ses pièces ; avec `owned`, c'est un objet de son inventaire :
 * il quitte son poisson ou son aquarium et passe à l'autre, sans pièce échangée.
 */
export function GiftSheet({ item, owned = false, onClose }: { item: ShopItem; owned?: boolean; onClose: () => void }) {
  const { me, partnerName, fishOf, userId, run, reload } = useStore()
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  if (!me) return null
  const coins = fishOf(userId).coins ?? 0
  const send = async () => {
    setBusy(true)
    const call = owned
      ? () => supabase.rpc('transfer_item', { p_item: item.id, p_message: msg.trim() || null })
      : () => supabase.rpc('gift_item', { p_item: item.id, p_message: msg.trim() || null })
    const ok = await run(call, `${item.name} offert à ${partnerName}`)
    setBusy(false)
    if (ok) {
      await reload(['shop', 'fish', 'deco', 'profiles'])
      onClose()
    }
  }
  return (
    <Sheet title={`Offrir à ${partnerName}`} onClose={onClose}>
      <div className="stack" style={{ gap: 14 }}>
        <div className="arrival">
          <div className="arrival-pic"><ItemPreview kind={item.kind} id={item.id} color={me.fish_color} /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="h2" style={{ fontSize: 16 }}>{item.name}</span>
            <span className="small">
              {owned && 'Il quitte ton inventaire et passe à ton duo, sans pièce échangée. '}
              {item.min_level > 1 ? `À partir du niveau ${item.min_level} : s’il n’y est pas encore, le cadeau l’attend en réserve.` : 'Il arrive tout de suite chez lui ou elle.'}
            </span>
          </div>
        </div>
        <label className="stack" style={{ gap: 6 }}>
          <span className="small" style={{ fontWeight: 800 }}>Un petit mot (facultatif)</span>
          <textarea className="textarea" rows={2} maxLength={140} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Pour toi, parce que…" />
        </label>
        {owned ? (
          <button type="button" className="btn primary" disabled={busy} onClick={send}>Offrir {item.name}</button>
        ) : (
          <>
            <button type="button" className="btn primary" disabled={busy || coins < item.price} onClick={send}>
              Offrir pour <Coin size={12} /> {item.price}
            </button>
            {coins < item.price && <span className="small">Il te manque {item.price - coins} pièces.</span>}
          </>
        )}
      </div>
    </Sheet>
  )
}

const seenKey = (u: string) => `hf-seen-gifts-${u}`
function readSeen(u: string): string[] {
  try { return JSON.parse(window.localStorage.getItem(seenKey(u)) || '[]') as string[] } catch { return [] }
}
function writeSeen(u: string, ids: string[]) {
  try { window.localStorage.setItem(seenKey(u), JSON.stringify(ids.slice(-100))) } catch { /* rien */ }
}

/** « Julie t'a offert un phare » : s'affiche une fois pour chaque cadeau reçu (de moins de 7 jours) */
export function GiftArrival({ onOpenShop }: { onOpenShop: () => void }) {
  const { gifts, shopItems, userId, partnerName, me } = useStore()
  const [seen, setSeen] = useState<string[]>(() => readSeen(userId))
  if (!me) return null
  const fresh = gifts.filter((g) => g.to_id === userId && !seen.includes(g.id) && Date.now() - new Date(g.created_at).getTime() < 7 * 24 * 3600 * 1000)
  const list = fresh.map((g) => ({ g, it: shopItems.find((i) => i.id === g.item_id) })).filter((x): x is { g: typeof fresh[number]; it: ShopItem } => !!x.it)
  if (!list.length) return null
  const close = () => {
    const next = [...seen, ...fresh.map((g) => g.id)]
    setSeen(next)
    writeSeen(userId, next)
  }
  return (
    <Sheet title={list.length === 1 ? 'Un cadeau pour toi' : `${list.length} cadeaux pour toi`} onClose={close}>
      <div className="stack" style={{ gap: 14 }}>
        {list.map(({ g, it }) => (
          <div key={g.id} className="arrival">
            <div className="arrival-pic"><ItemPreview kind={it.kind} id={it.id} color={me.fish_color} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="h2" style={{ fontSize: 16 }}>{partnerName} t’a offert : {it.name}</span>
              {g.message && <span className="small" style={{ fontStyle: 'italic' }}>« {g.message} »</span>}
              {it.min_level > 1 && <span className="small">Disponible dès le niveau {it.min_level}.</span>}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" style={{ flex: 1 }} onClick={close}>Merci !</button>
          <button type="button" className="btn primary" style={{ flex: 1 }} onClick={() => { close(); onOpenShop() }}>Voir la boutique</button>
        </div>
      </div>
    </Sheet>
  )
}
