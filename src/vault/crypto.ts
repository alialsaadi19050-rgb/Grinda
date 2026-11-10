// Kryptering av bokens innehåll. Samma kod körs i webbläsaren (inloggningen) och i Node
// (npm run lock och npm run users). Innehållet krypteras med AES-GCM, som också avslöjar
// fel lösenord eller ändrad fil.
//
// Flera inloggningar: innehållet låses med en slumpad boknyckel. Boknyckeln låses sedan
// en gång per inloggning ("plats") med en nyckel som härleds från användarnamn och
// lösenord med PBKDF2. Användarnamnet sparas inte, bara en hash som pekar ut platsen.
//
// Filformat:
//   MATTE2 | huvudets längd (4 byte) | huvud (JSON med platserna) | iv (12 byte) | krypterad JSON
//   MATTE1 | salt (16 byte) | iv (12 byte) | krypterad JSON   (äldre, en inloggning)

export interface VaultFiles {
  /** Sökväg under content/, t.ex. "data/1-1.json" → filens text. */
  files: Record<string, string>
  createdAt: string
}

/** En inloggning: boknyckeln låst med användarens nyckel. Allt i base64. */
export interface Slot {
  id: string
  salt: string
  iv: string
  key: string
}

export type Vault =
  | { version: 2; slots: Slot[]; iv: Uint8Array; data: Uint8Array }
  | { version: 1; salt: Uint8Array; iv: Uint8Array; data: Uint8Array }

const enc = new TextEncoder()
const dec = new TextDecoder()
const ITERATIONS = 600_000

const b64 = (bytes: Uint8Array) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n))

export const normalizeUser = (user: string) => user.trim().toLowerCase()

export function keyMaterial(user: string, password: string): string {
  return `${normalizeUser(user)}\n${password}`
}

export async function deriveKey(user: string, password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(keyMaterial(user, password)), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: ITERATIONS },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Platsens id: en hash av användarnamnet, så att rätt plats hittas utan att namnet sparas. */
export async function slotId(user: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`matte-user:${normalizeUser(user)}`)))
  return Array.from(hash.slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function parseVault(bytes: Uint8Array): Vault {
  const magic = dec.decode(bytes.slice(0, 6))
  if (magic === 'MATTE2') {
    const len = new DataView(bytes.buffer, bytes.byteOffset + 6, 4).getUint32(0)
    const head = JSON.parse(dec.decode(bytes.slice(10, 10 + len))) as { slots: Slot[] }
    const rest = 10 + len
    return { version: 2, slots: head.slots, iv: bytes.slice(rest, rest + 12), data: bytes.slice(rest + 12) }
  }
  if (magic === 'MATTE1' && bytes.length >= 34) return { version: 1, salt: bytes.slice(6, 22), iv: bytes.slice(22, 34), data: bytes.slice(34) }
  throw new Error('Filen är inte en Matte-vault.')
}

/* ---------- Boknyckeln ---------- */

export const newBookKey = () => random(32)

const importBookKey = (raw: Uint8Array) => crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt'])

/** Låser boknyckeln för en inloggning. */
export async function makeSlot(user: string, password: string, bookKey: Uint8Array): Promise<Slot> {
  const salt = random(16)
  const iv = random(12)
  const wrap = await deriveKey(user, password, salt)
  const key = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrap, bookKey as BufferSource))
  return { id: await slotId(user), salt: b64(salt), iv: b64(iv), key: b64(key) }
}

/** Låser innehållet med boknyckeln och lägger platserna i huvudet. */
export async function buildVault(files: VaultFiles, bookKey: Uint8Array, slots: Slot[]): Promise<Uint8Array> {
  if (!slots.length) throw new Error('Boken måste ha minst en inloggning.')
  const iv = random(12)
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await importBookKey(bookKey), enc.encode(JSON.stringify(files))))
  const head = enc.encode(JSON.stringify({ slots }))
  const out = new Uint8Array(10 + head.length + 12 + data.length)
  out.set(enc.encode('MATTE2'), 0)
  new DataView(out.buffer).setUint32(6, head.length)
  out.set(head, 10)
  out.set(iv, 10 + head.length)
  out.set(data, 22 + head.length)
  return out
}

/* ---------- Att öppna boken ---------- */

/** Det som sparas i webbläsaren efter inloggning: platsen och användarens nyckel (inte lösenordet). */
export interface Unlock {
  slot: string
  key: CryptoKey
}

/**
 * Kastar om användarnamnet eller lösenordet är fel. `extra` är en plats som inte ligger i boken
 * utan hämtats från servern (konton som skapats med en inbjudningskod).
 */
export async function login(vault: Vault, user: string, password: string, extra?: Slot | null): Promise<{ unlock: Unlock; bookKey: Uint8Array | null; files: VaultFiles }> {
  if (vault.version === 1) {
    const key = await deriveKey(user, password, vault.salt)
    return { unlock: { slot: 'v1', key }, bookKey: null, files: await openVault(vault, { slot: 'v1', key }) }
  }
  const id = await slotId(user)
  const slot = vault.slots.find((s) => s.id === id) ?? (extra?.id === id ? extra : undefined)
  if (!slot) throw new Error('Fel användarnamn eller lösenord.')
  const key = await deriveKey(user, password, unb64(slot.salt))
  const unlock = { slot: id, key }
  const bookKey = await unwrap(slot, key)
  return { unlock, bookKey, files: await decryptWith(vault, bookKey) }
}

