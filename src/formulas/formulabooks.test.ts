import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import katex from 'katex'
import { FORMULA_BOOKS, type FormulaBookData } from './FormulaBook.tsx'

// Formelsamlingarna ligger bara i den låsta boken, så testet hoppas över utan dem.
describe('formelsamlingarna', () => {
  for (const b of FORMULA_BOOKS) {
    const file = `public/content/${b.path}`
    it.skipIf(!existsSync(file))(`${b.name}: alla formler går att rita`, () => {
      const book = JSON.parse(readFileSync(file, 'utf8')) as FormulaBookData
      expect(book.chapters.length).toBeGreaterThan(0)
      const texts: string[] = []
      for (const c of book.chapters)
        for (const x of c.blocks) {
          if (x.type === 'row') texts.push(...x.lines.flat())
          if (x.type === 'intro') texts.push(x.text)
        }
      for (const t of texts)
        for (const m of t.matchAll(/\$([^$]+)\$/g)) expect(() => katex.renderToString(m[1], { throwOnError: true, strict: 'ignore' }), m[1]).not.toThrow()
    })
  }
})
