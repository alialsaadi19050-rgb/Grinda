import { describe, expect, it } from 'vitest'
import { GRID } from './render.ts'
import { angleAt, arcPoints, measurementStrokes, rulerInfo, templateStrokes, TEMPLATES } from './templates.ts'

let n = 0
const id = () => `t${n++}`

describe('mallar', () => {
  it.each(TEMPLATES.map((t) => t.id))('%s blir raka streck centrerade på rutnätet', (kind) => {
    const s = templateStrokes(kind, [GRID * 10 + 3, GRID * 4 - 2], 'ink', 1, id)
    expect(s.length).toBeGreaterThan(3)
    for (const st of s) {
      expect(st.shape).toBe(true)
      expect(st.points.length).toBeGreaterThan(1)
      expect(st.points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true)
    }
    // Mitten hamnar på närmaste rutkorsning.
    const xs = s.flatMap((st) => st.points.map((p) => p[0]))
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(GRID * 10, 0)
  })
})

describe('linjal och gradskiva', () => {
  it('mäter längd i rutor och cm samt vinkel moturs', () => {
    const r = rulerInfo({ a: [0, 0], b: [GRID * 4, 0] })
    expect(r.squares).toBeCloseTo(4)
    expect(r.cm).toBeCloseTo(2)
    expect(r.deg).toBeCloseTo(0)
    expect(rulerInfo({ a: [0, 0], b: [0, -GRID] }).deg).toBeCloseTo(90)
    expect(rulerInfo({ a: [0, 0], b: [-GRID, GRID] }).deg).toBeCloseTo(225)
  })

  it('mäter vinkeln mellan två ben', () => {
    expect(angleAt([0, 0], [10, 0], [0, -10])).toBeCloseTo(90)
    expect(angleAt([0, 0], [10, 0], [-10, -10])).toBeCloseTo(135)
    expect(angleAt([0, 0], [10, 0], [10, 10])).toBeCloseTo(45)
    expect(angleAt([0, 0], [-10, 1], [-10, -1])).toBeCloseTo(11.42, 1)
  })

  it('bågen går den kortaste vägen mellan benen', () => {
    const arc = arcPoints([0, 0], [10, 0], [0, 10], 5)
    expect(arc[0][0]).toBeCloseTo(5)
    expect(arc.at(-1)![1]).toBeCloseTo(5)
    expect(arc.every(([x, y]) => x >= -0.01 && y >= -0.01)).toBe(true)
  })

  it('gradskivan ritas in som två ben och en båge', () => {
    expect(measurementStrokes({ kind: 'protractor', a: [0, 0], b: [100, 0], c: [0, -100] }, 'red', 1, id)).toHaveLength(3)
    expect(measurementStrokes({ kind: 'protractor', a: [0, 0], b: [100, 0], waiting: true }, 'red', 1, id)).toHaveLength(0)
    expect(measurementStrokes({ kind: 'ruler', a: [0, 0], b: [100, 0] }, 'red', 1, id)).toHaveLength(1)
  })
})
