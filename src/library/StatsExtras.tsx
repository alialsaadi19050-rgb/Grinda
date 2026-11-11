// Två delar på statistiksidan: en karta över hur mycket du räknat varje dag de senaste
// veckorna, och de områden där du oftast svarar fel (med en genväg till att öva på dem).
import type { Exercise } from '../content/types.ts'
import type { Progress } from '../progress/progress.ts'
import { generatorFor, generatorHref } from '../practice/generators.ts'

const WEEKS = 16
const DAY = 86_400_000
const startOfDay = (t: number) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

/** XP per dag som rutor, en kolumn per vecka (måndag överst). */
export function ActivityMap({ xpByDay }: { xpByDay: Map<number, number> }) {
  const today = startOfDay(Date.now())
  const weekday = (new Date(today).getDay() + 6) % 7 // måndag = 0
  const first = today - (weekday + (WEEKS - 1) * 7) * DAY
  const days = Array.from({ length: WEEKS * 7 }, (_, i) => {
    // Dagar läggs ut med tolv timmars marginal så att sommartid inte flyttar dem.
    const t = startOfDay(first + i * DAY + DAY / 2)
    return { t, xp: t > today ? -1 : (xpByDay.get(t) ?? 0) }
  })
  const max = Math.max(1, ...days.map((d) => d.xp))
  const level = (xp: number) => (xp < 0 ? 'future' : xp === 0 ? 'l0' : `l${Math.min(4, Math.ceil((4 * xp) / max))}`)
  const active = days.filter((d) => d.xp > 0).length
  const total = days.reduce((s, d) => s + Math.max(0, d.xp), 0)
  const months = Array.from({ length: WEEKS }, (_, w) => {
    const d = new Date(days[w * 7].t)
    const prev = w ? new Date(days[(w - 1) * 7].t) : null
    // Första kolumnen får bara ett namn om månaden räcker några veckor, så att namnen inte krockar.
    const next = new Date(days[Math.min(WEEKS - 1, w + 2) * 7].t)
    if (!prev) return next.getMonth() === d.getMonth() ? MONTHS[d.getMonth()] : ''
    return prev.getMonth() !== d.getMonth() ? MONTHS[d.getMonth()] : ''
  })
  return (
    <div className="stp-map-wrap">
      <div className="stp-map" role="img" aria-label={`Du har räknat ${active} av de senaste ${WEEKS * 7} dagarna och fått ${total} XP.`}>
        <div className="stp-map-months" aria-hidden="true">
          {months.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </div>
        <div className="stp-map-grid">
          {days.map((d) => (
            <i key={d.t} className={level(d.xp)} title={d.xp >= 0 ? `${new Date(d.t).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}: ${d.xp} XP` : undefined} />
          ))}
        </div>
      </div>
      <p className="mk-row-note">
        {active ? `Du har räknat ${active} ${active === 1 ? 'dag' : 'dagar'} de senaste ${WEEKS} veckorna och fått ${total} XP.` : `Här fylls en ruta i för varje dag du räknar.`}
        <span className="stp-map-key" aria-hidden="true">
          Mindre <i className="l0" />
          <i className="l1" />
          <i className="l2" />
          <i className="l3" />
          <i className="l4" /> Mer
        </span>
      </p>
    </div>
  )
}

/** Områden där du fått flest fel, med andel lösta uppgifter. */
export function WeakTopics({ exercises, progress }: { exercises: Exercise[]; progress: Progress }) {
  const byTopic = new Map<string, { topic: string; chapter: number; section: string; wrong: number; tried: number; solved: number; total: number }>()
  for (const e of exercises) {
    if (!e.topic) continue
    const p = progress.byExercise[e.id]
    const t = byTopic.get(e.topic) ?? { topic: e.topic, chapter: e.chapter, section: e.section, wrong: 0, tried: 0, solved: 0, total: 0 }
    t.total++
    t.wrong += p.wrong
    if (p.status !== 'new') t.tried++
    if (p.status === 'correct') t.solved++
    byTopic.set(e.topic, t)
  }
  const weak = [...byTopic.values()]
    .filter((t) => t.wrong > 0)
    .sort((a, b) => b.wrong / Math.max(1, b.tried) - a.wrong / Math.max(1, a.tried) || b.wrong - a.wrong)
    .slice(0, 5)
  if (!weak.length) return <p className="mk-row-note">Inga fel än. När du svarar fel på något dyker området upp här, så att du vet vad du ska öva på.</p>
  return (
    <div className="stp-rows">
      {weak.map((t) => {
        const gen = generatorFor(t.topic)
        return (
          <div key={t.topic} className="stp-row stp-weak">
            <span className="stp-name">{t.topic}</span>
            <span className="stp-num">
              {t.wrong} fel · {t.solved} av {t.total} klara
            </span>
            <span className="stp-weak-links">
              <a href={`#/kapitel/${t.chapter}?avsnitt=${encodeURIComponent(t.section)}&omrade=${encodeURIComponent(t.topic)}`}>Uppgifterna</a>
              {gen && <a href={generatorHref(gen.id)}>Öva med nya siffror</a>}
            </span>
          </div>
        )
      })}
    </div>
  )
}
