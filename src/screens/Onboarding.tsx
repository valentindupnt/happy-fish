import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { Fish } from '../components/Fish'

export function Onboarding() {
  const { run, reloadAll, me } = useStore()
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'choose' | 'join'>('choose')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const create = async () => {
    if (!name.trim()) return setError('Dis-nous ton prénom')
    setBusy(true)
    const ok = await run(() => supabase.rpc('create_couple', { p_display_name: name.trim() }), 'Duo créé')
    setBusy(false)
    if (ok) await reloadAll()
  }

  const join = async () => {
    if (!name.trim()) return setError('Dis-nous ton prénom')
    if (code.trim().length < 6) return setError('Le code fait 6 caractères')
    setBusy(true)
    const ok = await run(() => supabase.rpc('join_couple', { p_code: code.trim(), p_display_name: name.trim() }), 'Bienvenue dans votre duo')
    setBusy(false)
    if (ok) await reloadAll()
  }

  return (
    <div className="screen no-tabs" style={{ justifyContent: 'center', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
        <Fish color="corail" width={64} />
        <Fish color="rose" width={64} flip />
      </div>
      <h1 className="title" style={{ textAlign: 'center' }}>Bienvenue</h1>

      <div className="card pad stack" style={{ gap: 14 }}>
        <div className="field">
          <label htmlFor="name">Ton prénom</label>
          <input id="name" className="input" value={name} maxLength={40} autoComplete="given-name" onChange={(e) => { setName(e.target.value); setError('') }} />
        </div>

        {mode === 'choose' ? (
          <>
            <button type="button" className="btn primary block" disabled={busy} onClick={create}>Créer notre duo</button>
            <button type="button" className="btn block" disabled={busy} onClick={() => setMode('join')}>J’ai un code de mon duo</button>
            <span className="small">Le premier crée le duo et reçoit un code à 6 caractères. Le second le saisit ici.</span>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="invite">Code du duo</label>
              <input id="invite" className="input" value={code} maxLength={6} autoCapitalize="characters"
                style={{ fontFamily: 'var(--pixel)', fontSize: 16, letterSpacing: 4, textAlign: 'center', textTransform: 'uppercase' }}
                onChange={(e) => { setCode(e.target.value); setError('') }} />
            </div>
            <button type="button" className="btn primary block" disabled={busy} onClick={join}>Rejoindre</button>
            <button type="button" className="btn small ghost" onClick={() => setMode('choose')}>Retour</button>
          </>
        )}
        {error && <p role="alert" style={{ margin: 0, color: '#A3201A', fontSize: 13, fontWeight: 700 }}>{error}</p>}
      </div>
      <span className="small" style={{ textAlign: 'center' }}>Connecté avec {me?.email}</span>
    </div>
  )
}
