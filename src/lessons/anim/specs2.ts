// Animationer: pulser, vågor, stående vågor och pipor.
import type { AnimSpec, G, Params } from './types.ts'
import { arrow, dashed, dot, fmt, line, sig, text } from './draw.ts'

const n = (p: Params, k: string) => Number(p[k])
const TEMPO = { key: 'tempo', label: 'Tempo', min: 0.1, max: 1, step: 0.05, value: 0.5, unit: '×', digits: 2 }

/** En puls som rör sig åt höger: formen ges av shape(x) med x mätt från pulsens mitt. */
const shapeOf = (kind: string) => (x: number) => {
  if (kind === 'rect') return Math.abs(x) <= 0.06 ? 1 : 0
  if (kind === 'tri') return Math.abs(x) <= 0.08 ? 1 - Math.abs(x) / 0.08 : 0
  return Math.exp(-(x * x) / (2 * 0.035 * 0.035))
}

function stringPath(g: G, f: (x: number) => number, x0: number, x1: number, amp: number, base: number, color: string, width = 2.2, dash: number[] = []) {
  const pts: [number, number][] = []
  const N = 300
  for (let i = 0; i <= N; i++) {
    const u = i / N
    pts.push([x0 + (x1 - x0) * u, base - f(u) * amp])
  }
  line(g, pts, color, width, dash)
}

export const pulseReflection: AnimSpec = {
  aspect: 0.42,
  speed: 0.35,
  sliders: [TEMPO],
  choices: [
    {
      key: 'end',
      label: 'Pulsen når',
      value: 'wall',
      options: [
        { value: 'wall', label: 'Fast vägg' },
        { value: 'dense', label: 'Tätare medium' },
        { value: 'thin', label: 'Tunnare medium' },
      ],
    },
  ],
  resetOn: ['end'],
  draw(g, p, t) {
    const { c, w, h } = g
    const end = String(p.end)
    const L = 0.55
    const r = end === 'wall' ? -1 : end === 'dense' ? -0.45 : 0.45
    const tau = 1 + r
    const v2 = end === 'dense' ? 0.5 : 2
    const tt = (t % 3.2) - 0.25
    const f = shapeOf('smooth')
    const y = (u: number) => {
      if (u <= L) return f(u - tt) + r * f(2 * L - u - tt)
      if (end === 'wall') return 0
      return tau * f(L + (u - L) / v2 - tt)
    }
    const x0 = 20
    const x1 = w - 20
    const base = h * 0.62
    const amp = h * 0.38
    const xL = x0 + (x1 - x0) * L
    if (end === 'wall') {
      g.ctx.fillStyle = c.faint
      g.ctx.fillRect(xL, base - amp - 10, 10, amp + 30)
    }
    stringPath(g, (u) => (u <= L || end !== 'wall' ? y(u) : 0), x0, end === 'wall' ? xL : x1, amp, base, c.fg)
    if (end !== 'wall') {
      // Den andra strängen ritas tjockare (tätare) eller tunnare.
      const pts: [number, number][] = []
      for (let i = 0; i <= 150; i++) {
        const u = L + ((1 - L) * i) / 150
        pts.push([x0 + (x1 - x0) * u, base - y(u) * amp])
      }
      line(g, pts, c.accent, end === 'dense' ? 5 : 1.2)
      dashed(g, xL, base - amp, xL, base + 20)
      text(g, end === 'dense' ? 'tätare medium' : 'tunnare medium', xL + 8, base + 18, { color: c.accent, size: 12 })
    }
    text(g, 'v', x0 + 4, 18, { color: c.dim, size: 12, italic: true })
  },
}

