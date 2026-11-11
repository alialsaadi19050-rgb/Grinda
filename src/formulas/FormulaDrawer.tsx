// Formelbladet inne i en uppgift: en panel från höger. I fysik visas hela formelsamlingen i
// samma ordning som din tryckta formelbok, så att du tränar på att hitta rätt formel själv.
// I matte visas genomgångarnas regler i bokens ordning.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ContentIndex, Lesson } from '../content/types.ts'
import { loadContentOnce } from '../content/load.ts'
import { Search, Sigma } from '../design/icons.tsx'
import { lessonHref, useLessons } from '../lessons/data.ts'
import { subjectOf, type Subject } from '../subject/subject.ts'
import { MathText } from '../ui/MathText.tsx'
import { FormulaBookView, useFormulaBook } from './FormulaBook.tsx'
import './formulas.css'

type Rule = { title: string; text: string }
export const rulesOf = (l: Lesson): Rule[] => l.blocks.flatMap((b) => (b.type === 'rule' ? [{ title: b.title, text: b.text }] : []))

/** Genomgångarnas regler för ett ämne, i bokens ordning. */
export function LessonRules({ lessons, index, subject, query }: { lessons: Lesson[]; index: ContentIndex; subject: Subject; query: string }) {
  const q = query.trim().toLowerCase()
  const chapters = index.chapters.filter((c) => subjectOf(c) === subject)
  const groups = chapters
    .map((c) => ({
      chapter: c,
      items: lessons
        .filter((l) => l.chapter === c.id)
        .map((l) => ({ lesson: l, rules: rulesOf(l).filter((r) => !q || `${r.title} ${r.text} ${l.topic}`.toLowerCase().includes(q)) }))
        .filter((x) => x.rules.length),
    }))
    .filter((g) => g.items.length)
  if (!groups.length) return <p className="fd-empty">{q ? `Ingen formel matchar ”${query}”.` : 'Det finns inga formler här än.'}</p>
  return (
    <div className="fbk">
      {groups.map((g) => (
        <section key={g.chapter.id} className="fbk-chapter">
          <h2>{g.chapter.title}</h2>
          {g.items.map(({ lesson, rules }) => (
            <div key={lesson.id}>
              <h3>
                <a href={lessonHref(lesson.id)}>{lesson.topic}</a>
              </h3>
              {rules.map((r, i) => (
                <article key={i} className="fb-card">
                  <h4>{r.title}</h4>
                  <MathText text={r.text} />
                </article>
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

export function FormulaDrawer({ chapter, onClose }: { topic?: string; chapter: number; onClose: () => void }) {
  const lessons = useLessons()
  const book = useFormulaBook()
  const [index, setIndex] = useState<ContentIndex | null>(null)
  const [query, setQuery] = useState('')
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    loadContentOnce().then((c) => setIndex(c.index), () => {})
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const subject = useMemo<Subject>(() => {
    const c = index?.chapters.find((x) => x.id === chapter)
    return c ? subjectOf(c) : chapter === 102 ? 'fysik' : 'matte'
  }, [index, chapter])
  const showBook = subject === 'fysik' && !!book

  return (
    <div className="fd-backdrop" onClick={onClose}>
      <aside className="fd" ref={panel} tabIndex={-1} aria-label="Formelblad" onClick={(e) => e.stopPropagation()}>
        <header className="fd-head">
          <span className="fd-icon">
            <Sigma size={18} />
          </span>
          <h2>{showBook ? 'Formelsamling' : 'Formler'}</h2>
          <button className="fd-close" onClick={onClose} aria-label="Stäng formelbladet">
            ×
          </button>
        </header>
        <label className="fb-search fd-search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök formel …" aria-label="Sök i formelbladet" />
        </label>
        <div className="fd-body">
          {book === undefined || !lessons || !index ? (
            <p className="fd-empty">Hämtar …</p>
          ) : showBook ? (
            <FormulaBookView book={book} query={query} compact />
          ) : (
            <LessonRules lessons={lessons} index={index} subject={subject} query={query} />
          )}
        </div>
        <a className="fd-all" href="#/formler">
          Hela formelbladet →
        </a>
      </aside>
    </div>
  )
}
