import { describe, expect, it } from 'vitest'
import type { Content } from '../content/load.ts'
import type { Exercise } from '../content/types.ts'
import { summarize } from './UserProgress.tsx'

const ex = (id: string, number: string, parts: number): Exercise =>
  ({ id, number, chapter: 1, section: '1.1', page: 1, facitPage: 1, prompt: '', parts: Array.from({ length: parts }, () => ({ label: null, answer: { type: 'self' }, facit: '' })) }) as Exercise

const exercises = [ex('a', '101', 2), ex('b', '102', 1), ex('c', '103', 3)]
const content = {
  index: { book: { title: '' }, chapters: [{ id: 1, title: 'Kap', sections: [{ id: '1.1', title: 'Avsnitt', file: '' }] }], pages: {}, facitPages: {} },
  sections: [{ section: '1.1', title: 'Avsnitt', exercises }],
  exercises,
} as unknown as Content

describe('summarize', () => {
  it('räknar en uppgift som löst först när alla delar blivit rätt', () => {
    const s = summarize(
      {
        user_id: 'x',
        active_days: 2,
        first_at: 1,
        last_at: 2,
        exercises: {
          a: { tries: 3, correct: [0, 1], wrong: 1, last: 1 },
          b: { tries: 1, correct: [0], wrong: 0, last: 1 },
          c: { tries: 4, correct: [0], wrong: 3, last: 1 },
          'gen:fjadrar:5': { tries: 1, correct: [0], wrong: 0, last: 1 },
        },
      },
      content,
    )!
    expect(s.solved).toBe(2)
    expect(s.started).toBe(1)
    expect(s.correctParts).toBe(5)
    expect(s.tries).toBe(9)
    expect(s.wrong).toBe(4)
    expect(s.generated).toBe(1)
    expect(s.perSection[0]).toMatchObject({ solved: 2, started: 1, total: 3, numbers: ['101', '102'] })
  })
})
