import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import type { FishColor } from '../lib/types'
import { Fish, PALETTES } from '../components/Fish'
import { Icon } from '../components/ui'

export function Settings({ onBack }: { onBack: () => void }) {
  const { me, partner, couple, force, run, reload, partnerName } = useStore()
  const [fishName, setFishName] = useState(me?.fish_name || '')
  const [color, setColor] = useState<FishColor>(me?.fish_color || 'corail')
  const [displayName, setDisplayName] = useState(me?.display_name || '')
  const [nick, setNick] = useState(me?.partner_nickname || '')
  const [newForce, setNewForce] = useState('')
  if (!me) return null

  const dirty = fishName !== me.fish_name || color !== me.fish_color || displayName !== me.display_name || nick !== (me.partner_nickname || '')

  const save = async () => {
    if (!fishName.trim()) return
    const ok = await run(() => supabase.from('profiles').update({
      fish_name: fishName.trim(),
      fish_color: color,
      display_name: displayName.trim(),
      partner_nickname: nick.trim() || null,
    }).eq('id', me.id), 'Enregistré')
    if (ok) await reload(['profiles'])
  }

  const addForce = async () => {
    const body = newForce.trim()
    if (!body) return
    const position = (force.at(-1)?.position || 0) + 1
    if (await run(() => supabase.from('force_messages').insert({ profile_id: me.id, body, position }))) {
      setNewForce('')
      await reload(['force'])
    }
  }

  const removeForce = async (id: string) => {
    if (await run(() => supabase.from('force_messages').delete().eq('id', id))) await reload(['force'])
  }

  return (
    <div className="screen no-tabs">
      <header className="head-row">
        <button type="button" className="icon-btn" aria-label="Retour" onClick={onBack}><Icon name="back" /></button>
        <h1 className="title" style={{ fontSize: 15 }}>Paramètres</h1>
      </header>

      <section aria-label="Mon poisson" className="card pad stack" style={{ gap: 14 }}>
        <h2 className="h2">Mon poisson</h2>
        <div style={{ height: 96, background: 'var(--water)', border: '2px solid var(--ink)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Fish color={color} width={90} label={`Aperçu de ${fishName || 'ton poisson'}`} />
        </div>
        <div className="field">
          <label htmlFor="fish-name">Surnom du poisson</label>
          <input id="fish-name" className="input" value={fishName} maxLength={24} onChange={(e) => setFishName(e.target.value)} />
        </div>
        <div className="field">
          <span className="label" id="color-label">Couleur</span>
          <div role="radiogroup" aria-labelledby="color-label" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {(Object.keys(PALETTES) as FishColor[]).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={PALETTES[c].label}
                onClick={() => setColor(c)}
                style={{
                  width: 44, height: 44, padding: 0, borderRadius: 10, background: PALETTES[c].b,
                  border: color === c ? '3px solid var(--ink)' : '2px solid var(--ink)',
                  boxShadow: color === c ? '0 0 0 3px #fff, 0 0 0 5px var(--ink)' : undefined,
                }}
              />
            ))}
          </div>
          <span className="small">D’autres couleurs arriveront dans la boutique.</span>
        </div>
      </section>

      <section aria-label="Surnoms" className="card pad stack">
        <h2 className="h2">Surnoms</h2>
        <div className="field">
          <label htmlFor="my-name">Mon surnom{partner ? `, vu par ${partner.display_name || 'mon duo'}` : ''}</label>
          <input id="my-name" className="input" value={displayName} maxLength={40} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        {partner && (
          <div className="field">
            <label htmlFor="nick">Le surnom que je donne à {partner.display_name || 'mon duo'}</label>
            <input id="nick" className="input" value={nick} maxLength={40} placeholder={partner.display_name} onChange={(e) => setNick(e.target.value)} />
          </div>
        )}
      </section>

      <button type="button" className="btn primary block" disabled={!dirty || !fishName.trim()} onClick={save}>Enregistrer</button>

      <section aria-label="Messages de force" className="card pad stack">
        <div className="stack" style={{ gap: 4 }}>
          <h2 className="h2">Messages de force</h2>
          <span className="small">Proposés en un tap dans Petits mots.</span>
        </div>
        <ul className="list stack" style={{ gap: 8 }}>
          {force.map((f) => (
            <li key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 0 12px', minHeight: 44, background: 'var(--bg)', borderRadius: 10 }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{f.body}</span>
              <button type="button" className="btn small ghost" aria-label={`Supprimer ${f.body}`} onClick={() => removeForce(f.id)}><Icon name="close" size={18} /></button>
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', gap: 8 }}>
          <label htmlFor="new-force" className="sr-only">Nouveau message de force</label>
          <input id="new-force" className="input" style={{ flex: 1, minWidth: 0 }} value={newForce} maxLength={80} placeholder="Nouveau message…"
            onChange={(e) => setNewForce(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addForce() }} />
          <button type="button" className="btn primary" disabled={!newForce.trim()} onClick={addForce}>Ajouter</button>
        </div>
      </section>

      <section aria-label="Notre duo" className="card pad stack">
        <h2 className="h2">Notre duo</h2>
        {partner ? (
          <span style={{ fontSize: 14, fontWeight: 600 }}>Tu es en duo avec {partnerName}.</span>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            Code à donner pour rejoindre ton duo : <strong style={{ fontFamily: 'var(--pixel)', fontSize: 13 }}>{couple?.invite_code}</strong>
          </span>
        )}
        <span className="small">Connecté avec {me.email}</span>
        <button type="button" className="btn" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
      </section>
    </div>
  )
}
