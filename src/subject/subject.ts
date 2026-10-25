// Vilket ämne du pluggar just nu: Fysik 2 eller Matte 5. Startsidan låter dig välja, och
// resten av appen (hem, kapitel, Lär dig, statistik) visar bara det ämnets innehåll.
import { useSyncExternalStore } from 'react'
import type { Content } from '../content/load.ts'
import type { ContentIndex } from '../content/types.ts'

export type Subject = 'matte' | 'fysik'

export const SUBJECTS: { id: Subject; name: string }[] = [
  { id: 'fysik', name: 'Fysik 2' },
  { id: 'matte', name: 'Matte 5' },
]

const KEY = 'grinda.subject'
const read = (): Subject => {
  try {
    return localStorage.getItem(KEY) === 'fysik' ? 'fysik' : 'matte'
  } catch {
    return 'matte'
  }
}

let current = read()
const listeners = new Set<() => void>()

export function setSubject(s: Subject) {
  if (s === current) return
  current = s
  try {
    localStorage.setItem(KEY, s)
  } catch {
    /* gäller bara den här sessionen */
  }
  listeners.forEach((l) => l())
}

export const getSubject = () => current

export function useSubject(): Subject {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}

type Chapter = ContentIndex['chapters'][number]
export const subjectOf = (c: Chapter): Subject => c.subject ?? 'matte'
export const subjectName = (s: Subject) => SUBJECTS.find((x) => x.id === s)!.name

/** Bara ett ämnes kapitel, avsnitt och uppgifter. */
export function filterContent(content: Content, subject: Subject): Content {
  const chapters = content.index.chapters.filter((c) => subjectOf(c) === subject)
  const ids = new Set(chapters.map((c) => c.id))
  const sectionIds = new Set(chapters.flatMap((c) => c.sections.map((s) => s.id)))
  return {
    index: { ...content.index, chapters },
    sections: content.sections.filter((s) => sectionIds.has(s.section)),
    exercises: content.exercises.filter((e) => ids.has(e.chapter)),
  }
}
