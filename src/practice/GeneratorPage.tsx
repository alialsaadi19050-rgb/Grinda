// En uppgift med nya siffror. ”Ge mig en till” slumpar nya tal för samma sorts uppgift.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Exercise } from '../content/types.ts'
import { ChevronLeft, Gear, CalculatorIcon, Sigma } from '../design/icons.tsx'
import { FormulaDrawer } from '../formulas/FormulaDrawer.tsx'
import { ThemeEditor } from '../design/ThemeEditor.tsx'
import { Calculator } from '../calculator/Calculator.tsx'
import { AnswerPanel } from '../exercise/AnswerPanel.tsx'
import { GEN_PREFIX } from '../game/game.ts'
import { lessonHref, useLessons } from '../lessons/data.ts'
import { SettingsDialog } from '../settings/SettingsDialog.tsx'
import { setSubject } from '../subject/subject.ts'
import { MathText } from '../ui/MathText.tsx'
import { InkSurface, type InkSurfaceHandle } from '../canvas/InkSurface.tsx'
import { NotesPad } from '../exercise/NotesPad.tsx'
import { useSettings } from '../settings/settings.ts'
import { GENERATORS, generatorHref, rng } from './generators.ts'
import '../library/library.css'
import '../exercise/exercise.css'
import './practice.css'

const seedFromHash = () => Number(/[?&]n=(\d+)/.exec(location.hash)?.[1] ?? 1)

export function GeneratorPage({ id }: { id: string }) {
  const gen = GENERATORS.find((g) => g.id === id)
  const [seed, setSeed] = useState(seedFromHash)
  const [count, setCount] = useState(1)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [calcOpen, setCalcOpen] = useState(false)
  const [formulasOpen, setFormulasOpen] = useState(false)
  const lessons = useLessons()
  const panel = useRef<HTMLElement>(null)
  const more = useRef<HTMLAnchorElement>(null)
  const ink = useRef<InkSurfaceHandle>(null)
  const settings = useSettings()

  useEffect(() => {
    const on = () => {
      setSeed(seedFromHash())
      setCount((c) => c + 1)
      // Ny uppgift: börja på ett tomt kladdpapper.
      ink.current?.clear()
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    if (gen) setSubject(gen.subject)
  }, [gen])

  const made = useMemo(() => gen?.make(rng(seed)), [gen, seed])
  // Nästa uppgift bestäms i förväg, så att länken går att öppna som vanligt.
  const nextHref = useMemo(() => (gen ? generatorHref(gen.id) : '#/ova'), [gen, seed])

  if (!gen || !made)
    return (
      <div className="mk-loading">
        Hittar inte den övningen. <a href="#/ova">Till Öva</a>
      </div>
    )

  const ex: Exercise = {
    id: `${GEN_PREFIX}${gen.id}:${seed}`,
    number: 'Nya siffror',
    chapter: 0,
    section: 'nya-siffror',
    topic: gen.topic,
    page: 0,
    facitPage: 0,
    prompt: made.prompt,
    parts: [{ label: null, answer: made.answer, facit: made.facit, solution: made.solution, ownSolution: true }],
  }
  const lesson = lessons?.find((l) => l.topic === gen.topic)

  return (
    <div className="ex grain plain">
      <header className="ex-top">
        <a className="ex-back" href="#/ova">
          <ChevronLeft size={18} /> Öva
        </a>
        <div className="ex-title">
          <span className="pr-gen-title">🎲 {gen.topic}</span>
          <span className="ex-calc">Nya siffror · nr {count}</span>
        </div>
        <div className="ex-top-right">
          <button className={`ex-formulas ${formulasOpen ? 'on' : ''}`} onClick={() => setFormulasOpen((o) => !o)} aria-expanded={formulasOpen} title="Formelblad">
            <Sigma size={17} />
            <span>Formler</span>
          </button>
          <button className={`ex-icon ${calcOpen ? 'on' : ''}`} onClick={() => setCalcOpen((o) => !o)} aria-label="Miniräknare" aria-pressed={calcOpen} title="Miniräknare">
            <CalculatorIcon size={19} />
          </button>
          <button className="ex-icon" onClick={() => setSettingsOpen(true)} aria-label="Inställningar" title="Inställningar">
            <Gear size={19} />
          </button>
        </div>
      </header>
      <div className="ex-plain">
        <section className="ex-plain-problem" aria-label="Uppgift">
          <div className="ex-problem-text">
            <MathText text={made.prompt} />
          </div>
          {lesson && (
            <a className="ex-lesson" href={lessonHref(lesson.id)} title="Läs bokens teori och exempel">
              Genomgång: {lesson.title}
            </a>
          )}
        </section>
        <AnswerPanel
          key={ex.id}
          ex={ex}
          panelRef={panel}
          onAllSolved={() => setTimeout(() => more.current?.focus(), 80)}
          footer={
            <a ref={more} className="mk-btn-primary ex-next ready" href={nextHref}>
              Ge mig en till 🎲
            </a>
          }
        />
        {/* Kladdpapper att räkna på: samma ritplatta som i bokens uppgifter, eller text om du räknar utan ritplatta. */}
        {settings.tablet ? (
          <section className="gen-scratch" aria-label="Kladdpapper">
            <InkSurface ref={ink} exerciseId={`${GEN_PREFIX}kladd:${gen.id}`} title={`Kladdpapper ${gen.topic}`} paper={settings.paper} className="gen-ink" />
          </section>
        ) : (
          <NotesPad exerciseId={`${GEN_PREFIX}kladd:${gen.id}`} />
        )}
      </div>
      <Calculator open={calcOpen} onClose={() => setCalcOpen(false)} />
      {formulasOpen && <FormulaDrawer topic={gen.topic} chapter={gen.subject === 'fysik' ? 102 : 1} onClose={() => setFormulasOpen(false)} />}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      <ThemeEditor />
    </div>
  )
}
