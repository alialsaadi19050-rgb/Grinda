// Små ritverktyg som animationerna delar.
import type { G } from './types.ts'

export function arrow(g: G, x1: number, y1: number, x2: number, y2: number, color: string, width = 2.5) {
  const { ctx } = g
  const len = Math.hypot(x2 - x1, y2 - y1)
  if (len < 2) return
  const head = Math.min(11, len * 0.45)
  const a = Math.atan2(y2 - y1, x2 - x1)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2 - Math.cos(a) * head * 0.7, y2 - Math.sin(a) * head * 0.7)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - Math.cos(a - 0.45) * head, y2 - Math.sin(a - 0.45) * head)
  ctx.lineTo(x2 - Math.cos(a + 0.45) * head, y2 - Math.sin(a + 0.45) * head)
  ctx.closePath()
  ctx.fill()
}

export function text(g: G, s: string, x: number, y: number, opts: { color?: string; size?: number; align?: CanvasTextAlign; base?: CanvasTextBaseline; bold?: boolean; italic?: boolean } = {}) {
  const { ctx } = g
  ctx.fillStyle = opts.color ?? g.c.fg
  ctx.font = `${opts.italic ? 'italic ' : ''}${opts.bold ? '700' : '500'} ${opts.size ?? 13}px system-ui, sans-serif`
  ctx.textAlign = opts.align ?? 'left'
  ctx.textBaseline = opts.base ?? 'alphabetic'
  ctx.fillText(s, x, y)
}

export function line(g: G, pts: [number, number][], color: string, width = 2, dash: number[] = []) {
  const { ctx } = g
  if (pts.length < 2) return
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.setLineDash(dash)
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.stroke()
  ctx.setLineDash([])
}

export function dashed(g: G, x1: number, y1: number, x2: number, y2: number, color = g.c.dim) {
  line(g, [
    [x1, y1],
    [x2, y2],
  ], color, 1.2, [5, 5])
}

export function dot(g: G, x: number, y: number, r: number, color: string) {
  g.ctx.fillStyle = color
  g.ctx.beginPath()
  g.ctx.arc(x, y, r, 0, Math.PI * 2)
  g.ctx.fill()
}

export function circle(g: G, x: number, y: number, r: number, color: string, width = 1.5) {
  g.ctx.strokeStyle = color
  g.ctx.lineWidth = width
  g.ctx.beginPath()
  g.ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2)
  g.ctx.stroke()
}

/** En spiralfjäder från (x, y1) till (x, y2). */
export function spring(g: G, x: number, y1: number, y2: number, color: string, coils = 12, width = 16) {
  const pts: [number, number][] = [[x, y1]]
  const lead = 8
  const top = y1 + lead
  const bottom = y2 - lead
  const n = coils * 2
  for (let i = 0; i <= n; i++) {
    const y = top + ((bottom - top) * i) / n
    pts.push([x + (i === 0 || i === n ? 0 : i % 2 ? width / 2 : -width / 2), y])
  }
  pts.push([x, y2])
  line(g, pts, color, 2)
}

/** Ett diagram med axlar. Ger en funktion som räknar om (x, y) till pixlar. */
export function axes(
  g: G,
  box: { x: number; y: number; w: number; h: number },
  xr: [number, number],
  yr: [number, number],
  labels: { x?: string; y?: string } = {},
) {
  const { ctx, c } = g
  const px = (x: number) => box.x + ((x - xr[0]) / (xr[1] - xr[0])) * box.w
  const py = (y: number) => box.y + box.h - ((y - yr[0]) / (yr[1] - yr[0])) * box.h
  ctx.strokeStyle = c.faint
  ctx.lineWidth = 1
  ctx.beginPath()
  const y0 = yr[0] <= 0 && yr[1] >= 0 ? py(0) : box.y + box.h
  ctx.moveTo(box.x, y0)
  ctx.lineTo(box.x + box.w, y0)
  ctx.moveTo(box.x, box.y)
  ctx.lineTo(box.x, box.y + box.h)
  ctx.stroke()
  if (labels.x) text(g, labels.x, box.x + box.w, y0 - 6, { color: c.dim, size: 12, align: 'right' })
  if (labels.y) text(g, labels.y, box.x + 6, box.y + 12, { color: c.dim, size: 12 })
  return { px, py }
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const fmt = (v: number, digits = 2) => v.toLocaleString('sv-SE', { maximumFractionDigits: digits, minimumFractionDigits: 0 })
/** Värdesiffror, t.ex. 0,0123 → 0,012. */
export const sig = (v: number, n = 2) => (v === 0 ? '0' : Number(v.toPrecision(n)).toLocaleString('sv-SE', { maximumFractionDigits: 12 }))
