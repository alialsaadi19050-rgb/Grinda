// Inbjudningskoder: bokens ägare skapar en kod i appen, och en kompis använder den för att
// skapa ett eget konto med användarnamn och lösenord – utan att boken behöver låsas om.
//
// Koden låser boknyckeln (som ett lösenord). Servern sparar bara en hash av koden och den
// låsta nyckeln. Kontot som skapas sparas som en plats på servern i stället för i vault.bin.
import { rpc } from '../sync/supabase.ts'
import { inviteHash, newInviteCode, normalizeInvite, prettyInvite, seal, sealInvite, unseal, type Sealed, type Slot } from './crypto.ts'
import type { SyncCreds } from '../sync/sync.ts'

/** Hur länge en ny kod gäller. */
export const INVITE_DAYS = 7

/* ---------- För den som skapar konto ---------- */

/** Den låsta boknyckeln för en kod, eller null om koden inte finns, redan använts eller gått ut. */
export async function fetchInvite(code: string): Promise<Pick<Slot, 'salt' | 'iv' | 'key'> | null> {
  if (normalizeInvite(code).length < 10) return null
  return rpc('invite_open', { p_hash: await inviteHash(code) })
}

/** Sparar det nya kontots plats och markerar koden som använd. */
export async function claimInvite(code: string, slot: Slot): Promise<void> {
  await rpc('invite_claim', { p_hash: await inviteHash(code), p_id: slot.id, p_salt: slot.salt, p_iv: slot.iv, p_key: slot.key })
}

/** Platsen för ett konto som skapats med en kod, eller null om det inte finns. */
export const fetchSlot = (id: string) => rpc<Slot | null>('book_slot', { p_id: id })

/* ---------- För ägaren ---------- */

export interface Invite {
  hash: string
  note: string
  code: string | null
  createdAt: string
  expiresAt: string
  usedAt: string | null
}

interface Row {
  hash: string
  note: string
  code_sealed: Sealed | null
  created_at: string
  expires_at: string
  used_at: string | null
}

const auth = (c: SyncCreds) => ({ p_user: c.user, p_secret: c.secret })

/** Alla koder, nyast först. Kastar med status 403 om du inte får bjuda in. */
export async function listInvites(c: SyncCreds): Promise<Invite[]> {
  const rows = await rpc<Row[]>('invite_list', auth(c))
  return Promise.all(
    rows.map(async (r) => ({
      hash: r.hash,
      note: r.note,
      // Koden sparas krypterad med din nyckel, så att bara du kan se den igen.
      code: r.code_sealed && c.keys ? await unseal<string>(c.keys, r.code_sealed).catch(() => null) : null,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      usedAt: r.used_at,
    })),
  )
}

export async function createInvite(c: SyncCreds, bookKey: Uint8Array, note: string): Promise<string> {
  const code = newInviteCode()
  const sealed = await sealInvite(code, bookKey)
  await rpc('invite_create', {
    ...auth(c),
    p_hash: await inviteHash(code),
    p_salt: sealed.salt,
    p_iv: sealed.iv,
    p_key: sealed.key,
    p_note: note.trim().slice(0, 60),
    p_code: c.keys ? await seal(c.keys, code) : null,
    p_days: INVITE_DAYS,
  })
  return prettyInvite(code)
}

/** Drar tillbaka en oanvänd kod, eller tar bort kontot som skapades med den. */
export const deleteInvite = (c: SyncCreds, hash: string) => rpc('invite_delete', { ...auth(c), p_hash: hash })

/** Länk som öppnar inloggningen med koden ifylld. */
export const inviteLink = (code: string) => `${location.origin}${location.pathname}#/?kod=${normalizeInvite(code)}`
