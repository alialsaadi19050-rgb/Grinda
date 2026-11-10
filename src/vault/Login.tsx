import { useState } from 'react'
import { createAccount, login } from './vault.ts'
import { prettyInvite } from './crypto.ts'
import './login.css'

/** En länk som slutar på #/?kod=XXXXXXXXXX öppnar "Skapa konto" med koden ifylld. */
const codeFromLink = () => /[?&]kod=([A-Za-z0-9-]+)/.exec(location.hash)?.[1] ?? ''

export function Login() {
  const linked = codeFromLink()
  const [mode, setMode] = useState<'login' | 'signup'>(linked ? 'signup' : 'login')
  const [code, setCode] = useState(linked ? prettyInvite(linked) : '')
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const signup = mode === 'signup'

  const switchTo = (m: 'login' | 'signup') => {
    setMode(m)
    setError(null)
    setPassword('')
    setAgain('')
  }

  const ready = signup ? code.trim() && user.trim() && password && again : user.trim() && password

  return (
    <main className="lg">
      <form
        className="lg-card"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!ready || busy) return
          if (signup && password !== again) {
            setError('Lösenorden är inte samma.')
            return
          }
          setBusy(true)
          setError(null)
          try {
            if (signup) await createAccount(code, user, password)
            else await login(user, password)
            // Ta bort koden ur adressen när du är inne.
            if (codeFromLink()) history.replaceState(null, '', `${location.pathname}#/`)
          } catch (err) {
            setError((err as Error).message)
            setPassword('')
            setAgain('')
            setBusy(false)
          }
        }}
      >
        <div className="lg-logo">
          grinda<span>.</span>
        </div>
        <p className="lg-sub">{signup ? 'Skapa ditt konto med koden du fått.' : 'Logga in för att öppna boken.'}</p>
        {signup && (
          <label>
            Inbjudningskod
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCDE-FGHJK"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              autoFocus={!linked}
            />
          </label>
        )}
        <label>
          {signup ? 'Välj användarnamn' : 'Användarnamn'}
          <input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus={!signup || !!linked} />
        </label>
        <label>
          {signup ? 'Välj lösenord (minst 8 tecken)' : 'Lösenord'}
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={signup ? 'new-password' : 'current-password'} />
        </label>
        {signup && (
          <label>
            Samma lösenord igen
            <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />
          </label>
        )}
        {error && (
          <p className="lg-error" role="alert">
            {error}
          </p>
        )}
        <button className="lg-btn" disabled={busy || !ready}>
          {busy ? (signup ? 'Skapar kontot …' : 'Låser upp …') : signup ? 'Skapa konto' : 'Logga in'}
        </button>
        <button type="button" className="lg-switch" onClick={() => switchTo(signup ? 'login' : 'signup')} disabled={busy}>
          {signup ? 'Har du redan ett konto? Logga in' : 'Har du en inbjudningskod? Skapa konto'}
        </button>
      </form>
    </main>
  )
}
