// Skickar din XP, nivå och svit till topplistan när den ändras (bara om du gått med bland kompisarna).
import { useEffect, useRef } from 'react'
import { useGame } from '../game/useGame.ts'
import { pushStats, useInbox, type PublicStats } from './api.ts'

export function StatsPublisher() {
  const inbox = useInbox()
  const game = useGame()
  const last = useRef('')
  useEffect(() => {
    if (!inbox.joined || !game) return
    const stats: PublicStats = {
      weekXp: game.weekXp,
      xp: game.xp,
      level: game.level.level,
      levelName: game.level.name,
      streak: game.streakDays,
      solved: game.solvedTotal,
      badges: game.badges.filter((b) => b.earned).length,
      at: Date.now(),
    }
    const key = JSON.stringify({ ...stats, at: 0 })
    if (key === last.current) return
    const t = setTimeout(() => {
      last.current = key
      pushStats(stats).catch(() => (last.current = ''))
    }, 3000)
    return () => clearTimeout(t)
  }, [inbox.joined, game])
  return null
}
