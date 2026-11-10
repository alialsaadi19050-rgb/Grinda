import { describe, expect, it } from 'vitest'
import { checkAnswer } from '../check/check.ts'
import { checkAnswer as validate } from '../content/validate.ts'
import { evalNumber } from '../math/expr.ts'
import { GENERATORS, num, rng } from './generators.ts'

describe('uppgifter med nya siffror', () => {
  it('samma frö ger samma uppgift', () => {
    for (const g of GENERATORS) expect(g.make(rng(42))).toEqual(g.make(rng(42)))
  })

  it.each(GENERATORS.map((g) => [g.id, g] as const))('%s: facit godkänns av rättningen', (_, g) => {
    for (let seed = 1; seed <= 200; seed++) {
      const ex = g.make(rng(seed))
      expect(validate(ex.answer), `${g.id} #${seed}`).toEqual([])
      expect(ex.prompt).not.toMatch(/undefined|NaN/)
      expect(ex.solution).not.toMatch(/undefined|NaN/)
      const a = ex.answer
      const input = a.type === 'choice' ? a.value : a.type === 'number' ? (a.unit ? `${num(evalNumber(a.value))} ${a.unit}` : (a.approx ?? String(evalNumber(a.value))).replace('.', ',')) : ''
      const res = checkAnswer(a, input)
      expect(res.status, `${g.id} #${seed}: ${ex.prompt} → ${input} (${res.message})`).toBe('correct')
      // Ett tydligt fel svar ska inte godkännas.
      if (a.type === 'number') expect(checkAnswer(a, a.unit ? `${num(evalNumber(a.value) * 1.5)} ${a.unit}` : String(evalNumber(a.value) * 2 + 1)).status).not.toBe('correct')
    }
  })
})
