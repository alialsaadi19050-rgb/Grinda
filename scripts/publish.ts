// Låser boken och pushar den i ett steg: npm run publicera
//
// Använder boknyckeln som sparats på datorn (första gången loggar du in en gång). Lägger
// bara till public/vault.bin i committen – andra ändringar i projektet rörs inte.
import { execFileSync } from 'node:child_process'
import { lock } from './lock.ts'
import { ROOT } from './vaultfile.ts'

const git = (...args: string[]) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()

const res = await lock()
if (!res) process.exit(0)

if (!git('status', '--porcelain', '--', 'public/vault.bin')) {
  console.log('Boken är oförändrad sedan senaste push – inget att publicera.')
  process.exit(0)
}

git('add', '--', 'public/vault.bin')
git('commit', '-m', 'Uppdatera boken', '--', 'public/vault.bin')
console.log('Pushar …')
try {
  git('push')
} catch {
  // Någon annan ändring ligger redan på GitHub: hämta den och försök igen.
  git('pull', '--rebase', '--autostash')
  git('push')
}
console.log('Klart: boken är pushad. Den syns på sidan om en minut eller två.')
