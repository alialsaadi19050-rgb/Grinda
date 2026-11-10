// Formelbladet inne i en uppgift: en panel från höger med formlerna för uppgiftens delområde
// först, och resten av kapitlet nedanför (med sök).
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Lesson } from '../content/types.ts'
import { Search, Sigma } from '../design/icons.tsx'
import { lessonHref, useLessons } from '../lessons/data.ts'
import { MathText } from '../ui/MathText.tsx'
import './formulas.css'

type Rule = { title: string; text: string }
export const rulesOf = (l: Lesson): Rule[] => l.blocks.flatMap((b) => (b.type === 'rule' ? [{ title: b.title, text: b.text }] : []))

export function FormulaDrawer({ topic, chapter, onClose }: { topic?: string; chapter: number; onClose: () => void }) {
  const lessons = useLessons()
  const [query, setQuery] = useState('')
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const { mine, others } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const inChapter = (lessons ?? []).filter((l) => l.chapter === chapter || chapter === 0)
    const withRules = inChapter
      .map((l) => ({ lesson: l, rules: rulesOf(l).filter((r) => !q || `${r.title} ${r.text} ${l.topic}`.toLowerCase().includes(q)) }))
      .filter((x) => x.rules.length)
    return { mine: withRules.filter((x) => x.lesson.topic === topic), others: withRules.filter((x) => x.lesson.topic !== topic) }
  }, [lessons, chapter, topic, query])

  return (
    <div className="fd-backdrop" onClick={onClose}>
      <aside className="fd" ref={panel} tabIndex={-1} aria-label="Formelblad" onClick={(e) => e.stopPropagation()}>
        <header className="fd-head">
          <span className="fd-icon">
            <Sigma size={18} />
          </span>
          <h2>Formler</h2>
          <button className="fd-close" onClick={onClose} aria-label="Stäng formelbladet">
            ×
          </button>
        </header>
        <label className="fb-search fd-search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök formel …" aria-label="Sök i formelbladet" />
        </label>
        <div className="fd-body">
          {!lessons ? (
            <p className="fd-empty">Hämtar …</p>
          ) : !mine.length && !others.length ? (
            <p className="fd-empty">{query ? `Ingen formel matchar ”${query}”.` : 'Det finns inga formler för det här kapitlet än.'}</p>
          ) : (
            <>
              {mine.map(({ lesson, rules }) => (
                <section key={lesson.id} className="fd-topic mine">
                  <h3>
                    Till den här uppgiften · <a href={lessonHref(lesson.id)}>{lesson.topic}</a>
                  </h3>
                  {rules.map((r, i) => (
                    <article key={i} className="fb-card">
                      <h4>{r.title}</h4>
                      <MathText text={r.text} />
                    </article>
                  ))}
                </section>
              ))}
              {others.map(({ lesson, rules }) => (
                <details key={lesson.id} className="fd-topic" open={!!query || !mine.length}>
                  <summary>
                    {lesson.topic} <small>{rules.length}</small>
                  </summary>
                  {rules.map((r, i) => (
                    <article key={i} className="fb-card">
                      <h4>{r.title}</h4>
                      <MathText text={r.text} />
                    </article>
                  ))}
                </details>
              ))}
            </>
          )}
        </div>
        <a className="fd-all" href="#/formler">
          Hela formelbladet →
        </a>
      </aside>
    </div>
  )
}
