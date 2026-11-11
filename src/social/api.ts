// Kompisar, meddelanden och dueller via Supabase. Allt kräver din inloggning (synkhemligheten).
import { useEffect, useSyncExternalStore } from 'react'
import { rpc } from '../sync/supabase.ts'
import { currentSession } from '../vault/vault.ts'
import type { SyncCreds } from '../sync/sync.ts'

const creds = (): SyncCreds => {
  const s = currentSession()
  if (!s) throw new Error('Du är inte inloggad.')
  return s.sync
}
const auth = () => {
  const c = creds()
  return { p_user: c.user, p_secret: c.secret }
}
export const myId = () => currentSession()?.sync.user ?? null

/* ---------- Profil ---------- */

export interface Me {
  name: string
  blocked: boolean
  /** Syns inte i topplistan (namnet finns kvar för meddelanden och dueller). */
  hidden?: boolean
}
export const fetchMe = () => rpc<Me | null>('social_me', auth())
export const join = (name: string) => rpc('social_join', { ...auth(), p_name: name })
export const leave = () => rpc('social_leave', auth())
/** Visa dig i topplistan eller inte. Dold: servern sparar och visar inga siffror. */
export const setHidden = (hidden: boolean) => rpc('social_hide', { ...auth(), p_hidden: hidden })

export interface PublicStats {
  weekXp: number
  xp: number
  level: number
  levelName: string
  streak: number
  solved: number
  badges: number
  /** Början på veckan (ms) som weekXp gäller. */
  at: number
  /** Du har valt att inte synas i topplistan (då skickas inga siffror). */
  hidden?: boolean
}
export const pushStats = (stats: PublicStats) => rpc('social_stats', { ...auth(), p_stats: stats })

export interface Friend {
  user_id: string
  name: string
  stats: Partial<PublicStats>
  updated_at: string
}
export const fetchBoard = () => rpc<Friend[]>('social_board', auth())
export const search = (q: string) => rpc<{ user_id: string; name: string }[]>('social_search', { ...auth(), p_q: q })

/* ---------- Meddelanden ---------- */

export type MessageKind = 'text' | 'exercise' | 'work' | 'duel'

export interface MessagePayload {
  exerciseId?: string
  number?: string
  title?: string
  notes?: string
  duel?: string
  image?: string
}

export interface Message {
  id: number
  from_id: string
  to_id: string
  kind: MessageKind
  body: string
  payload: MessagePayload | null
  has_image: boolean
  created_at: string
  read_at: string | null
}

export const send = (to: string, kind: MessageKind, body: string, payload?: MessagePayload) => rpc<number>('dm_send', { ...auth(), p_to: to, p_kind: kind, p_body: body, p_payload: payload ?? null })
export const fetchImage = (id: number) => rpc<string | null>('dm_image', { ...auth(), p_id: id })
export const markRead = (from: string) => rpc('dm_read', { ...auth(), p_from: from })

/* ---------- Dueller ---------- */

export interface DuelResult {
  /** Deluppgifter rätt på första försöket. */
  score: number
  of: number
  ms: number
  at?: string
}
export interface Duel {
  id: string
  created_by: string
  opponent: string
  subject: 'matte' | 'fysik'
  exercises: string[]
  results: Record<string, DuelResult>
  created_at: string
  names: Record<string, string>
}
export const createDuel = (to: string, subject: string, exercises: string[]) => rpc<string>('duel_create', { ...auth(), p_to: to, p_subject: subject, p_exercises: exercises })
export const fetchDuel = (id: string) => rpc<Duel | null>('duel_get', { ...auth(), p_id: id })
export const fetchDuels = () => rpc<Omit<Duel, 'exercises' | 'names'>[]>('duel_list', auth())
export const submitDuel = (id: string, result: DuelResult) => rpc('duel_submit', { ...auth(), p_id: id, p_result: result })

/* ---------- Inkorgen: hämtas i bakgrunden medan du är med ---------- */

interface Inbox {
  joined: boolean | null
  me: Me | null
  messages: Message[]
  /** Avsändare → antal olästa. */
  unread: Record<string, number>
  error: string | null
}

let state: Inbox = { joined: null, me: null, messages: [], unread: {}, error: null }
const listeners = new Set<() => void>()
let timer = 0
let running = false
let owner: string | null = null

function set(patch: Partial<Inbox>) {
  state = { ...state, ...patch }
  const mine = myId()
  const unread: Record<string, number> = {}
  for (const m of state.messages) if (m.to_id === mine && !m.read_at) unread[m.from_id] = (unread[m.from_id] ?? 0) + 1
  state.unread = unread
  listeners.forEach((l) => l())
}

async function poll() {
  if (running) return
  running = true
  try {
    const mine = myId()
    if (!mine) return
    if (owner !== mine) {
      owner = mine
      state = { joined: null, me: null, messages: [], unread: {}, error: null }
    }
    if (!state.me) {
      const me = await fetchMe()
      if (!me) return set({ joined: false, me: null })
      set({ joined: true, me })
    }
    const since = state.messages.at(-1)?.id ?? 0
    const fresh = await rpc<Message[]>('dm_inbox', { ...auth(), p_since: since })
    const receipts = await rpc<{ id: number; read_at: string }[]>('dm_receipts', auth())
    const read = new Map(receipts.map((r) => [r.id, r.read_at]))
    const merged = [...state.messages, ...fresh].map((m) => (read.has(m.id) && !m.read_at ? { ...m, read_at: read.get(m.id)! } : m))
    set({ messages: merged, error: null })
  } catch (e) {
    set({ error: (e as Error).message })
  } finally {
    running = false
  }
}

/** Hämtar nya meddelanden nu (t.ex. efter att du skickat något). */
export const refreshInbox = () => poll()

/** Gå med eller lämna: börja om från början. */
export function resetInbox() {
  state = { joined: null, me: null, messages: [], unread: {}, error: null }
  void poll()
}

/** Markerar lokalt att du läst en tråd (och på servern). */
export function readThread(from: string) {
  const mine = myId()
  if (!state.messages.some((m) => m.from_id === from && m.to_id === mine && !m.read_at)) return
  set({ messages: state.messages.map((m) => (m.from_id === from && m.to_id === mine && !m.read_at ? { ...m, read_at: new Date().toISOString() } : m)) })
  void markRead(from).catch(() => {})
}

export function useInbox(): Inbox {
  useEffect(() => {
    if (!timer) {
      void poll()
      timer = window.setInterval(() => document.visibilityState === 'visible' && poll(), 20_000)
    }
  }, [])
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}
