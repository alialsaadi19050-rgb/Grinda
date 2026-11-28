// Känner igen uppgifter som ska lösas med grafritare ("Lös grafiskt …", "Rita kurvan med din
// grafräknare …") och gissar ett lämpligt fönster för GeoGebra från intervallet i uppgiften,
// t.ex. 0° ≤ x ≤ 360°. Det behövs ingen extra data i boken: allt läses ur uppgiftstexten.
import type { Exercise } from '../content/types.ts'

export interface GraphView {
  xmin: number
  xmax: number
  ymin: number
  ymax: number
}

export interface GraphTask {
  /** Uppgiften ber om grafritare eller grafisk lösning. */
  graph: boolean
  /** Vinklar i grader: i GeoGebra skriver man då cos(0.5x°). */
  degrees: boolean
  /** Fönster att börja med, eller null för GeoGebras vanliga. */
  view: GraphView | null
}

const GRAPH_WORDS = /grafisk|grafrit|grafräkn|digitalt? verktyg|rita (?:in )?(?:grafen|graferna|kurvan|kurvorna)\b|i samma (?:koordinatsystem|fönster)/i

// Ett tal i bokens LaTeX: 360, -90, 0{,}5, 2\pi, \pi.
const NUM = String.raw`(-?\s*(?:\d+(?:\{,\}\d+)?)?\s*\\pi|-?\s*\d+(?:\{,\}\d+)?)`
const DEG = String.raw`\s*(?:\^\s*\{?\\circ\}?|°)?`
const LE = String.raw`\s*(?:\\leq?|\\leqslant|<|≤)\s*`
const INTERVAL = new RegExp(NUM + DEG + LE + String.raw`[a-zv]` + LE + NUM + DEG)

// Tal i texten, utom vinklar (360°) och π-tal. De bestämmer hur hög y-axeln blir.
const PLAIN = /(?<![\d{])(\d+(?:\{,\}\d+)?)(?!\s*(?:\^\s*\{?\\circ|°(?!\s*C)|\\pi|\{,\}|\d))/g

const toNumber = (s: string) => {
  const t = s.replace(/\s+/g, '').replace('{,}', '.')
  if (!t.includes('\\pi')) return Number(t)
  const k = t.replace('\\pi', '')
  return (k === '' ? 1 : k === '-' ? -1 : Number(k)) * Math.PI
}

export function graphTask(ex: Pick<Exercise, 'prompt' | 'parts' | 'calculator'>): GraphTask {
  const text = [ex.prompt, ...ex.parts.map((p) => p.prompt ?? '')].join('\n')
  // "°C" är temperatur, inte grader.
  const degrees = /\^\s*\{?\\circ|°(?!\s*C)/.test(text)
  const graph = ex.calculator !== false && GRAPH_WORDS.test(text)

  let view: GraphView | null = null
  const m = text.match(INTERVAL)
  const a = m ? toNumber(m[1]) : NaN
  const b = m ? toNumber(m[2]) : NaN
  // y-axeln: tillräckligt hög för de största talen i uppgiften (t.ex. 12 sin(…) + 20 = 30),
  // lika långt åt båda hållen så att ingen kurva klipps av nedåt.
  const rest = m ? text.replace(m[0], ' ') : text
  const big = Math.max(0, ...[...rest.matchAll(PLAIN)].map((n) => Number(n[1].replace('{,}', '.'))).filter((n) => n < 1000))
  const ymax = Math.max(3, Math.ceil(big * 1.15))
  const ymin = -ymax
  if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
    const pad = (b - a) * 0.08
    view = { xmin: a - pad, xmax: b + pad, ymin, ymax }
  } else if (degrees) {
    view = { xmin: -30, xmax: 390, ymin, ymax }
  }
  return { graph, degrees, view }
}