/** Öppnar boken med en sparad inloggning. Kastar om platsen tagits bort eller nyckeln inte passar. */
export async function openVault(vault: Vault, unlock: Unlock, extra?: Slot | null): Promise<VaultFiles> {
  return (await openVaultWithKey(vault, unlock, extra)).files
}

/** Som openVault, men ger också boknyckeln (den behövs för att skapa inbjudningskoder). */
export async function openVaultWithKey(vault: Vault, unlock: Unlock, extra?: Slot | null): Promise<{ files: VaultFiles; bookKey: Uint8Array | null }> {
  if (vault.version === 1) {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: vault.iv as BufferSource }, unlock.key, vault.data as BufferSource)
    return { files: JSON.parse(dec.decode(plain)) as VaultFiles, bookKey: null }
  }
  const slot = vault.slots.find((s) => s.id === unlock.slot) ?? (extra?.id === unlock.slot ? extra : undefined)
  if (!slot) throw new Error('Inloggningen finns inte längre.')
  const bookKey = await unwrap(slot, unlock.key)
  return { files: await decryptWith(vault, bookKey), bookKey }
}

/** Öppnar boken direkt med boknyckeln. Kastar om nyckeln inte passar. */
export async function openWithBookKey(vault: Vault, bookKey: Uint8Array): Promise<VaultFiles> {
  if (vault.version !== 2) throw new Error('Boken har det äldre formatet.')
  return decryptWith(vault, bookKey)
}

/** Kontrollerar att en boknyckel öppnar boken. */
export async function bookKeyOpens(vault: Vault, bookKey: Uint8Array): Promise<boolean> {
  return openWithBookKey(vault, bookKey).then(
    () => true,
    () => false,
  )
}

/* ---------- Inbjudningskoder ---------- */

// En inbjudningskod låser boknyckeln precis som ett lösenord. Servern får bara en hash av
// koden och den låsta nyckeln, så den kan aldrig själv öppna boken.

const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // utan I, L, O, 0 och 1

/** En slumpad kod som "K7RX2-MQ9TB" (cirka 50 bitar). */
export function newInviteCode(): string {
  const out: string[] = []
  while (out.length < 10) {
    for (const b of random(16)) {
      // Förkasta de högsta värdena så att alla tecken blir lika vanliga.
      if (b < 248 && out.length < 10) out.push(INVITE_ALPHABET[b % 31])
    }
  }
  return `${out.slice(0, 5).join('')}-${out.slice(5).join('')}`
}

export const normalizeInvite = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '')
export const prettyInvite = (code: string) => {
  const n = normalizeInvite(code)
  return n.length === 10 ? `${n.slice(0, 5)}-${n.slice(5)}` : n
}

export async function inviteHash(code: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`grinda-invite:${normalizeInvite(code)}`)))
  return Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Boknyckeln låst med inbjudningskoden. */
export const sealInvite = (code: string, bookKey: Uint8Array) => makeSlot('inbjudan', normalizeInvite(code), bookKey)

/** Kastar om koden inte passar. */
export async function openInvite(code: string, sealed: Pick<Slot, 'salt' | 'iv' | 'key'>): Promise<Uint8Array> {
  const key = await deriveKey('inbjudan', normalizeInvite(code), unb64(sealed.salt))
  return unwrap({ id: '', ...sealed }, key)
}

async function unwrap(slot: Slot, key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(slot.iv) as BufferSource }, key, unb64(slot.key) as BufferSource))
}

async function decryptWith(vault: Extract<Vault, { version: 2 }>, bookKey: Uint8Array): Promise<VaultFiles> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: vault.iv as BufferSource }, await importBookKey(bookKey), vault.data as BufferSource)
  return JSON.parse(dec.decode(plain)) as VaultFiles
}

/* ---------- Synk ---------- */

/**
 * Hemligheten för synkservern. Härleds ur användarnamn och lösenord med ett eget salt, så
 * servern får aldrig lösenordet och kan inte räkna fram nyckeln till boken.
 */
export async function syncSecret(user: string, password: string): Promise<string> {
  const base = await crypto.subtle.importKey('raw', enc.encode(keyMaterial(user, password)), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('matte-sync-v1'), iterations: 200_000 }, base, 256)
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('')
}

/* ---------- Hemligheter som synkas krypterade (API-nycklar) ---------- */

/**
 * Nyckel för att kryptera dina API-nycklar innan de synkas. Härleds ur användarnamn och
 * lösenord med ett eget salt och lämnar aldrig enheten, så synkservern kan inte läsa dem.
 */
export const secretsKey = (user: string, password: string) => deriveKey(user, password, enc.encode('matte-keys-v1'))

export interface Sealed {
  iv: string
  ct: string
}

export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = random(12)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value))))
  return { iv: b64(iv), ct: b64(ct) }
}

/** Kastar om nyckeln inte passar (t.ex. efter byte av lösenord). */
export async function unseal<T>(key: CryptoKey, s: Sealed): Promise<T> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv) as BufferSource }, key, unb64(s.ct) as BufferSource)
  return JSON.parse(dec.decode(plain)) as T
}
