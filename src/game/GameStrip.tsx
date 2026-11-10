// Raden under hjälteytan på startsidan: nivå och XP, dagens mål och dagens repetition.
import { useEffect, useMemo, useState } from 'react'
import type { Exercise } from '../content/types.ts'
import { useSettings } from '../settings/settings.ts'
import { computeSrs, readAdjust, srsToday, type SrsToday } from '../practice/srs.ts'
import { weekSentence, type Badge, type Game } from './game.ts'
import { useAttempts, useGame } from './useGame.ts'
import './game.css'

export function GoalRing({ value, goal, size = 56 }: { value: number; goal: number; size?: number }) {
  const r = 22
  const c = 2 * Math.PI * r
  const share = goal > 0 ? Math.min(1, value / goal) : 0
  return (
    <span className={`gm-goal ${share >= 1 ? 'done' : ''}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r={r} className="track" />
        <circle cx="28" cy="28" r={r} className="fill" strokeDasharray={`${c * share} ${c}`} transform="rotate(-90 28 28)" />
      </svg>
      <b>{share >= 1 ? '✓' : value}</b>
    </span>
  )
}

/** Dagens repetition för de givna uppgifterna. Uppdateras när du svarar, skjuter upp eller ändrar intervallen. */
export function useSrsToday(exercises: Exercise[] | undefined): SrsToday | null {
  const attempts = useAttempts()
  const { srs } = useSettings()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const on = () => setTick((t) => t + 1)
    window.addEventListener('grinda:srs', on)
    return () => window.removeEventListener('grinda:srs', on)
  }, [])
  return useMemo(() => {
    if (!exercises || !attempts) return null
    if (!srs.enabled) return { due: [], overflow: 0, upcoming: [], removed: [] }
    return srsToday(computeSrs(exercises, attempts, srs.intervals), readAdjust(), srs.maxPerDay)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises, attempts, srs, tick])
}

export function GameStrip({ exercises, onGoal }: { exercises: Exercise[]; onGoal: () => void }) {
  const game = useGame()
  const { dailyGoal, srs } = useSettings()
  const review = useSrsToday(exercises)
  if (!game) return null
  const { level } = game
  const due = review?.due.length ?? 0
  return (
    <>
      <div className="gm-strip">
        <a className="gm-card" href="#/statistik" title="Se dina märken och din statistik">
          <span className="gm-level">{level.level}</span>
          <div>
            <strong>{level.name}</strong>
            <small>
              {game.xp} XP · {level.span - level.into} XP till nivå {level.level + 1}
            </small>
            <span className="gm-xpbar">
              <span style={{ width: `${(100 * level.into) / level.span}%` }} />
            </span>
          </div>
        </a>
        <button className="gm-card" onClick={onGoal} title="Ändra ditt dagliga mål" style={{ border: 0, textAlign: 'left', font: 'inherit', cursor: 'pointer' }}>
          <GoalRing value={game.today} goal={dailyGoal} />
          <div>
            <strong>{dailyGoal > 0 ? (game.today >= dailyGoal ? 'Dagens mål nått!' : `${game.today} av ${dailyGoal} idag`) : `${game.today} rätt idag`}</strong>
            <small>{dailyGoal > 0 ? (game.today >= dailyGoal ? `${game.today} rätta svar idag. Snyggt!` : `${dailyGoal - game.today} rätta svar kvar till dagens mål`) : 'Inget dagligt mål – tryck för att välja ett'}</small>
          </div>
        </button>
        <a className={`gm-card ${due ? 'due' : ''}`} href="#/ova">
          <span className="gm-level" style={due ? undefined : { background: 'rgba(var(--fg-rgb), 0.1)', color: 'var(--text)', boxShadow: 'none' }}>
            {due}
          </span>
          <div>
            <strong>{!srs.enabled ? 'Repetition avstängd' : due ? 'Dagens repetition' : 'Ingen repetition idag'}</strong>
            <small>
              {!srs.enabled
                ? 'Slå på den under Öva.'
                : due
                  ? `${due} ${due === 1 ? 'uppgift' : 'uppgifter'} du fått fel på är dags att göra om.`
                  : review?.upcoming.length
                    ? `${review.upcoming.length} väntar längre fram. Felbank och nya siffror finns under Öva.`
                    : 'Felbank och uppgifter med nya siffror finns under Öva.'}
            </small>
          </div>
        </a>
      </div>
      <p className="gm-week">
        {weekSentence(game.week)} <a href="#/statistik">Mer statistik</a>
      </p>
    </>
  )
}

export function BadgeGrid({ badges }: { badges: Badge[] }) {
  const sorted = [...badges].sort((a, b) => Number(b.earned) - Number(a.earned) || b.have / b.need - a.have / a.need)
  return (
    <div className="gm-badges">
      {sorted.map((b) => (
        <div key={b.id} className={`gm-badge ${b.earned ? 'earned' : ''}`}>
          <span className="gm-badge-icon" aria-hidden="true">
            {b.icon}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong>{b.title}</strong>
            <small>{b.text}</small>
            {!b.earned && b.need > 1 && (
              <>
                <span className="gm-xpbar">
                  <span style={{ width: `${(100 * b.have) / b.need}%` }} />
                </span>
                <small>
                  {b.have} av {b.need}
                </small>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Veckan i siffror, för statistiksidan. */
export function WeekCard({ game }: { game: Game }) {
  const w = game.week
  const diff = w.correct - w.correctBefore
  return (
    <>
      <p className="mk-row-note" style={{ maxWidth: 720 }}>
        {weekSentence(w)}
      </p>
      <div className="stp-cards">
        <div className="stp-card">
          <strong>{w.correct}</strong>
          <span>rätta svar{w.correctBefore || w.correct ? ` · ${diff >= 0 ? '+' : '−'}${Math.abs(diff)} mot veckan innan` : ''}</span>
        </div>
        <div className="stp-card">
          <strong>{w.solved}</strong>
          <span>uppgifter helt lösta</span>
        </div>
        <div className="stp-card">
          <strong>{w.xp}</strong>
          <span>XP</span>
        </div>
        <div className="stp-card">
          <strong>
            {w.activeDays}
            <small> / 7</small>
          </strong>
          <span>dagar du räknat</span>
        </div>
      </div>
    </>
  )
}