export const superposition: AnimSpec = {
  aspect: 0.42,
  speed: 0.25,
  sliders: [TEMPO],
  choices: [
    {
      key: 'side',
      label: 'Pulserna',
      value: 'same',
      options: [
        { value: 'same', label: 'På samma sida' },
        { value: 'opp', label: 'På olika sidor' },
      ],
    },
    {
      key: 'shape',
      label: 'Form',
      value: 'rect',
      options: [
        { value: 'rect', label: 'Rektangel' },
        { value: 'tri', label: 'Triangel' },
      ],
    },
  ],
  resetOn: ['side', 'shape'],
  draw(g, p, t) {
    const { c, w, h } = g
    const f = shapeOf(String(p.shape))
    const s2 = p.side === 'same' ? 1 : -1
    const tt = t % 2
    const p1 = (u: number) => f(u - (0.15 + tt * 0.35))
    const p2 = (u: number) => s2 * 0.75 * f(u - (0.85 - tt * 0.35))
    const base = h * 0.55
    const amp = h * 0.32
    stringPath(g, p1, 20, w - 20, amp, base, c.blue, 1.4, [5, 4])
    stringPath(g, p2, 20, w - 20, amp, base, c.green, 1.4, [5, 4])
    stringPath(g, (u) => p1(u) + p2(u), 20, w - 20, amp, base, c.fg, 2.4)
    text(g, 'streckat: varje puls för sig · heldraget: strängen (summan)', 20, h - 8, { color: c.dim, size: 11.5 })
  },
}

export const travellingWave: AnimSpec = {
  aspect: 0.45,
  sliders: [
    { key: 'f', label: 'Frekvens f', min: 0.2, max: 2, step: 0.05, value: 0.5, unit: 'Hz' },
    { key: 'lam', label: 'Våglängd λ', min: 0.5, max: 3, step: 0.1, value: 2, unit: 'm' },
  ],
  choices: [
    {
      key: 'kind',
      label: 'Våg',
      value: 'trans',
      options: [
        { value: 'trans', label: 'Transversell' },
        { value: 'long', label: 'Longitudinell' },
      ],
    },
  ],
  readout: (p) => [`T = 1/f = ${sig(1 / n(p, 'f'), 3)} s`, `v = f · λ = ${sig(n(p, 'f') * n(p, 'lam'), 3)} m/s`],
  draw(g, p, t) {
    const { c, w, h } = g
    const f = n(p, 'f')
    const lam = n(p, 'lam')
    const meters = 6
    const sx = (w - 40) / meters
    const k = (2 * Math.PI) / lam
    const om = 2 * Math.PI * f
    const base = h * 0.5
    if (p.kind === 'trans') {
      const A = h * 0.26
      const pts: [number, number][] = []
      for (let i = 0; i <= 300; i++) {
        const x = (meters * i) / 300
        pts.push([20 + x * sx, base - A * Math.sin(om * t - k * x)])
      }
      line(g, pts, c.fg, 2.2)
      for (const [x, col] of [
        [1.5, c.red],
        [3.5, c.green],
      ] as const) {
        const yy = base - A * Math.sin(om * t - k * x)
        dashed(g, 20 + x * sx, base - A - 6, 20 + x * sx, base + A + 6, c.faint)
        dot(g, 20 + x * sx, yy, 7, col)
      }
      // Våglängden mellan två toppar.
      arrow(g, 20, 16, 20 + lam * sx, 16, c.accent, 1.5)
      text(g, 'λ', 20 + (lam * sx) / 2, 32, { color: c.accent, align: 'center', italic: true, bold: true })
      text(g, 'Punkterna rör sig bara upp och ner – vågen rör sig åt höger.', 20, h - 8, { color: c.dim, size: 11.5 })
    } else {
      const s0 = 0.18
      for (let i = 0; i <= 90; i++) {
        const x0 = (meters * i) / 90
        const dx = s0 * Math.sin(om * t - k * x0)
        for (let row = -3; row <= 3; row++) dot(g, 20 + (x0 + dx) * sx, base + row * 14, 3, i === 30 ? c.red : i === 60 ? c.green : c.fg)
      }
      arrow(g, 20, 20, 20 + lam * sx, 20, c.accent, 1.5)
      text(g, 'λ', 20 + (lam * sx) / 2, 36, { color: c.accent, align: 'center', italic: true, bold: true })
      text(g, 'Förtätningar och förtunningar rör sig åt höger – varje del svänger bara fram och tillbaka.', 20, h - 8, { color: c.dim, size: 11.5 })
    }
  },
}

