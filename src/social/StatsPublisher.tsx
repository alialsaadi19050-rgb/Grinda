// Skickar din XP, nivå och svit till topplistan när den ändras (bara om du gått med bland kompisarna).
import { useEffect, useRef } from 'react'
import { useGame } from '../game/useGame.ts'
import { pushStats, useInbox, type PublicStats } from './api.ts'

export function StatsPublisher() {
  const inbox = useInbox()
  const game = useGame()
  const last = useRef('')
  useEffect(() => {
    // Vill du inte synas i topplistan skickas inga siffror alls.
    if (!inbox.joined || !game || inbox.me?.hidden) return
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
  }, [inbox.joined, inbox.me?.hidden, game])
  return null
}
