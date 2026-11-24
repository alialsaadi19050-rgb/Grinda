// Formelsamlingarna för Fysik 2: den tryckta formelboken (samma ordning och rubriker) och
// formelbladet "Formler och tabeller för gymnasiet". Den används både på formelbladet och i panelen inne i uppgifterna, så att du
// tränar på att hitta rätt formel själv.
import { useEffect, useMemo, useRef, useState } from 'react'
import { contentText } from '../vault/vault.ts'
import { MathText } from '../ui/MathText.tsx'
import './formulas.css'

export type BookBlock =
  | { type: 'section'; title: string }
  | { type: 'intro'; text: string }
  | { type: 'table'; rows: [string, string, string][] }
  | { type: 'row'; label: string; lines: string[][]; fig?: string }

export interface FormulaBookData {
  title: string
  chapters: { title: string; blocks: BookBlock[] }[]
}

/** Formelsamlingarna för Fysik 2. Den första är den tryckta formelboken. */
export const FORMULA_BOOKS = [
  { id: 'formelbok', name: 'Formelboken', path: 'data/formelbok-fysik2.json' },
  { id: 'formelblad', name: 'Formelblad', path: 'data/formelblad-fy2.json' },
] as const
export type FormulaBookId = (typeof FORMULA_BOOKS)[number]['id']

const promises = new Map<string, Promise<FormulaBookData | null>>()
const load = (path: string) => {
  let p = promises.get(path)
  if (!p) {
    p = contentText(path).then(
      (t) => JSON.parse(t) as FormulaBookData,
      () => null,
    )
    promises.set(path, p)
  }
  return p
}

const CHOICE_KEY = 'grinda.formelbok'
const readChoice = (): FormulaBookId => {
  try {
    const v = localStorage.getItem(CHOICE_KEY)
    if (FORMULA_BOOKS.some((b) => b.id === v)) return v as FormulaBookId
  } catch {
    /* privat läge */
  }
  return FORMULA_BOOKS[0].id
}

export type LoadedBook = { id: FormulaBookId; name: string; book: FormulaBookData }

/**
 * Formelsamlingarna som finns i den här versionen av boken, och den du valde senast.
 * undefined medan de laddas; en tom lista om ingen finns.
 */
export function useFormulaBooks(): { books: LoadedBook[]; current: LoadedBook | null; choose: (id: FormulaBookId) => void } | undefined {
  const [books, setBooks] = useState<LoadedBook[] | undefined>(undefined)
  const [choice, setChoice] = useState<FormulaBookId>(readChoice)
  useEffect(() => {
    let alive = true
    Promise.all(FORMULA_BOOKS.map((b) => load(b.path).then((book): LoadedBook | null => (book ? { id: b.id, name: b.name, book } : null)))).then((all) => {
      if (alive) setBooks(all.filter((b): b is LoadedBook => !!b))
    })
    return () => {
      alive = false
    }
  }, [])
  if (!books) return undefined
  const choose = (id: FormulaBookId) => {
    setChoice(id)
    try {
      localStorage.setItem(CHOICE_KEY, id)
    } catch {
      /* privat läge */
    }
  }
  return { books, current: books.find((b) => b.id === choice) ?? books[0] ?? null, choose }
}

/** Knappar för att byta formelsamling, när det finns fler än en. */
export function FormulaBookSwitch({ state }: { state: NonNullable<ReturnType<typeof useFormulaBooks>> }) {
  if (state.books.length < 2) return null
  return (
    <div className="st-seg fbk-switch" role="tablist" aria-label="Formelsamling">
      {state.books.map((b) => (
        <button key={b.id} role="tab" aria-selected={state.current?.id === b.id} className={state.current?.id === b.id ? 'on' : ''} onClick={() => state.choose(b.id)}>
          {b.name}
        </button>
      ))}
    </div>
  )
}

const plain = (s: string) => s.replace(/\\[a-zA-Z]+/g, ' ').replace(/[${}_^]/g, '').toLowerCase()

/** Markören för pilarna i figurerna (en gång per sida). */
function ArrowDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
          <path d="M0 1 10 5 0 9Z" fill="currentColor" stroke="none" />
        </marker>
      </defs>
    </svg>
  )
}

export function FormulaBookView({ book, query, compact = false }: { book: FormulaBookData; query: string; compact?: boolean }) {
  const q = query.trim().toLowerCase()
  const top = useRef<HTMLDivElement>(null)

  // Med sökning visas bara de formelrader som matchar (och rubrikerna de står under).
  const chapters = useMemo(() => {
    if (!q) return book.chapters
    return book.chapters
      .map((c) => {
        let section = ''
        const blocks: BookBlock[] = []
        let pendingSection: BookBlock | null = null
        for (const b of c.blocks) {
          if (b.type === 'section') {
            section = b.title
            pendingSection = b
            continue
          }
          if (b.type !== 'row') continue
          const hay = `${c.title} ${section} ${b.label} ${b.lines.flat().map(plain).join(' ')}`.toLowerCase()
          if (!hay.includes(q)) continue
          if (pendingSection) {
            blocks.push(pendingSection)
            pendingSection = null
          }
          blocks.push(b)
        }
        return { ...c, blocks }
      })
      .filter((c) => c.blocks.some((b) => b.type === 'row'))
  }, [book, q])

  const jump = (i: number) => top.current?.querySelector(`[data-chapter="${i}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className={`fbk ${compact ? 'compact' : ''}`} ref={top}>
      <ArrowDefs />
      {!q && (
        <nav className="fbk-toc" aria-label="Kapitel i formelsamlingen">
          {book.chapters.map((c, i) => (
            <button key={c.title} onClick={() => jump(i)}>
              {c.title}
            </button>
          ))}
        </nav>
      )}
      {!chapters.length && <p className="fd-empty">Ingen formel matchar ”{query}”.</p>}
      {chapters.map((c) => (
        <section key={c.title} className="fbk-chapter" data-chapter={book.chapters.findIndex((x) => x.title === c.title)}>
          <h2>{c.title}</h2>
          {c.blocks.map((b, i) =>
            b.type === 'section' ? (
              <h3 key={i}>{b.title}</h3>
            ) : b.type === 'intro' ? (
              <MathText key={i} className="fbk-intro" text={b.text} />
            ) : b.type === 'table' ? (
              <details key={i} className="fbk-table">
                <summary>Beteckningar, storheter och enheter</summary>
                <table>
                  <tbody>
                    {b.rows.map(([sym, desc, unit]) => (
                      <tr key={sym + desc}>
                        <td>
                          <MathText text={`$${sym}$`} />
                        </td>
                        <td>{desc}</td>
                        <td>{unit ? <MathText text={`$\\mathrm{${unit}}$`} /> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ) : (
              <div key={i} className={`fbk-row ${b.label ? '' : 'cont'} ${b.fig ? 'has-fig' : ''}`}>
                <div className="fbk-label">{b.label}</div>
                <div className="fbk-body">
                  {b.lines.map((cells, j) =>
                    cells.length > 1 ? (
                      <div key={j} className="fbk-multi">
                        {cells.map((cell, k) => (
                          <MathText key={k} text={cell} />
                        ))}
                      </div>
                    ) : (
                      <MathText key={j} text={cells[0]} />
                    ),
                  )}
                </div>
                {b.fig && <div className="fbk-fig" dangerouslySetInnerHTML={{ __html: b.fig }} />}
              </div>
            ),
          )}
        </section>
      ))}
    </div>
  )
}