export const standingString: AnimSpec = {
  aspect: 0.42,
  sliders: [
    { key: 'n', label: 'n', min: 1, max: 6, step: 1, value: 1, digits: 0 },
    { key: 'l', label: 'Strängens längd l', min: 0.2, max: 1, step: 0.05, value: 0.65, unit: 'm' },
    { key: 'v', label: 'Våghastighet v', min: 100, max: 600, step: 10, value: 430, unit: 'm/s', digits: 0 },
  ],
  speed: 1,
  readout: (p) => {
    const N = n(p, 'n')
    const lam = (2 * n(p, 'l')) / N
    return [N === 1 ? 'Grundtonen (n = 1)' : `${N - 1}:a övertonen (n = ${N})`, `l = n · λ/2 ⇒ λ = ${sig(lam, 3)} m`, `f = v/λ = ${sig(n(p, 'v') / lam, 3)} Hz`]
  },
  draw(g, p, t) {
    const { c, w, h } = g
    const N = n(p, 'n')
    const base = h * 0.5
    const A = h * 0.32
    const x0 = 30
    const x1 = w - 30
    const env = (u: number) => Math.sin(N * Math.PI * u)
    // Långsam svängning så att man hinner se den.
    const ct = Math.cos(2 * Math.PI * 0.7 * t)
    stringPath(g, env, x0, x1, A, base, c.faint, 1.2, [4, 4])
    stringPath(g, (u) => -env(u), x0, x1, A, base, c.faint, 1.2, [4, 4])
    stringPath(g, (u) => env(u) * ct, x0, x1, A, base, c.fg, 2.4)
    for (let i = 0; i <= N; i++) {
      const x = x0 + ((x1 - x0) * i) / N
      dot(g, x, base, 5, c.red)
      text(g, 'N', x, base + 22, { color: c.red, size: 12, align: 'center', bold: true })
    }
    for (let i = 0; i < N; i++) {
      const x = x0 + ((x1 - x0) * (i + 0.5)) / N
      text(g, 'B', x, base - A - 8, { color: c.accent, size: 12, align: 'center', bold: true })
    }
    text(g, 'N = nod · B = buk', 12, h - 8, { color: c.dim, size: 11.5 })
  },
}

