// Vilka uppgifter som ingår i ett prov, från lärarens lista ("Till prov 2 Fysik 2 Na24").
// Uppgifter i provets kapitel som inte finns med får en liten varning på uppgiftssidan.

export interface Exam {
  id: string
  title: string
  /** Kapitlet provet gäller. Uppgifter i andra kapitel får ingen varning. */
  chapter: number
  /** Uppgifternas nummer som i lärarens lista, t.ex. "201-205", "240ab-245", "2.64ab", "2100a-2103". */
  lists: string[]
  /** Boksidorna som ingår, som de står i listan. */
  pages: string
  /**
   * Genomgångar som inte ingår (none) eller bara delvis ingår (some) enligt sidlistan.
   * Genomgångar som inte står här ingår helt.
   */
  lessons: Record<string, { included: 'none' } | { included: 'some'; note: string }>
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
    pages: 's. 54–halva 71, 72–80, 82–90, halva 92–96, 101–102, 104–halva 106, 109–122',
    lessons: {
      'f2-pendlar': { included: 'some', note: 'Den matematiska pendeln ingår, men inte den fysikaliska pendeln (nedre halvan av s. 71).' },
      'f2-staende': { included: 'some', note: 'Sidan 81 står inte med – vågornas hastighet i en sträng, $v = \\sqrt{\\frac{F}{\\rho A}}$.' },
      'f2-ljudstyrka': { included: 'some', note: 'Hörseln och örat (s. 91 och början av s. 92) ingår inte. Ljudstyrka, intensitet och decibel ingår.' },
      'f2-doppler': { included: 'some', note: 'Bara början av dopplereffekten (s. 96) står med. Sidan 97 – dopplerformeln och snabbare än ljudet – och exempel 2.11 på s. 99 står inte med. Fråga läraren om formeln ingår.' },
      'f2-svavningar': { included: 'none' },
      'f2-huygens': { included: 'some', note: 'Huygens princip och diffraktion ingår. Jordbävningar och tsunamier (s. 106–108) ingår inte.' },
    },
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

/** Om genomgången hör till ett provs kapitel: ingår den helt, delvis eller inte alls? */
export function lessonExamStatus(lesson: { id: string; chapter: number }): { exam: Exam; included: 'all' | 'none' | 'some'; note?: string } | null {
  const exam = EXAMS.find((e) => e.chapter === lesson.chapter)
  if (!exam) return null
  const l = exam.lessons[lesson.id]
  if (!l) return { exam, included: 'all' }
  return { exam, ...l }
}
