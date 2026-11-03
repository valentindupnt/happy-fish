import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase, errorText } from './supabase'
import { addDays, todayParis, weekStart } from './dates'
import type { Category, Couple, FishStatus, ForceMessage, Goal, Message, Profile, Suggestion, Task, Wish } from './types'

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
}

const EMPTY: State = {
  loading: true, me: null, partner: null, couple: null, categories: [], suggestions: [],
  goals: [], tasks: [], wishes: [], messages: [], force: [], fish: [],
}

interface Toast { id: number; text: string; tone: 'info' | 'error' }

interface Store extends State {
  userId: string
  today: string
  reloadAll: () => Promise<void>
  reloadTasks: () => Promise<void>
  loadWeek: (start: string) => Promise<void>
  reload: (what: Array<'profiles' | 'couple' | 'categories' | 'suggestions' | 'goals' | 'wishes' | 'messages' | 'force' | 'fish'>) => Promise<void>
  /** Appelle une action, affiche l'erreur éventuelle, renvoie true si tout s'est bien passé */
  run: (fn: () => PromiseLike<unknown>, success?: string) => Promise<boolean>
  toast: (text: string, tone?: 'info' | 'error') => void
  toasts: Toast[]
  partnerName: string
  nameOf: (profileId: string | null) => string
  categoryOf: (id: string | null) => Category | undefined
  goalOf: (id: string) => Goal | undefined
  fishOf: (profileId: string | undefined) => FishStatus
}

const Ctx = createContext<Store | null>(null)

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

export function StoreProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [state, setState] = useState<State>(EMPTY)
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
      ])
      const parts = await Promise.all([
        loaders.couple(), loaders.categories(), loaders.suggestions(), loaders.goals(),
        loaders.wishes(), loaders.messages(), loaders.force(), loaders.fish(),
      ])
      const tasks = await fetchTasks(range.current.from, range.current.to)
      setState(Object.assign({ ...EMPTY, loading: false, me, partner, tasks }, ...parts))
    } catch (e) {
      setState((s) => ({ ...s, loading: false }))
      toast(errorText(e), 'error')
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

  useEffect(() => { reloadAll() }, [reloadAll])

  // Rechargement au retour dans l'app (et passage à minuit)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') reloadAll() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reloadAll])

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
        if (list.includes('tasks')) reloadTasks()
        const others = list.filter((w) => w !== 'tasks') as Parameters<Store['reload']>[0]
        if (others.length) reload(others)
      }, 300)
    }
    const channel = supabase
      .channel(`duo-${coupleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `couple_id=eq.${coupleId}` }, () => schedule('messages'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `couple_id=eq.${coupleId}` }, () => schedule('tasks'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'xp_events' }, () => schedule('fish'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `couple_id=eq.${coupleId}` }, () => schedule('profiles'))
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
      fishOf: (pid) => state.fish.find((f) => f.profile_id === pid) || { profile_id: pid || '', xp: 0, level: 1, level_uncapped: 1 },
    }
  }, [state, userId, today, reloadAll, reloadTasks, loadWeek, reload, run, toast, toasts])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
