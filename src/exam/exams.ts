// Vilka uppgifter som ingår i ett prov, från lärarens lista ("Till prov 2 Fysik 2 Na24").
// Uppgifter i provets kapitel som inte finns med får en liten varning på uppgiftssidan.

export interface Exam {
  id: string
  title: string
  /** Kapitlet provet gäller. Uppgifter i andra kapitel får ingen varning. */
  chapter: number
  /** Uppgifternas nummer som i lärarens lista, t.ex. "201-205", "240ab-245", "2.64ab", "2100a-2103". */
  lists: string[]
}

export const EXAMS: Exam[] = [
  {
    id: 'fysik2-prov2',
    title: 'prov 2',
    chapter: 102,
    lists: [
      // Läroboken
      '201-205, 207, 209-217, 219-223, 225-227, 230-236, 240ab-245, 246a, 247, 263, 264, 266-269',
      // Övningsboken
      '2.13, 2.14, 2.22, 2.29, 2.54-2.56, 2.64ab, 2.67, 2.69, 2.73',
      // Stjärnuppgifter
      '270-272, 274-280, 283-284, 286-289ab, 291-295, 297, 2100a-2103, 2105',
    ],
  },
]

/** Uppgiftsnummer → vilka deluppgifter som ingår (null = hela uppgiften). */
export type ExamItems = Map<string, Set<string> | null>

/** Tolkar "240ab-245" som 240 (a och b) och 241–245 hela. Övningsbokens "2.54-2.56" går också. */
export function parseList(list: string): ExamItems {
  const out: ExamItems = new Map()
  for (const raw of list.split(',')) {
    const item = raw.trim()
    if (!item) continue
    const m = /^(\d+(?:\.\d+)?)([a-z]*)(?:-(\d+(?:\.\d+)?)([a-z]*))?$/.exec(item)
    if (!m) throw new Error(`Förstår inte "${item}"`)
    const [, from, fromParts, to, toParts] = m
    if (!to) {
      out.set(from, fromParts ? new Set(fromParts) : null)
      continue
    }
    // Övningsboken: "2.54-2.56" räknar på siffrorna efter punkten.
    const dot = from.includes('.')
    const prefix = dot ? from.slice(0, from.indexOf('.') + 1) : ''
    const a = Number(dot ? from.slice(prefix.length) : from)
    const b = Number(dot ? to.slice(to.indexOf('.') + 1) : to)
    for (let n = a; n <= b; n++) {
      const num = `${prefix}${n}`
      const parts = n === a && fromParts ? fromParts : n === b && toParts ? toParts : ''
      out.set(num, parts ? new Set(parts) : null)
    }
  }
  return out
}

const cache = new Map<string, ExamItems>()
const itemsOf = (exam: Exam) => {
  let items = cache.get(exam.id)
  if (!items) {
    items = new Map(exam.lists.flatMap((l) => [...parseList(l)]))
    cache.set(exam.id, items)
  }
  return items
}

export type ExamStatus = { exam: Exam; included: 'all' } | { exam: Exam; included: 'none' } | { exam: Exam; included: 'some'; parts: string[] }

/** Om uppgiften hör till ett provs kapitel: ingår den helt, delvis eller inte alls? */
export function examStatus(ex: { chapter: number; number: string; parts: { label: string | null }[] }): ExamStatus | null {
  const exam = EXAMS.find((e) => e.chapter === ex.chapter)
  if (!exam) return null
  const items = itemsOf(exam)
  if (!items.has(ex.number)) return { exam, included: 'none' }
  const parts = items.get(ex.number)
  if (!parts) return { exam, included: 'all' }
  const labels = ex.parts.map((p) => p.label).filter((l): l is string => !!l)
  // Står alla deluppgifter med räknas den som hel.
  if (labels.length && labels.every((l) => parts.has(l))) return { exam, included: 'all' }
  return { exam, included: 'some', parts: [...parts] }
}
