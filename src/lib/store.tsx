import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase, errorText } from './supabase'
import { addDays, todayParis, weekStart } from './dates'
import type { VisitorBook, VisitorFound } from './visitors'
import type { Category, Challenge, ChallengeRoll, Couple, CoupleItem, FishStatus, ForceMessage, Goal, Message, Profile, Purchase, Review, ShopItem, Streak, Suggestion, SurpriseIdea, Task, Wish } from './types'

interface State {
  loading: boolean
  me: Profile | null
  partner: Profile | null
  couple: Couple | null
  categories: Category[]
  suggestions: Suggestion[]
  goals: Goal[]
  tasks: Task[]
  wishes: Wish[]
  messages: Message[]
  force: ForceMessage[]
  fish: FishStatus[]
  shopItems: ShopItem[]
  purchases: Purchase[]
  coupleItems: CoupleItem[]
  reviews: Review[]
  pot: number
  streaks: Streak[]
  challenges: Challenge[]
  rolls: ChallengeRoll[]
  surpriseIdeas: SurpriseIdea[]
  visitorsFound: VisitorFound[]
  visitorBook: VisitorBook | null
}

const EMPTY: State = {
  loading: true, me: null, partner: null, couple: null, categories: [], suggestions: [],
  goals: [], tasks: [], wishes: [], messages: [], force: [], fish: [],
  shopItems: [], purchases: [], coupleItems: [], reviews: [], pot: 0,
  streaks: [], challenges: [], rolls: [], surpriseIdeas: [], visitorsFound: [], visitorBook: null,
}

type Part = 'profiles' | 'couple' | 'categories' | 'suggestions' | 'goals' | 'wishes' | 'messages' | 'force' | 'fish' | 'shop' | 'reviews'
  | 'streaks' | 'challenges' | 'surprises' | 'visitors'

interface Toast { id: number; text: string; tone: 'info' | 'error' }

interface Store extends State {
  userId: string
  today: string
  reloadAll: () => Promise<void>
  reloadTasks: () => Promise<void>
  loadWeek: (start: string) => Promise<void>
  reload: (what: Part[]) => Promise<void>
  /** Appelle une action, affiche l'erreur éventuelle, renvoie true si tout s'est bien passé */
  run: (fn: () => PromiseLike<unknown>, success?: string) => Promise<boolean>
  toast: (text: string, tone?: 'info' | 'error') => void
  toasts: Toast[]
  partnerName: string
  nameOf: (profileId: string | null) => string
  categoryOf: (id: string | null) => Category | undefined
  goalOf: (id: string) => Goal | undefined
  fishOf: (profileId: string | undefined) => FishStatus
  online: boolean
  pendingChecks: number
  /** Cocher ou décocher sans réseau : appliqué tout de suite, envoyé au retour du réseau */
  queueToggle: (task: Task) => void
}

const Ctx = createContext<Store | null>(null)

// Hors ligne : dernières données gardées dans le téléphone, coches mises en attente
const cacheKey = (u: string) => `hf-cache-${u}`
const queueKey = (u: string) => `hf-queue-${u}`

function readCache(userId: string): State | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(userId))
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<State>), loading: false } : null
  } catch { return null }
}

function writeCache(userId: string, st: State) {
  try {
    const { loading: _l, ...rest } = st
    window.localStorage.setItem(cacheKey(userId), JSON.stringify(rest))
  } catch { /* plein ou indisponible : tant pis */ }
}

export function readQueue(userId: string): string[] {
  try { return JSON.parse(window.localStorage.getItem(queueKey(userId)) || '[]') as string[] } catch { return [] }
}

function writeQueue(userId: string, q: string[]) {
  try { window.localStorage.setItem(queueKey(userId), JSON.stringify(q)) } catch { /* rien */ }
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('Store manquant')
  return s
}

async function must<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p
  if (error) throw error
  return data as T
}

