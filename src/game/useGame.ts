// Håller XP, nivå och märken uppdaterade medan du räknar.
import { useEffect, useMemo, useState } from 'react'
import { liveQuery } from 'dexie'
import { loadContentOnce, loadLessons, type Content } from '../content/load.ts'
import { db, type Attempt } from '../storage/db.ts'
import { useLessonProgress } from '../lessons/progress.ts'
import { useSettings } from '../settings/settings.ts'
import { computeGame, type Game } from './game.ts'

/** Alla försök, uppdateras när du svarar. */
export function useAttempts(): Attempt[] | null {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null)
  useEffect(() => {
    const sub = liveQuery(() => db.attempts.toArray()).subscribe({ next: setAttempts, error: () => setAttempts([]) })
    return () => sub.unsubscribe()
  }, [])
  return attempts
}

/** Hela bokens innehåll (alla ämnen). */
export function useAllContent(): Content | null {
  const [content, setContent] = useState<Content | null>(null)
  useEffect(() => {
    loadContentOnce().then(setContent, () => {})
  }, [])
  return content
}

export function useGame(): Game | null {
  const content = useAllContent()
  const attempts = useAttempts()
  const lp = useLessonProgress()
  const { dailyGoal } = useSettings()
  const [lessonCount, setLessonCount] = useState(0)
  useEffect(() => {
    loadLessons().then(
      (l) => setLessonCount(l.length),
      () => {},
    )
  }, [])
  return useMemo(() => {
    if (!content || !attempts) return null
    const lessonsDone = Object.fromEntries(Object.entries(lp).map(([id, p]) => [id, p.done]))
    return computeGame({ index: content.index, exercises: content.exercises, attempts, lessonsDone, lessonCount, dailyGoal })
  }, [content, attempts, lp, lessonCount, dailyGoal])
}