export const pipe: AnimSpec = {
  aspect: 0.42,
  sliders: [
    { key: 'n', label: 'n', min: 1, max: 4, step: 1, value: 1, digits: 0 },
    { key: 'l', label: 'Pipans längd l', min: 0.1, max: 2, step: 0.05, value: 0.5, unit: 'm' },
  ],
  choices: [
    {
      key: 'kind',
      label: 'Pipa',
      value: 'open',
      options: [
        { value: 'open', label: 'Öppen' },
        { value: 'half', label: 'Halvöppen' },
        { value: 'closed', label: 'Sluten' },
      ],
    },
  ],
  readout: (p) => {
    const N = n(p, 'n')
    const l = n(p, 'l')
    const half = p.kind === 'half'
    const lam = half ? (4 * l) / (2 * N - 1) : (2 * l) / N
    return [half ? `l = (2n − 1)λ/4 ⇒ λ = ${sig(lam, 3)} m` : `l = n · λ/2 ⇒ λ = ${sig(lam, 3)} m`, `f = v/λ = ${sig(340 / lam, 3)} Hz (v = 340 m/s)`]
  },
  draw(g, p, t) {
    const { c, w, h } = g
    const N = n(p, 'n')
    const kind = String(p.kind)
    const x0 = 40
    const x1 = w - 40
    const top = h * 0.2
    const bot = h * 0.8
    const mid = (top + bot) / 2
    const A = (bot - top) * 0.42
    g.ctx.strokeStyle = c.fg
    g.ctx.lineWidth = 3
    g.ctx.beginPath()
    g.ctx.moveTo(x0, top)
    g.ctx.lineTo(x1, top)
    g.ctx.moveTo(x0, bot)
    g.ctx.lineTo(x1, bot)
    if (kind !== 'open') {
      g.ctx.moveTo(x0, top)
      g.ctx.lineTo(x0, bot)
    }
    if (kind === 'closed') {
      g.ctx.moveTo(x1, top)
      g.ctx.lineTo(x1, bot)
    }
    g.ctx.stroke()
    // Rörelsen ritas som en transversell våg, precis som i boken.
    const env = (u: number) => (kind === 'open' ? Math.cos(N * Math.PI * u) : kind === 'half' ? Math.sin(((2 * N - 1) * Math.PI * u) / 2) : Math.sin(N * Math.PI * u))
    const ct = Math.cos(2 * Math.PI * 0.7 * t)
    stringPath(g, env, x0, x1, A, mid, c.faint, 1.2, [4, 4])
    stringPath(g, (u) => -env(u), x0, x1, A, mid, c.faint, 1.2, [4, 4])
    stringPath(g, (u) => env(u) * ct, x0, x1, A, mid, c.accent, 2.4)
    text(g, `${N === 1 ? 'Grundton' : `${N - 1}:a övertonen`}`, x0, top - 10, { color: c.dim, size: 12 })
    text(g, kind === 'open' ? 'buk i båda öppna ändarna' : kind === 'half' ? 'nod i den slutna änden, buk i den öppna' : 'noder i båda slutna ändarna', x0, bot + 22, { color: c.dim, size: 11.5 })
    void fmt
  },
}

export const waterWave: AnimSpec = {
  aspect: 0.5,
  speed: 1,
  sliders: [TEMPO],
  draw(g, _p, t) {
    const { c, w, h } = g
    const lam = w / 2.2
    const k = (2 * Math.PI) / lam
    const om = 2.4
    const surf = h * 0.3
    const r0 = h * 0.09
    g.ctx.fillStyle = `rgba(79, 141, 255, 0.12)`
    g.ctx.fillRect(0, surf, w, h - surf)
    const rows = [0, 0.35, 0.7, 1.05]
    rows.forEach((d, ri) => {
      const r = r0 * Math.exp(-k * d * lam * 0.25)
      const y0 = surf + d * h * 0.42
      const pts: [number, number][] = []
      for (let i = 0; i <= 40; i++) {
        const x0 = (w * i) / 40
        const ph = k * x0 - om * t
        const x = x0 - r * Math.sin(ph)
        const y = y0 + r * Math.cos(ph) - r
        if (ri === 0) pts.push([x, y])
        dot(g, x, y, ri === 0 ? 3.5 : 2.5, i === 12 ? c.red : ri === 0 ? c.fg : c.dim)
        if (i === 12) {
          g.ctx.strokeStyle = c.faint
          g.ctx.lineWidth = 1
          g.ctx.beginPath()
          g.ctx.arc(x0, y0 - r, r, 0, Math.PI * 2)
          g.ctx.stroke()
        }
      }
      if (ri === 0) line(g, pts, c.blue, 2)
    })
    arrow(g, w - 120, 20, w - 30, 20, c.accent, 1.8)
    text(g, 'vågrörelse', w - 124, 24, { color: c.accent, size: 12, align: 'right' })
    text(g, 'Varje vattendroppe går runt i en cirkel – djupare ner blir cirklarna mindre.', 12, h - 8, { color: c.dim, size: 11.5 })
  },
}

export { fmt }
