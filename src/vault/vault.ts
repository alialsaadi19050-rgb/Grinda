// Inloggningen. Bokens innehåll ligger krypterat i vault.bin och går bara att läsa med rätt
// användarnamn och lösenord. Nyckeln (inte lösenordet) sparas i webbläsarens IndexedDB som en
// nyckel som inte går att exportera, så du förblir inloggad tills du loggar ut.
//
// I utvecklingsläget (npm run dev) läses de okrypterade filerna i public/content direkt.
import { useSyncExternalStore } from 'react'
import { bookKeyOpens, login as unlockVault, makeSlot, openInvite, openVaultWithKey, parseVault, secretsKey, slotId, syncSecret, type Slot, type Unlock, type Vault } from './crypto.ts'
import type { SyncCreds } from '../sync/sync.ts'

/**
 * Det som sparas efter inloggning: nyckeln till boken och synkens hemlighet (inget lösenord).
 * Konton som skapats med en inbjudningskod har sin plats på servern; en kopia sparas här så att
 * appen går att öppna offline.
 */
type Saved = Unlock & { sync?: SyncCreds; remote?: Slot }

// Inbjudningarna laddas först när de behövs.
const invites = () => import('./invites.ts')

// Synken laddas först när den behövs.
const sync = () => import('../sync/sync.ts')

export type VaultStatus = 'checking' | 'locked' | 'open'

const PLAIN = import.meta.env.DEV
let status: VaultStatus = PLAIN ? 'open' : 'checking'
let files: Record<string, string> | null = null
/** Den inloggade sessionen: boknyckeln behövs för att skapa inbjudningskoder. */
let session: { sync: SyncCreds; bookKey: Uint8Array | null } | null = null
export const currentSession = () => session
const listeners = new Set<() => void>()

function set(s: VaultStatus) {
  status = s
  listeners.forEach((l) => l())
}

export function useVaultStatus(): VaultStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => status,
  )
}

/* ---------- Den sparade nyckeln ---------- */

function keyStore<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('matte-auth', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('keys')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const tx = open.result.transaction('keys', mode)
      const req = run(tx.objectStore('keys'))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
      tx.oncomplete = () => open.result.close()
    }
  })
}

const saveKey = (u: Saved) => keyStore('readwrite', (s) => s.put(u, 'vault'))
// Äldre versioner sparade bara nyckeln (en inloggning, format 1).
const loadKey = () => keyStore<Saved | CryptoKey | undefined>('readonly', (s) => s.get('vault')).then((v): Saved | undefined => (v instanceof CryptoKey ? { slot: 'v1', key: v } : v))
const forgetKey = () => keyStore('readwrite', (s) => s.delete('vault'))

/* ---------- Inloggning ---------- */

/**
 * Boken och sidans kod hör ihop. Har webbläsaren kvar en äldre version av sidan än boken
 * (eller tvärtom) laddas sidan om en gång, utan cache, så att de passar ihop igen.
 */
function parseOrReload(bytes: Uint8Array) {
  try {
    const vault = parseVault(bytes)
    sessionStorage.removeItem(RELOADED)
    return vault
  } catch (e) {
    if (!sessionStorage.getItem(RELOADED)) {
      sessionStorage.setItem(RELOADED, '1')
      location.reload()
      return new Promise<never>(() => {})
    }
    throw new Error('Sidan har uppdaterats. Ladda om den (Ctrl+Shift+R, eller stäng fliken och öppna igen).', { cause: e })
  }
}
const RELOADED = 'matte.vault.reloaded'

async function fetchVault(): Promise<Uint8Array> {
  const res = await fetch(`${import.meta.env.BASE_URL}vault.bin`, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`Kunde inte hämta innehållet (${res.status}).`)
  return new Uint8Array(await res.arrayBuffer())
}

/** Försöker öppna med den sparade nyckeln när appen startar. */
export async function restoreSession(): Promise<void> {
  if (PLAIN) return
  try {
    const saved = await loadKey()
    // Inloggningar från innan synken (eller synken av API-nycklar) fanns: logga in en gång till.
    if (saved?.sync?.keys) {
      const vault = await parseOrReload(await fetchVault())
      const remote = await refreshRemote(vault, saved)
      const opened = await openVaultWithKey(vault, saved, remote)
      files = opened.files.files
      session = { sync: saved.sync, bookKey: opened.bookKey }
      set('open')
      sync().then((s) => s.startSync(saved.sync!))
      return
    }
  } catch {
    // Fel nyckel (nytt lösenord, borttagen inloggning) eller ingen lagring: logga in igen.
    await forgetKey().catch(() => {})
  }
  set('locked')
}

/**
 * Ett konto som skapats med inbjudningskod har sin plats på servern. Hämta den på nytt när det
 * går, så att ett borttaget konto slutar fungera. Utan nät används den sparade kopian.
 */
