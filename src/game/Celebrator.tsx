// Firar när du nått något nytt: ny nivå, nytt märke, dagens mål, ett klart avsnitt eller kapitel.
// Jämför läget med det som redan firats (sparat i webbläsaren), så att inget firas två gånger.
import { useEffect, useRef, useState } from 'react'
import { fireConfetti } from './confetti.ts'
import { useAllContent, useGame } from './useGame.ts'
import { useSettings } from '../settings/settings.ts'
import './game.css'

const KEY = 'grinda.celebrated.v1'

interface Seen {
  level: number
  badges: string[]
  sections: string[]
  chapters: number[]
  /** Dagen (ms) då dagens mål senast firades. */
  goalDay: number
}

interface Toast {
  id: number
  icon: string
  title: string
  text: string
}

const today = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function readSeen(): Seen | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Seen | null
  } catch {
    return null
  }
}

let toastId = 0

export function Celebrator() {
  const game = useGame()
  const content = useAllContent()
  const { dailyGoal, celebrate } = useSettings()
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  useEffect(() => {
    if (!game || !content) return
    const earned = game.badges.filter((b) => b.earned).map((b) => b.id)
    const goalDay = dailyGoal > 0 && game.today >= dailyGoal ? today() : 0
    const now: Seen = { level: game.level.level, badges: earned, sections: game.sectionsDone, chapters: game.chaptersDone, goalDay }
    const seen = readSeen()
    const save = (s: Seen) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(s))
      } catch {
        /* då firas det igen nästa gång */
      }
    }
    // Första gången (t.ex. efter uppdateringen eller på en ny enhet): fira inget gammalt.
    if (!seen) return save(now)

    const fresh: Omit<Toast, 'id'>[] = []
    let power = 0
    for (const id of game.chaptersDone.filter((c) => !seen.chapters.includes(c))) {
      const ch = content.index.chapters.find((c) => c.id === id)
      fresh.push({ icon: '📚', title: 'Kapitlet klart!', text: ch?.title ?? `Kapitel ${id}` })
      power = Math.max(power, 2.2)
    }
    for (const s of game.sectionsDone.filter((x) => !seen.sections.includes(x))) {
      const sec = content.sections.find((x) => x.section === s)
      fresh.push({ icon: '📘', title: 'Avsnittet klart!', text: sec?.title ?? s })
      power = Math.max(power, 1.6)
    }
    if (game.level.level > seen.level) {
      fresh.push({ icon: '⬆️', title: `Nivå ${game.level.level}`, text: `Du är nu ${game.level.name}.` })
      power = Math.max(power, 1.3)
    }
    for (const b of game.badges.filter((b) => b.earned && !seen.badges.includes(b.id))) {
      fresh.push({ icon: b.icon, title: `Nytt märke: ${b.title}`, text: b.text })
      power = Math.max(power, 1)
    }
    if (goalDay && seen.goalDay !== goalDay) {
      fresh.push({ icon: '✅', title: 'Dagens mål nått!', text: `${dailyGoal} rätta svar idag.` })
      power = Math.max(power, 1)
    }
    // Märken och klara avsnitt försvinner aldrig ur det som firats, även om läget tillfälligt backar.
    save({
      level: Math.max(seen.level, now.level),
      badges: [...new Set([...seen.badges, ...earned])],
      sections: [...new Set([...seen.sections, ...now.sections])],
      chapters: [...new Set([...seen.chapters, ...now.chapters])],
      goalDay: goalDay || seen.goalDay,
    })
    if (!fresh.length || !celebrate) return
    fireConfetti(power)
    const added = fresh.slice(0, 4).map((t) => ({ ...t, id: ++toastId }))
    setToasts((t) => [...t, ...added])
    timers.current.push(window.setTimeout(() => setToasts((t) => t.filter((x) => !added.some((a) => a.id === x.id))), 6500))
  }, [game, content, dailyGoal, celebrate])

  if (!toasts.length) return null
  return (
    <div className="gm-toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className="gm-toast" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} title="Stäng">
          <span className="gm-toast-icon" aria-hidden="true">
            {t.icon}
          </span>
          <span>
            <strong>{t.title}</strong>
            <small>{t.text}</small>
          </span>
        </button>
      ))}
    </div>
  )
}
