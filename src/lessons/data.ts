// Lättviktiga hjälpare för genomgångarna, så att startsidan kan visa dem utan att ladda
// mattefältet och resten av genomgångssidan.
import { useEffect, useState } from 'react'
import type { Lesson } from '../content/types.ts'
import { loadLessons } from '../content/load.ts'

export function useLessons(): Lesson[] | null {
  const [lessons, setLessons] = useState<Lesson[] | null>(null)
  useEffect(() => {
    // Saknas genomgångarna (t.ex. en äldre låst bok) visas helt enkelt inga.
    loadLessons().then(setLessons, () => setLessons([]))
  }, [])
  return lessons
}

/** Länk till en genomgång. Med `back` (t.ex. uppgiftens adress) visar genomgången en knapp tillbaka dit. */
export const lessonHref = (id: string, back?: string) => `#/lar/${encodeURIComponent(id)}${back ? `?tillbaka=${encodeURIComponent(back)}` : ''}`

/** Adressen genomgången öppnades från (om den öppnades från en uppgift). */
export const lessonBack = (): string | null => {
  const m = /[?&]tillbaka=([^&]+)/.exec(location.hash)
  const back = m ? decodeURIComponent(m[1]) : null
  // Bara länkar inom appen.
  return back && back.startsWith('#/') ? back : null
}
export const practiceHref = (l: Lesson) => `#/kapitel/${l.chapter}?avsnitt=${encodeURIComponent(l.section)}&omrade=${encodeURIComponent(l.topic)}`