async function refreshRemote(vault: Vault, saved: Saved): Promise<Slot | undefined> {
  if (vault.version !== 2 || vault.slots.some((s) => s.id === saved.slot)) return undefined
  let slot: Slot | null
  try {
    slot = await (await invites()).fetchSlot(saved.slot)
  } catch (e) {
    // Servern går inte att nå (offline eller pausad): använd den sparade kopian.
    if (saved.remote) return saved.remote
    throw e
  }
  if (!slot) throw new Error('Kontot finns inte längre.')
  if (JSON.stringify(slot) !== JSON.stringify(saved.remote)) await saveKey({ ...saved, remote: slot }).catch(() => {})
  return slot
}

async function fetchVaultOrExplain(): Promise<Vault> {
  let bytes: Uint8Array
  try {
    bytes = await fetchVault()
  } catch {
    throw new Error(navigator.onLine ? 'Kunde inte hämta innehållet. Försök igen.' : 'Du är offline. Första inloggningen kräver internet.')
  }
  return parseOrReload(bytes)
}

export async function login(user: string, password: string): Promise<void> {
  const vault = await fetchVaultOrExplain()
  // Inte i boken? Då kan kontot vara skapat med en inbjudningskod.
  const id = await slotId(user)
  let remote: Slot | null = null
  if (vault.version === 2 && !vault.slots.some((s) => s.id === id)) {
    remote = await (await invites()).fetchSlot(id).catch((e: Error & { status?: number }) => {
      if (e.status === 0) throw e
      return null
    })
  }
  let saved: Saved
  try {
    const res = await unlockVault(vault, user, password, remote)
    files = res.files.files
    const [secret, keys] = await Promise.all([syncSecret(user, password), secretsKey(user, password)])
    saved = { ...res.unlock, sync: { user: res.unlock.slot, secret, keys }, ...(remote ? { remote } : {}) }
    session = { sync: saved.sync!, bookKey: res.bookKey }
  } catch {
    throw new Error('Fel användarnamn eller lösenord.')
  }
  await saveKey(saved).catch(() => {
    /* utan lagring får du logga in varje gång */
  })
  // Hämta framstegen från dina andra enheter innan sidan visas, så att statistiken stämmer direkt.
  const s = await sync()
  await Promise.race([s.startSync(saved.sync!), new Promise((r) => setTimeout(r, 8000))])
  set('open')
}

/** Skapar ett konto med en inbjudningskod och loggar in med det. */
export async function createAccount(code: string, user: string, password: string): Promise<void> {
  if (!user.trim()) throw new Error('Välj ett användarnamn.')
  if (user.trim().length > 32) throw new Error('Användarnamnet får vara högst 32 tecken.')
  if (password.length < 8) throw new Error('Lösenordet måste vara minst 8 tecken.')
  const vault = await fetchVaultOrExplain()
  if (vault.version !== 2) throw new Error('Boken behöver låsas om innan inbjudningar fungerar.')
  const inv = await invites()
  const id = await slotId(user)
  if (vault.slots.some((s) => s.id === id) || (await inv.fetchSlot(id))) throw new Error(`Användarnamnet ”${user.trim()}” är upptaget. Välj ett annat.`)
  const sealed = await inv.fetchInvite(code)
  if (!sealed) throw new Error('Koden fungerar inte. Den kan vara felskriven, redan använd eller för gammal.')
  let bookKey: Uint8Array
  try {
    bookKey = await openInvite(code, sealed)
  } catch {
    throw new Error('Koden fungerar inte. Kontrollera att den är rätt skriven.')
  }
  if (!(await bookKeyOpens(vault, bookKey))) throw new Error('Koden hör till en äldre version av boken. Be om en ny kod.')
  await inv.claimInvite(code, await makeSlot(user, password, bookKey))
  await login(user, password)
}

export async function logout(): Promise<void> {
  // Skicka det sista innan utloggningen, om det går.
  const s = await sync()
  await Promise.race([s.syncNow(), new Promise((r) => setTimeout(r, 4000))])
  s.stopSync()
  // API-nycklarna följer inloggningen, så de ska inte ligga kvar i webbläsaren efter utloggning.
  const { clearAiLocal } = await import('../ai/ai.ts')
  clearAiLocal()
  files = null
  session = null
  await forgetKey().catch(() => {})
  set('locked')
}

/** Läser en fil under content/, t.ex. "data/index.json" eller "figures/venn.svg". */
export async function contentText(path: string): Promise<string> {
  if (PLAIN) {
    const res = await fetch(`${import.meta.env.BASE_URL}content/${path}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Kunde inte läsa ${path} (${res.status})`)
    return res.text()
  }
  const text = files?.[path]
  if (text === undefined) throw new Error(files ? `Hittar inte ${path}` : 'Du är inte inloggad.')
  return text
}
