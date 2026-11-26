import { describe, expect, it } from 'vitest'
import type { Answer } from '../content/types.ts'
import { checkAnswer, normalizeTrig } from './check.ts'
import { latexToPlain } from './latex.ts'

const st = (a: Answer, raw: string) => checkAnswer(a, raw).status

describe('trigonometriska uttryck', () => {
  it('läser sin x, cos5x, sin^2 x och produkter', () => {
    expect(normalizeTrig('5cos5x', ['x'])).toBe('5*cos(5x)')
    expect(normalizeTrig('sinxcosx', ['x'])).toBe('sin(x)*cos(x)')
    expect(normalizeTrig('sin^2 x', ['x'])).toBe('(sin(x))^2')
    expect(normalizeTrig('sin^4(2x-1)', ['x'])).toBe('(sin(2x-1))^4')
    expect(normalizeTrig('cos 0.5x', ['x'])).toBe('cos(0.5x)')
  })

  const d = (value: string, variables = ['x']): Answer => ({ type: 'expression', value, variables })
  it('rättar derivator skrivna på olika sätt', () => {
    expect(st(d('5*cos(5*x)'), '5cos5x')).toBe('correct')
    expect(st(d('5*cos(5*x)'), "y' = 5 cos(5x)")).toBe('correct')
    expect(st(d('5*cos(5*x)'), 'cos5x')).toBe('incorrect')
    expect(st(d('2*sin(x)*cos(x)'), '2sinxcosx')).toBe('correct')
    expect(st(d('2*sin(x)*cos(x)'), 'sin2x')).toBe('correct')
    expect(st(d('10*sin(2*x)^4*cos(2*x)'), '10sin^4(2x)cos(2x)')).toBe('correct')
    expect(st(d('3*(1+sin(x))^2*cos(x)'), '3(1+sinx)^2·cosx')).toBe('correct')
    expect(st(d('-6*pi*sin(2*pi*x+3)'), '−6π sin(2πx + 3)')).toBe('correct')
    expect(st(d('0.7*cos(t)+1.1*sin(t)', ['t']), '0,7cos t + 1,1 sin t')).toBe('correct')
    expect(st(d('cos(x)*e^sin(x)'), 'cos x · e^(sin x)')).toBe('correct')
  })

  it('tar emot det mattefältet skickar', () => {
    expect(st(d('5*cos(5*x)'), latexToPlain('5\\cos5x'))).toBe('correct')
    expect(st(d('2*sin(x)*cos(x)'), latexToPlain('2\\sin x\\cos x'))).toBe('correct')
    expect(st(d('3*(1+sin(x))^2*cos(x)'), latexToPlain('3\\left(1+\\sin x\\right)^2\\cos x'))).toBe('correct')
  })
})

describe('grader i tal och listor', () => {
  it('godtar gradtecken och x₁ =', () => {
    expect(st({ type: 'number', value: '68.43', approx: '68.4' }, '68,4°')).toBe('correct')
    expect(st({ type: 'list', items: ['21', '111', '201', '291'], ordered: false, tol: 0.003 }, '21°, 111°, 201°, 291°')).toBe('correct')
  })
})

describe('fullständiga lösningar', () => {
  const deg: Answer = { type: 'periodic', values: ['30', '150'], period: '360', unit: 'deg' }
  it('godtar olika skrivsätt', () => {
    expect(st(deg, 'x = 30° + n·360° eller x = 150° + n·360°')).toBe('correct')
    expect(st(deg, 'x=30+n*360, x=150+n*360')).toBe('correct')
    expect(st(deg, 'x = 150 + 360n; x = 30 + 360n')).toBe('correct')
    expect(st(deg, 'x = 390° + n·360° eller x = −210° + n·360°')).toBe('correct')
  })
  it('säger till när en lösning fattas eller perioden är fel', () => {
    expect(st(deg, 'x = 30° + n·360°')).toBe('incorrect')
    expect(checkAnswer(deg, 'x = 30°').status).toBe('partial')
    expect(st(deg, 'x = 30 + n·180')).toBe('incorrect')
    expect(checkAnswer(deg, 'x = π/6 + n·2π eller x = 5π/6 + n·2π').hint).toMatch(/grader/)
  })
  it('förstår ± och en sammanslagen period', () => {
    const cos: Answer = { type: 'periodic', values: ['acos(-0.54)/2', '-acos(-0.54)/2'], period: 'pi', unit: 'rad' }
    expect(st(cos, 'x ≈ ±1,07 + n·π')).toBe('correct')
    expect(st(cos, 'x = 1,07 + nπ eller x = −1,07 + nπ')).toBe('correct')
    expect(st(cos, 'x = 1,07 + nπ eller x = 2,07 + nπ')).toBe('correct')
    const half: Answer = { type: 'periodic', values: ['90', '270'], period: '360', unit: 'deg' }
    expect(st(half, 'x = 90° + n·180°')).toBe('correct')
    const zero: Answer = { type: 'periodic', values: ['0'], period: '180', unit: 'deg' }
    expect(st(zero, 'x = n·180°')).toBe('correct')
  })
  it('godtar avrundade svar i radianer', () => {
    const s: Answer = { type: 'periodic', values: ['asin(0.93)', 'pi - asin(0.93)'], period: '2*pi', unit: 'rad' }
    expect(st(s, 'x ≈ 1,19 + n·2π eller x ≈ 1,95 + n·2π')).toBe('correct')
    expect(checkAnswer(s, 'x = 1,19 + n·360°').hint).toMatch(/radianer/)
  })
})

describe('fler skrivsätt', () => {
  it('n360, n2π och avrundad period', () => {
    const a: Answer = { type: 'periodic', values: ['115', '-42'], period: '360', unit: 'deg', tol: 0.6 }
    expect(st(a, 'x = 318 + n360, x = 115 + n360')).toBe('correct')
    const r: Answer = { type: 'periodic', values: ['0', 'pi', 'pi/3', '-pi/3'], period: '2*pi', unit: 'rad' }
    expect(st(r, 'x = nπ eller x = ±π/3 + n2π')).toBe('correct')
    expect(st(r, 'x = n·3,14 eller x = ±1,05 + n·6,28')).toBe('correct')
    expect(st({ ...r, anyUnit: true }, 'x = n·180° eller x = ±60° + n·360°')).toBe('correct')
  })
  it('mattefältets LaTeX', () => {
    const a: Answer = { type: 'periodic', values: ['pi/12', '5*pi/12'], period: 'pi', unit: 'rad' }
    expect(st(a, latexToPlain('x=\\frac{\\pi}{12}+n\\pi\\text{ eller }x=\\frac{5\\pi}{12}+n\\pi'))).toBe('correct')
    expect(st({ type: 'periodic', values: ['101.3'], period: '180', unit: 'deg' }, latexToPlain('x=101{,}3\\degree+n\\cdot180\\degree'))).toBe('correct')
  })
  it('uttryck i grader', () => {
    const a: Answer = { type: 'expression', value: 'sin(x+60)', variables: ['x'], degrees: true }
    expect(st(a, 'y = sin(x + 60°)')).toBe('correct')
    expect(st(a, 'sin(x − 300°)')).toBe('correct')
    expect(st(a, 'sin(x + 30°)')).toBe('incorrect')
  })
})

