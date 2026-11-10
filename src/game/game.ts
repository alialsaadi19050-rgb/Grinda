// XP, nivåer, märken, dagligt mål och veckosammanfattning. Allt räknas ut från dina sparade
// försök och genomgångar, så det följer med i synken utan att något extra behöver sparas.
import type { ContentIndex, Exercise } from '../content/types.ts'
import { resolveOverrides, type Attempt } from '../storage/db.ts'

const DAY = 86_400_000
const startOfDay = (t: number) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
const dayKey = (t: number) => startOfDay(t)

/* ---------- Nivåer ---------- */

export const LEVEL_NAMES = ['Nybörjare', 'Räknare', 'Problemlösare', 'Formelräv', 'Vågmästare', 'Mängdmagiker', 'Bevisbyggare', 'Tankeatlet', 'Mattegeni', 'Grinda-legend']

/** XP som krävs för att nå en nivå (nivå 1 = 0 XP). Varje nivå kräver 50 XP mer än den förra. */
export const xpForLevel = (level: number) => 25 * (level - 1) * (level + 2)

export function levelOf(xp: number): { level: number; name: string; into: number; span: number } {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  const from = xpForLevel(level)
  return { level, name: LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length) - 1], into: xp - from, span: xpForLevel(level + 1) - from }
}

/* ---------- XP ---------- */

const LEVEL_FACTOR = { a: 1, b: 1.5, c: 2 } as const
/** Uppgifter som räknats fram med nya siffror har id som börjar så här. */
export const GEN_PREFIX = 'gen:'
export const XP_LESSON = 20
export const XP_GENERATED = 4

export interface Badge {
  id: string
  icon: string
  title: string
  text: string
  earned: boolean
  /** Hur långt du kommit, t.ex. 7 av 10. */
  have: number
  need: number
}

export interface WeekSummary {
  /** Rätta deluppgifter de senaste sju dagarna, och sju dagarna innan. */
  correct: number
  correctBefore: number
  solved: number
  xp: number
  activeDays: number
  /** Delområdet med högst respektive lägst andel rätt på första försöket (minst tre försök). */
  best: { topic: string; accuracy: number } | null
  worst: { topic: string; accuracy: number } | null
}

export interface Game {
  xp: number
  level: ReturnType<typeof levelOf>
  /** XP per dag (början på dagen i ms → XP). */
  xpByDay: Map<number, number>
  /** Rätta deluppgifter idag. */
  today: number
  /** Dagar då dagens mål nåddes. */
  goalDays: number
  badges: Badge[]
  week: WeekSummary
  /** XP de senaste sju dagarna (för topplistan). */
  weekXp: number
  streakDays: number
  solvedTotal: number
  /** Avsnitt och kapitel där alla uppgifter är lösta. */
  sectionsDone: string[]
  chaptersDone: number[]
}

export interface GameInput {
  index: ContentIndex
  exercises: Exercise[]
  attempts: Attempt[]
  /** Genomgång → när den blev klar. */
  lessonsDone: Record<string, number | undefined>
  lessonCount: number
  dailyGoal: number
  now?: number
}

