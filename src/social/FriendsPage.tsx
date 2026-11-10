// Kompisar: topplista, meddelanden (med sök på namn) och dueller.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ThemeEditor } from '../design/ThemeEditor.tsx'
import { Send } from '../design/icons.tsx'
import { useGame } from '../game/useGame.ts'
import { exerciseHref, Nav, useContent } from '../library/Library.tsx'
import { SettingsDialog } from '../settings/SettingsDialog.tsx'
import { subjectOf, useSubject } from '../subject/subject.ts'
import { MathText } from '../ui/MathText.tsx'
import { createDuel, fetchBoard, fetchDuels, fetchImage, join, leave, myId, readThread, refreshInbox, resetInbox, search, send, useInbox, type Duel, type Friend, type Message } from './api.ts'
import '../practice/practice.css'
import './social.css'

type Tab = 'board' | 'chat' | 'duels'

const time = (iso: string) => {
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  return today ? d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

export function FriendsPage({ with: chatWith }: { with?: string }) {
  const inbox = useInbox()
  const game = useGame()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tab, setTab] = useState<Tab>(chatWith ? 'chat' : 'board')
  const [board, setBoard] = useState<Friend[] | null>(null)
  const unread = Object.values(inbox.unread).reduce((s, n) => s + n, 0)

  useEffect(() => {
    if (chatWith) setTab('chat')
  }, [chatWith])
  useEffect(() => {
    if (inbox.joined) fetchBoard().then(setBoard, () => setBoard([]))
  }, [inbox.joined, inbox.me?.name])

  return (
    <div className="mk grain">
      <Nav streak={game?.streakDays ?? 0} onSettings={() => setSettingsOpen(true)} active="friends" />
      <main className="so">
        <h1 className="ch-title">Kompisar</h1>
        {!myId() ? (
          <p className="pr-empty">Logga in för att se dina kompisar. (I utvecklingsläget finns ingen inloggning.)</p>
        ) : inbox.joined === null ? (
          <p className="pr-empty">{inbox.error ?? 'Hämtar …'}</p>
        ) : !inbox.joined ? (
          <JoinForm />
        ) : (
          <>
            <div className="so-tabs" role="tablist">
              {(
                [
                  ['board', 'Topplista'],
                  ['chat', unread ? `Meddelanden (${unread})` : 'Meddelanden'],
                  ['duels', 'Dueller'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  className={tab === id ? 'on' : ''}
                  onClick={() => {
                    setTab(id)
                    if (id !== 'chat' && chatWith) location.hash = '#/kompisar'
                  }}
                >
                  {label}
                </button>
              ))}
              <span className="so-me">
                Du heter <b>{inbox.me?.name}</b> · <ProfileMenu />
              </span>
            </div>
            {tab === 'board' && <Board board={board} />}
            {tab === 'chat' && <Chats board={board} chatWith={chatWith} />}
            {tab === 'duels' && <Duels board={board} />}
          </>
        )}
      </main>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      <ThemeEditor />
    </div>
  )
}

/* ---------- Gå med ---------- */

function JoinForm({ initial = '', onDone }: { initial?: string; onDone?: () => void }) {
  const [name, setName] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="so-join"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        try {
          await join(name)
          resetInbox()
          onDone?.()
        } catch (err) {
          setError((err as Error).message)
        }
        setBusy(false)
      }}
    >
      {!initial && (
        <>
          <h2>Välj ett visningsnamn</h2>
          <p className="so-help">
            Namnet syns för de andra i Grinda. Det används på topplistan, och kompisar kan söka efter det för att skicka meddelanden, dela uträkningar och utmana dig på dueller. Det behöver inte vara samma som ditt användarnamn, och
            ditt lösenord delas aldrig.
          </p>
          <p className="so-help">
            Meddelanden sparas på Grindas server. De är inte krypterade, så skriv inget hemligt. Du kan lämna när du vill – då försvinner du från listan.
          </p>
        </>
      )}
      <div className="so-row">
        <input className="so-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="T.ex. Looshy" maxLength={24} autoFocus aria-label="Visningsnamn" />
        <button className="mk-btn-primary" disabled={busy || name.trim().length < 2}>
          {busy ? 'Sparar …' : initial ? 'Byt namn' : 'Gå med'}
        </button>
      </div>
      {error && <p className="so-error">{error}</p>}
    </form>
  )
}

