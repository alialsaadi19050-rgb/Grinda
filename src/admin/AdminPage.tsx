// Admin (bara bokens ägare): översikt, felrapporter, användare, meddelande till alla och inbjudningar.
import { useEffect, useState } from 'react'
import { ThemeEditor } from '../design/ThemeEditor.tsx'
import { useGame } from '../game/useGame.ts'
import { exerciseHref, Nav } from '../library/Library.tsx'
import { SettingsDialog } from '../settings/SettingsDialog.tsx'
import { useCanInvite } from '../vault/InviteTab.tsx'
import { myId } from '../social/api.ts'
import { slotId } from '../vault/crypto.ts'
import { announce, fetchAnnouncement, fetchOverview, fetchReports, fetchUsers, updateReport, userAction, type AdminUser, type Overview, type Report, type UserAction } from './api.ts'
import '../practice/practice.css'
import '../social/social.css'
import './admin.css'

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–')

export function AdminPage() {
  const isAdmin = useCanInvite()
  const game = useGame()
  const [checked, setChecked] = useState(false)
  const [settings, setSettings] = useState<false | 'invite' | 'tablet'>(false)
  useEffect(() => {
    const t = setTimeout(() => setChecked(true), 2500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="mk grain">
      <Nav streak={game?.streakDays ?? 0} onSettings={() => setSettings('tablet')} active="admin" />
      <main className="pr ad">
        <h1 className="ch-title">Admin</h1>
        {!isAdmin ? (
          <p className="pr-empty">{checked ? 'Den här sidan är bara för bokens ägare.' : 'Kontrollerar behörighet …'}</p>
        ) : (
          <>
            <p className="pr-lead">Bara du ser den här sidan. Meddelanden mellan andra visas aldrig här.</p>
            <OverviewPanel />
            <Reports />
            <Announce />
            <Users />
            <section className="pr-section">
              <h2>Inbjudningar</h2>
              <p className="mk-row-note">Skapa koder för nya konton och se vilka som använts.</p>
              <button className="mk-btn-ghost" onClick={() => setSettings('invite')}>
                Öppna inbjudningarna
              </button>
            </section>
          </>
        )}
      </main>
      {settings && <SettingsDialog initialTab={settings} onClose={() => setSettings(false)} />}
      <ThemeEditor />
    </div>
  )
}

function OverviewPanel() {
  const [o, setO] = useState<Overview | null>(null)
  useEffect(() => {
    fetchOverview().then(setO, () => {})
  }, [])
  if (!o) return null
  const max = Math.max(1, ...o.per_day.map((d) => d.n))
  return (
    <section className="pr-section">
      <h2>Översikt</h2>
      <div className="stp-cards">
        {(
          [
            [o.users, 'konton'],
            [o.active_day, 'aktiva idag'],
            [o.active_week, 'aktiva i veckan'],
            [o.attempts, 'svar totalt'],
            [o.profiles, 'med visningsnamn'],
            [o.messages_week, 'meddelanden i veckan'],
            [o.duels, 'dueller'],
            [o.open_reports, 'öppna felrapporter'],
            [o.open_invites, 'oanvända koder'],
          ] as const
        ).map(([n, l]) => (
          <div key={l} className="stp-card">
            <strong>{n}</strong>
            <span>{l}</span>
          </div>
        ))}
      </div>
      {o.per_day.length > 0 && (
        <>
          <h3 className="ad-sub">Svar per dag (alla, senaste två veckorna)</h3>
          <div className="ad-bars" role="img" aria-label={o.per_day.map((d) => `${d.day}: ${d.n}`).join(', ')}>
            {o.per_day.map((d) => (
              <div key={d.day} title={`${d.day}: ${d.n}`}>
                <i style={{ height: `${(100 * d.n) / max}%` }} />
                <small>{d.day.slice(8)}</small>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function Reports() {
  const [list, setList] = useState<Report[] | null>(null)
  const [show, setShow] = useState<'open' | 'all'>('open')
  const [copied, setCopied] = useState(false)
  const load = () => fetchReports().then(setList, () => setList([]))
  useEffect(() => {
    void load()
  }, [])
  const shown = (list ?? []).filter((r) => show === 'all' || r.status === 'open')
  const open = (list ?? []).filter((r) => r.status === 'open')
  const asText = open.map((r) => `#${r.id} uppgift ${r.context?.number ?? r.exercise_id} (${r.exercise_id})${r.label ? ` del ${r.label})` : ''}: ${r.message}`).join('\n')

  return (
    <section className="pr-section">
      <div className="pr-head">
        <h2>Felrapporter</h2>
        <div className="st-seg" style={{ margin: 0 }}>
          <button className={show === 'open' ? 'on' : ''} onClick={() => setShow('open')}>
            Öppna ({open.length})
          </button>
          <button className={show === 'all' ? 'on' : ''} onClick={() => setShow('all')}>
            Alla
          </button>
        </div>
        {open.length > 0 && (
          <button
            className="pr-link"
            onClick={() =>
              navigator.clipboard.writeText(asText).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              })
            }
          >
            {copied ? 'Kopierat ✓' : 'Kopiera alla öppna som text'}
          </button>
        )}
      </div>
      <p className="mk-row-note">Rapportera fel med knappen ”Rapportera fel” på en uppgift. Be Claude att rätta dem – rapporterna ligger i Supabase och kan läsas därifrån.</p>
      {!list ? (
        <p className="pr-empty">Hämtar …</p>
      ) : !shown.length ? (
        <p className="pr-empty">Inga {show === 'open' ? 'öppna ' : ''}felrapporter.</p>
      ) : (
        <ul className="pr-list">
          {shown.map((r) => (
            <li key={r.id} className={`pr-item ad-report ${r.status}`}>
              <a className="pr-item-main" href={exerciseHref(r.exercise_id)}>
                <span className="pr-num">{r.context?.number ?? r.exercise_id}</span>
                <span className="pr-item-text">
                  <strong>
                    {r.label ? `Del ${r.label}) · ` : ''}
                    {when(r.created_at)}
                    {r.status !== 'open' ? ` · ${r.status === 'fixed' ? 'Rättad' : 'Lämnas'}` : ''}
                  </strong>
                  <span className="ad-msg">{r.message}</span>
                  {r.note && <span>Anteckning: {r.note}</span>}
                </span>
              </a>
              <span className="pr-actions">
                {r.status === 'open' ? (
                  <>
                    <button onClick={() => updateReport(r.id, 'fixed').then(load)}>Rättad</button>
                    <button onClick={() => updateReport(r.id, 'wontfix').then(load)}>Lämna</button>
                  </>
                ) : (
                  <button onClick={() => updateReport(r.id, 'open').then(load)}>Öppna igen</button>
                )}
                <button onClick={() => updateReport(r.id, 'delete').then(load)}>Ta bort</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Announce() {
  const [current, setCurrent] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const load = () => fetchAnnouncement().then((a) => setCurrent(a?.body ?? null), () => {})
  useEffect(() => {
    void load()
  }, [])
  return (
    <section className="pr-section">
      <h2>Meddelande till alla</h2>
      <p className="mk-row-note">Visas överst på startsidan för alla som loggar in, tills de stänger det eller du tar bort det. Bra för t.ex. ”Nytt kapitel ute!” eller ”Prov på fredag”.</p>
      {current && (
        <div className="ad-current">
          <span>Visas nu:</span> <b>{current}</b>
          <button
            className="pr-link"
            onClick={async () => {
              await announce('')
              void load()
            }}
          >
            Ta bort
          </button>
        </div>
      )}
      <div className="so-row" style={{ marginTop: 10 }}>
        <input className="so-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Skriv ett meddelande till alla …" maxLength={500} />
        <button
          className="mk-btn-primary"
          disabled={busy || !text.trim()}
          onClick={async () => {
            setBusy(true)
            await announce(text).catch(() => {})
            setText('')
            await load()
            setBusy(false)
          }}
        >
          Publicera
        </button>
      </div>
    </section>
  )
}

const ACTIONS: { id: UserAction; label: string; confirm?: string; when: (u: AdminUser) => boolean }[] = [
  { id: 'block', label: 'Blockera från kompisar', when: (u) => !!u.name && !u.blocked && !u.is_admin },
  { id: 'unblock', label: 'Häv blockering', when: (u) => u.blocked },
  { id: 'make_admin', label: 'Gör till admin', confirm: 'Admin kan se och göra allt på den här sidan och bjuda in nya konton.', when: (u) => !u.is_admin },
  { id: 'remove_admin', label: 'Ta bort admin', when: (u) => u.is_admin },
  { id: 'reset', label: 'Nollställ framsteg', confirm: 'Alla svar, skrivytor och bokmärken för kontot raderas på servern och på kontots enheter. Det går inte att ångra.', when: () => true },
  { id: 'delete', label: 'Ta bort kontot', confirm: 'Kontot och allt det sparat raderas. Det går inte att ångra.', when: (u) => u.invite_account && !u.is_admin },
]

const LABELS = 'grinda.admin.labels'
const readLabels = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(LABELS) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function Users() {
  const [list, setList] = useState<AdminUser[] | null>(null)
  const [labels, setLabels] = useState(readLabels)
  const [who, setWho] = useState('')
  const [found, setFound] = useState<string | null>(null)
  const saveLabel = (id: string, name: string) => {
    const next = { ...labels, [id]: name }
    setLabels(next)
    try {
      localStorage.setItem(LABELS, JSON.stringify(next))
    } catch {
      /* bara den här gången */
    }
  }
  // Användarnamnet sparas bara som en hash, men känner du till namnet kan appen räkna fram hashen.
  const recognize = async () => {
    const name = who.trim()
    if (!name) return
    const id = await slotId(name)
    const hit = list?.find((u) => u.id === id)
    if (hit) {
      saveLabel(id, name)
      setFound(`Hittade ${name}.`)
      setWho('')
    } else setFound(`Inget konto som har synkat heter ”${name}”.`)
  }
  const [pending, setPending] = useState<{ user: AdminUser; action: (typeof ACTIONS)[number] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const me = myId()
  const load = () => fetchUsers().then(setList, (e: Error) => setError(e.message))
  useEffect(() => {
    void load()
  }, [])
  const run = async (u: AdminUser, a: UserAction) => {
    setError(null)
    try {
      await userAction(u.id, a)
      setPending(null)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <section className="pr-section">
      <h2>Användare</h2>
      <p className="mk-row-note">Alla konton som har synkat. Användarnamn sparas inte på servern – du ser visningsnamnet (om de valt ett) och noteringen från inbjudan.</p>
      <form
        className="so-row"
        onSubmit={(e) => {
          e.preventDefault()
          void recognize()
        }}
      >
        <input className="so-input" value={who} onChange={(e) => setWho(e.target.value)} placeholder="Känn igen ett konto: skriv dess användarnamn" aria-label="Användarnamn att känna igen" />
        <button className="mk-btn-ghost" disabled={!who.trim()}>
          Känn igen
        </button>
      </form>
      {found && <p className="so-help">{found} Namnen sparas bara i den här webbläsaren.</p>}
      {error && <p className="so-error">{error}</p>}
      {!list ? (
        <p className="pr-empty">Hämtar …</p>
      ) : (
        <ul className="pr-list">
          {list.map((u) => (
            <li key={u.id} className="pr-item">
              <span className="pr-item-main">
                <span className="so-avatar">{(labels[u.id] ?? u.name ?? u.invite_note ?? '?').slice(0, 1).toUpperCase()}</span>
                <span className="pr-item-text">
                  <strong>
                    {labels[u.id] ?? u.name ?? u.invite_note ?? 'Okänt namn'}
                    {labels[u.id] && u.name && u.name !== labels[u.id] ? ` (${u.name})` : ''}
                    {u.id === me ? ' (du)' : ''}
                    {u.is_admin && <span className="ad-tag">admin</span>}
                    {u.blocked && <span className="ad-tag bad">blockerad</span>}
                    {u.invite_account && <span className="ad-tag soft">inbjudan</span>}
                  </strong>
                  <span>
                    Senast {when(u.last_seen)} · {u.attempts} svar ({u.attempts_week} i veckan) · id {u.id.slice(0, 8)}
                  </span>
                </span>
              </span>
              <span className="pr-actions">
                <select
                  className="ad-select"
                  value=""
                  aria-label="Åtgärd"
                  onChange={(e) => {
                    const a = ACTIONS.find((x) => x.id === e.target.value)
                    if (!a) return
                    if (a.confirm) setPending({ user: u, action: a })
                    else void run(u, a.id)
                  }}
                >
                  <option value="">Åtgärd …</option>
                  {ACTIONS.filter((a) => a.when(u) && !(u.id === me && ['block', 'remove_admin', 'delete'].includes(a.id))).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </span>
              {pending?.user.id === u.id && (
                <div className="ad-confirm">
                  <p>
                    <b>{pending.action.label}?</b> {pending.action.confirm}
                  </p>
                  <div className="so-row">
                    <button className="st-secondary danger" onClick={() => void run(u, pending.action.id)}>
                      Ja, {pending.action.label.toLowerCase()}
                    </button>
                    <button className="st-secondary" onClick={() => setPending(null)}>
                      Avbryt
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
