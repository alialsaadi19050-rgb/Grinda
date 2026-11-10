// Krypterar bokens innehåll (public/content/data och figures) till public/vault.bin. Kör om
// efter varje ändring i innehållet.
//
//   npm run lock             låser med samma inloggningar som förut. Första gången loggar du in;
//                            sedan sparas boknyckeln på datorn och du slipper logga in.
//   npm run publicera        låser och pushar boken i ett steg
//   npm run lock -- --glom   glömmer den sparade nyckeln (nästa gång loggar du in igen)
//   npm run lock -- --ny     börjar om med en enda ny inloggning (t.ex. om alla lösenord glömts)
//
// Inloggningar läggs till och tas bort med npm run users eller med inbjudningskoder i appen.
// Lösenord sparas ingenstans.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeSlot, newBookKey, type Slot } from '../src/vault/crypto.ts'
import { askNewLogin, forgetBookKey, openWithLogin, openWithSavedKey, readVault, ROOT, saveBookKey, writeVault } from './vaultfile.ts'

/** Låser boken. Ger antalet filer och storleken. */
export async function lock(argv: string[] = []) {
  if (argv.includes('--glom')) {
    forgetBookKey()
    console.log('Den sparade boknyckeln är borttagen. Nästa gång loggar du in igen.')
    return null
  }

  const CONTENT = join(ROOT, 'public', 'content')
  const files: Record<string, string> = {}
  for (const dir of ['data', 'figures']) {
    for (const f of readdirSync(join(CONTENT, dir))) {
      if (/\.(json|svg)$/.test(f)) files[`${dir}/${f}`] = readFileSync(join(CONTENT, dir, f), 'utf8')
    }
  }
  if (!files['data/index.json']) throw new Error('Hittar inte public/content/data/index.json')
  const content = { files, createdAt: new Date().toISOString() }

  const fresh = argv.includes('--ny')
  const vault = fresh ? null : readVault()
  let bookKey: Uint8Array
  let slots: Slot[]
  let check: { user: string; password: string }[]
  /** Det som redan ligger i boken, för att se om något ändrats. */
  let before: Record<string, string> | null = null

  const saved = vault ? await openWithSavedKey(vault) : null
  if (vault?.version === 2 && saved) {
    // Sparad nyckel på den här datorn: ingen inloggning behövs.
    console.log('Använder den sparade boknyckeln – ingen inloggning behövs.')
    bookKey = saved.bookKey
    slots = vault.slots
    check = []
    before = saved.files.files
  } else if (vault?.version === 2) {
    // Samma boknyckel och samma inloggningar som förut.
    const me = await openWithLogin(vault)
    bookKey = me.bookKey!
    slots = vault.slots
    check = [me]
    before = me.files.files
  } else if (vault?.version === 1) {
    // Äldre bok med en inloggning: flytta över den till det nya formatet.
    const me = await openWithLogin(vault, 'din inloggning')
    bookKey = newBookKey()
    slots = [await makeSlot(me.user, me.password, bookKey)]
    check = [me]
  } else {
    if (fresh) console.log('OBS: med --ny får boken en ny nyckel. Konton som skapats med inbjudningskod slutar då fungera och behöver nya koder.')
    console.log('Välj användarnamn och lösenord för boken.')
    const me = await askNewLogin()
    bookKey = newBookKey()
    slots = [await makeSlot(me.user, me.password, bookKey)]
    check = [me]
  }

  const same = (a: Record<string, string>, b: Record<string, string>) => Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v)
  if (before && same(before, files)) {
    saveBookKey(bookKey)
    console.log('Klart: innehållet är oförändrat, så boken behöver inte låsas om.')
    return 'oförändrad' as const
  }

  const bytes = await writeVault(content, bookKey, slots, check)
  saveBookKey(bookKey)
  console.log(`Klart: ${Object.keys(files).length} filer krypterade till public/vault.bin (${(bytes.length / 1024).toFixed(0)} kB), ${slots.length} ${slots.length === 1 ? 'inloggning' : 'inloggningar'}.`)
  return bytes
}

if (import.meta.main) await lock(process.argv.slice(2))
