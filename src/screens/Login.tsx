import { useState } from 'react'
import { supabase, errorText } from '../lib/supabase'
import { Fish } from '../components/Fish'

export function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const sendCode = async () => {
    const e = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(e)) return setError('Entre une adresse e-mail valide')
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({ email: e, options: { shouldCreateUser: true } })
    setBusy(false)
    if (error) return setError(errorText(error))
    setStep('code')
  }

  const verify = async () => {
    const token = code.replace(/\D/g, '')
    if (token.length < 6) return setError('Le code fait 6 chiffres ou plus')
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'email' })
    setBusy(false)
    if (error) setError(/expired|invalid/i.test(error.message) ? 'Code incorrect ou expiré, demande un nouveau code' : errorText(error))
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
        {step === 'email' ? (
          <>
            <div className="field">
              <label htmlFor="email">Ton adresse e-mail</label>
              <input id="email" className="input" type="email" inputMode="email" autoComplete="email" value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }} onKeyDown={(e) => { if (e.key === 'Enter') sendCode() }} />
            </div>
            <button type="button" className="btn primary block" disabled={busy} onClick={sendCode}>{busy ? 'Envoi…' : 'Recevoir mon code'}</button>
            <span className="small">Pas de mot de passe : tu reçois un code par e-mail, à taper ici. Tu restes ensuite connecté.</span>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="code">Code reçu par e-mail</label>
              <input id="code" className="input" inputMode="numeric" autoComplete="one-time-code" value={code}
                style={{ fontFamily: 'var(--pixel)', fontSize: 18, letterSpacing: 4, textAlign: 'center' }}
                onChange={(e) => { setCode(e.target.value); setError('') }} onKeyDown={(e) => { if (e.key === 'Enter') verify() }} />
            </div>
            <button type="button" className="btn primary block" disabled={busy} onClick={verify}>{busy ? 'Vérification…' : 'Me connecter'}</button>
            <span className="small">Envoyé à {email}. Pense à regarder dans les spams.</span>
            <button type="button" className="btn small ghost" onClick={() => { setStep('email'); setCode('') }}>Changer d’adresse ou renvoyer un code</button>
          </>
        )}
        {error && <p role="alert" style={{ margin: 0, color: '#A3201A', fontSize: 13, fontWeight: 700 }}>{error}</p>}
      </div>
    </div>
  )
}
