import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Answer, SectionFile } from '../content/types.ts'
import { checkAnswer } from './check.ts'
import { evalNumber } from '../math/expr.ts'

const DATA = join(import.meta.dirname, '..', '..', 'public', 'content', 'data')
const files = ['ma4-m4-21.json', 'ma4-m4-22.json', 'ma4-m4-23.json', 'ma4-m4-24.json', 'ma4-m4-diagnos.json', 'ma4-m4-blandade2.json', 'ma4-m4-blandade12.json']
const fmt = (v: number) => String(Math.round(v * 1e4) / 1e4).replace('.', ',')

function studentInput(a: Answer): string | null {
  switch (a.type) {
    case 'number':
      return (a.approx ? a.approx.replace('.', ',') : fmt(evalNumber(a.value))) + (a.unit ? ' ' + a.unit : '')
    case 'list':
      return a.variables?.length ? a.items.join('; ') : a.items.map((i) => fmt(evalNumber(i))).join('; ')
    case 'expression':
      return a.value
    case 'periodic':
      return a.values.map((v) => `x = ${fmt(evalNumber(v))} + n*${fmt(evalNumber(a.period))}`).join(' eller ')
    case 'choice':
      return a.value
    case 'set':
      return `{${a.elements.join(', ')}}`
    case 'inequality':
      return `${a.variable} ${a.op} ${a.bound}`
    default:
      return null
  }
}

describe.skipIf(!existsSync(join(DATA, files[0])))('Matte 4: facit godkänns av rättningen', () => {
  for (const f of files) {
    const sec = JSON.parse(readFileSync(join(DATA, f), 'utf8')) as SectionFile
    for (const ex of sec.exercises)
      ex.parts.forEach((p) => {
        const input = studentInput(p.answer)
        if (input === null) return
        it(`${ex.id}${p.label ?? ''}: ${input}`, () => {
          expect(checkAnswer(p.answer, input).status).toBe('correct')
        })
      })
  }
})
