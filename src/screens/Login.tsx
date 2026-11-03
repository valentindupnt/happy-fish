import { useState } from 'react'
import { supabase, errorText } from '../lib/supabase'
import { Fish } from '../components/Fish'

function readable(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'E-mail ou mot de passe incorrect'
  if (/already registered|already exists/i.test(message)) return 'Ce compte existe déjà : choisis « Me connecter »'
  if (/signups? not allowed|signup is disabled/i.test(message)) return 'Les inscriptions sont fermées. Connecte-toi avec ton compte existant.'
  if (/password should be at least/i.test(message)) return 'Le mot de passe doit faire au moins 8 caractères'
  if (/email not confirmed/i.test(message)) return 'Compte pas encore confirmé : il faut désactiver « Confirm email » dans Supabase (voir GUIDE.md)'
  return message
}

export function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const submit = async () => {
    const e = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(e)) return setError('Entre une adresse e-mail valide')
    if (password.length < 8) return setError('Le mot de passe doit faire au moins 8 caractères')
    setBusy(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: e, password })
        if (error) setError(readable(error.message))
      } else {
        const { data, error } = await supabase.auth.signUp({ email: e, password })
        if (error) setError(readable(error.message))
        else if (!data.session) setInfo('Compte créé, mais Supabase demande une confirmation par e-mail. Désactive « Confirm email » dans Supabase (voir GUIDE.md), puis connecte-toi.')
      }
    } catch (err) {
      setError(errorText(err))
    }
    setBusy(false)
  }

  return (
    <div className="screen no-tabs" style={{ justifyContent: 'center', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 120, height: 90, background: 'var(--water)', border: '2px solid var(--ink)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Fish color="corail" width={80} />
        </div>
        <h1 className="title" style={{ fontSize: 20 }}>Happy Fish</h1>
        <p className="kicker" style={{ textAlign: 'center' }}>Vos objectifs à deux, et vos poissons qui grandissent.</p>
      </div>

      <div className="card pad stack" style={{ gap: 14 }}>
        <div className="seg" role="group" aria-label="Connexion ou création de compte">
          <button type="button" aria-pressed={mode === 'signin'} onClick={() => { setMode('signin'); setError(''); setInfo('') }}>Me connecter</button>
          <button type="button" aria-pressed={mode === 'signup'} onClick={() => { setMode('signup'); setError(''); setInfo('') }}>Créer mon compte</button>
        </div>
        <div className="field">
          <label htmlFor="email">Ton adresse e-mail</label>
          <input id="email" className="input" type="email" inputMode="email" autoComplete="email" value={email}
            onChange={(e) => { setEmail(e.target.value); setError('') }} />
        </div>
        <div className="field">
          <label htmlFor="password">Mot de passe{mode === 'signup' ? ' (8 caractères minimum)' : ''}</label>
          <input id="password" className="input" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
        </div>
        <button type="button" className="btn primary block" disabled={busy} onClick={submit}>
          {busy ? 'Un instant…' : mode === 'signin' ? 'Me connecter' : 'Créer mon compte'}
        </button>
        <span className="small">Tu te connectes une fois par appareil, l’app s’en souvient ensuite.</span>
        {error && <p role="alert" style={{ margin: 0, color: '#A3201A', fontSize: 13, fontWeight: 700 }}>{error}</p>}
        {info && <p role="status" style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{info}</p>}
      </div>
    </div>
  )
}
