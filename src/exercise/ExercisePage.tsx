import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnswerPanel } from './AnswerPanel.tsx'
import { NotesPad } from './NotesPad.tsx'
import { setSubject, subjectOf } from '../subject/subject.ts'
import { loadContent, type Content } from '../content/load.ts'
import { MathText } from '../ui/MathText.tsx'
import { Figures } from '../ui/Figure.tsx'
import { Bookmark, CalculatorIcon, ChevronLeft, ChevronRight, Collapse, Gear, Mute, Sound } from '../design/icons.tsx'
import { Calculator } from '../calculator/Calculator.tsx'
import { InkSurface, type InkSurfaceHandle } from '../canvas/InkSurface.tsx'
import { actionForEvent, S620_ASPECT, updateSettings, useSettings } from '../settings/settings.ts'
import { SettingsDialog } from '../settings/SettingsDialog.tsx'
import { ThemeEditor } from '../design/ThemeEditor.tsx'
import { toggleBookmark, useBookmarks } from '../bookmarks/bookmarks.ts'
import { lessonHref, useLessons } from '../lessons/data.ts'
import { attemptsFor, currentRound, startRedo } from '../storage/db.ts'
import { generatorFor, generatorHref } from '../practice/generators.ts'
import { endRedoSession, getRedoSession, markRedoStarted } from './redoSession.ts'
import '../library/library.css'
import './exercise.css'

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest('input, textarea, select, [contenteditable="true"]')
const go = (id: string) => (location.hash = `#/uppgift/${encodeURIComponent(id)}`)

