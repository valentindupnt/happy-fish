import { useEffect, useState } from 'react'
import { supabase, errorText } from '../lib/supabase'
import { useStore } from '../lib/store'
import type { FishColor, Profile } from '../lib/types'
import { FREE_COLORS, Fish, PALETTES } from '../components/Fish'
import { Icon, Switch } from '../components/ui'
import { disablePush, enablePush, pushState, sendTestPush } from '../lib/push'
import type { PushState } from '../lib/push'
import { widgetScript } from '../lib/widgetScript'

export function Settings({ onBack, openShop }: { onBack: () => void; openShop: () => void }) {
  const { me, partner, couple, force, run, reload, partnerName, purchases } = useStore()
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
          <Fish color={color} hat={me.fish_hat} width={90} label={`Aperçu de ${fishName || 'ton poisson'}`} />
        </div>
        <div className="field">
          <label htmlFor="fish-name">Surnom du poisson</label>
          <input id="fish-name" className="input" value={fishName} maxLength={24} onChange={(e) => setFishName(e.target.value)} />
        </div>
        <div className="field">
          <span className="label" id="color-label">Couleur</span>
          <div role="radiogroup" aria-labelledby="color-label" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {(Object.keys(PALETTES) as FishColor[]).filter((c) => FREE_COLORS.includes(c) || purchases.some((p) => p.profile_id === me.id && p.item_id === c)).map((c) => (
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
          <span className="small">D’autres couleurs, des habits et des familiers t’attendent dans la <button type="button" className="btn small ghost" style={{ padding: 0, minHeight: 0, textDecoration: 'underline' }} onClick={openShop}>boutique</button>.</span>
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

      <Notifications me={me} partnerLabel={partner ? partnerName : 'ton duo'} />

      <WidgetSetup />

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
        <PasswordChange />
        <button type="button" className="btn" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
      </section>
    </div>
  )
}

function PasswordChange() {
  const { toast } = useStore()
  const [open, setOpen] = useState(false)
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!open) return <button type="button" className="btn" onClick={() => setOpen(true)}>Changer mon mot de passe</button>

  const save = async () => {
    if (pwd.length < 8) return setError('Choisis au moins 8 caractères')
    if (pwd !== pwd2) return setError('Les deux mots de passe ne sont pas identiques')
    setBusy(true)
    const { error: e } = await supabase.auth.updateUser({ password: pwd })
    setBusy(false)
    if (e) {
      setError(/different from the old/i.test(e.message) ? 'C’est déjà ton mot de passe actuel' : errorText(e))
      return
    }
    toast('Mot de passe changé')
    setOpen(false); setPwd(''); setPwd2(''); setError('')
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="field">
        <label htmlFor="pwd-new">Nouveau mot de passe</label>
        <input id="pwd-new" className="input" type="password" autoComplete="new-password" value={pwd} onChange={(e) => { setPwd(e.target.value); setError('') }} />
      </div>
      <div className="field">
        <label htmlFor="pwd-new2">Encore une fois</label>
        <input id="pwd-new2" className="input" type="password" autoComplete="new-password" value={pwd2} onChange={(e) => { setPwd2(e.target.value); setError('') }} />
      </div>
      {error && <p role="alert" style={{ margin: 0, color: '#A3201A', fontSize: 13, fontWeight: 700 }}>{error}</p>}
      <div className="wrap">
        <button type="button" className="btn primary" disabled={busy} onClick={save}>Enregistrer</button>
        <button type="button" className="btn" onClick={() => { setOpen(false); setError('') }}>Annuler</button>
      </div>
    </div>
  )
}

function Notifications({ me, partnerLabel }: { me: Profile; partnerLabel: string }) {
  const { run, reload, toast } = useStore()
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { pushState().then(setState).catch(() => setState('unsupported')) }, [])

  const enable = async () => {
    setBusy(true)
    try {
      const next = await enablePush(me.id)
      setState(next)
      if (next === 'on') toast('Notifications activées sur cet appareil')
    } catch (e) {
      toast(errorText(e), 'error')
    }
    setBusy(false)
  }

  const test = async () => {
    setBusy(true)
    try {
      const sent = await sendTestPush()
      toast(sent ? 'Notification de test envoyée' : 'Aucun appareil enregistré', sent ? 'info' : 'error')
    } catch (e) {
      toast(errorText(e), 'error')
    }
    setBusy(false)
  }

  const off = async () => {
    setBusy(true)
    try { await disablePush(); setState('off') } catch (e) { toast(errorText(e), 'error') }
    setBusy(false)
  }

  const pref = async (col: keyof Profile, value: boolean) => {
    if (await run(() => supabase.from('profiles').update({ [col]: value }).eq('id', me.id))) await reload(['profiles'])
  }

  return (
    <section aria-label="Notifications" className="card pad stack">
      <h2 className="h2">Notifications</h2>
      {state === 'needs-install' && (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          Sur iPhone, ajoute d’abord l’app à l’écran d’accueil (Safari, Partager, Sur l’écran d’accueil), puis ouvre-la depuis son icône pour activer les notifications.
        </span>
      )}
      {state === 'unsupported' && <span style={{ fontSize: 14, fontWeight: 600 }}>Ce navigateur ne gère pas les notifications.</span>}
      {state === 'denied' && (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          Les notifications sont refusées pour cette app. Réactive-les dans les Réglages de l’iPhone, puis Notifications, puis Happy Fish.
        </span>
      )}
      {state === 'off' && <button type="button" className="btn primary" disabled={busy} onClick={enable}>Activer les notifications sur cet appareil</button>}
      {state === 'on' && (
        <div className="wrap" style={{ alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--green-ink)' }}>Activées sur cet appareil</span>
          <button type="button" className="btn small" disabled={busy} onClick={test}>Envoyer un test</button>
          <button type="button" className="btn small ghost" disabled={busy} onClick={off}>Désactiver</button>
        </div>
      )}
      <div>
        <Switch checked={me.notify_messages} onChange={(v) => pref('notify_messages', v)} label={`Petits mots de ${partnerLabel}`} />
        <Switch checked={me.notify_gestures} onChange={(v) => pref('notify_gestures', v)} label="Bulles et friandises" />
        <Switch checked={me.notify_checks} onChange={(v) => pref('notify_checks', v)} label={`Quand ${partnerLabel} coche un objectif`} />
        <Switch checked={me.notify_evening} onChange={(v) => pref('notify_evening', v)} label="Rappel du soir, vers 20 h" />
        <Switch checked={me.notify_weekly} onChange={(v) => pref('notify_weekly', v)} label="Bilan du lundi matin" />
      </div>
    </section>
  )
}

function WidgetSetup() {
  const { run, toast } = useStore()
  const [token, setToken] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Le jeton est chargé à l'avance : sur iPhone, la copie doit se faire tout de suite après le toucher
  useEffect(() => {
    if (!open || token) return
    supabase.rpc('my_widget_token').then(({ data, error }) => {
      if (error) toast(errorText(error), 'error')
      else setToken(data as string)
    })
  }, [open, token, toast])

  const copy = async () => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(widgetScript(token))
      setCopied(true)
      toast('Script copié')
    } catch {
      toast('Copie impossible ici, réessaie depuis l’app installée', 'error')
    }
  }

  const reset = async () => {
    let next: string | null = null
    const ok = await run(async () => {
      const r = await supabase.rpc('reset_widget_token')
      next = r.data as string
      return r
    }, 'Nouveau script prêt, l’ancien widget ne marche plus')
    if (ok && next) { setToken(next); setCopied(false) }
  }

  return (
    <section aria-label="Widget iPhone" className="card pad stack">
      <h2 className="h2">Widget sur l’écran d’accueil</h2>
      <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.45 }}>
        Vos deux bocaux et l’avancement du jour, directement sur l’écran d’accueil, grâce à l’app gratuite Scriptable.
      </span>
      {!open ? (
        <button type="button" className="btn" onClick={() => setOpen(true)}>Installer le widget</button>
      ) : (
        <>
          <ol className="steps">
            <li>Installe <strong>Scriptable</strong> depuis l’App Store (gratuite).</li>
            <li>Touche <strong>Copier le script</strong> ci-dessous.</li>
            <li>Dans Scriptable, touche <strong>+</strong>, colle le script, puis nomme-le « Happy Fish » en haut.</li>
            <li>Sur l’écran d’accueil, appuie longuement, touche <strong>Modifier</strong> puis <strong>Ajouter un widget</strong>, choisis <strong>Scriptable</strong> en taille moyenne.</li>
            <li>Appuie sur le widget ajouté, <strong>Modifier le widget</strong>, et choisis le script « Happy Fish ».</li>
          </ol>
          <button type="button" className="btn primary" disabled={!token} onClick={copy}>{copied ? 'Copié, recopier' : token ? 'Copier le script' : 'Préparation…'}</button>
          <span className="small">Le script contient ta clé personnelle : ne le partage pas. Si tu l’as envoyé par erreur, change la clé.</span>
          <button type="button" className="btn small ghost" onClick={reset}>Changer la clé du widget</button>
        </>
      )}
    </section>
  )
}
