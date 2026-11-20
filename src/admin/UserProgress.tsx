// Exakt hur mycket varje konto har räknat: lösta och påbörjade uppgifter, rätta delar, dagar
// och per avsnitt. Servern skickar vilka delar som blivit rätt per uppgift; här räknas det om
// mot bokens innehåll (antalet delar per uppgift), så "löst" betyder alla delar rätt.
import { useMemo, useState } from 'react'
import type { Content } from '../content/load.ts'
import type { UserProgress } from './api.ts'

export interface ProgressSummary {
  solved: number
  started: number
  correctParts: number
  tries: number
  wrong: number
  generated: number
  perSection: { key: string; title: string; solved: number; started: number; total: number; numbers: string[] }[]
}

export function summarize(p: UserProgress | undefined, content: Content | null): ProgressSummary | null {
  if (!p || !content) return null
  const byId = new Map(content.exercises.map((e) => [e.id, e]))
  const s: ProgressSummary = { solved: 0, started: 0, correctParts: 0, tries: 0, wrong: 0, generated: 0, perSection: [] }
  const sections = new Map<string, ProgressSummary['perSection'][number]>()
  for (const sec of content.sections) {
    const ch = content.index.chapters.find((c) => c.sections.some((x) => x.id === sec.section))
    sections.set(sec.section, { key: sec.section, title: `${ch?.label ?? ch?.title ?? ''} · ${sec.title}`, solved: 0, started: 0, total: sec.exercises.length, numbers: [] })
  }
  for (const [id, info] of Object.entries(p.exercises ?? {})) {
    s.tries += info.tries
    s.wrong += info.wrong
    s.correctParts += info.correct.length
    // Uppgifter med nya siffror (gen:…) finns inte i boken; de räknas för sig.
    if (id.startsWith('gen:')) {
      if (info.correct.length) s.generated++
      continue
    }
    const ex = byId.get(id)
    if (!ex) continue
    const row = sections.get(ex.section)
    const done = info.correct.length >= ex.parts.length
    if (done) {
      s.solved++
      if (row) {
        row.solved++
        row.numbers.push(ex.number)
      }
    } else {
      s.started++
      if (row) row.started++
    }
  }
  s.perSection = [...sections.values()].filter((r) => r.solved || r.started)
  for (const r of s.perSection) r.numbers.sort((a, b) => a.localeCompare(b, 'sv', { numeric: true }))
  return s
}

const date = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) : '–')

export function UserProgressLine({ p, content }: { p: UserProgress | undefined; content: Content | null }) {
  const [open, setOpen] = useState(false)
  const s = useMemo(() => summarize(p, content), [p, content])
  if (!p) return <span className="ad-progress muted">Inga svar synkade än.</span>
  if (!s) return <span className="ad-progress muted">Räknar …</span>
  return (
    <div className="ad-progress">
      <div className="ad-nums">
        <span>
          <b>{s.solved}</b> lösta
        </span>
        <span>
          <b>{s.started}</b> påbörjade
        </span>
        <span>
          <b>{s.correctParts}</b> rätta delar
        </span>
        <span>
          <b>{s.tries ? Math.round((100 * (s.tries - s.wrong)) / s.tries) : 0} %</b> av svaren rätt
        </span>
        <span>
          <b>{p.active_days}</b> {p.active_days === 1 ? 'dag' : 'dagar'}
        </span>
        {s.generated > 0 && (
          <span>
            <b>{s.generated}</b> nya siffror
          </span>
        )}
        <button className="ad-more" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Dölj' : 'Per avsnitt'}
        </button>
      </div>
      {open && (
        <div className="ad-detail">
          <p className="so-help">
            Första svaret {date(p.first_at)}, senaste {date(p.last_at)}. {s.tries} svar totalt, varav {s.wrong} fel.
          </p>
          <table>
            <thead>
              <tr>
                <th>Avsnitt</th>
                <th>Lösta</th>
                <th>Påbörjade</th>
                <th>Lösta uppgifter</th>
              </tr>
            </thead>
            <tbody>
              {s.perSection.map((r) => (
                <tr key={r.key}>
                  <td>{r.title}</td>
                  <td>
                    {r.solved} / {r.total}
                  </td>
                  <td>{r.started}</td>
                  <td className="ad-numbers">{r.numbers.join(', ') || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
