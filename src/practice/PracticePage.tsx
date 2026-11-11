// Öva: dagens repetition, felbanken och uppgifter med nya siffror.
import { useMemo, useState } from 'react'
import type { Exercise } from '../content/types.ts'
import { Play } from '../design/icons.tsx'
import { ThemeEditor } from '../design/ThemeEditor.tsx'
import { startRedoSession } from '../exercise/redoSession.ts'
import { useSrsToday } from '../game/GameStrip.tsx'
import { useAttempts } from '../game/useGame.ts'
import { exerciseHref, Nav, sectionLabel, useContent } from '../library/Library.tsx'
import { useProgress } from '../progress/progress.ts'
import { SettingsDialog } from '../settings/SettingsDialog.tsx'
import { useSettings } from '../settings/settings.ts'
import { resolveOverrides } from '../storage/db.ts'
import { useSubject } from '../subject/subject.ts'
import { MathText } from '../ui/MathText.tsx'
import { GENERATORS, generatorHref } from './generators.ts'
import { SrsControls } from './SrsControls.tsx'
import { dayLabel, removeFromSrs, restoreToSrs, snooze, type SrsItem } from './srs.ts'
import './practice.css'

const firstLine = (ex: Exercise) => {
  const plain = (ex.prompt || ex.parts[0].prompt || '').replace(/\n+/g, ' ')
  return plain.length > 130 ? `${plain.slice(0, 127)}…` : plain
}

