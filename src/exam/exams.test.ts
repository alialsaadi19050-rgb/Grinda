import { describe, expect, it } from 'vitest'
import katex from 'katex'
import { EXAMS, examStatus, lessonExamStatus, parseList } from './exams.ts'

const ex = (number: string, labels: (string | null)[] = [null], chapter = 102) => ({ chapter, number, parts: labels.map((label) => ({ label })) })

describe('provlistan', () => {
  it('tolkar intervall och deluppgifter', () => {
    const m = parseList('201-203, 240ab-242, 246a, 2.54-2.56, 2100a-2101')
    expect([...m.keys()]).toEqual(['201', '202', '203', '240', '241', '242', '246', '2.54', '2.55', '2.56', '2100', '2101'])
    expect(m.get('240')).toEqual(new Set(['a', 'b']))
    expect(m.get('241')).toBeNull()
    expect(m.get('2100')).toEqual(new Set(['a']))
  })

  it('säger om en uppgift ingår, delvis ingår eller inte ingår', () => {
    expect(examStatus(ex('201'))?.included).toBe('all')
    expect(examStatus(ex('206'))?.included).toBe('none')
    expect(examStatus(ex('240', ['a', 'b', 'c']))).toMatchObject({ included: 'some', parts: ['a', 'b'] })
    expect(examStatus(ex('2100', ['a', 'b']))).toMatchObject({ included: 'some', parts: ['a'] })
    expect(examStatus(ex('2.13', ['a', 'b']))?.included).toBe('all')
    expect(examStatus(ex('2.61'))?.included).toBe('none')
    expect(examStatus(ex('2105'))?.included).toBe('all')
    expect(examStatus(ex('2104'))?.included).toBe('none')
  })

  it('övningsbokens extrauppgifter', () => {
    expect(examStatus(ex('2.15'))).toMatchObject({ included: 'extra', best: true, parts: null })
    expect(examStatus(ex('2.1'))).toMatchObject({ included: 'extra', best: false })
    expect(examStatus(ex('2.18', ['a', 'b']))).toMatchObject({ included: 'extra', parts: ['a'] })
    expect(examStatus(ex('2.24'))?.included).toBe('none')
    expect(examStatus(ex('2.64', ['a', 'b', 'c']))?.included).toBe('some')
    const exam = EXAMS[0]
    const all = parseList(exam.extra!.all)
    expect(all.size).toBe(50)
    for (const n of parseList(exam.extra!.best).keys()) expect(all.has(n)).toBe(true)
    for (const l of exam.lists) for (const n of parseList(l).keys()) expect(all.has(n)).toBe(false)
  })

  it('bryr sig inte om andra kapitel', () => {
    expect(examStatus(ex('1101', [null], 1))).toBeNull()
  })
})

describe('teorin i provet', () => {
  it('säger vilka genomgångar som ingår', () => {
    expect(lessonExamStatus({ id: 'f2-fjadrar', chapter: 102 })?.included).toBe('all')
    expect(lessonExamStatus({ id: 'f2-svavningar', chapter: 102 })?.included).toBe('none')
    expect(lessonExamStatus({ id: 'f2-huygens', chapter: 102 })?.included).toBe('some')
    expect(lessonExamStatus({ id: 'ladprincipen', chapter: 1 })).toBeNull()
  })
  it('formlerna i anteckningarna går att rita', () => {
    for (const exam of EXAMS)
      for (const l of Object.values(exam.lessons))
        if (l.included === 'some') for (const m of l.note.matchAll(/\$([^$]+)\$/g)) expect(() => katex.renderToString(m[1], { throwOnError: true })).not.toThrow()
  })
})