function applyQueue(tasks: Task[], ids: string[]): Task[] {
  const flips = new Map<string, number>()
  for (const id of ids) flips.set(id, (flips.get(id) || 0) + 1)
  return tasks.map((t) => {
    const n = flips.get(t.id) || 0
    if (n % 2 === 0) return t
    return { ...t, done_at: t.done_at ? null : new Date().toISOString() }
  })
}

export function StoreProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [state, setState] = useState<State>(() => readCache(userId) || EMPTY)
  const [online, setOnline] = useState(() => !isOffline())
  const [pendingChecks, setPendingChecks] = useState(() => readQueue(userId).length)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [today, setToday] = useState(todayParis())
  const range = useRef({ from: addDays(weekStart(todayParis()), -42), to: addDays(weekStart(todayParis()), 62) })
  const coupleRef = useRef<string | null>(null)

  const toast = useCallback((text: string, tone: 'info' | 'error' = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 4500 : 2500)
  }, [])

  const fetchTasks = useCallback(async (from: string, to: string) => {
    return must<Task[]>(supabase.from('tasks').select('*').gte('date', from).lte('date', to).order('date'))
  }, [])

  const loaders = useMemo(() => ({
    profiles: async () => {
      const rows = await must<Profile[]>(supabase.from('profiles').select('*'))
      const me = rows.find((p) => p.id === userId) || null
      const partner = rows.find((p) => p.id !== userId && me?.couple_id && p.couple_id === me.couple_id) || null
      coupleRef.current = me?.couple_id || null
      return { me, partner }
    },
    couple: async () => ({ couple: (await must<Couple[]>(supabase.from('couples').select('*')))[0] || null }),
    categories: async () => ({ categories: await must<Category[]>(supabase.from('categories').select('*').order('position')) }),
    suggestions: async () => ({ suggestions: await must<Suggestion[]>(supabase.from('suggestions').select('*').order('title')) }),
    goals: async () => ({ goals: await must<Goal[]>(supabase.from('goals').select('*')) }),
    wishes: async () => ({ wishes: await must<Wish[]>(supabase.from('wishes').select('*').order('created_at', { ascending: false })) }),
    messages: async () => {
      const rows = await must<Message[]>(supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(300))
      return { messages: rows.reverse() }
    },
    force: async () => ({ force: await must<ForceMessage[]>(supabase.from('force_messages').select('*').order('position')) }),
    fish: async () => ({ fish: await must<FishStatus[]>(supabase.from('fish_status').select('*')) }),
    shop: async () => {
      const [shopItems, purchases, coupleItems, pot] = await Promise.all([
        must<ShopItem[]>(supabase.from('shop_items').select('*').order('position')),
        must<Purchase[]>(supabase.from('purchases').select('profile_id, item_id')),
        must<CoupleItem[]>(supabase.from('couple_items').select('item_id')),
        must<number>(supabase.rpc('get_pot')),
      ])
      return { shopItems, purchases, coupleItems, pot: pot ?? 0 }
    },
    reviews: async () => ({ reviews: await must<Review[]>(supabase.from('weekly_reviews').select('*').order('week_start', { ascending: false }).limit(20)) }),
    streaks: async () => ({ streaks: (await must<Streak[]>(supabase.rpc('goal_streaks'))) || [] }),
    challenges: async () => {
      const [challenges, rolls] = await Promise.all([
        must<Challenge[]>(supabase.from('challenges').select('*').eq('archived', false).order('created_at')),
        must<ChallengeRoll[]>(supabase.from('challenge_rolls').select('*').order('week_start', { ascending: false }).limit(12)),
      ])
      return { challenges, rolls }
    },
    surprises: async () => ({ surpriseIdeas: await must<SurpriseIdea[]>(supabase.from('surprise_ideas').select('*').order('created_at')) }),
    // Le carnet ne bloque jamais l'app : sans lui (base pas encore migrée), il reste vide
    visitors: async () => {
      try {
        const [visitorsFound, visitorBook] = await Promise.all([
          must<VisitorFound[]>(supabase.from('visitor_found').select('id, profile_id, visitor_id, reward, found_at').order('found_at')),
          must<VisitorBook>(supabase.rpc('visitor_book')),
        ])
        return { visitorsFound: visitorsFound || [], visitorBook }
      } catch {
        return { visitorsFound: [] as VisitorFound[], visitorBook: null }
      }
    },
  }), [userId])

  const reload: Store['reload'] = useCallback(async (what) => {
    try {
      const parts = await Promise.all(what.map((w) => loaders[w]()))
      setState((s) => Object.assign({}, s, ...parts))
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }, [loaders, toast])

  const reloadTasks = useCallback(async () => {
    try {
      const tasks = await fetchTasks(range.current.from, range.current.to)
      setState((s) => ({ ...s, tasks }))
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }, [fetchTasks, toast])

  const reloadAll = useCallback(async () => {
    try {
      const { me, partner } = await loaders.profiles()
      if (!me?.couple_id) {
        setState({ ...EMPTY, loading: false, me })
        return
      }
      const t = todayParis()
      setToday(t)
      const ws = weekStart(t)
      await Promise.all([
        supabase.rpc('ensure_week', { p_week: ws }),
        supabase.rpc('ensure_week', { p_week: addDays(ws, 7) }),
        supabase.rpc('ensure_reviews'),
      ])
      const parts = await Promise.all([
        loaders.couple(), loaders.categories(), loaders.suggestions(), loaders.goals(),
        loaders.wishes(), loaders.messages(), loaders.force(), loaders.fish(), loaders.shop(), loaders.reviews(),
        loaders.streaks(), loaders.challenges(), loaders.surprises(), loaders.visitors(),
      ])
      const tasks = await fetchTasks(range.current.from, range.current.to)
      const next = Object.assign({ ...EMPTY, loading: false, me, partner, tasks }, ...parts) as State
      // Les coches en attente restent visibles tant qu'elles ne sont pas envoyées
      const q = readQueue(userId)
      if (q.length) next.tasks = applyQueue(next.tasks, q)
      setState(next)
      writeCache(userId, next)
    } catch (e) {
      setState((s) => ({ ...s, loading: false }))
      if (!isOffline()) toast(errorText(e), 'error')
    }
  }, [loaders, fetchTasks, toast])

  const loadWeek = useCallback(async (start: string) => {
    try {
      await supabase.rpc('ensure_week', { p_week: start })
      const end = addDays(start, 6)
      if (start < range.current.from) range.current.from = start
      if (end > range.current.to) range.current.to = end
      const rows = await fetchTasks(start, end)
      setState((s) => {
        const byId = new Map<string, Task>()
        for (const t of s.tasks) if (t.date < start || t.date > end) byId.set(t.id, t)
        for (const t of rows) byId.set(t.id, t)
        return { ...s, tasks: [...byId.values()].sort((a, b) => a.date.localeCompare(b.date)) }
      })
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }, [fetchTasks, toast])

  const run: Store['run'] = useCallback(async (fn, success) => {
    if (isOffline()) {
      toast('Pas de réseau pour l’instant : réessaie dans un moment', 'error')
      return false
    }
    try {
      const res = (await fn()) as { error?: unknown } | undefined
      if (res && typeof res === 'object' && 'error' in res && res.error) throw res.error
      if (success) toast(success)
      return true
    } catch (e) {
      toast(errorText(e), 'error')
      return false
    }
  }, [toast])

  // Envoi des coches faites hors ligne
  const flushing = useRef(false)
  const flushQueue = useCallback(async () => {
    const q = readQueue(userId)
    if (!q.length || flushing.current || isOffline()) return
    flushing.current = true
    const counts = new Map<string, number>()
    for (const id of q) counts.set(id, (counts.get(id) || 0) + 1)
    let sent = 0
    for (const [id, n] of counts) {
      if (n % 2 === 0) continue // coché puis décoché : rien à envoyer
      const { error } = await supabase.rpc('toggle_task', { p_task: id })
      if (!error) sent++
    }
    writeQueue(userId, [])
    setPendingChecks(0)
    flushing.current = false
    if (sent) toast(`${sent} coche${sent > 1 ? 's' : ''} faite${sent > 1 ? 's' : ''} hors ligne envoyée${sent > 1 ? 's' : ''}`)
  }, [userId, toast])

  const queueToggle = useCallback((task: Task) => {
    const q = [...readQueue(userId), task.id]
    writeQueue(userId, q)
    setPendingChecks(q.length)
    setState((s) => {
      const next = { ...s, tasks: applyQueue(s.tasks, [task.id]) }
      writeCache(userId, next)
      return next
    })
  }, [userId])

  useEffect(() => {
    const on = async () => { setOnline(true); await flushQueue(); await reloadAll() }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [flushQueue, reloadAll])

  useEffect(() => { void flushQueue().then(() => reloadAll()) }, [flushQueue, reloadAll])

  // Rechargement au retour dans l'app (et passage à minuit)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void flushQueue().then(() => reloadAll()) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reloadAll, flushQueue])

  // Mises à jour en direct
  const coupleId = state.me?.couple_id
  useEffect(() => {
    if (!coupleId) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const pending = new Set<string>()
    const schedule = (what: string) => {
      pending.add(what)
      clearTimeout(timer)
      timer = setTimeout(() => {
        const list = [...pending]
        pending.clear()
        if (list.includes('tasks')) { reloadTasks(); pending.add('streaks'); pending.add('visitors') }
        const others = [...new Set([...list, ...pending])].filter((w) => w !== 'tasks') as Parameters<Store['reload']>[0]
        pending.clear()
        if (others.length) reload(others)
      }, 300)
    }
    const channel = supabase
      .channel(`duo-${coupleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `couple_id=eq.${coupleId}` }, () => schedule('messages'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `couple_id=eq.${coupleId}` }, () => schedule('tasks'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'xp_events' }, () => schedule('fish'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `couple_id=eq.${coupleId}` }, () => schedule('profiles'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'couples', filter: `id=eq.${coupleId}` }, () => { schedule('couple'); schedule('fish') })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pot_events', filter: `couple_id=eq.${coupleId}` }, () => { schedule('shop'); schedule('fish') })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_reviews', filter: `couple_id=eq.${coupleId}` }, () => schedule('reviews'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges', filter: `couple_id=eq.${coupleId}` }, () => schedule('challenges'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenge_rolls', filter: `couple_id=eq.${coupleId}` }, () => schedule('challenges'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'visitor_found', filter: `couple_id=eq.${coupleId}` }, () => { schedule('visitors'); schedule('fish') })
      .subscribe()
    return () => { clearTimeout(timer); supabase.removeChannel(channel) }
  }, [coupleId, reload, reloadTasks])

  const value = useMemo<Store>(() => {
    const partnerName = state.me?.partner_nickname || state.partner?.display_name || 'ton duo'
    return {
      ...state,
      userId,
      today,
      reloadAll, reloadTasks, loadWeek, reload, run, toast, toasts,
      partnerName,
      nameOf: (id) => {
        if (!id) return 'vous deux'
        if (id === userId) return state.me?.display_name || 'Moi'
        return partnerName
      },
      categoryOf: (id) => state.categories.find((c) => c.id === id),
      goalOf: (id) => state.goals.find((g) => g.id === id),
      fishOf: (pid) => state.fish.find((f) => f.profile_id === pid) || { profile_id: pid || '', xp: 0, level: 1, level_uncapped: 1, coins: 0 },
      online, pendingChecks, queueToggle,
    }
  }, [state, userId, today, reloadAll, reloadTasks, loadWeek, reload, run, toast, toasts, online, pendingChecks, queueToggle])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
