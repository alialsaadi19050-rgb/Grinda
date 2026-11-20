// Kontrollerar genomgångarna: att varje formel går att rita med KaTeX och att facit till
// varje testfråga godkänns av rättningen. Genomgångarna ligger utanför git (de kommer från
// boken), så testet hoppar över sig själv om filen saknas.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import katex from 'katex'
import { describe, expect, it } from 'vitest'
import type { Answer, Lesson, LessonBlock } from '../content/types.ts'
import { checkAnswer } from '../check/check.ts'
import { evalNumber } from '../math/expr.ts'

const FILE = join(import.meta.dirname, '..', '..', 'public', 'content', 'data', 'lessons.json')
const lessons: Lesson[] = existsSync(FILE) ? (JSON.parse(readFileSync(FILE, 'utf8')) as { lessons: Lesson[] }).lessons : []

/** All text i ett block där det kan finnas matte. */
function texts(b: LessonBlock): string[] {
  switch (b.type) {
    case 'text':
    case 'tip':
      return [b.text]
    case 'term':
      return [b.term, b.text]
    case 'rule':
    case 'aside':
    case 'mistake':
      return [b.title, b.text]
    case 'example':
      return [b.title, b.prompt, b.answer ?? '', ...b.steps.map((s) => (typeof s === 'string' ? s : s.text))]
    case 'check':
      return [b.prompt, b.solution, b.hint ?? '']
    case 'derivation':
      return [b.title, b.intro ?? '', b.result ?? '', ...b.steps.flatMap((s) => [s.math, s.why])]
    case 'goals':
    case 'summary':
      return b.items
    case 'think':
      return [b.prompt, b.answer]
    case 'animation':
      return [b.caption]
    case 'figure':
      return [b.caption ?? '']
  }
}

/** Plockar ut $$…$$ och $…$ ur en text. */
function formulas(s: string): { tex: string; display: boolean }[] {
  const out: { tex: string; display: boolean }[] = []
  const rest = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => {
    out.push({ tex, display: true })
    return ' '
  })
  for (const m of rest.matchAll(/\$([^$]+)\$/g)) out.push({ tex: m[1], display: false })
  return out
}

const canonical = (a: Answer): string[] => {
  if (a.type === 'choice') return [a.value]
  if (a.type !== 'number') return []
  const unit = a.unit ? ` ${a.unit}` : ''
  const v = evalNumber(a.value)
  const out = [`${String(v).replace('.', ',')}${unit}`]
  if (a.approx) out.push(`${a.approx.replace('.', ',')}${unit}`)
  return out
}

describe.skipIf(!lessons.length)('genomgångarna', () => {
  for (const l of lessons) {
    it(`${l.id}: all matte går att rita`, () => {
      for (const b of l.blocks)
        for (const t of texts(b))
          for (const f of formulas(t)) expect(() => katex.renderToString(f.tex, { throwOnError: true, displayMode: f.display }), f.tex).not.toThrow()
    })
    it(`${l.id}: facit till testfrågorna godkänns`, () => {
      for (const b of l.blocks) {
        if (b.type !== 'check') continue
        if (b.answer.type === 'choice') expect(b.answer.options, b.prompt).toContain(b.answer.value)
        for (const input of canonical(b.answer)) expect(checkAnswer(b.answer, input), `${b.prompt} → ${input}`).toMatchObject({ status: 'correct' })
      }
    })
  }
})
