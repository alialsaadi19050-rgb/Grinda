// Formelblad: alla regler och formler från genomgångarna, samlade per avsnitt. Går att skriva ut.
import { useMemo, useState } from 'react'
import type { Lesson } from '../content/types.ts'
import { Search } from '../design/icons.tsx'
import { ThemeEditor } from '../design/ThemeEditor.tsx'
import { lessonHref, useLessons } from '../lessons/data.ts'
import { Nav, useContent } from '../library/Library.tsx'
import { useProgress } from '../progress/progress.ts'
import { SettingsDialog } from '../settings/SettingsDialog.tsx'
import { subjectName, useSubject } from '../subject/subject.ts'
import { MathText } from '../ui/MathText.tsx'
import '../practice/practice.css'
import './formulas.css'

type Rule = { title: string; text: string }
const rulesOf = (l: Lesson): Rule[] => l.blocks.flatMap((b) => (b.type === 'rule' ? [{ title: b.title, text: b.text }] : []))

export function FormulaPage() {
  const content = useContent()
  const lessons = useLessons()
  const subject = useSubject()
  const progress = useProgress(content?.exercises)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    if (!content || !lessons) return []
    const q = query.trim().toLowerCase()
    return content.index.chapters.flatMap((c) =>
      c.sections
        .map((s) => ({
          key: `${c.id}-${s.id}`,
          chapter: c.label ?? `Kapitel ${c.id}`,
          title: s.title,
          lessons: lessons
            .filter((l) => l.chapter === c.id && l.section === s.id)
            .map((l) => ({ lesson: l, rules: rulesOf(l).filter((r) => !q || `${r.title} ${r.text} ${l.topic}`.toLowerCase().includes(q)) }))
            .filter((x) => x.rules.length),
        }))
        .filter((g) => g.lessons.length),
    )
  }, [content, lessons, query])

  if (!content || !lessons || !progress) return <div className="mk-loading">Laddar …</div>
  const total = groups.reduce((n, g) => n + g.lessons.reduce((m, l) => m + l.rules.length, 0), 0)

  return (
    <div className="mk grain fb-page">
      <Nav streak={progress.streakDays} onSettings={() => setSettingsOpen(true)} active="formulas" />
      <main className="fb">
        <header className="fb-head">
          <div>
            <p className="mk-kicker">{subjectName(subject)}</p>
            <h1 className="ch-title">Formelblad</h1>
            <p className="pr-lead">Alla regler och formler från genomgångarna, i bokens ordning. Tryck på ett delområde för att läsa hela genomgången.</p>
          </div>
          <div className="fb-tools">
            <label className="fb-search">
              <Search size={16} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök formel, t.ex. pendel" aria-label="Sök i formelbladet" />
            </label>
            <button className="mk-btn-ghost" onClick={() => window.print()}>
              Skriv ut / spara som PDF
            </button>
          </div>
        </header>

        {total === 0 && <p className="pr-empty">{query ? `Ingen formel matchar ”${query}”.` : 'Det finns inga genomgångar med formler för det här ämnet än.'}</p>}

        {groups.map((g) => (
          <section key={g.key} className="fb-section">
            <h2>
              <small>{g.chapter}</small>
              {g.title}
            </h2>
            {g.lessons.map(({ lesson, rules }) => (
              <div key={lesson.id} className="fb-topic">
                <h3>
                  <a href={lessonHref(lesson.id)}>{lesson.topic}</a>
                </h3>
                <div className="fb-cards">
                  {rules.map((r, i) => (
                    <article key={i} className="fb-card">
                      <h4>{r.title}</h4>
                      <MathText text={r.text} />
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </main>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      <ThemeEditor />
    </div>
  )
}
