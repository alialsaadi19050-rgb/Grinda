import { describe, expect, it } from 'vitest'
import type { Exercise } from '../content/types.ts'
import type { Attempt } from '../storage/db.ts'
import { computeSrs, dayLabel, srsToday, startOfDay } from './srs.ts'

const ex = (id: string, parts = 1): Exercise =>
  ({ id, number: id, chapter: 1, section: '1.1', topic: 'T', prompt: '', parts: Array.from({ length: parts }, () => ({ label: null, answer: { type: 'number', value: '1' }, facit: '1' })) }) as unknown as Exercise

const DAY = 86_400_000
const T0 = new Date(2026, 0, 10, 12).getTime()
let n = 0
const at = (exerciseId: string, day: number, status: Attempt['status'], part = 0): Attempt => ({ uid: `u${n++}`, exerciseId, part: status === 'redo' ? -1 : part, label: null, input: '', status, self: false, hintUsed: false, at: T0 + day * DAY + n })

describe('repetition med mellanrum', () => {
  it('lägger in en uppgift efter ett fel, med första intervallet', () => {
    const s = computeSrs([ex('a')], [at('a', 0, 'incorrect'), at('a', 0, 'correct')], [1, 3, 7])
    expect(s.items).toHaveLength(1)
    expect(s.items[0]).toMatchObject({ exerciseId: 'a', step: 0, due: startOfDay(T0 + DAY) })
  })

  it('en uppgift utan fel hamnar inte i repetitionen', () => {
    expect(computeSrs([ex('a')], [at('a', 0, 'correct')], [1, 3, 7]).items).toHaveLength(0)
  })

  it('går vidare ett steg vid felfri omgång på rätt dag, och blir klar efter sista steget', () => {
    const a = [at('a', 0, 'incorrect'), at('a', 1, 'redo'), at('a', 1, 'correct')]
    let s = computeSrs([ex('a')], a, [1, 3, 7])
    expect(s.items[0]).toMatchObject({ step: 1, due: startOfDay(T0 + 4 * DAY), passes: 1 })
    a.push(at('a', 5, 'redo'), at('a', 5, 'correct'))
    s = computeSrs([ex('a')], a, [1, 3, 7])
    expect(s.items[0]).toMatchObject({ step: 2, due: startOfDay(T0 + 12 * DAY) })
    a.push(at('a', 12, 'redo'), at('a', 12, 'correct'))
    s = computeSrs([ex('a')], a, [1, 3, 7])
    expect(s.items).toHaveLength(0)
    expect(s.graduated).toEqual(['a'])
  })

  it('en felfri omgång för tidigt räknas inte', () => {
    const s = computeSrs([ex('a')], [at('a', 0, 'incorrect'), at('a', 0, 'redo'), at('a', 0, 'correct')], [1, 3, 7])
    expect(s.items[0]).toMatchObject({ step: 0 })
  })

  it('ett nytt fel börjar om från början, även efter att uppgiften blivit klar', () => {
    const a = [at('a', 0, 'incorrect'), at('a', 1, 'redo'), at('a', 1, 'correct'), at('a', 4, 'redo'), at('a', 4, 'incorrect')]
    const s = computeSrs([ex('a')], a, [1, 3])
    expect(s.items[0]).toMatchObject({ step: 0, due: startOfDay(T0 + 5 * DAY), passes: 0 })
  })

  it('kräver att alla deluppgifter är rätt', () => {
    const a = [at('a', 0, 'incorrect', 0), at('a', 1, 'redo'), at('a', 1, 'correct', 0)]
    expect(computeSrs([ex('a', 2)], a, [1, 3]).items[0].step).toBe(0)
    a.push(at('a', 1, 'correct', 1))
    expect(computeSrs([ex('a', 2)], a, [1, 3]).items[0].step).toBe(1)
  })

  it('följer egna intervall', () => {
    const s = computeSrs([ex('a')], [at('a', 0, 'incorrect')], [2, 5, 9, 20])
    expect(s.items[0].due).toBe(startOfDay(T0 + 2 * DAY))
    expect(computeSrs([ex('a')], [at('a', 0, 'incorrect')], []).items).toHaveLength(0)
  })

  it('dagens lista: tak per dag, uppskjutet och borttaget', () => {
    const exs = ['a', 'b', 'c', 'd'].map((id) => ex(id))
    const s = computeSrs(exs, exs.map((e) => at(e.id, 0, 'incorrect')), [1, 3])
    const now = T0 + 2 * DAY
    expect(srsToday(s, { snooze: {}, removed: {} }, 0, now).due).toHaveLength(4)
    const capped = srsToday(s, { snooze: {}, removed: {} }, 3, now)
    expect(capped.due).toHaveLength(3)
    expect(capped.overflow).toBe(1)
    const adj = srsToday(s, { snooze: { a: startOfDay(now + 2 * DAY) }, removed: { b: now } }, 0, now)
    expect(adj.due.map((i) => i.exerciseId).sort()).toEqual(['c', 'd'])
    expect(adj.upcoming.map((i) => i.exerciseId)).toEqual(['a'])
    expect(adj.removed.map((i) => i.exerciseId)).toEqual(['b'])
  })

  it('skriver dagar begripligt', () => {
    expect(dayLabel(T0, T0)).toBe('idag')
    expect(dayLabel(T0 + DAY, T0)).toBe('i morgon')
    expect(dayLabel(T0 + 4 * DAY, T0)).toBe('om 4 dagar')
    expect(dayLabel(T0 - 3 * DAY, T0)).toBe('3 dagar sen')
  })
})
