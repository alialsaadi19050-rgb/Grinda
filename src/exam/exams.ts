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
  /**
   * Uppgifter som inte står på listan men liknar bokens provuppgifter (bra extraövning).
   * best är de som är extra värda att göra.
   */
  extra?: { all: string; best: string }
  /** Avsnitt med egna uppgifter som är skrivna efter listan (t.ex. A-uppgifter). De får ingen varning. */
  ownSections?: string[]
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
    // Övningsboken: uppgifter som liknar provets uppgifter i läroboken. Svävningar, fysikalisk pendel,
    // hörseln, dopplerformeln och ljudhastighetens temperaturberoende är bortvalda (står inte med).
    extra: {
      all:
        '2.1-2.7, 2.9-2.12, 2.15-2.17, 2.18a, 2.19-2.21, 2.23, 2.26-2.28, 2.30-2.40, 2.42, 2.44-2.47, 2.49, 2.51, 2.52, 2.57-2.60, 2.70-2.72, 2.74, 2.76',
      best: '2.3, 2.4, 2.5, 2.7, 2.12, 2.15, 2.16, 2.17, 2.21, 2.26, 2.27, 2.28, 2.35, 2.37, 2.40, 2.44, 2.45, 2.46, 2.49, 2.52, 2.58, 2.59, 2.60, 2.70, 2.71, 2.72, 2.74, 2.76',
    },
    ownSections: ['f2-a-uppgifter'],
  },
  {
    // Matte 4, kapitel 2 – enligt planeringen (vecka 39–49), prov onsdag 2/12.
    id: 'matte4-prov2',
    title: 'prov 2',
    chapter: 402,
    lists: [
      '2102-2115, 2117-2124, 2126-2140, 2143-2152, 2155-2189',
      '2204-2233',
      '2303-2337',
      '2402-2422',
      // Diagnos 2 och blandade övningar (s. 91–97)
      '1-32',
    ],
    pages: 's. 52–76, 78–84, diagnos s. 91, 92–97 (prov 2/12)',
    lessons: {},
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

const cache = new Map<string, { items: ExamItems; extra: ExamItems; best: ExamItems }>()
const itemsOf = (exam: Exam) => {
  let c = cache.get(exam.id)
  if (!c) {
    c = {
      items: new Map(exam.lists.flatMap((l) => [...parseList(l)])),
      extra: exam.extra ? parseList(exam.extra.all) : new Map(),
      best: exam.extra ? parseList(exam.extra.best) : new Map(),
    }
    cache.set(exam.id, c)
  }
  return c
}

export type ExamStatus =
  | { exam: Exam; included: 'all' }
  | { exam: Exam; included: 'none' }
  | { exam: Exam; included: 'some'; parts: string[] }
  /** Inte på listan, men en bra extraövning. parts = bara vissa deluppgifter. */
  | { exam: Exam; included: 'extra'; best: boolean; parts: string[] | null }
  /** En egen uppgift som är skriven efter listan. */
  | { exam: Exam; included: 'own' }

/** Ingår uppgiften (helt eller delvis) i provet? */
export const inExam = (st: ExamStatus | null) => st?.included === 'all' || st?.included === 'some'

/** Om uppgiften hör till ett provs kapitel: ingår den helt, delvis eller inte alls? */
export function examStatus(ex: { chapter: number; section?: string; number: string; parts: { label: string | null }[] }): ExamStatus | null {
  const exam = EXAMS.find((e) => e.chapter === ex.chapter)
  if (!exam) return null
  if (ex.section && exam.ownSections?.includes(ex.section)) return { exam, included: 'own' }
  const { items, extra, best } = itemsOf(exam)
  if (!items.has(ex.number)) {
    if (!extra.has(ex.number)) return { exam, included: 'none' }
    const p = extra.get(ex.number)
    return { exam, included: 'extra', best: best.has(ex.number), parts: p ? [...p] : null }
  }
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