function ProfileMenu() {
  const inbox = useInbox()
  const [open, setOpen] = useState<'name' | 'leave' | null>(null)
  return (
    <>
      <button className="pr-link" onClick={() => setOpen(open === 'name' ? null : 'name')}>
        byt namn
      </button>
      {' · '}
      <button className="pr-link" onClick={() => setOpen(open === 'leave' ? null : 'leave')}>
        lämna
      </button>
      {open === 'name' && (
        <div className="so-pop">
          <JoinForm initial={inbox.me?.name} onDone={() => setOpen(null)} />
        </div>
      )}
      {open === 'leave' && (
        <div className="so-pop">
          <p>Lämna kompisarna? Du försvinner från topplistan och ingen kan skicka till dig. Dina framsteg finns kvar.</p>
          <div className="so-row">
            <button
              className="st-secondary danger"
              onClick={async () => {
                await leave().catch(() => {})
                resetInbox()
              }}
            >
              Lämna
            </button>
            <button className="st-secondary" onClick={() => setOpen(null)}>
              Avbryt
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/* ---------- Topplista ---------- */

function Board({ board }: { board: Friend[] | null }) {
  const [sort, setSort] = useState<'weekXp' | 'xp' | 'streak' | 'solved'>('weekXp')
  const me = myId()
  if (!board) return <p className="pr-empty">Hämtar topplistan …</p>
  const week = 7 * 86_400_000
  // Veckans XP räknas bara om den skickats den senaste veckan.
  const value = (f: Friend) => (sort === 'weekXp' && Date.now() - (f.stats.at ?? 0) > week ? 0 : (f.stats[sort] ?? 0))
  const rows = [...board].sort((a, b) => value(b) - value(a) || a.name.localeCompare(b.name))
  const label = { weekXp: 'XP senaste 7 dagarna', xp: 'XP totalt', streak: 'Dagar i rad', solved: 'Lösta uppgifter' }[sort]
  return (
    <section className="so-section">
      <div className="st-seg">
        {(
          [
            ['weekXp', 'Veckan'],
            ['xp', 'Totalt'],
            ['streak', 'Dagar i rad'],
            ['solved', 'Lösta'],
          ] as const
        ).map(([id, l]) => (
          <button key={id} className={sort === id ? 'on' : ''} onClick={() => setSort(id)}>
            {l}
          </button>
        ))}
      </div>
      <ol className="so-board">
        {rows.map((f, i) => (
          <li key={f.user_id} className={f.user_id === me ? 'me' : ''}>
            <span className={`so-rank r${i + 1}`}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
            <span className="so-avatar">{f.name.slice(0, 1).toUpperCase()}</span>
            <span className="so-name">
              <strong>
                {f.name}
                {f.user_id === me ? ' (du)' : ''}
              </strong>
              <small>
                {f.stats.level ? `Nivå ${f.stats.level} · ${f.stats.levelName}` : 'Inga poäng än'}
                {f.stats.streak ? ` · 🔥 ${f.stats.streak}` : ''}
                {f.stats.badges ? ` · ${f.stats.badges} märken` : ''}
              </small>
            </span>
            <span className="so-score" title={label}>
              {value(f)}
              <small>{sort === 'weekXp' || sort === 'xp' ? 'XP' : sort === 'streak' ? 'dagar' : 'lösta'}</small>
            </span>
            {f.user_id !== me && (
              <a className="so-small-btn" href={`#/kompisar/${f.user_id}`}>
                Skriv
              </a>
            )}
          </li>
        ))}
      </ol>
      <p className="so-help">Topplistan uppdateras när ni räknar. XP får man för rätta svar – mer för rätt på första försöket och svårare nivåer.</p>
    </section>
  )
}

/* ---------- Meddelanden ---------- */

function Chats({ board, chatWith }: { board: Friend[] | null; chatWith?: string }) {
  const inbox = useInbox()
  const me = myId()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<{ user_id: string; name: string }[] | null>(null)
  const names = useMemo(() => new Map((board ?? []).map((f) => [f.user_id, f.name])), [board])

  useEffect(() => {
    const q = query.trim()
    if (!q) return setHits(null)
    const t = setTimeout(() => search(q).then(setHits, () => setHits([])), 250)
    return () => clearTimeout(t)
  }, [query])

  // Trådar: senaste meddelandet med varje kompis.
  const threads = useMemo(() => {
    const last = new Map<string, Message>()
    for (const m of inbox.messages) last.set(m.from_id === me ? m.to_id : m.from_id, m)
    return [...last].sort((a, b) => b[1].id - a[1].id)
  }, [inbox.messages, me])

  return (
    <section className={`so-chat ${chatWith ? 'open' : ''}`}>
      <aside className="so-threads">
        <input className="so-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök på namn för att skriva …" aria-label="Sök kompis" />
        {hits ? (
          hits.length ? (
            hits.map((h) => (
              <a key={h.user_id} className="so-thread" href={`#/kompisar/${h.user_id}`} onClick={() => setQuery('')}>
                <span className="so-avatar">{h.name.slice(0, 1).toUpperCase()}</span>
                <span className="so-name">
                  <strong>{h.name}</strong>
                  <small>Skriv ett meddelande</small>
                </span>
              </a>
            ))
          ) : (
            <p className="so-help">Ingen heter så. Kompisen måste ha valt ett visningsnamn under Kompisar.</p>
          )
        ) : threads.length ? (
          threads.map(([who, m]) => (
            <a key={who} className={`so-thread ${who === chatWith ? 'on' : ''}`} href={`#/kompisar/${who}`}>
              <span className="so-avatar">{(names.get(who) ?? '?').slice(0, 1).toUpperCase()}</span>
              <span className="so-name">
                <strong>{names.get(who) ?? 'Okänd'}</strong>
                <small>
                  {m.from_id === me ? 'Du: ' : ''}
                  {preview(m)}
                </small>
              </span>
              <span className="so-thread-meta">
                <small>{time(m.created_at)}</small>
                {inbox.unread[who] ? <b className="so-unread">{inbox.unread[who]}</b> : null}
              </span>
            </a>
          ))
        ) : (
          <p className="so-help">Inga meddelanden än. Sök på en kompis namn här ovanför, eller tryck Skriv på topplistan.</p>
        )}
      </aside>
      {chatWith ? <Thread who={chatWith} name={names.get(chatWith) ?? hits?.find((h) => h.user_id === chatWith)?.name} /> : <div className="so-thread-empty">Välj en kompis för att läsa och skriva.</div>}
    </section>
  )
}

const preview = (m: Message) => (m.kind === 'duel' ? '⚔️ Duell' : m.kind === 'work' ? `📝 Uträkning till ${m.payload?.number ?? 'uppgift'}` : m.kind === 'exercise' ? `📘 Uppgift ${m.payload?.number ?? ''}` : m.body)

function Thread({ who, name }: { who: string; name?: string }) {
  const inbox = useInbox()
  const content = useContent('all')
  const subject = useSubject()
  const me = myId()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const list = inbox.messages.filter((m) => (m.from_id === who && m.to_id === me) || (m.from_id === me && m.to_id === who))

  useEffect(() => {
    readThread(who)
    end.current?.scrollIntoView({ block: 'end' })
  }, [who, list.length])

  const submit = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await send(who, 'text', text.trim())
      setText('')
      await refreshInbox()
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  const challenge = async () => {
    if (!content) return
    setError(null)
    try {
      const ids = pickDuel(content.exercises.filter((e) => { const c = content.index.chapters.find((x) => x.id === e.chapter); return !!c && subjectOf(c) === subject }), 5)
      const id = await createDuel(who, subject, ids)
      await refreshInbox()
      location.hash = `#/duell/${id}`
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="so-thread-view">
      <header>
        <a className="so-back" href="#/kompisar">
          ←
        </a>
        <span className="so-avatar">{(name ?? '?').slice(0, 1).toUpperCase()}</span>
        <strong>{name ?? 'Kompis'}</strong>
        <button className="so-small-btn" onClick={challenge} title={`5 slumpade uppgifter i ${subject === 'fysik' ? 'Fysik 2' : 'Matte 5'}. Flest rätt på första försöket vinner, tiden avgör vid lika.`}>
          ⚔️ Utmana till duell
        </button>
      </header>
      <div className="so-messages">
        {list.length === 0 && <p className="so-help">Säg hej till {name ?? 'din kompis'}!</p>}
        {list.map((m, i) => (
          <Bubble key={m.id} m={m} mine={m.from_id === me} last={i === list.length - 1} />
        ))}
        <div ref={end} />
      </div>
      {error && <p className="so-error">{error}</p>}
      <form
        className="so-compose"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void submit()
            }
          }}
          placeholder={`Skriv till ${name ?? 'kompisen'} …`}
          rows={1}
          maxLength={2000}
          aria-label="Meddelande"
        />
        <button className="so-send-btn" disabled={busy || !text.trim()} aria-label="Skicka">
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}

function Bubble({ m, mine, last }: { m: Message; mine: boolean; last: boolean }) {
  const [image, setImage] = useState<string | null>(null)
  const [big, setBig] = useState(false)
  useEffect(() => {
    if (m.has_image) fetchImage(m.id).then(setImage, () => {})
  }, [m.id, m.has_image])
  const p = m.payload
  return (
    <div className={`so-bubble ${mine ? 'mine' : ''}`}>
      {m.kind === 'duel' && p?.duel ? (
        <a className="so-card" href={`#/duell/${p.duel}`}>
          <span>⚔️</span>
          <span>
            <strong>{mine ? 'Du utmanade till duell' : 'Du har blivit utmanad!'}</strong>
            <small>Öppna duellen</small>
          </span>
        </a>
      ) : (m.kind === 'exercise' || m.kind === 'work') && p?.exerciseId ? (
        <a className="so-card" href={exerciseHref(p.exerciseId)}>
          <span>{m.kind === 'work' ? '📝' : '📘'}</span>
          <span>
            <strong>
              {m.kind === 'work' ? 'Uträkning till uppgift' : 'Uppgift'} {p.number}
            </strong>
            <small>{p.title} · öppna uppgiften</small>
          </span>
        </a>
      ) : null}
      {m.has_image && (image ? <img className={`so-image ${big ? 'big' : ''}`} src={image} alt={`Uträkning till uppgift ${p?.number ?? ''}`} onClick={() => setBig((b) => !b)} title={big ? 'Mindre' : 'Större'} /> : <div className="so-image loading">Hämtar bilden …</div>)}
      {p?.notes && <MathText className="so-notes" text={p.notes} />}
      {m.body && <p>{m.body}</p>}
      <small className="so-time">
        {time(m.created_at)}
        {mine && last && m.read_at ? ' · Läst' : ''}
      </small>
    </div>
  )
}

/* ---------- Dueller ---------- */

/** Slumpar uppgifter som rättas automatiskt (inga självbedömda delar). */
export function pickDuel(pool: { id: string; parts: { answer: { type: string } }[] }[], n: number): string[] {
  const ok = pool.filter((e) => e.parts.every((p) => p.answer.type !== 'self'))
  const shuffled = [...ok].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n).map((e) => e.id)
}

function Duels({ board }: { board: Friend[] | null }) {
  const [list, setList] = useState<Omit<Duel, 'exercises' | 'names'>[] | null>(null)
  const me = myId()!
  const names = new Map((board ?? []).map((f) => [f.user_id, f.name]))
  useEffect(() => {
    fetchDuels().then(setList, () => setList([]))
  }, [])
  if (!list) return <p className="pr-empty">Hämtar dueller …</p>
  return (
    <section className="so-section">
      <p className="so-help">Utmana en kompis från chatten: ni får samma fem uppgifter. Flest deluppgifter rätt på första försöket vinner – vid lika vinner den som var snabbast.</p>
      {!list.length ? (
        <p className="pr-empty">Inga dueller än.</p>
      ) : (
        <ul className="pr-list">
          {list.map((d) => {
            const other = d.created_by === me ? d.opponent : d.created_by
            const mineR = d.results[me]
            const theirs = d.results[other]
            const status = !mineR ? 'Din tur!' : !theirs ? 'Väntar på motståndaren' : duelWinner(d.results, me, other)
            return (
              <li key={d.id} className="pr-item">
                <a className="pr-item-main" href={`#/duell/${d.id}`}>
                  <span className="pr-num">⚔️</span>
                  <span className="pr-item-text">
                    <strong>Mot {names.get(other) ?? 'okänd'}</strong>
                    <span>
                      {d.subject === 'fysik' ? 'Fysik 2' : 'Matte 5'} · {time(d.created_at)}
                      {mineR && theirs ? ` · ${mineR.score}–${theirs.score}` : ''}
                    </span>
                  </span>
                </a>
                <span className={`so-status ${!mineR ? 'turn' : ''}`}>{status}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function duelWinner(results: Duel['results'], me: string, other: string): string {
  const a = results[me]
  const b = results[other]
  if (!a || !b) return ''
  if (a.score !== b.score) return a.score > b.score ? 'Du vann! 🏆' : 'Du förlorade'
  if (a.ms !== b.ms) return a.ms < b.ms ? 'Du vann på tid! 🏆' : 'Du förlorade på tid'
  return 'Oavgjort'
}
