// Gemensamt för npm run lock, unlock, users och publicera: läsa och skriva public/vault.bin.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { buildVault, login, openWithBookKey, parseVault, type Slot, type Vault, type VaultFiles } from '../src/vault/crypto.ts'
import { ask } from './prompt.ts'

export const ROOT = join(import.meta.dirname, '..')
export const VAULT = join(ROOT, 'public', 'vault.bin')

export function readVault(): Vault | null {
  return existsSync(VAULT) ? parseVault(new Uint8Array(readFileSync(VAULT))) : null
}

/* ---------- Sparad boknyckel ---------- */

// Efter första inloggningen sparas boknyckeln på den här datorn, utanför projektet, så att den
// aldrig kan hamna på GitHub. Då behöver npm run lock och npm run publicera ingen inloggning.
// Den som kommer åt datorn kan redan läsa boken i public/content, så skyddet blir inte sämre.
export const KEY_FILE = join(process.env.LOCALAPPDATA ?? join(homedir(), '.config'), 'grinda', 'boknyckel')

export function saveBookKey(bookKey: Uint8Array | null) {
  if (!bookKey) return
  mkdirSync(dirname(KEY_FILE), { recursive: true })
  writeFileSync(KEY_FILE, Buffer.from(bookKey).toString('base64'), { mode: 0o600 })
}

export function forgetBookKey() {
  rmSync(KEY_FILE, { force: true })
}

/** Öppnar boken med den sparade nyckeln, eller null om ingen nyckel finns eller den inte passar. */
export async function openWithSavedKey(vault: Vault): Promise<{ bookKey: Uint8Array; files: VaultFiles } | null> {
  if (vault.version !== 2 || !existsSync(KEY_FILE)) return null
  const bookKey = new Uint8Array(Buffer.from(readFileSync(KEY_FILE, 'utf8').trim(), 'base64'))
  try {
    return { bookKey, files: await openWithBookKey(vault, bookKey) }
  } catch {
    return null
  }
}

/* ---------- Inloggning ---------- */

/** Ber om en befintlig inloggning och öppnar boken med den. Sparar boknyckeln till nästa gång. */
export async function openWithLogin(vault: Vault, prompt = 'en befintlig inloggning') {
  console.log(`Logga in med ${prompt}.`)
  const user = process.env.MATTE_USER ?? (await ask('Användarnamn: '))
  const password = process.env.MATTE_PASS ?? (await ask('Lösenord: ', true))
  try {
    const res = await login(vault, user, password)
    saveBookKey(res.bookKey)
    return { user, password, ...res }
  } catch {
    console.error('\nFel användarnamn eller lösenord. Här loggar du in med ett konto som redan finns – inte det nya. Inget har ändrats.')
    process.exit(1)
  }
}

/** Frågar efter ett nytt användarnamn och lösenord (två gånger). */
export async function askNewLogin(env = true) {
  const user = (env && process.env.MATTE_NEW_USER) || (await ask('Nytt användarnamn: '))
  let password = env ? process.env.MATTE_NEW_PASS : undefined
  if (!password) {
    password = await ask('Lösenord: ', true)
    if ((await ask('Samma lösenord igen: ', true)) !== password) throw new Error('Lösenorden är inte samma.')
  }
  if (!user.trim()) throw new Error('Användarnamnet får inte vara tomt.')
  if (password.length < 8) throw new Error('Lösenordet måste vara minst 8 tecken.')
  return { user, password }
}

/** Skriver boken och kontrollerar att den går att öppna, med nyckeln och med varje inloggning man just angett. */
export async function writeVault(files: VaultFiles, bookKey: Uint8Array, slots: Slot[], check: { user: string; password: string }[]) {
  const bytes = await buildVault(files, bookKey, slots)
  const opened = await openWithBookKey(parseVault(bytes), bookKey)
  if (Object.keys(opened.files).length !== Object.keys(files.files).length) throw new Error('Kontrollen misslyckades.')
  for (const c of check) {
    const res = await login(parseVault(bytes), c.user, c.password)
    if (Object.keys(res.files.files).length !== Object.keys(files.files).length) throw new Error('Kontrollen misslyckades.')
  }
  writeFileSync(VAULT, bytes)
  return bytes
}
