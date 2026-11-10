import { describe, expect, it } from 'vitest'
import type { ContentIndex, Exercise } from '../content/types.ts'
import type { Attempt } from '../storage/db.ts'
import { computeGame, levelOf, weekSentence, xpForLevel } from './game.ts'

const ex = (id: string, o: Partial<Exercise> = {}): Exercise =>
  ({ id, number: id, chapter: 1, section: '1.1', topic: 'Permutationer', prompt: '', parts: [{ label: null, answer: { type: 'number', value: '1' }, facit: '1' }], ...o }) as unknown as Exercise
const index = { chapters: [{ id: 1, title: 'K1', sections: [] }, { id: 102, title: 'F2', subject: 'fysik', sections: [] }] } as unknown as ContentIndex

const DAY = 86_400_000
const T0 = new Date(2026, 0, 10, 12).getTime()
let n = 0
const at = (exerciseId: string, day: number, status: Attempt['status'], o: Partial<Attempt> = {}): Attempt => ({ uid: `u${n++}`, exerciseId, part: status === 'redo' ? -1 : 0, label: null, input: '', status, self: false, hintUsed: false, at: T0 + day * DAY + n, ...o })
const game = (exercises: Exercise[], attempts: Attempt[], o: Partial<Parameters<typeof computeGame>[0]> = {}) => computeGame({ index, exercises, attempts, lessonsDone: {}, lessonCount: 0, dailyGoal: 2, now: T0, ...o })
const badge = (g: ReturnType<typeof computeGame>, id: string) => g.badges.find((b) => b.id === id)!

describe('nivåer', () => {
  it('kräver 100, 250, 450 … XP', () => {
    expect([1, 2, 3, 4].map(xpForLevel)).toEqual([0, 100, 250, 450])
    expect(levelOf(0)).toMatchObject({ level: 1, into: 0, span: 100 })
    expect(levelOf(99).level).toBe(1)
    expect(levelOf(100)).toMatchObject({ level: 2, into: 0, span: 150 })
    expect(levelOf(260)).toMatchObject({ level: 3, into: 10 })
  })
})

describe('XP', () => {
  it('ger mer för rätt direkt och för svårare nivå', () => {
    expect(game([ex('a', { level: 'a' })], [at('a', 0, 'correct')]).xp).toBe(15)
    expect(game([ex('a', { level: 'a' })], [at('a', 0, 'incorrect'), at('a', 0, 'correct')]).xp).toBe(10)
    expect(game([ex('a', { level: 'c' })], [at('a', 0, 'correct')]).xp).toBe(30)
    expect(game([ex('a')], [at('a', 0, 'correct')]).xp).toBe(18)
  })

  it('räknar varje deluppgift en gång per omgång, och mindre för repetition', () => {
    const a = [at('a', 0, 'correct'), at('a', 0, 'correct'), at('a', 1, 'redo'), at('a', 1, 'correct')]
    expect(game([ex('a', { level: 'a' })], a).xp).toBe(15 + 5)
  })

  it('”Jag hade rätt” räknas som rätt direkt', () => {
    const wrong = at('a', 0, 'incorrect')
    expect(game([ex('a', { level: 'a' })], [wrong, at('a', 0, 'correct', { overrides: wrong.uid, self: true })]).xp).toBe(15)
  })

  it('ger XP för genomgångar och uppgifter med nya siffror', () => {
    expect(game([], [at('gen:fjadrar:1', 0, 'correct')], { lessonsDone: { x: T0 } }).xp).toBe(4 + 20)
  })
})

describe('märken, mål och vecka', () => {
  it('delar ut märken och räknar framsteg', () => {
    const exs = Array.from({ length: 12 }, (_, i) => ex(`e${i}`))
    const g = game(exs, exs.map((e) => at(e.id, 0, 'correct')))
    expect(badge(g, 'first').earned).toBe(true)
    expect(badge(g, 'solved-10').earned).toBe(true)
    expect(badge(g, 'solved-50')).toMatchObject({ earned: false, have: 12, need: 50 })
    expect(badge(g, 'run-10').earned).toBe(true)
    expect(badge(g, 'section').earned).toBe(true)
    expect(g.sectionsDone).toEqual(['1.1'])
    expect(g.chaptersDone).toEqual([1])
  })

  it('räknar dagens rätta svar, måldagar och dagar i rad', () => {
    const exs = ['a', 'b', 'c', 'd'].map((id) => ex(id))
    const g = game(exs, [at('a', -2, 'correct'), at('b', -1, 'correct'), at('c', -1, 'correct'), at('d', 0, 'correct')])
    expect(g.today).toBe(1)
    expect(g.goalDays).toBe(1)
    expect(g.streakDays).toBe(3)
    expect(badge(g, 'streak-3').earned).toBe(true)
  })

  it('felfri repetition ger Andra chansen', () => {
    const g = game([ex('a')], [at('a', 0, 'incorrect'), at('a', 1, 'redo'), at('a', 1, 'correct')], { now: T0 + DAY })
    expect(badge(g, 'redo-1').earned).toBe(true)
  })

  it('sammanfattar veckan med bästa och svåraste delområdet', () => {
    const exs = [...Array.from({ length: 3 }, (_, i) => ex(`p${i}`)), ...Array.from({ length: 3 }, (_, i) => ex(`k${i}`, { topic: 'Kombinationer' }))]
    const a = [...exs.slice(0, 3).map((e) => at(e.id, 0, 'correct')), ...exs.slice(3).flatMap((e) => [at(e.id, 0, 'incorrect'), at(e.id, 0, 'correct')])]
    const g = game(exs, a)
    expect(g.week).toMatchObject({ correct: 6, solved: 6, activeDays: 1, best: { topic: 'Permutationer', accuracy: 1 }, worst: { topic: 'Kombinationer', accuracy: 0 } })
    expect(weekSentence(g.week)).toBe('De senaste sju dagarna: 6 rätta svar på 1 dag, bäst på permutationer (100 % rätt direkt), svårast med kombinationer (0 %).')
  })
})