export function computeGame({ index, exercises, attempts, lessonsDone, lessonCount, dailyGoal, now = Date.now() }: GameInput): Game {
  const all = resolveOverrides(attempts).sort((a, b) => a.at - b.at)
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const xpByDay = new Map<number, number>()
  const correctByDay = new Map<number, number>()
  const give = (at: number, xp: number) => xpByDay.set(dayKey(at), (xpByDay.get(dayKey(at)) ?? 0) + xp)

  // Går igenom försöken i tidsordning. En deluppgift ger XP första gången den blir rätt i varje omgång.
  const round = new Map<string, number>()
  const tried = new Set<string>()
  const won = new Set<string>()
  const solvedParts = new Map<string, Set<number>>()
  const solvedAt = new Map<string, number>()
  const hadWrong = new Set<string>()
  const cleanRedos = new Set<string>()
  const topicFirst = new Map<string, { at: number; ok: boolean }[]>()
  let run = 0
  let bestRun = 0
  let night = false
  let early = false
  let generated = 0

  for (const a of all) {
    if (a.status === 'redo') {
      round.set(a.exerciseId, (round.get(a.exerciseId) ?? 0) + 1)
      continue
    }
    const r = round.get(a.exerciseId) ?? 0
    const key = `${a.exerciseId}|${r}|${a.part}`
    const first = !tried.has(key)
    tried.add(key)
    const ex = byId.get(a.exerciseId)
    const gen = a.exerciseId.startsWith(GEN_PREFIX)
    if (first && !a.self) {
      run = a.status === 'correct' ? run + 1 : 0
      bestRun = Math.max(bestRun, run)
      if (ex?.topic) {
        const list = topicFirst.get(ex.topic) ?? []
        list.push({ at: a.at, ok: a.status === 'correct' })
        topicFirst.set(ex.topic, list)
      }
    }
    if (a.status !== 'correct') {
      if (ex) hadWrong.add(`${a.exerciseId}|${r}`)
      continue
    }
    if (won.has(key)) continue
    won.add(key)
    correctByDay.set(dayKey(a.at), (correctByDay.get(dayKey(a.at)) ?? 0) + 1)
    const hour = new Date(a.at).getHours()
    if (hour < 5) night = true
    else if (hour < 7) early = true
    if (gen) {
      generated++
      give(a.at, XP_GENERATED)
      continue
    }
    if (!ex) continue
    // Första omgången: 10 XP (6 om du rättat själv), +5 för rätt direkt, gånger nivån. Repetition: 5 XP.
    let xp = r > 0 ? 5 : (a.self ? 6 : 10) + (first && !a.self ? 5 : 0)
    if (r === 0) xp *= ex.level ? LEVEL_FACTOR[ex.level] : 1.2
    if (a.hintUsed) xp -= 2
    give(a.at, Math.max(1, Math.round(xp)))
    // Hela uppgiften löst i den här omgången?
    const partsKey = `${a.exerciseId}|${r}`
    const parts = solvedParts.get(partsKey) ?? new Set<number>()
    parts.add(a.part)
    solvedParts.set(partsKey, parts)
    if (parts.size === ex.parts.length) {
      if (!solvedAt.has(ex.id)) solvedAt.set(ex.id, a.at)
      if (r > 0 && !hadWrong.has(partsKey)) cleanRedos.add(ex.id)
    }
  }
  const doneLessons = Object.entries(lessonsDone).filter(([, at]) => at)
  for (const [, at] of doneLessons) give(at!, XP_LESSON)

  const xp = [...xpByDay.values()].reduce((s, v) => s + v, 0)
  const today = correctByDay.get(dayKey(now)) ?? 0
  const goalDays = dailyGoal > 0 ? [...correctByDay.values()].filter((v) => v >= dailyGoal).length : 0
  const bestDay = Math.max(0, ...correctByDay.values())

  // Dagar i rad: räknas bakåt från idag (eller igår, om du inte hunnit räkna idag än).
  const active = new Set(all.map((a) => dayKey(a.at)))
  let streak = 0
  let longest = 0
  {
    const d = new Date(startOfDay(now))
    if (!active.has(d.getTime())) d.setDate(d.getDate() - 1)
    while (active.has(d.getTime())) {
      streak++
      d.setDate(d.getDate() - 1)
    }
    const days = [...active].sort((a, b) => a - b)
    let cur = 0
    days.forEach((t, i) => {
      cur = i && Math.round((t - days[i - 1]) / DAY) === 1 ? cur + 1 : 1
      longest = Math.max(longest, cur)
    })
  }

  const solved = new Set(solvedAt.keys())
  const sections = [...new Set(exercises.map((e) => e.section))]
  const sectionsDone = sections.filter((s) => exercises.filter((e) => e.section === s).every((e) => solved.has(e.id)))
  const chaptersDone = index.chapters.map((c) => c.id).filter((id) => exercises.some((e) => e.chapter === id) && exercises.filter((e) => e.chapter === id).every((e) => solved.has(e.id)))
  const subjects = new Set(index.chapters.filter((c) => exercises.some((e) => e.chapter === c.id && solved.has(e.id))).map((c) => c.subject ?? 'matte'))
  const hard = exercises.filter((e) => e.level === 'c' && solved.has(e.id)).length

  const badge = (id: string, icon: string, title: string, text: string, have: number, need: number): Badge => ({ id, icon, title, text, have: Math.min(have, need), need, earned: have >= need })
  const badges: Badge[] = [
    badge('first', '🌱', 'Första steget', 'Lös din första uppgift.', solved.size, 1),
    badge('solved-10', '🔟', 'Tio klara', 'Lös 10 uppgifter.', solved.size, 10),
    badge('solved-50', '🏅', 'Femtio klara', 'Lös 50 uppgifter.', solved.size, 50),
    badge('solved-100', '💯', 'Hundra klara', 'Lös 100 uppgifter.', solved.size, 100),
    badge('solved-250', '🏆', 'Tvåhundrafemtio', 'Lös 250 uppgifter.', solved.size, 250),
    badge('run-10', '🎯', '10 rätt i rad', 'Svara rätt på första försöket tio gånger i rad.', bestRun, 10),
    badge('run-25', '🔥', '25 rätt i rad', 'Svara rätt på första försöket 25 gånger i rad.', bestRun, 25),
    badge('streak-3', '📅', 'Tre dagar i rad', 'Räkna tre dagar i rad.', longest, 3),
    badge('streak-7', '🗓️', 'En hel vecka', 'Räkna sju dagar i rad.', longest, 7),
    badge('streak-30', '⛰️', 'Trettio dagar', 'Räkna trettio dagar i rad.', longest, 30),
    badge('section', '📘', 'Avsnittsmästare', 'Lös alla uppgifter i ett avsnitt.', sectionsDone.length, 1),
    badge('chapter', '📚', 'Kapitelmästare', 'Lös alla uppgifter i ett kapitel.', chaptersDone.length, 1),
    badge('redo-1', '♻️', 'Andra chansen', 'Gör om en uppgift du fått fel på – utan fel.', cleanRedos.size, 1),
    badge('redo-10', '🛠️', 'Felfixaren', 'Gör om tio uppgifter du fått fel på – utan fel.', cleanRedos.size, 10),
    badge('level-c', '🧗', 'Nivå C', 'Lös fem uppgifter på nivå C.', hard, 5),
    badge('marathon', '🏃', 'Maraton', '30 rätta deluppgifter på en och samma dag.', bestDay, 30),
    badge('goal-1', '✅', 'Dagens mål', 'Nå ditt dagliga mål.', goalDays, 1),
    badge('goal-7', '🌟', 'Sju mål', 'Nå ditt dagliga mål sju dagar.', goalDays, 7),
    badge('lessons-5', '📖', 'Bokmal', 'Gör klart fem genomgångar.', doneLessons.length, 5),
    badge('lessons-all', '🎓', 'Alla genomgångar', 'Gör klart alla genomgångar.', lessonCount ? doneLessons.length : 0, Math.max(1, lessonCount)),
    badge('both', '⚛️', 'Dubbelämnad', 'Lös uppgifter i både Fysik 2 och Matte 5.', subjects.size, 2),
    badge('new-numbers', '🎲', 'Nya siffror', 'Lös tio uppgifter med nya siffror.', generated, 10),
    badge('night', '🦉', 'Nattugglan', 'Svara rätt mellan midnatt och klockan fem.', night ? 1 : 0, 1),
    badge('early', '🐓', 'Morgonpigg', 'Svara rätt mellan klockan fem och sju på morgonen.', early ? 1 : 0, 1),
  ]

  // Veckan: de senaste sju dagarna jämfört med de sju innan.
  const weekStart = startOfDay(now) - 6 * DAY
  const prevStart = weekStart - 7 * DAY
  const sumDays = (m: Map<number, number>, from: number, to: number) => [...m].filter(([d]) => d >= from && d < to).reduce((s, [, v]) => s + v, 0)
  const end = startOfDay(now) + DAY
  const topicStats = [...topicFirst]
    .map(([topic, list]) => {
      const w = list.filter((x) => x.at >= weekStart)
      return { topic, tries: w.length, accuracy: w.length ? w.filter((x) => x.ok).length / w.length : 0 }
    })
    .filter((t) => t.tries >= 3)
    .sort((a, b) => b.accuracy - a.accuracy || b.tries - a.tries)
  const week: WeekSummary = {
    correct: sumDays(correctByDay, weekStart, end),
    correctBefore: sumDays(correctByDay, prevStart, weekStart),
    solved: [...solvedAt.values()].filter((t) => t >= weekStart).length,
    xp: sumDays(xpByDay, weekStart, end),
    activeDays: [...active].filter((d) => d >= weekStart).length,
    best: topicStats[0] ? { topic: topicStats[0].topic, accuracy: topicStats[0].accuracy } : null,
    worst: topicStats.length > 1 ? { topic: topicStats.at(-1)!.topic, accuracy: topicStats.at(-1)!.accuracy } : null,
  }

  return { xp, level: levelOf(xp), xpByDay, today, goalDays, badges, week, weekXp: week.xp, streakDays: streak, solvedTotal: solved.size, sectionsDone, chaptersDone }
}

/** ”Den här veckan: 47 rätta svar. Bäst på dopplereffekt, svårast med interferens.” */
export function weekSentence(w: WeekSummary): string {
  if (!w.correct) return 'Inga rätta svar de senaste sju dagarna – en uppgift idag räcker för att komma igång.'
  const parts = [`${w.correct} rätta svar på ${w.activeDays} ${w.activeDays === 1 ? 'dag' : 'dagar'}`]
  if (w.best) parts.push(`bäst på ${w.best.topic.toLowerCase()} (${Math.round(w.best.accuracy * 100)} % rätt direkt)`)
  if (w.worst && w.worst.accuracy < 1 && w.worst.topic !== w.best?.topic) parts.push(`svårast med ${w.worst.topic.toLowerCase()} (${Math.round(w.worst.accuracy * 100)} %)`)
  return `De senaste sju dagarna: ${parts.join(', ')}.`
}
