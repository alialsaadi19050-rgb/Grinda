// Repetition med mellanrum. En uppgift du fått fel på kommer tillbaka efter t.ex. 1, 3 och
// 7 dagar. Klarar du den utan fel den dagen (eller senare) går den vidare till nästa steg.
// Får du fel igen börjar den om. Allt räknas ut från dina försök, så det följer med i synken.
import type { Exercise } from '../content/types.ts'
import { resolveOverrides, type Attempt } from '../storage/db.ts'

const DAY = 86_400_000
export const startOfDay = (t: number) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
/** Hela dagar mellan två tidpunkter (kalenderdagar, så att sommartid inte spelar in). */
export const daysBetween = (from: number, to: number) => Math.round((startOfDay(to) - startOfDay(from)) / DAY)
const addDays = (t: number, days: number) => {
  const d = new Date(startOfDay(t))
  d.setDate(d.getDate() + days)
  return d.getTime()
}

export interface SrsItem {
  exerciseId: string
  /** Vilket steg uppgiften är på (0 = första repetitionen). */
  step: number
  /** Början på dagen då den ska repeteras. */
  due: number
  /** Senaste gången du fick fel. */
  lastWrongAt: number
  /** Antal gånger du klarat en repetition i rad. */
  passes: number
}

export interface SrsState {
  /** Uppgifter som väntar på repetition, tidigast först. */
  items: SrsItem[]
  /** Uppgifter som klarat alla steg. */
  graduated: string[]
}

interface Round {
  wrongAt: number
  /** När sista deluppgiften blev rätt (0 om omgången inte är klar). */
  completedAt: number
}

/** Delar upp en uppgifts försök i omgångar (vid varje ”gör om”). */
function rounds(ex: Exercise, attempts: Attempt[]): Round[] {
  const out: Attempt[][] = [[]]
  for (const a of attempts) {
    if (a.status === 'redo') out.push([])
    else out.at(-1)!.push(a)
  }
  return out
    .filter((r) => r.length)
    .map((r) => {
      const wrong = r.filter((a) => a.status === 'incorrect' || a.status === 'partial')
      const solved = ex.parts.map((_, i) => r.find((a) => a.part === i && a.status === 'correct')?.at ?? 0)
      return { wrongAt: wrong.length ? Math.max(...wrong.map((a) => a.at)) : 0, completedAt: solved.every(Boolean) ? Math.max(...solved) : 0 }
    })
}

/** Ren funktion så att den går att testa. */
export function computeSrs(exercises: Exercise[], attempts: Attempt[], intervals: number[]): SrsState {
  const steps = intervals.filter((d) => d > 0)
  const byEx = new Map<string, Attempt[]>()
  for (const a of resolveOverrides(attempts)) {
    const list = byEx.get(a.exerciseId) ?? []
    list.push(a)
    byEx.set(a.exerciseId, list)
  }
  const items: SrsItem[] = []
  const graduated: string[] = []
  if (!steps.length) return { items, graduated }

  for (const ex of exercises) {
    const mine = byEx.get(ex.id)
    if (!mine) continue
    let item: SrsItem | null = null
    let done = false
    for (const r of rounds(ex, mine.sort((a, b) => a.at - b.at))) {
      if (r.wrongAt) {
        // Fel: börja om från första steget.
        item = { exerciseId: ex.id, step: 0, due: addDays(r.wrongAt, steps[0]), lastWrongAt: r.wrongAt, passes: 0 }
        done = false
      } else if (item && r.completedAt && r.completedAt >= item.due) {
        // Felfri omgång på rätt dag eller senare: vidare till nästa steg.
        const cur: SrsItem = item
        const step = cur.step + 1
        if (step >= steps.length) {
          item = null
          done = true
        } else item = { ...cur, step, due: addDays(r.completedAt, steps[step]), passes: cur.passes + 1 }
      }
    }
    if (item) items.push(item)
    else if (done) graduated.push(ex.id)
  }
  items.sort((a, b) => a.due - b.due || a.lastWrongAt - b.lastWrongAt)
  return { items, graduated }
}

/* ---------- Egna justeringar (sparas i den här webbläsaren) ---------- */

const KEY = 'grinda.srs.adjust.v1'

export interface SrsAdjust {
  /** Uppgift → dag (ms) den är uppskjuten till. */
  snooze: Record<string, number>
  /** Uppgift → när du tog bort den ur repetitionen. Ett nytt fel efter det lägger tillbaka den. */
  removed: Record<string, number>
}

export function readAdjust(): SrsAdjust {
  try {
    return { snooze: {}, removed: {}, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<SrsAdjust>) }
  } catch {
    return { snooze: {}, removed: {} }
  }
}

function writeAdjust(a: SrsAdjust) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a))
  } catch {
    /* gäller bara den här sessionen */
  }
  window.dispatchEvent(new Event('grinda:srs'))
}

export function snooze(exerciseId: string, days: number, now = Date.now()) {
  const a = readAdjust()
  writeAdjust({ ...a, snooze: { ...a.snooze, [exerciseId]: addDays(now, days) } })
}

export function removeFromSrs(exerciseId: string, now = Date.now()) {
  const a = readAdjust()
  writeAdjust({ ...a, removed: { ...a.removed, [exerciseId]: now } })
}

export function restoreToSrs(exerciseId: string) {
  const a = readAdjust()
  const { [exerciseId]: _gone, ...removed } = a.removed
  writeAdjust({ ...a, removed })
}

export interface SrsToday {
  /** Ska repeteras idag (eller är försenade), högst maxPerDay. */
  due: SrsItem[]
  /** Fler som är försenade men inte fick plats idag. */
  overflow: number
  /** Kommande, tidigast först. */
  upcoming: SrsItem[]
  /** Borttagna av dig. */
  removed: SrsItem[]
}

/** Dagens lista, med dina uppskjutningar och borttagningar inräknade. */
export function srsToday(state: SrsState, adjust: SrsAdjust, maxPerDay: number, now = Date.now()): SrsToday {
  const today = startOfDay(now)
  const removed: SrsItem[] = []
  const active: SrsItem[] = []
  for (const it of state.items) {
    if ((adjust.removed[it.exerciseId] ?? 0) > it.lastWrongAt) removed.push(it)
    else active.push({ ...it, due: Math.max(it.due, adjust.snooze[it.exerciseId] ?? 0) })
  }
  active.sort((a, b) => a.due - b.due || a.lastWrongAt - b.lastWrongAt)
  const dueAll = active.filter((it) => it.due <= today)
  const due = maxPerDay > 0 ? dueAll.slice(0, maxPerDay) : dueAll
  return { due, overflow: dueAll.length - due.length, upcoming: active.filter((it) => it.due > today), removed }
}

/** ”idag”, ”i morgon”, ”om 4 dagar”, ”3 dagar sen”. */
export function dayLabel(t: number, now = Date.now()): string {
  const d = daysBetween(now, t)
  if (d === 0) return 'idag'
  if (d === 1) return 'i morgon'
  if (d === -1) return 'i går'
  return d > 0 ? `om ${d} dagar` : `${-d} dagar sen`
}
