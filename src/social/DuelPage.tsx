// En duell: samma uppgifter för båda. Poängen är antalet deluppgifter rätt på första försöket,
// och tiden avgör vid lika. Uppgifterna räknas också som vanlig övning.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Exercise } from '../content/types.ts'
import { ChevronLeft } from '../design/icons.tsx'
import { AnswerPanel } from '../exercise/AnswerPanel.tsx'
import { useAllContent } from '../game/useGame.ts'
import { db, resolveOverrides, startRedo } from '../storage/db.ts'
import { setSubject } from '../subject/subject.ts'
import { Figures } from '../ui/Figure.tsx'
import { MathText } from '../ui/MathText.tsx'
import { fetchDuel, myId, refreshInbox, send, submitDuel, type Duel } from './api.ts'
import { duelWinner } from './FriendsPage.tsx'
import '../library/library.css'
import '../exercise/exercise.css'
import './social.css'

const START_KEY = (id: string) => `grinda.duel.start.${id}`
const fmt = (ms: number) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Poäng: deluppgifter där första försöket efter start var rätt. */
async function scoreFor(exercises: Exercise[], start: number) {
  const attempts = resolveOverrides(await db.attempts.where('exerciseId').anyOf(exercises.map((e) => e.id)).toArray()).filter((a) => a.at >= start && a.status !== 'redo')
  let score = 0
  let of = 0
  for (const ex of exercises) {
    ex.parts.forEach((_, i) => {
      of++
      const first = attempts.filter((a) => a.exerciseId === ex.id && a.part === i).sort((a, b) => a.at - b.at)[0]
      if (first?.status === 'correct' && !first.overrides) score++
    })
  }
  return { score, of }
}