export function ExercisePage({ id }: { id: string }) {
  const [content, setContent] = useState<Content | null>(null)
  const settings = useSettings()
  const bookmarks = useBookmarks()
  const lessons = useLessons()
  const [problemOpen, setProblemOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [calcOpen, setCalcOpen] = useState(false)
  const ink = useRef<InkSurfaceHandle>(null)
  const answers = useRef<HTMLElement>(null)
  /** Ökar vid ”gör om”, så att svarspanelen börjar om. */
  const [round, setRound] = useState(0)
  const session = useMemo(getRedoSession, [id])
  const inSession = !!session?.queue.includes(id)

  useEffect(() => {
    loadContent().then(setContent)
  }, [])

  const { ex, prev, next } = useMemo(() => {
    // Föregående och nästa går bara genom uppgifterna i samma ämne.
    const self = content?.exercises.find((e) => e.id === id)
    const chapter = content?.index.chapters.find((c) => c.id === self?.chapter)
    const same = new Set(content?.index.chapters.filter((c) => chapter && subjectOf(c) === subjectOf(chapter)).map((c) => c.id))
    const list = (content?.exercises ?? []).filter((e) => !chapter || same.has(e.chapter))
    const i = list.findIndex((e) => e.id === id)
    // I en repetition går Nästa och Föregående genom repetitionens uppgifter.
    if (session && inSession) {
      const q = session.queue.indexOf(id)
      const find = (qid?: string) => list.find((e) => e.id === qid)
      return { ex: list[i], prev: find(session.queue[q - 1]), next: find(session.queue[q + 1]) }
    }
    return { ex: list[i], prev: list[i - 1], next: list[i + 1] }
  }, [content, id, session, inSession])

  // Öppnar man en uppgift i det andra ämnet byter appen ämne.
  useEffect(() => {
    const c = content?.index.chapters.find((x) => x.id === ex?.chapter)
    if (c) setSubject(subjectOf(c))
  }, [content, ex?.chapter])

  const redo = async (blank: boolean) => {
    await startRedo(id)
    if (blank) ink.current?.clear()
    setRound((r) => r + 1)
  }

  // I en repetition börjar varje uppgift om automatiskt, med tom skrivyta, första gången du kommer dit.
  useEffect(() => {
    // Läs om sessionen här (inte från useMemo), så att uppgiften bara börjar om en gång.
    const s = getRedoSession()
    if (!s?.queue.includes(id) || s.started.includes(id)) return
    markRedoStarted(id)
    attemptsFor(id).then((all) => {
      if (currentRound(all).length) redo(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, inSession])

  // Kortkommandon. Ritplattans snabbknappar skickar samma tangenter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (settingsOpen) return
      const typing = isTyping(e.target)
      const action = actionForEvent(e, settings.shortcuts)
      if (!action) return
      if (typing && action !== 'undo' && action !== 'redo') return
      if (typing && (action === 'undo' || action === 'redo')) return // låt textfältet ångra sin egen text
      e.preventDefault()
      const h = ink.current
      switch (action) {
        case 'pen':
        case 'highlighter':
        case 'eraser':
        case 'lasso':
        case 'hand':
        case 'shape':
          h?.setTool({ tool: action })
          break
        case 'eraserMode':
          h?.toggleEraserMode()
          break
        case 'undo':
          h?.undo()
          break
        case 'redo':
          h?.redo()
          break
        case 'color1':
        case 'color2':
        case 'color3':
        case 'color4':
          h?.setTool({ tool: 'pen', color: (['ink', 'blue', 'red', 'green'] as const)[Number(action.slice(-1)) - 1] })
          break
        case 'zoomReset':
          h?.resetZoom()
          break
        case 'submit': {
          // Hoppa till första svaret som inte är klart.
          const input = answers.current?.querySelector<HTMLElement>('.ex-field:not(.solved) input:not([readonly]), .ex-field:not(.solved) math-field')
          input?.focus()
          break
        }
        case 'next':
          if (next) go(next.id)
          break
        case 'prev':
          if (prev) go(prev.id)
          break
        case 'calculator':
          setCalcOpen((o) => !o)
          break
        case 'bookmark':
          toggleBookmark(id)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settings.shortcuts, settingsOpen, next, prev, id])

  if (!content) return <div className="mk-loading">Laddar …</div>
  if (!ex)
    return (
      <div className="mk-loading">
        Hittar ingen uppgift {id}. <a href="#/">Till startsidan</a>
      </div>
    )

  const zone = settings.zone
  const zoneStyle: CSSProperties | undefined = zone.enabled
    ? { position: 'fixed', left: zone.x, top: zone.y, width: zone.width, height: Math.round(zone.width / S620_ASPECT), flex: 'none', zIndex: 20 }
    : undefined
  const section = content.sections.find((s) => s.section === ex.section)
  const plain = !settings.tablet
  const lesson = lessons?.find((l) => l.topic === ex.topic)
  const generator = generatorFor(ex.topic)

  // Uppgiften ser likadan ut i båda lägena – bara placeringen skiljer.
  const problem = (
    <>
      <div className="ex-problem-text">
        <MathText text={ex.prompt} />
        <ol className="ex-parts">
          {ex.parts.map((p, i) =>
            p.label || p.prompt ? (
              <li key={p.label ?? i} className={p.figures?.length ? 'has-fig' : ''}>
                {p.label && <b>{p.label})</b>} <MathText text={p.prompt ?? ''} />
                {p.figures?.length ? <Figures figures={p.figures} /> : null}
              </li>
            ) : null,
          )}
        </ol>
      </div>
      <Figures figures={ex.figures} />
      {(lesson || generator) && (
        <div className="ex-links">
          {lesson && (
            <a className="ex-lesson" href={lessonHref(lesson.id)} title="Läs bokens teori och exempel">
              Genomgång: {lesson.title}
            </a>
          )}
          {generator && (
            <a className="ex-lesson alt" href={generatorHref(generator.id)} title="Samma sorts uppgift med nya tal – öva tills det sitter">
              🎲 Öva med nya siffror
            </a>
          )}
        </div>
      )}
    </>
  )
  const answerPanel = (
    <AnswerPanel
      key={`${ex.id}-${round}`}
      ex={ex}
      panelRef={answers}
      next={next}
      onRedo={redo}
      redoLabel={inSession && session ? `Repetition ${session.queue.indexOf(id) + 1} av ${session.queue.length}${next ? '' : ' – sista uppgiften!'}` : undefined}
    />
  )

  return (
    <div className={`ex grain ${zone.enabled && !plain ? 'zone-mode' : ''} ${plain ? 'plain' : ''}`}>
      <header className="ex-top">
        <a className="ex-back" href={`#/kapitel/${ex.chapter}?avsnitt=${encodeURIComponent(ex.section)}`}>
          <ChevronLeft size={18} /> {section ? (section.section.includes('.') ? `${section.section} ${section.title}` : section.title) : 'Tillbaka'}
        </a>
        {inSession && (
          <button
            className="ex-redo-end"
            onClick={() => {
              endRedoSession()
              location.hash = '#/hem'
            }}
            title="Avsluta repetitionen"
          >
            Avsluta repetition
          </button>
        )}
        <div className="ex-title">
          <span className="ex-num" style={{ viewTransitionName: 'ex-num' }}>
            {ex.number}
          </span>
          {ex.level && <span className={`mk-lvl mk-lvl-${ex.level}`}>{ex.level.toUpperCase()}</span>}
          {ex.calculator !== undefined && <span className="ex-calc">{ex.calculator ? 'Med räknare' : 'Utan räknare'}</span>}
          <button
            className={`ex-bookmark ${bookmarks[ex.id] ? 'on' : ''}`}
            onClick={() => toggleBookmark(ex.id)}
            aria-pressed={!!bookmarks[ex.id]}
            title={`${bookmarks[ex.id] ? 'Sparad till senare – tryck för att ta bort' : 'Spara till senare'} (${settings.shortcuts.bookmark})`}
          >
            <Bookmark size={16} filled={!!bookmarks[ex.id]} />
            {bookmarks[ex.id] ? 'Sparad' : 'Spara till senare'}
          </button>
        </div>
        <div className="ex-top-right">
          <div className="ex-seg ex-mode-toggle" role="radiogroup" aria-label="Läge">
            {([true, false] as const).map((t) => (
              <button key={String(t)} role="radio" aria-checked={settings.tablet === t} className={settings.tablet === t ? 'on' : ''} onClick={() => updateSettings({ tablet: t })}>
                {t ? 'Med ritplatta' : 'Utan ritplatta'}
              </button>
            ))}
          </div>
          {!plain && (
          <div className="ex-seg" role="radiogroup" aria-label="Papper">
            {(['light', 'dark'] as const).map((p) => (
              <button key={p} role="radio" aria-checked={settings.paper === p} className={settings.paper === p ? 'on' : ''} onClick={() => updateSettings({ paper: p })}>
                {p === 'light' ? 'Ljust papper' : 'Mörkt papper'}
              </button>
            ))}
          </div>
          )}
          <button className="ex-icon" onClick={() => updateSettings({ sound: !settings.sound })} aria-label={settings.sound ? 'Stäng av ljud' : 'Sätt på ljud'} title={settings.sound ? 'Ljud på' : 'Ljud av'}>
            {settings.sound ? <Sound size={19} /> : <Mute size={19} />}
          </button>
          <button className={`ex-icon ${calcOpen ? 'on' : ''}`} onClick={() => setCalcOpen((o) => !o)} aria-label="Miniräknare" aria-pressed={calcOpen} title={`Miniräknare (${settings.shortcuts.calculator})`}>
            <CalculatorIcon size={19} />
          </button>
          <button className="ex-icon" onClick={() => setSettingsOpen(true)} aria-label="Inställningar" title="Inställningar">
            <Gear size={19} />
          </button>
          <button className="ex-icon" disabled={!prev} onClick={() => prev && go(prev.id)} aria-label="Föregående uppgift" title={`Föregående (${settings.shortcuts.prev})`}>
            <ChevronLeft size={20} />
          </button>
          <button className="ex-icon" disabled={!next} onClick={() => next && go(next.id)} aria-label="Nästa uppgift" title={`Nästa (${settings.shortcuts.next})`}>
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {plain ? (
        <div className="ex-plain">
          <section className="ex-plain-problem" aria-label={`Uppgift ${ex.number}`}>
            {problem}
          </section>
          {answerPanel}
          <NotesPad exerciseId={ex.id} />
        </div>
      ) : (
      <div className="ex-body">
        <main className="ex-work" style={zone.enabled ? { paddingBottom: Math.max(0, window.innerHeight - zone.y) } : undefined}>
          <section className={`ex-problem ${problemOpen ? '' : 'closed'}`}>
            <button className="ex-problem-toggle" onClick={() => setProblemOpen((o) => !o)} aria-expanded={problemOpen}>
              <Collapse size={16} style={{ transform: problemOpen ? 'none' : 'rotate(180deg)' }} />
              {problemOpen ? 'Dölj uppgiften' : `Visa uppgift ${ex.number}`}
            </button>
            <div className="ex-problem-body">{problem}</div>
          </section>

          <InkSurface ref={ink} exerciseId={ex.id} title={`Uppgift ${ex.number}`} paper={settings.paper} className="ex-ink" style={zoneStyle} />
        </main>

        {answerPanel}
      </div>
      )}

      <Calculator open={calcOpen} onClose={() => setCalcOpen(false)} noCalculator={ex.calculator === false} />
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      <ThemeEditor />
    </div>
  )
}
