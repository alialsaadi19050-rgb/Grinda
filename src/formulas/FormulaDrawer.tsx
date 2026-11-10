// Formelbladet inne i en uppgift: en panel från höger med alla formler. Uppgiftens delområde
// visas först, sedan resten av kapitlet och sist de andra kapitlen (med sök).
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ContentIndex, Lesson } from '../content/types.ts'
import { loadContentOnce } from '../content/load.ts'
import { Search, Sigma } from '../design/icons.tsx'
import { lessonHref, useLessons } from '../lessons/data.ts'
import { MathText } from '../ui/MathText.tsx'
import './formulas.css'

type Rule = { title: string; text: string }
export const rulesOf = (l: Lesson): Rule[] => l.blocks.flatMap((b) => (b.type === 'rule' ? [{ title: b.title, text: b.text }] : []))

export function FormulaDrawer({ topic, chapter, onClose }: { topic?: string; chapter: number; onClose: () => void }) {
  const lessons = useLessons()
  const [index, setIndex] = useState<ContentIndex | null>(null)
  useEffect(() => {
    loadContentOnce().then((c) => setIndex(c.index), () => {})
  }, [])
  const [query, setQuery] = useState('')
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Alla formler: uppgiftens delområde först, sedan resten av kapitlet och sist de andra kapitlen.
  const { mine, groups } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const withRules = (lessons ?? [])
      .map((l) => ({ lesson: l, rules: rulesOf(l).filter((r) => !q || `${r.title} ${r.text} ${l.topic}`.toLowerCase().includes(q)) }))
      .filter((x) => x.rules.length)
    const mine = withRules.filter((x) => x.lesson.topic === topic)
    const rest = withRules.filter((x) => x.lesson.topic !== topic)
    const chapters = [...new Set(rest.map((x) => x.lesson.chapter))].sort((a, b) => Number(b === chapter) - Number(a === chapter))
    const groups = chapters.map((c) => ({
      chapter: c,
      label: index?.chapters.find((x) => x.id === c),
      items: rest.filter((x) => x.lesson.chapter === c),
    }))
    return { mine, groups }
  }, [lessons, chapter, topic, query, index])

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
          ) : !mine.length && !groups.length ? (
            <p className="fd-empty">{query ? `Ingen formel matchar ”${query}”.` : 'Det finns inga formler än.'}</p>
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
              {groups.map((g) => (
                <div key={g.chapter} className="fd-chapter">
                  <h3 className="fd-chapter-title">
                    {g.chapter === chapter ? 'Resten av kapitlet' : (g.label?.label ?? `Kapitel ${g.chapter}`)}
                    {g.chapter !== chapter && g.label?.title ? <small> · {g.label.title}</small> : null}
                  </h3>
                  {g.items.map(({ lesson, rules }) => (
                    <details key={lesson.id} className="fd-topic" open={!!query}>
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
                </div>
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