export function DuelPage({ id }: { id: string }) {
  const content = useAllContent()
  const [duel, setDuel] = useState<Duel | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [start, setStart] = useState<number | null>(() => Number(sessionStorage.getItem(START_KEY(id))) || null)
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const panel = useRef<HTMLElement>(null)
  const me = myId()

  const load = () => fetchDuel(id).then(setDuel, (e: Error) => setError(e.message))
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  useEffect(() => {
    if (duel) setSubject(duel.subject)
  }, [duel])
  useEffect(() => {
    if (!start) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [start])

  const exercises = useMemo(() => (duel && content ? duel.exercises.flatMap((x) => content.exercises.find((e) => e.id === x) ?? []) : []), [duel, content])

  if (error) return <div className="mk-loading">{error}</div>
  if (duel === undefined || !content) return <div className="mk-loading">Laddar duellen …</div>
  if (!duel || !me) return <div className="mk-loading">Hittar inte duellen.</div>

  const other = duel.created_by === me ? duel.opponent : duel.created_by
  const names = duel.names ?? {}
  const mine = duel.results[me]
  const theirs = duel.results[other]

  const finish = async () => {
    if (!start || busy) return
    setBusy(true)
    try {
      const { score, of } = await scoreFor(exercises, start)
      await submitDuel(id, { score, of, ms: Date.now() - start })
      sessionStorage.removeItem(START_KEY(id))
      const fresh = await fetchDuel(id)
      setDuel(fresh)
      if (fresh && fresh.results[other]) void send(other, 'text', `Duellen är klar: ${duelWinner(fresh.results, me, other)} (${score}–${fresh.results[other].score})`).then(refreshInbox, () => {})
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  // Resultatet
  if (mine) {
    return (
      <div className="ex grain plain">
        <header className="ex-top">
          <a className="ex-back" href="#/kompisar">
            <ChevronLeft size={18} /> Kompisar
          </a>
          <div className="ex-title">
            <span className="pr-gen-title">⚔️ Duell</span>
          </div>
          <div />
        </header>
        <div className="ex-plain">
          <section className="so-duel-result">
            <h1>{theirs ? duelWinner(duel.results, me, other) : 'Väntar på motståndaren …'}</h1>
            <div className="so-duel-score">
              <div>
                <span>Du</span>
                <strong>
                  {mine.score}
                  <small>/{mine.of}</small>
                </strong>
                <small>{fmt(mine.ms)}</small>
              </div>
              <b>mot</b>
              <div>
                <span>{names[other] ?? 'Motståndaren'}</span>
                <strong>{theirs ? theirs.score : '?'}{theirs && <small>/{theirs.of}</small>}</strong>
                <small>{theirs ? fmt(theirs.ms) : 'har inte spelat än'}</small>
              </div>
            </div>
            {!theirs && (
              <button className="mk-btn-ghost" onClick={() => void load()}>
                Uppdatera
              </button>
            )}
            <h3>Uppgifterna</h3>
            <ul className="so-duel-list">
              {exercises.map((e) => (
                <li key={e.id}>
                  <a href={`#/uppgift/${encodeURIComponent(e.id)}`}>
                    {e.number} · {e.topic}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    )
  }

  // Före start
  if (!start) {
    return (
      <div className="ex grain plain">
        <header className="ex-top">
          <a className="ex-back" href="#/kompisar">
            <ChevronLeft size={18} /> Kompisar
          </a>
          <div className="ex-title">
            <span className="pr-gen-title">⚔️ Duell</span>
          </div>
          <div />
        </header>
        <div className="ex-plain">
          <section className="so-duel-result">
            <h1>
              Du mot {names[other] ?? 'en kompis'}
            </h1>
            <p className="so-help">
              {exercises.length} uppgifter i {duel.subject === 'fysik' ? 'Fysik 2' : 'Matte 5'}. Du får en poäng för varje deluppgift som blir rätt på första försöket. Klockan startar när du trycker Starta och stannar när du är klar – vid lika poäng vinner den
              som var snabbast. {theirs ? `${names[other] ?? 'Motståndaren'} har redan spelat.` : ''}
            </p>
            <button
              className="mk-btn-primary"
              onClick={async () => {
                // Varje uppgift börjar om, så att tidigare svar inte räknas.
                await Promise.all(exercises.map((e) => startRedo(e.id)))
                const t = Date.now()
                sessionStorage.setItem(START_KEY(id), String(t))
                setStart(t)
                setIndex(0)
              }}
            >
              Starta duellen
            </button>
          </section>
        </div>
      </div>
    )
  }

  const ex = exercises[index]
  const last = index === exercises.length - 1
  return (
    <div className="ex grain plain">
      <header className="ex-top">
        <span className="ex-back">⚔️ Mot {names[other] ?? 'kompis'}</span>
        <div className="ex-title">
          <span className="ex-num">{ex?.number}</span>
          <span className="ex-calc">
            Uppgift {index + 1} av {exercises.length}
          </span>
        </div>
        <div className="ex-top-right">
          <span className="so-clock">⏱ {fmt(now - start)}</span>
        </div>
      </header>
      {ex && (
        <div className="ex-plain">
          <section className="ex-plain-problem" aria-label={`Uppgift ${ex.number}`}>
            <div className="ex-problem-text">
              <MathText text={ex.prompt} />
              <ol className="ex-parts">
                {ex.parts.map((p, i) =>
                  p.label || p.prompt ? (
                    <li key={p.label ?? i}>
                      {p.label && <b>{p.label})</b>} <MathText text={p.prompt ?? ''} />
                      {p.figures?.length ? <Figures figures={p.figures} /> : null}
                    </li>
                  ) : null,
                )}
              </ol>
            </div>
            <Figures figures={ex.figures} />
          </section>
          <AnswerPanel
            key={`${ex.id}-${start}`}
            ex={ex}
            panelRef={panel}
            footer={
              <button className="mk-btn-primary ex-next ready" disabled={busy} onClick={() => (last ? void finish() : setIndex((i) => i + 1))}>
                {last ? (busy ? 'Skickar …' : 'Klar – se resultatet') : 'Nästa uppgift →'}
              </button>
            }
          />
        </div>
      )}
    </div>
  )
}
