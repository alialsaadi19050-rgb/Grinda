import { describe, expect, it } from 'vitest'
import { buildTheme, contrast, hexToRgb, PRESETS, type Mode } from './theme.ts'

const modes: Mode[] = ['dark', 'light']

describe('tema', () => {
  for (const mode of modes) {
    for (const p of PRESETS) {
      for (const softness of [0, 0.5, 1]) {
        it(`${p.name}, ${mode === 'dark' ? 'mörkt' : 'ljust'}, mjukhet ${softness}: texten går att läsa`, () => {
          const t = buildTheme({ mode, softness, ...p.settings })
          const bg = hexToRgb(t['--bg'])
          expect(contrast(hexToRgb(t['--text']), bg)).toBeGreaterThanOrEqual(7)
          expect(contrast(hexToRgb(t['--text-dim']), bg)).toBeGreaterThanOrEqual(4.5)
          expect(contrast(hexToRgb(t['--accent-text']), bg)).toBeGreaterThanOrEqual(4.5)
          expect(contrast(hexToRgb(t['--accent-ink']), hexToRgb(t['--accent']))).toBeGreaterThanOrEqual(4.5)
        })
      }
    }
  }

  it('ljust läge: bakgrunden är papper, korten är ljusare än bakgrunden', () => {
    const t = buildTheme({ mode: 'light', softness: 0.5, ...PRESETS[0].settings })
    expect(t['--bg'].toLowerCase()).not.toBe('#ffffff')
    const lum = (h: string) => hexToRgb(h).reduce((s, v) => s + v, 0)
    expect(lum(t['--surface'])).toBeGreaterThan(lum(t['--bg']))
  })

  it('mörkt läge är en färgad natthimmel, inte svart', () => {
    const t = buildTheme({ mode: 'dark', softness: 0.5, ...PRESETS[0].settings })
    const [r, , b] = hexToRgb(t['--bg'])
    expect(contrast(hexToRgb(t['--bg']), [0, 0, 0])).toBeGreaterThan(1.08)
    expect(b).toBeGreaterThan(r)
  })

  for (const mode of modes) {
    it(`${mode === 'dark' ? 'mörkt' : 'ljust'}: texten går att läsa på korten också`, () => {
      for (const p of PRESETS) {
        const t = buildTheme({ mode, softness: 0.5, ...p.settings })
        const card = hexToRgb(t['--surface'])
        expect(contrast(hexToRgb(t['--text']), card)).toBeGreaterThanOrEqual(7)
        expect(contrast(hexToRgb(t['--text-dim']), card)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(hexToRgb(t['--accent-text']), card)).toBeGreaterThanOrEqual(4.5)
      }
    })
  }

  it('godtycklig accentfärg fungerar, även mörk', () => {
    for (const accent of ['#000080', '#3a3a3a', '#ffff00', '#00ffff']) {
      for (const mode of modes) {
        const t = buildTheme({ mode, softness: 0.5, accent, bgHue: 200, bgTint: 0.3 })
        expect(contrast(hexToRgb(t['--accent-text']), hexToRgb(t['--bg']))).toBeGreaterThanOrEqual(4.5)
        expect(contrast(hexToRgb(t['--accent-ink']), hexToRgb(t['--accent']))).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})
