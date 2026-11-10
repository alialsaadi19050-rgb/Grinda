// Inställningar → Bjud in: skapa inbjudningskoder och se vilka som använts. Syns bara för den
// som får bjuda in (bokens ägare).
import { useEffect, useState } from 'react'
import { currentSession } from './vault.ts'
import { createInvite, deleteInvite, INVITE_DAYS, inviteLink, listInvites, type Invite } from './invites.ts'

let cached: { user: string; ok: Promise<boolean> } | null = null

/** Får den inloggade skapa koder? Frågar servern en gång per inloggning. */
export function useCanInvite(): boolean {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    const s = currentSession()
    if (!s?.bookKey) return
    if (cached?.user !== s.sync.user) {
      const ok = listInvites(s.sync).then(
        () => true,
        (e: { status?: number }) => {
          // Inte nått servern: fråga igen nästa gång.
          if (e.status !== 403) cached = null
          return false
        },
      )
      cached = { user: s.sync.user, ok }
    }
    let live = true
    cached.ok.then((v) => live && setOk(v))
    return () => {
      live = false
    }
  }, [])
  return ok
}

const day = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function InviteTab() {
  const session = currentSession()
  const [list, setList] = useState<Invite[] | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [fresh, setFresh] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = () => {
    if (!session) return
    listInvites(session.sync)
      .then(setList)
      .catch((e: Error) => setError(e.message))
  }
  useEffect(reload, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!session?.bookKey) return <p className="st-help">Logga in för att bjuda in.</p>

  const make = async () => {
    setBusy(true)
    setError(null)
    try {
      const code = await createInvite(session.sync, session.bookKey!, note)
      setFresh(code)
      setNote('')
      reload()
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  const doCopy = async (what: string, text: string) => {
    if (await copy(text)) {
      setCopied(what)
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 1800)
    } else setError('Kunde inte kopiera. Markera texten och kopiera själv.')
  }

  const remove = async (inv: Invite) => {
    setError(null)
    try {
      await deleteInvite(session.sync, inv.hash)
      setConfirm(null)
      if (fresh && inv.code === fresh) setFresh(null)
      reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const now = Date.now()

  return (
    <>
      <section className="st-section">
        <h3>Bjud in en kompis</h3>
        <p className="st-help">
          Skapa en kod och skicka den. Kompisen går till sidan, trycker på <b>Har du en inbjudningskod?</b> och väljer eget användarnamn och lösenord. Koden fungerar en gång och gäller i {INVITE_DAYS} dagar. Du behöver inte låsa om boken.
        </p>
        <div className="st-invite-new">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Till vem? (valfritt)" maxLength={60} onKeyDown={(e) => e.key === 'Enter' && !busy && make()} />
          <button className="st-primary" onClick={make} disabled={busy}>
            {busy ? 'Skapar …' : 'Skapa kod'}
          </button>
        </div>
        {fresh && (
          <div className="st-invite-fresh">
            <span className="st-invite-code">{fresh}</span>
            <div className="st-zone-presets">
              <button onClick={() => doCopy('kod', fresh)}>{copied === 'kod' ? 'Kopierad ✓' : 'Kopiera kod'}</button>
              <button onClick={() => doCopy('länk', inviteLink(fresh))}>{copied === 'länk' ? 'Kopierad ✓' : 'Kopiera länk med koden'}</button>
            </div>
            <p className="st-help">Länken öppnar sidan med koden redan ifylld.</p>
          </div>
        )}
        {error && <p className="st-note st-invite-error">{error}</p>}
      </section>
      <section className="st-section">
        <h3>Dina koder</h3>
        {!list ? (
          <p className="st-help">Hämtar …</p>
        ) : !list.length ? (
          <p className="st-help">Du har inte skapat några koder än.</p>
        ) : (
          <ul className="st-invites">
            {list.map((inv) => {
              const expired = !inv.usedAt && new Date(inv.expiresAt).getTime() < now
              return (
                <li key={inv.hash}>
                  <div>
                    <strong>{inv.note || 'Utan namn'}</strong>
                    <small>
                      {inv.usedAt ? `Konto skapat ${day(inv.usedAt)}` : expired ? 'Har gått ut' : `Oanvänd · gäller till ${day(inv.expiresAt)}`}
                      {!inv.usedAt && !expired && inv.code ? ` · ${inv.code}` : ''}
                    </small>
                  </div>
                  <div className="st-invite-actions">
                    {!inv.usedAt && !expired && inv.code && (
                      <button className="st-link" onClick={() => doCopy(inv.hash, inviteLink(inv.code!))}>
                        {copied === inv.hash ? 'Kopierad ✓' : 'Kopiera länk'}
                      </button>
                    )}
                    {confirm === inv.hash ? (
                      <>
                        <button className="st-secondary danger" onClick={() => remove(inv)}>
                          Ja, ta bort kontot
                        </button>
                        <button className="st-link" onClick={() => setConfirm(null)}>
                          Avbryt
                        </button>
                      </>
                    ) : (
                      <button className="st-link" onClick={() => (inv.usedAt ? setConfirm(inv.hash) : remove(inv))}>
                        {inv.usedAt ? 'Ta bort kontot' : expired ? 'Ta bort' : 'Dra tillbaka'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <p className="st-help st-invite-foot">Konton som du lagt till med npm run users syns inte här.</p>
      </section>
    </>
  )
}
