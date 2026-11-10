// Mallar som ritas in på skrivytan med ett klick (koordinatsystem, enhetscirkel, tabell,
// tallinje) och mätningar med linjal och gradskiva. Allt blir vanliga streck, så att det går
// att flytta, sudda och ångra precis som det du skrivit själv.
import { shapePoints } from './geometry.ts'
import { GRID } from './render.ts'
import type { InkColor, Point, Stroke } from './types.ts'
import { PEN_SIZES } from './types.ts'

export type TemplateKind = 'axes' | 'unit-circle' | 'table' | 'number-line'

export const TEMPLATES: { id: TemplateKind; label: string }[] = [
  { id: 'axes', label: 'Koordinatsystem' },
  { id: 'unit-circle', label: 'Enhetscirkel' },
  { id: 'number-line', label: 'Tallinje' },
  { id: 'table', label: 'Tabell' },
]

/** Ett rakt streck (eller en form) som en del av en mall. */
type Piece = { points: Point[]; color?: InkColor; thin?: boolean }

const line = (a: [number, number], b: [number, number], o: Omit<Piece, 'points'> = {}): Piece => ({ points: shapePoints('line', a, b), ...o })
const arrow = (tip: [number, number], dir: [number, number], size = 9): Piece[] => {
  const [dx, dy] = dir
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  const back: [number, number] = [tip[0] - ux * size, tip[1] - uy * size]
  return [line(tip, [back[0] - uy * size * 0.6, back[1] + ux * size * 0.6]), line(tip, [back[0] + uy * size * 0.6, back[1] - ux * size * 0.6])]
}

/** Mallens bitar, med (0, 0) i mitten. Måtten följer rutorna (GRID). */
export function templatePieces(kind: TemplateKind): Piece[] {
  const g = GRID
  const tick = 5
  if (kind === 'axes') {
    const W = 10 * g
    const H = 7 * g
    const out: Piece[] = [line([-W, 0], [W, 0]), line([0, H], [0, -H]), ...arrow([W, 0], [1, 0]), ...arrow([0, -H], [0, -1])]
    for (let i = -9; i <= 9; i++) if (i) out.push(line([i * g, -tick], [i * g, tick], { thin: true }))
    for (let i = -6; i <= 6; i++) if (i) out.push(line([-tick, i * g], [tick, i * g], { thin: true }))
    return out
  }
  if (kind === 'number-line') {
    const W = 11 * g
    const out: Piece[] = [line([-W, 0], [W, 0]), ...arrow([W, 0], [1, 0])]
    for (let i = -10; i <= 10; i++) out.push(line([i * g, -(i % 5 ? tick : tick * 2)], [i * g, i % 5 ? tick : tick * 2], { thin: i % 5 !== 0 }))
    return out
  }
  if (kind === 'unit-circle') {
    const R = 8 * g
    const out: Piece[] = [line([-R - 2 * g, 0], [R + 2 * g, 0]), line([0, R + 2 * g], [0, -R - 2 * g]), ...arrow([R + 2 * g, 0], [1, 0]), ...arrow([0, -R - 2 * g], [0, -1])]
    out.push({ points: shapePoints('ellipse', [-R, -R], [R, R]) })
    for (const t of [-R, R]) {
      out.push(line([t, -tick], [t, tick], { thin: true }), line([-tick, t], [tick, t], { thin: true }))
    }
    // Vinklarna 30°, 45° och 60° i alla kvadranter, tunt och blått.
    for (const deg of [30, 45, 60, 120, 135, 150, 210, 225, 240, 300, 315, 330]) {
      const r = (deg * Math.PI) / 180
      out.push(line([0, 0], [R * Math.cos(r), -R * Math.sin(r)], { color: 'blue', thin: true }))
    }
    return out
  }
  // Tabell: 3 kolumner × 6 rader, rubrikraden lite tjockare under.
  const cw = 5 * g
  const rh = 2 * g
  const cols = 3
  const rows = 6
  const x0 = (-cols * cw) / 2
  const y0 = (-rows * rh) / 2
  const out: Piece[] = []
  for (let c = 0; c <= cols; c++) out.push(line([x0 + c * cw, y0], [x0 + c * cw, y0 + rows * rh]))
  for (let r = 0; r <= rows; r++) out.push(line([x0, y0 + r * rh], [x0 + cols * cw, y0 + r * rh], { thin: r !== 0 && r !== 1 && r !== rows }))
  return out
}

