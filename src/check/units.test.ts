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