export function PracticePage() {
  const content = useContent()
  const subject = useSubject()
  const progress = useProgress(content?.exercises)
  const attempts = useAttempts()
  const review = useSrsToday(content?.exercises)
  const { srs } = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showSrs, setShowSrs] = useState(false)
  const [showLater, setShowLater] = useState(false)

  // Dina felaktiga svar per uppgift (de senaste först), till felbanken.
  const wrongInputs = useMemo(() => {
    const map = new Map<string, { label: string | null; input: string; at: number }[]>()
    for (const a of resolveOverrides(attempts ?? [])) {
      if (a.status !== 'incorrect' && a.status !== 'partial') continue
      const list = map.get(a.exerciseId) ?? []
      list.push({ label: a.label, input: a.input, at: a.at })
      map.set(a.exerciseId, list)
    }
    for (const list of map.values()) list.sort((a, b) => b.at - a.at)
    return map
  }, [attempts])

  // Rätta svar per sorts uppgift med nya siffror (id:t är gen:<övning>:<frö>), och andel rätt.
  const genStats = useMemo(() => {
    const map = new Map<string, { right: number; tries: number }>()
    for (const a of attempts ?? []) {
      if (!a.exerciseId.startsWith('gen:') || a.exerciseId.startsWith('gen:kladd:')) continue
      const id = a.exerciseId.split(':')[1]
      const st = map.get(id) ?? { right: 0, tries: 0 }
      st.tries++
      if (a.status === 'correct') st.right++
      map.set(id, st)
    }
    return map
  }, [attempts])

  if (!content || !progress || !review) return <div className="mk-loading">Laddar …</div>

  const byId = new Map(content.exercises.map((e) => [e.id, e]))
  const withEx = (items: SrsItem[]) => items.flatMap((it) => (byId.get(it.exerciseId) ? [{ it, ex: byId.get(it.exerciseId)! }] : []))
  const due = withEx(review.due)
  const upcoming = withEx(review.upcoming)
  const removed = withEx(review.removed)
  const bank = content.exercises.filter((e) => progress.byExercise[e.id].needsRedo).sort((a, b) => progress.byExercise[b.id].wrong - progress.byExercise[a.id].wrong || progress.byExercise[b.id].lastAt - progress.byExercise[a.id].lastAt)
  const bankBySection = content.sections.map((s) => ({ s, list: bank.filter((e) => e.section === s.section) })).filter((x) => x.list.length)
  const generators = GENERATORS.filter((g) => g.subject === subject)
  const steps = srs.intervals.length

  return (
    <div className="mk grain">
      <Nav streak={progress.streakDays} onSettings={() => setSettingsOpen(true)} active="practice" />
      <main className="pr">
        <h1 className="ch-title">Öva</h1>
        <p className="pr-lead">Gör om det du fått fel på – lagom ofta – och öva på samma sorts uppgift med nya siffror.</p>

        <section className="pr-section">
          <div className="pr-head">
            <h2>Dagens repetition</h2>
            {due.length > 0 && (
              <button className="mk-redo-start" onClick={() => startRedoSession(due.map((d) => d.ex.id))}>
                <Play size={14} /> Starta ({due.length})
              </button>
            )}
            <button className="pr-link" onClick={() => setShowSrs((s) => !s)} aria-expanded={showSrs}>
              {showSrs ? 'Dölj inställningarna' : `Intervall: ${srs.enabled ? srs.intervals.join(' · ') + ' dagar' : 'avstängd'} – ändra`}
            </button>
          </div>
          {showSrs && (
            <div className="pr-panel">
              <SrsControls />
            </div>
          )}
          {!srs.enabled ? (
            <p className="pr-empty">Repetitionen är avstängd. Slå på den under ”ändra” här ovanför. Felbanken nedan fungerar ändå.</p>
          ) : due.length === 0 ? (
            <p className="pr-empty">
              {upcoming.length ? `Inget att repetera idag. Nästa uppgift kommer ${dayLabel(upcoming[0].it.due)}.` : 'Inget att repetera. När du får fel på en uppgift kommer den tillbaka här efter några dagar.'}
            </p>
          ) : (
            <ul className="pr-list">
              {due.map(({ it, ex }) => (
                <li key={ex.id} className="pr-item">
                  <a className="pr-item-main" href={exerciseHref(ex.id)} onClick={() => startRedoSession([ex.id])}>
                    <span className="pr-num">{ex.number}</span>
                    <span className="pr-item-text">
                      <strong>{ex.topic}</strong>
                      <MathText text={firstLine(ex)} />
                    </span>
                  </a>
                  <span className="pr-meta">
                    <span className="pr-steps" title={`Steg ${it.step + 1} av ${steps}`} aria-label={`Steg ${it.step + 1} av ${steps}`}>
                      {Array.from({ length: steps }, (_, i) => (
                        <i key={i} className={i < it.step ? 'done' : i === it.step ? 'now' : ''} />
                      ))}
                    </span>
                    <small>fel {dayLabel(it.lastWrongAt)}</small>
                  </span>
                  <span className="pr-actions">
                    <button onClick={() => snooze(ex.id, 1)} title="Visa den i morgon i stället">
                      I morgon
                    </button>
                    <button onClick={() => removeFromSrs(ex.id)} title="Ta bort uppgiften ur repetitionen">
                      Ta bort
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {review.overflow > 0 && (
            <p className="pr-note">
              {review.overflow} till väntar, men du har valt högst {srs.maxPerDay} per dag.
            </p>
          )}
          {srs.enabled && (upcoming.length > 0 || removed.length > 0) && (
            <>
              <button className="pr-link" onClick={() => setShowLater((s) => !s)} aria-expanded={showLater}>
                {showLater ? 'Dölj' : 'Visa'} kommande ({upcoming.length}){removed.length ? ` och borttagna (${removed.length})` : ''}
              </button>
              {showLater && (
                <ul className="pr-list compact">
                  {upcoming.map(({ it, ex }) => (
                    <li key={ex.id} className="pr-item">
                      <a className="pr-item-main" href={exerciseHref(ex.id)}>
                        <span className="pr-num">{ex.number}</span>
                        <span className="pr-item-text">
                          <strong>{ex.topic}</strong>
                        </span>
                      </a>
                      <span className="pr-meta">
                        <small>
                          {dayLabel(it.due)} · steg {it.step + 1} av {steps}
                        </small>
                      </span>
                      <span className="pr-actions">
                        <button onClick={() => removeFromSrs(ex.id)}>Ta bort</button>
                      </span>
                    </li>
                  ))}
                  {removed.map(({ ex }) => (
                    <li key={ex.id} className="pr-item gone">
                      <a className="pr-item-main" href={exerciseHref(ex.id)}>
                        <span className="pr-num">{ex.number}</span>
                        <span className="pr-item-text">
                          <strong>{ex.topic}</strong>
                        </span>
                      </a>
                      <span className="pr-meta">
                        <small>borttagen</small>
                      </span>
                      <span className="pr-actions">
                        <button onClick={() => restoreToSrs(ex.id)}>Lägg tillbaka</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <section className="pr-section">
          <div className="pr-head">
            <h2>Felbank</h2>
            {bank.length > 0 && (
              <button className="mk-redo-start" onClick={() => startRedoSession(bank.map((e) => e.id))}>
                <Play size={14} /> Gör om alla ({bank.length})
              </button>
            )}
          </div>
          <p className="mk-row-note">Alla uppgifter du fått fel på och inte gjort om felfritt än. Gör om en uppgift utan fel så försvinner den härifrån.</p>
          {bank.length === 0 ? (
            <p className="pr-empty">Felbanken är tom. Snyggt!</p>
          ) : (
            bankBySection.map(({ s, list }) => (
              <div key={s.section} className="pr-group">
                <h3>
                  {sectionLabel(s)} <small>{list.length}</small>
                </h3>
                <ul className="pr-list">
                  {list.map((ex) => {
                    const p = progress.byExercise[ex.id]
                    const mine = (wrongInputs.get(ex.id) ?? []).filter((w) => w.input.trim()).slice(0, 3)
                    return (
                      <li key={ex.id} className="pr-item">
                        <a className="pr-item-main" href={exerciseHref(ex.id)} onClick={() => startRedoSession([ex.id])}>
                          <span className="pr-num">{ex.number}</span>
                          <span className="pr-item-text">
                            <strong>{ex.topic}</strong>
                            <MathText text={firstLine(ex)} />
                            {mine.length > 0 && (
                              <span className="pr-wrong">
                                Du svarade:{' '}
                                {mine.map((w, i) => (
                                  <code key={i}>
                                    {w.label ? `${w.label}) ` : ''}
                                    {w.input}
                                  </code>
                                ))}
                              </span>
                            )}
                          </span>
                        </a>
                        <span className="pr-meta">
                          <span className="mk-badge miss" style={{ position: 'static' }}>
                            {p.wrong} fel
                          </span>
                          <small>{dayLabel(p.lastAt)}</small>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </section>

        <section className="pr-section">
          <div className="pr-head">
            <h2>Nya siffror</h2>
          </div>
          <p className="mk-row-note">Samma sorts uppgift som i boken, men med nya tal varje gång. Öva tills det sitter. Uppgifterna är skrivna för Grinda och finns inte i boken.</p>
          <div className="pr-gens">
            {generators.map((g) => (
              <a key={g.id} className="pr-gen" href={generatorHref(g.id)}>
                <span aria-hidden="true">🎲</span>
                <strong>{g.topic}</strong>
                {genStats.get(g.id) && (
                  <small className="pr-gen-count" title={`${genStats.get(g.id)!.right} rätt av ${genStats.get(g.id)!.tries} försök`}>
                    {genStats.get(g.id)!.right} rätt
                  </small>
                )}
              </a>
            ))}
          </div>
        </section>
      </main>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      <ThemeEditor />
    </div>
  )
}