/** Gör mallen till streck, med mitten i `at` (rundat till rutnätet). */
export function templateStrokes(kind: TemplateKind, at: [number, number], color: InkColor, nextZ: number, newId: () => string): Stroke[] {
  const cx = Math.round(at[0] / GRID) * GRID
  const cy = Math.round(at[1] / GRID) * GRID
  return templatePieces(kind).map((p, i) => ({
    id: newId(),
    z: nextZ + i * 0.001,
    tool: 'pen',
    color: p.color ?? color,
    size: p.thin ? PEN_SIZES[0] * 0.75 : PEN_SIZES[0],
    pressure: false,
    shape: true,
    points: p.points.map(([x, y, w]) => [x + cx, y + cy, w] as Point),
  }))
}

/* ---------- Mätningar ---------- */

/** En ruta är 5 mm, som på rutat papper. */
export const CM_PER_UNIT = 0.5 / GRID

export interface Measurement {
  kind: 'ruler' | 'protractor'
  /** Linjal: start. Gradskiva: vinkelns spets. */
  a: [number, number]
  /** Linjal: slut. Gradskiva: första benet. */
  b: [number, number]
  /** Gradskiva: andra benet (saknas medan du väljer det). */
  c?: [number, number]
  /** Gradskivan väntar på det andra benet. */
  waiting?: boolean
}

export function rulerInfo(m: Pick<Measurement, 'a' | 'b'>) {
  const dx = m.b[0] - m.a[0]
  const dy = m.b[1] - m.a[1]
  const units = Math.hypot(dx, dy)
  // Vinkeln mot x-axeln, moturs som i matten (y-axeln pekar nedåt på skärmen).
  let deg = (Math.atan2(-dy, dx) * 180) / Math.PI
  if (deg < 0) deg += 360
  return { squares: units / GRID, cm: units * CM_PER_UNIT, deg }
}

/** Vinkeln mellan benen (0–180°). */
export function angleAt(v: [number, number], p: [number, number], q: [number, number]): number {
  const a1 = Math.atan2(p[1] - v[1], p[0] - v[0])
  const a2 = Math.atan2(q[1] - v[1], q[0] - v[0])
  let d = Math.abs(a1 - a2) * (180 / Math.PI)
  if (d > 180) d = 360 - d
  return d
}

/** Punkterna för bågen som markerar vinkeln, med radien r. */
export function arcPoints(v: [number, number], p: [number, number], q: [number, number], r: number): Point[] {
  const a1 = Math.atan2(p[1] - v[1], p[0] - v[0])
  let a2 = Math.atan2(q[1] - v[1], q[0] - v[0])
  let d = a2 - a1
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  a2 = a1 + d
  const n = Math.max(6, Math.ceil((Math.abs(d) * r) / 4))
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = a1 + (d * i) / n
    return [Math.round((v[0] + r * Math.cos(t)) * 100) / 100, Math.round((v[1] + r * Math.sin(t)) * 100) / 100, 0.5] as Point
  })
}

/** Mätningen som streck (”Rita in”). */
export function measurementStrokes(m: Measurement, color: InkColor, nextZ: number, newId: () => string): Stroke[] {
  const mk = (points: Point[], i: number): Stroke => ({ id: newId(), z: nextZ + i * 0.001, tool: 'pen', color, size: PEN_SIZES[0], pressure: false, shape: true, points })
  if (m.kind === 'ruler') return [mk(shapePoints('line', m.a, m.b), 0)]
  if (!m.c) return []
  return [mk(shapePoints('line', m.a, m.b), 0), mk(shapePoints('line', m.a, m.c), 1), mk(arcPoints(m.a, m.b, m.c, Math.min(40, 0.4 * Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]), 0.4 * Math.hypot(m.c[0] - m.a[0], m.c[1] - m.a[1]))), 2)]
}

export const fmtNum = (x: number, d = 1) => x.toFixed(d).replace('.', ',')
