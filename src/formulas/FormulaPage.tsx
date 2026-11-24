// Formelblad. Fysik 2: hela formelsamlingen i samma ordning som din tryckta formelbok.
// Matte 5: genomgångarnas regler i bokens ordning. Går att söka i och skriva ut.
import { useEffect, useState } from 'react'
import { Search } from '../design/icons.tsx'
import { ThemeEditor } from '../design/ThemeEditor.tsx'
import { useLessons } from '../lessons/data.ts'
import { Nav, useContent } from '../library/Library.tsx'
import { useProgress } from '../progress/progress.ts'
import { SettingsDialog } from '../settings/SettingsDialog.tsx'
import { SUBJECTS, useSubject, type Subject } from '../subject/subject.ts'
import { FormulaBookSwitch, FormulaBookView, useFormulaBooks } from './FormulaBook.tsx'
import { LessonRules } from './FormulaDrawer.tsx'
import '../practice/practice.css'
import './formulas.css'

export function FormulaPage() {
  const content = useContent('all')
  const mine = useContent()
  const lessons = useLessons()
  const books = useFormulaBooks()
  const subject = useSubject()
  const progress = useProgress(mine?.exercises)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState<Subject>(subject)
  useEffect(() => setShown(subject), [subject])

  if (!content || !lessons || !progress || !books) return <div className="mk-loading">Laddar …</div>
  const book = books.current?.book
  const showBook = shown === 'fysik' && !!book

  return (
    <div className="mk grain fb-page">
      <Nav streak={progress.streakDays} onSettings={() => setSettingsOpen(true)} active="formulas" />
      <main className="fb">
        <header className="fb-head">
          <div>
            <h1 className="ch-title">Formelblad</h1>
            <p className="pr-lead">
              {showBook
                ? books.current?.id === 'formelbok'
                  ? 'Formelsamlingen i samma ordning som din formelbok – öva på att hitta rätt formel själv. Samma formler finns bakom Formler-knappen i varje uppgift.'
                  : 'Formler, konstanter och tabeller för gymnasiefysiken. Samma formler finns bakom Formler-knappen i varje uppgift.'
                : 'Alla regler och formler från genomgångarna, i bokens ordning.'}
            </p>
          </div>
          <div className="fb-tools">
            <div className="st-seg fb-subjects" role="tablist" aria-label="Ämne">
              {SUBJECTS.map((s) => (
                <button key={s.id} role="tab" aria-selected={shown === s.id} className={shown === s.id ? 'on' : ''} onClick={() => setShown(s.id)}>
                  {s.name}
                </button>
              ))}
            </div>
            <label className="fb-search">
              <Search size={16} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök formel, t.ex. pendel" aria-label="Sök i formelbladet" />
            </label>
            <button className="mk-btn-ghost" onClick={() => window.print()}>
              Skriv ut / PDF
            </button>
          </div>
        </header>
        {showBook && <FormulaBookSwitch state={books} />}
        {showBook ? <FormulaBookView key={books.current?.id} book={book} query={query} /> : <LessonRules lessons={lessons} index={content.index} subject={shown} query={query} />}
      </main>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      <ThemeEditor />
    </div>
  )
}
