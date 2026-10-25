// Enheter för fysiksvar. En enhet tolkas till en faktor (hur många SI-enheter den är) och
// en dimension, så att t.ex. 0,07 kN/m och 70 N/m känns igen som samma svar.

/** Exponenter för kg, m och s. Vinklar (rad, °) är dimensionslösa. dB jämförs bara med dB. */
type Dim = [number, number, number]

export interface ParsedUnit {
  factor: number
  dim: Dim
  /** dB är enhetslöst men ska ändå skrivas ut – det går inte att byta mot något annat. */
  db?: boolean
}

const BASE: Record<string, { factor: number; dim: Dim }> = {
  g: { factor: 1e-3, dim: [1, 0, 0] },
  t: { factor: 1e3, dim: [1, 0, 0] },
  m: { factor: 1, dim: [0, 1, 0] },
  s: { factor: 1, dim: [0, 0, 1] },
  min: { factor: 60, dim: [0, 0, 1] },
  h: { factor: 3600, dim: [0, 0, 1] },
  N: { factor: 1, dim: [1, 1, -2] },
  J: { factor: 1, dim: [1, 2, -2] },
  Wh: { factor: 3600, dim: [1, 2, -2] },
  W: { factor: 1, dim: [1, 2, -3] },
  Hz: { factor: 1, dim: [0, 0, -1] },
  Pa: { factor: 1, dim: [1, -1, -2] },
  l: { factor: 1e-3, dim: [0, 3, 0] },
  L: { factor: 1e-3, dim: [0, 3, 0] },
  rad: { factor: 1, dim: [0, 0, 0] },
  '°': { factor: Math.PI / 180, dim: [0, 0, 0] },
  grader: { factor: Math.PI / 180, dim: [0, 0, 0] },
}

const PREFIX: Record<string, number> = { T: 1e12, G: 1e9, M: 1e6, k: 1e3, c: 1e-2, m: 1e-3, µ: 1e-6, μ: 1e-6, u: 1e-6, n: 1e-9 }

function token(t: string): { factor: number; dim: Dim } | null {
  const m = /^([^\d^]+?)(?:\^?(-?\d+))?$/.exec(t)
  if (!m) return null
  const name = m[1]
  const exp = m[2] ? Number(m[2]) : 1
  let base = BASE[name]
  let factor = 1
  if (!base && name.length > 1 && PREFIX[name[0]] && BASE[name.slice(1)]) {
    factor = PREFIX[name[0]]
    base = BASE[name.slice(1)]
  }
  if (!base) return null
  return { factor: (factor * base.factor) ** exp, dim: base.dim.map((d) => d * exp) as Dim }
}

/** Tolkar t.ex. "kN/m", "m/s^2", "W/m²", "km/h", "s^-1", "°". Ger null för okända enheter. */
export function parseUnit(raw: string): ParsedUnit | null {
  const s = raw
    .trim()
    .replace(/[²]/g, '^2')
    .replace(/[³]/g, '^3')
    .replace(/⁻¹/g, '^-1')
    .replace(/[·⋅∙×*]/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\^\s*\(?\s*(-?\d+)\s*\)?/g, '^$1')
    .replace(/[−–]/g, '-')
  if (!s) return null
  if (/^db$/i.test(s)) return { factor: 1, dim: [0, 0, 0], db: true }
  if (s === '%') return { factor: 0.01, dim: [0, 0, 0] }
  const [num, ...dens] = s.split('/')
  let factor = 1
  const dim: Dim = [0, 0, 0]
  const add = (part: string, sign: number) => {
    for (const t of part.split(/\s+/).filter(Boolean)) {
      if (t === '1') continue
      const u = token(t)
      if (!u) return false
      factor *= u.factor ** sign
      u.dim.forEach((d, i) => (dim[i] += d * sign))
    }
    return true
  }
  if (!add(num, 1)) return null
  for (const d of dens) if (!add(d, -1)) return null
  return { factor, dim }
}

export const sameDimension = (a: ParsedUnit, b: ParsedUnit) => !!a.db === !!b.db && a.dim.every((d, i) => d === b.dim[i])

/**
 * Delar ”3,72 kN” i tal och enhet. Enheten är det som står sist och börjar med en bokstav,
 * ° eller µ – men inte potensen i ”· 10^-3”.
 */
export function splitQuantity(raw: string): { number: string; unit: string } {
  const s = raw.trim().replace(/\s+/g, ' ')
  const m = /^(.*?[\d)!.,])\s*((?![eE][+-]?\d)(?:[A-Za-zµμΩ°%][A-Za-zµμΩ°%0-9^²³⁻¹·⋅*/ -]*))$/.exec(s)
  if (!m) return { number: s, unit: '' }
  return { number: m[1].trim(), unit: m[2].trim() }
}

/** Visar enheten snyggt: m/s^2 → m/s². */
export const prettyUnit = (u: string) => u.replace(/\^2/g, '²').replace(/\^3/g, '³').replace(/\^-1/g, '⁻¹').replace(/\*/g, '·')
