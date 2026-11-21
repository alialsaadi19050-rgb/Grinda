import { beforeEach, describe, expect, it } from 'vitest'

// Ett enkelt localStorage för testerna (de körs i Node).
const store = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage

const { acceptRemotePref, prefChanged, prefChangedAt } = await import('./prefStore.ts')
const { readDirty } = await import('./changes.ts')

describe('inställningar som synkas', () => {
  beforeEach(() => store.clear())

  it('en lokal ändring markeras för synk med tidsstämpel', () => {
    prefChanged('study')
    expect(prefChangedAt('study')).toBeGreaterThan(0)
    expect(readDirty().docs).toContain('pref:study')
  })

  it('en ändring från en annan enhet gäller bara om den är nyare', () => {
    expect(acceptRemotePref('srs', 1000)).toBe(true)
    expect(prefChangedAt('srs')).toBe(1000)
    expect(acceptRemotePref('srs', 900)).toBe(false)
    expect(acceptRemotePref('srs', 1000)).toBe(false)
    expect(acceptRemotePref('srs', 2000)).toBe(true)
  })

  it('en ny enhet utan egna ändringar tar emot allt', () => {
    expect(prefChangedAt('theme')).toBeUndefined()
    expect(acceptRemotePref('theme', 1)).toBe(true)
  })
})
