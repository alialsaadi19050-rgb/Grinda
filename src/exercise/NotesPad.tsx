// Uträkning med tangentbordet – läget utan ritplatta. Sparas per uppgift tillsammans med
// skrivytan (och synkas på samma sätt), så att AI:n och andra enheter ser den.
import { useEffect, useRef, useState } from 'react'
import { loadDrawing, saveNotes } from '../storage/db.ts'

const SYMBOLS = ['²', '³', '√', 'π', '°', '·', '⋅10^', '≈', 'Δ', 'λ', 'ω', 'µ']

export function NotesPad({ exerciseId }: { exerciseId: string }) {
  const area = useRef<HTMLTextAreaElement>(null)
  const [state, setState] = useState<'loading' | 'idle' | 'saving' | 'saved'>('loading')
  const timer = useRef(0)
  const pending = useRef<string | null>(null)

  const flush = () => {
    if (pending.current === null) return
    const text = pending.current
    pending.current = null
    void saveNotes(exerciseId, text).then(() => setState('saved'))
  }

  useEffect(() => {
    let alive = true
    setState('loading')
    loadDrawing(exerciseId).then((d) => {
      if (!alive || !area.current) return
      area.current.value = d?.notes ?? ''
      setState('idle')
    })
    return () => {
      alive = false
      clearTimeout(timer.current)
      flush()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId])

  const changed = () => {
    pending.current = area.current?.value ?? ''
    setState('saving')
    clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, 500)
  }

  const insert = (sym: string) => {
    const el = area.current
    if (!el) return
    const a = el.selectionStart
    const b = el.selectionEnd
    el.value = el.value.slice(0, a) + sym + el.value.slice(b)
    el.focus()
    el.setSelectionRange(a + sym.length, a + sym.length)
    changed()
  }

  return (
    <section className="ex-notes" aria-label="Uträkning">
      <div className="ex-notes-head">
        <h2>Uträkning</h2>
        <button className="ex-notes-print" type="button" onClick={() => window.print()} title="Skriv ut uppgiften och din uträkning, eller spara som PDF">
          Skriv ut / PDF
        </button>
        <span className="ex-notes-state" aria-live="polite">
          {state === 'saving' ? 'Sparar …' : state === 'saved' ? 'Sparat' : ''}
        </span>
      </div>
      <textarea
        ref={area}
        className="ex-notes-area"
        placeholder={'Skriv din uträkning här, en rad i taget.\nT.ex.  k = F/Δl = 0,98/0,014 = 70 N/m'}
        spellCheck={false}
        rows={7}
        disabled={state === 'loading'}
        onInput={changed}
        onBlur={flush}
      />
      <div className="ex-keyhelp" role="toolbar" aria-label="Tecken för uträkningen">
        {SYMBOLS.map((s) => (
          <button key={s} type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(s)}>
            {s}
          </button>
        ))}
      </div>
    </section>
  )
}
