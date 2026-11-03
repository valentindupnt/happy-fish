import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { configured, supabase } from './lib/supabase'
import { StoreProvider, useStore } from './lib/store'
import { dateOfTimestamp } from './lib/dates'
import type { Task } from './lib/types'
import { Login } from './screens/Login'
import { Onboarding } from './screens/Onboarding'
import { Today } from './screens/Today'
import { Week } from './screens/Week'
import { Together } from './screens/Together'
import { Chat } from './screens/Chat'
import { Aquarium } from './screens/Aquarium'
import { Settings } from './screens/Settings'
import { Shop } from './screens/Shop'
import { AddGoal } from './components/AddGoal'
import type { AddGoalInit } from './components/AddGoal'
import { TaskSheet } from './components/TaskSheet'
import { Fish } from './components/Fish'
import { Icon, Toasts } from './components/ui'

type Tab = 'today' | 'together' | 'chat' | 'aquarium'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!configured) {
    return (
      <div className="app"><div className="scroll"><div className="screen no-tabs" style={{ justifyContent: 'center' }}>
        <div className="card pad stack">
          <h1 className="h2">Configuration manquante</h1>
          <p style={{ margin: 0, fontSize: 14 }}>L’adresse et la clé publique de Supabase ne sont pas renseignées. Voir GUIDE.md, étape Supabase.</p>
        </div>
      </div></div></div>
    )
  }
  if (session === undefined) return <Splash />
  if (!session) return <div className="app"><div className="scroll"><Login /></div></div>

  return (
    <StoreProvider key={session.user.id} userId={session.user.id}>
      <div className="app"><Main /><Toasts /></div>
    </StoreProvider>
  )
}

function Splash() {
  return (
    <div className="app"><div className="screen no-tabs" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <Fish color="corail" width={72} label="Chargement" />
    </div></div>
  )
}

function Main() {
  const { loading, me, messages, userId, today } = useStore()
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(window.location.search).get('tab') === 'chat' ? 'chat' : 'today'))
  const [view, setView] = useState<'tabs' | 'week' | 'settings' | 'shop'>('tabs')
  const [adding, setAdding] = useState<AddGoalInit | null>(null)
  const [openTaskItem, setOpenTaskItem] = useState<Task | null>(null)
  const [chatRef, setChatRef] = useState<string | null>(null)
  const [seenChat, setSeenChat] = useState(() => localStorageGet('hf-seen-chat'))
  const scrollRef = useRef<HTMLDivElement>(null)

  const openTask = useCallback((t: Task) => setOpenTaskItem(t), [])
  const openAdd = useCallback((day: string) => setAdding({ day }), [])

  useEffect(() => { scrollRef.current?.scrollTo(0, 0) }, [tab, view])
  // Clic sur une notification alors que l'app est déjà ouverte
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'open' && String(e.data.url).includes('tab=chat')) { setTab('chat'); setView('tabs') }
    }
    navigator.serviceWorker.addEventListener('message', onMsg)
    return () => navigator.serviceWorker.removeEventListener('message', onMsg)
  }, [])
  useEffect(() => {
    if (tab === 'chat' && view === 'tabs' && messages.length) {
      const last = messages[messages.length - 1].created_at
      setSeenChat(last)
      localStorageSet('hf-seen-chat', last)
    }
  }, [tab, view, messages])

  if (loading) return <Splash />
  if (!me?.couple_id) return <div className="scroll"><Onboarding /></div>

  const unread = messages.filter((m) => m.author_id !== userId && m.created_at > (seenChat || '') && dateOfTimestamp(m.created_at) >= addDaysSafe(today)).length

  let content
  if (view === 'week') content = <Week onBack={() => setView('tabs')} openTask={openTask} openAdd={openAdd} />
  else if (view === 'settings') content = <Settings onBack={() => setView('tabs')} openShop={() => setView('shop')} />
  else if (view === 'shop') content = <Shop onBack={() => { setTab('aquarium'); setView('tabs') }} />
  else if (tab === 'today') content = <Today openTask={openTask} openAdd={openAdd} goWeek={() => setView('week')} goSettings={() => setView('settings')} />
  else if (tab === 'together') content = <Together openTask={openTask} openAdd={(init) => setAdding(init)} />
  else if (tab === 'chat') content = <Chat refTaskId={chatRef} clearRef={() => setChatRef(null)} />
  else content = <Aquarium openShop={() => setView('shop')} />

  const isChat = view === 'tabs' && tab === 'chat'
  return (
    <>
      <div ref={scrollRef} className={isChat ? 'scroll fixed' : 'scroll'}>{content}</div>
      {view !== 'settings' && view !== 'shop' && (
        <nav className="tabs" aria-label="Navigation">
          <div className="tabs-inner">
            <TabButton name="today" icon="today" label="Aujourd’hui" active={view !== 'tabs' ? view === 'week' && tab === 'today' : tab === 'today'} onClick={() => { setTab('today'); setView('tabs') }} />
            <TabButton name="together" icon="together" label="Ensemble" active={view === 'tabs' && tab === 'together'} onClick={() => { setTab('together'); setView('tabs') }} />
            <TabButton name="chat" icon="chat" label="Petits mots" badge={unread} active={view === 'tabs' && tab === 'chat'} onClick={() => { setTab('chat'); setView('tabs') }} />
            <TabButton name="aquarium" icon="fish" label="Aquarium" active={view === 'tabs' && tab === 'aquarium'} onClick={() => { setTab('aquarium'); setView('tabs') }} />
          </div>
        </nav>
      )}
      {adding && <AddGoal init={adding} onClose={() => setAdding(null)} />}
      {openTaskItem && (
        <TaskSheet
          task={openTaskItem}
          onClose={() => setOpenTaskItem(null)}
          onEncourage={(t) => { setOpenTaskItem(null); setChatRef(t.id); setTab('chat'); setView('tabs') }}
        />
      )}
    </>
  )
}

function TabButton({ icon, label, active, onClick, badge }: { name: string; icon: string; label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button type="button" className="tab" aria-current={active ? 'page' : undefined} onClick={onClick}>
      <Icon name={icon} size={24} />
      {label}
      {badge ? <span className="badge" aria-label={`${badge} nouveaux`}>{badge}</span> : null}
    </button>
  )
}

function addDaysSafe(today: string): string {
  // Les petits mots non lus des 7 derniers jours seulement
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 7)
  return d.toISOString().slice(0, 10)
}

function localStorageGet(key: string): string | null {
  try { return window.localStorage.getItem(key) } catch { return null }
}

function localStorageSet(key: string, value: string) {
  try { window.localStorage.setItem(key, value) } catch { /* rien */ }
}
