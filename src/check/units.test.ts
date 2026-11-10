import { describe, expect, it } from 'vitest'
import { checkAnswer } from './check.ts'
import { parseUnit, splitQuantity } from './units.ts'
import type { NumberAnswer } from '../content/types.ts'

const q = (value: string, unit: string, extra: Partial<NumberAnswer> = {}): NumberAnswer => ({ type: 'number', value, unit, ...extra })

describe('enheter', () => {
  it('tolkar vanliga enheter', () => {
    expect(parseUnit('kN/m')!.factor).toBeCloseTo(1000)
    expect(parseUnit('km/h')!.factor).toBeCloseTo(1 / 3.6)
    expect(parseUnit('m/s²')!.dim).toEqual([0, 1, -2])
    expect(parseUnit('mW/m^2')!.factor).toBeCloseTo(1e-3)
    expect(parseUnit('ms')!.factor).toBeCloseTo(1e-3)
    expect(parseUnit('TWh')!.factor).toBeCloseTo(3.6e15)
    expect(parseUnit('rad/s')!.dim).toEqual(parseUnit('s^-1')!.dim)
    expect(parseUnit('hejsan')).toBeNull()
  })
  it('delar tal och enhet', () => {
    expect(splitQuantity('3,72 kN')).toEqual({ number: '3,72', unit: 'kN' })
    expect(splitQuantity('1,1 * 10^-6 W/m^2')).toEqual({ number: '1,1 * 10^-6', unit: 'W/m^2' })
    expect(splitQuantity('70N/m')).toEqual({ number: '70', unit: 'N/m' })
    expect(splitQuantity('42')).toEqual({ number: '42', unit: '' })
  })
  it('rättar fysiksvar', () => {
    const a = q('70.1', 'N/m', { approx: '70' })
    expect(checkAnswer(a, '70 N/m').status).toBe('correct')
    expect(checkAnswer(a, '0,070 kN/m').status).toBe('correct')
    expect(checkAnswer(a, '70').status).toBe('invalid')
    expect(checkAnswer(a, '70 N').status).toBe('incorrect')
    expect(checkAnswer(a, '7 N/m').status).toBe('incorrect')
    expect(checkAnswer(q('0.378', 'kg'), '380 g').status).toBe('correct')
    expect(checkAnswer(q('5.3', 'm/s^2'), '5,3 m/s²').status).toBe('correct')
    expect(checkAnswer(q('101', 'dB'), '101 dB').status).toBe('correct')
    expect(checkAnswer(q('37', 'm/s'), '133 km/h').status).toBe('correct')
    expect(checkAnswer(q('48.6', '°'), '49°').status).toBe('correct')
  })
})

describe('vanliga fel i fysiksvar', () => {
  const k = { type: 'number', value: '70', unit: 'N/m' } as const
  const hint = (a: Parameters<typeof checkAnswer>[0], input: string) => {
    const r = checkAnswer(a, input)
    expect(r.status).toBe('incorrect')
    return r.hint ?? ''
  }
  it('känner igen en faktor 2, 2π, g, glömd rot och inverterat värde', () => {
    expect(hint(k, '140 N/m')).toMatch(/dubbelt/)
    expect(hint(k, '35 N/m')).toMatch(/hälften/)
    expect(hint(k, '440 N/m')).toContain('gånger för stort')
    expect(hint(k, '7,13 N/m')).toMatch(/glömt \$g\$/)
    expect(hint({ type: 'number', value: '2.5', unit: 'm/s' }, '6,25 m/s')).toMatch(/roten/)
    expect(hint({ type: 'number', value: '0.8', unit: 's' }, '1,25 s')).toMatch(/inverterade/)
    expect(hint({ type: 'number', value: '14.5', unit: '°' }, '0,253°')).toMatch(/radianer/)
    expect(hint({ type: 'number', value: '14.5', unit: '°' }, '75,5°')).toMatch(/90°/)
  })
  it('säger inget särskilt när felet inte följer ett mönster', () => {
    expect(checkAnswer(k, '93 N/m').hint).toBeUndefined()
  })
})
