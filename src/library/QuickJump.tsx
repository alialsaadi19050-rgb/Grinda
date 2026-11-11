// Hoppa direkt till en uppgift eller genomgång: skriv numret i boken (t.ex. 214) eller ett ord.
// Öppnas med sökknappen i menyn eller med tangenten / (eller Ctrl+K).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from '../design/icons.tsx'
import { lessonHref, useLessons } from '../lessons/data.ts'
import { useContent } from './Library.tsx'

const plain = (s: string) =>
  s
    .replace(/\$[^$]*\$/g, ' ')
    .replace(/[*_]/g, '')
    .toLowerCase()

interface Hit {
  key: string
  href: string
  title: string
  sub: string
  kind: 'Uppgift' | 'Genomgång'
}

export function QuickJump() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && !!e.target.closest('input, textarea, select, [contenteditable="true"], math-field')
      if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <>
      <button className="nv-icon" onClick={() => setOpen(true)} aria-label="Sök uppgift eller genomgång" title="Sök uppgift eller genomgång (/)">
        <Search size={19} />
      </button>
      {open && <JumpDialog onClose={() => setOpen(false)} />}
    </>
  )
}

function JumpDialog({ onClose }: { onClose: () => void }) {
  const content = useContent()
  const lessons = useLessons()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])

  const hits = useMemo<Hit[]>(() => {
    const t = q.trim().toLowerCase()
    if (!t || !content) return []
    const isNum = /^\d/.test(t)
    const exHits = content.exercises
      .filter((e) => (isNum ? e.number.toLowerCase().startsWith(t) : plain(`${e.prompt} ${e.topic ?? ''}`).includes(t)))
      .sort((a, b) => (isNum ? Number(a.number === t ? -1 : 0) - Number(b.number === t ? -1 : 0) : 0))
      .slice(0, 8)
      .map((e) => ({ key: e.id, href: `#/uppgift/${encodeURIComponent(e.id)}`, title: `Uppgift ${e.number}`, sub: e.topic ?? '', kind: 'Uppgift' as const }))
    const chapters = new Set(content.index.chapters.map((c) => c.id))
    const lessonHits = isNum
      ? []
      : (lessons ?? [])
          .filter((l) => chapters.has(l.chapter) && plain(`${l.title} ${l.topic} ${l.summary}`).includes(t))
          .slice(0, 4)
          .map((l) => ({ key: l.id, href: lessonHref(l.id), title: l.title, sub: l.summary, kind: 'Genomgång' as const }))
    return [...lessonHits, ...exHits]
  }, [q, content, lessons])

  useEffect(() => setSel(0), [q])
  const go = (h: Hit | undefined) => {
    if (!h) return
    onClose()
    location.hash = h.href
  }

  return (
    <div className="qj-backdrop" onClick={onClose}>
      <div className="qj" role="dialog" aria-label="Sök" onClick={(e) => e.stopPropagation()}>
        <label className="qj-field">
          <Search size={20} />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Uppgiftsnummer, t.ex. 214, eller ett ord"
            aria-label="Sök uppgift eller genomgång"
            inputMode="search"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSel((s) => Math.min(hits.length - 1, s + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSel((s) => Math.max(0, s - 1))
              } else if (e.key === 'Enter') go(hits[sel])
            }}
          />
          <kbd>Esc</kbd>
        </label>
        {q.trim() && (
          <ul className="qj-list" role="listbox">
            {hits.length ? (
              hits.map((h, i) => (
                <li key={h.key} role="option" aria-selected={i === sel}>
                  <a href={h.href} className={i === sel ? 'on' : ''} onMouseEnter={() => setSel(i)} onClick={onClose}>
                    <span className={`qj-kind ${h.kind === 'Uppgift' ? 'qj-ex' : 'qj-ls'}`}>{h.kind}</span>
                    <b>{h.title}</b>
                    <small>{h.sub}</small>
                  </a>
                </li>
              ))
            ) : (
              <li className="qj-empty">Hittar inget som matchar ”{q}”.</li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
