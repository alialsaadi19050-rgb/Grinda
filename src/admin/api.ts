// Funktioner som bara bokens ägare (admin) kommer åt. Servern kontrollerar behörigheten.
import { rpc } from '../sync/supabase.ts'
import { currentSession } from '../vault/vault.ts'

const auth = () => {
  const s = currentSession()
  if (!s) throw new Error('Du är inte inloggad.')
  return { p_user: s.sync.user, p_secret: s.sync.secret }
}

export interface Report {
  id: number
  user_id: string
  exercise_id: string
  part: number | null
  label: string | null
  message: string
  context: { number?: string; section?: string; facit?: string; answers?: string[]; url?: string } | null
  status: 'open' | 'fixed' | 'wontfix'
  note: string
  created_at: string
}

export const createReport = (exerciseId: string, part: number | null, label: string | null, message: string, context: Report['context']) =>
  rpc<number>('report_create', { ...auth(), p_exercise: exerciseId, p_part: part, p_label: label, p_message: message, p_context: context })
export const fetchReports = () => rpc<Report[]>('admin_reports', auth())
export const updateReport = (id: number, status: Report['status'] | 'delete', note?: string) => rpc('admin_report_update', { ...auth(), p_id: id, p_status: status, p_note: note ?? null })

export interface AdminUser {
  id: string
  created_at: string
  last_seen: string | null
  attempts: number
  attempts_week: number
  name: string | null
  blocked: boolean
  invite_note: string | null
  is_admin: boolean
  invite_account: boolean
}
export type UserAction = 'reset' | 'block' | 'unblock' | 'make_admin' | 'remove_admin' | 'delete'
export const fetchUsers = () => rpc<AdminUser[]>('admin_users', auth())
export const userAction = (target: string, action: UserAction) => rpc('admin_user_action', { ...auth(), p_target: target, p_action: action })

export interface Overview {
  users: number
  active_week: number
  active_day: number
  attempts: number
  profiles: number
  messages_week: number
  duels: number
  open_reports: number
  open_invites: number
  per_day: { day: string; n: number }[]
}
export const fetchOverview = () => rpc<Overview>('admin_overview', auth())
export const announce = (body: string) => rpc('admin_announce', { ...auth(), p_body: body })

export interface Announcement {
  id: number
  body: string
  created_at: string
}
/** Meddelandet till alla. Kräver ingen inloggning. */
export const fetchAnnouncement = () => rpc<Announcement | null>('announcement', {})
