// Animationer: fjädrar, svängningar, pendlar och resonans.
import type { AnimSpec, G, Params } from './types.ts'
import { arrow, axes, dashed, dot, fmt, line, sig, spring, text } from './draw.ts'

const n = (p: Params, k: string) => Number(p[k])
const TEMPO = { key: 'tempo', label: 'Tempo', min: 0.1, max: 1, step: 0.05, value: 0.4, unit: '×', digits: 2 }

/** Vikten i fjädern: rita fjäder, vikt och jämviktsläge. y i meter (positiv nedåt). */
function massOnSpring(g: G, cx: number, y: number, scale: number, m: number) {
  const { c } = g
  const top = 16
  const eq = g.h * 0.48
  const my = eq + y * scale
  g.ctx.fillStyle = c.faint
  g.ctx.fillRect(cx - 50, top - 6, 100, 6)
  spring(g, cx, top, my - 22, c.fg, 11, 18)
  const size = 26 + Math.sqrt(m) * 20
  g.ctx.fillStyle = c.accent
  g.ctx.fillRect(cx - size / 2, my - 22, size, size * 0.85)
  dashed(g, cx - 80, eq, cx + 80, eq)
  text(g, 'jämviktsläge', cx - 80, eq + 14, { color: c.dim, size: 11 })
  return { my, eq, bottom: my - 22 + size * 0.85 }
}

export const springOsc: AnimSpec = {
  aspect: 0.55,
  speed: 1,
  sliders: [
    { key: 'm', label: 'Massa m', min: 0.05, max: 1, step: 0.05, value: 0.2, unit: 'kg' },
    { key: 'k', label: 'Fjäderkonstant k', min: 5, max: 60, step: 1, value: 20, unit: 'N/m', digits: 0 },
    { key: 'A', label: 'Amplitud A', min: 0.01, max: 0.06, step: 0.005, value: 0.04, unit: 'm', digits: 3 },
    TEMPO,
  ],
  choices: [
    {
      key: 'show',
      label: 'Visa pil för',
      value: 'F',
      options: [
        { value: 'F', label: 'Kraft F_R' },
        { value: 'a', label: 'Acceleration a' },
        { value: 'v', label: 'Hastighet v' },
      ],
    },
  ],
  readout: (p) => {
    const w = Math.sqrt(n(p, 'k') / n(p, 'm'))
    return [`ω = √(k/m) = ${sig(w, 3)} rad/s`, `T = 2π√(m/k) = ${sig((2 * Math.PI) / w, 3)} s`, `v_max = ωA = ${sig(w * n(p, 'A'), 2)} m/s`, `a_max = ω²A = ${sig(w * w * n(p, 'A'), 2)} m/s²`]
  },
  draw(g, p, t) {
    const { c, w, h } = g
    const m = n(p, 'm')
    const k = n(p, 'k')
    const A = n(p, 'A')
    const om = Math.sqrt(k / m)
    const scale = (h * 0.32) / 0.06
    const y = A * Math.sin(om * t)
    const v = om * A * Math.cos(om * t)
    const a = -om * om * y
    const cx = w * 0.2
    const { my, eq } = massOnSpring(g, cx, y, scale, m)
    const show = p.show
    const ax = cx + 52
    if (show === 'F') {
      // Pilens längd följer kraften: 1 N ≈ 30 px.
      arrow(g, ax, my, ax, my - k * y * 30, c.red)
      text(g, 'F_R', ax + 8, my + 4, { color: c.red, bold: true })
    } else if (show === 'a') {
      arrow(g, ax, my, ax, my + (a / (om * om * A)) * 55, c.green)
      text(g, 'a', ax + 8, my + 4, { color: c.green, bold: true, italic: true })
    } else {
      arrow(g, ax, my, ax, my + (v / (om * A)) * 55, c.blue)
      text(g, 'v', ax + 8, my + 4, { color: c.blue, bold: true, italic: true })
    }
    // Diagram: elongationen som funktion av tiden.
    const T = (2 * Math.PI) / om
    const span = 2 * T
    const t0 = Math.max(0, t - span * 0.75)
    const box = { x: w * 0.42, y: 18, w: w * 0.54, h: h - 46 }
    const { px, py: up } = axes(g, box, [t0, t0 + span], [-0.065, 0.065], { x: 't', y: 'y (positiv nedåt ↓)' })
    // Diagrammet ritas med positiv riktning nedåt, så att punkten rör sig som vikten.
    const py = (v: number) => up(-v)
    const pts: [number, number][] = []
    for (let i = 0; i <= 200; i++) {
      const tt = t0 + (span * i) / 200
      if (tt > t) break
      pts.push([px(tt), py(A * Math.sin(om * tt))])
    }
    line(g, pts, c.accent, 2.2)
    dot(g, px(t), py(y), 5, c.accent)
    dashed(g, cx + 30, my, px(t) - 6, py(y), c.faint)
    void eq
  },
}

export const springEnergy: AnimSpec = {
  aspect: 0.55,
  sliders: [
    { key: 'm', label: 'Massa m', min: 0.05, max: 1, step: 0.05, value: 0.2, unit: 'kg' },
    { key: 'k', label: 'Fjäderkonstant k', min: 5, max: 60, step: 1, value: 20, unit: 'N/m', digits: 0 },
    { key: 'A', label: 'Amplitud A', min: 0.01, max: 0.06, step: 0.005, value: 0.04, unit: 'm', digits: 3 },
    TEMPO,
  ],
  readout: (p) => [`Total energi E = kA²/2 = ${sig((n(p, 'k') * n(p, 'A') ** 2) / 2, 3)} J`],
  draw(g, p, t) {
    const { c, w, h } = g
    const m = n(p, 'm')
    const k = n(p, 'k')
    const A = n(p, 'A')
    const om = Math.sqrt(k / m)
    const y = A * Math.sin(om * t)
    const v = om * A * Math.cos(om * t)
    massOnSpring(g, w * 0.2, y, (h * 0.32) / 0.06, m)
    const E = (k * A * A) / 2
    const Ep = (k * y * y) / 2
    const Ek = (m * v * v) / 2
    const bars: [string, number, string][] = [
      ['E_p = ky²/2', Ep, c.blue],
      ['E_k = mv²/2', Ek, c.green],
      ['E = E_p + E_k', Ep + Ek, c.accent],
    ]
    const bw = Math.min(70, w * 0.12)
    const base = h - 40
    const full = h - 90
    bars.forEach(([label, val, col], i) => {
      const x = w * 0.46 + i * (bw + w * 0.06)
      g.ctx.fillStyle = g.c.grid
      g.ctx.fillRect(x, base - full, bw, full)
      g.ctx.fillStyle = col
      const hh = E > 0 ? (val / E) * full : 0
      g.ctx.fillRect(x, base - hh, bw, hh)
      text(g, label, x + bw / 2, base + 18, { color: c.fg, size: 12, align: 'center' })
      text(g, `${sig(val * 1000, 2)} mJ`, x + bw / 2, base - hh - 6, { color: c.dim, size: 11, align: 'center' })
    })
  },
}

export const hooke: AnimSpec = {
  aspect: 0.55,
  sliders: [
    { key: 'k', label: 'Fjäderkonstant k', min: 10, max: 100, step: 5, value: 40, unit: 'N/m', digits: 0 },
    { key: 'F', label: 'Största kraft F', min: 1, max: 8, step: 0.5, value: 6, unit: 'N' },
    TEMPO,
  ],
  readout: (p) => [`Δl = F/k = ${sig(n(p, 'F') / n(p, 'k'), 2)} m vid största kraften`, `E = kΔl²/2 = ${sig(n(p, 'F') ** 2 / (2 * n(p, 'k')), 2)} J`],
  draw(g, p, t) {
    const { c, w, h } = g
    const k = n(p, 'k')
    const Fmax = n(p, 'F')
    const F = (Fmax * (1 - Math.cos(t * 1.2))) / 2
    const dl = F / k
    // Fjädern sitter i en vägg och dras åt höger.
    const x0 = 20
    const rest = w * 0.25
    const scale = (w * 0.18) / 0.8
    const xe = x0 + rest + dl * scale
    g.ctx.fillStyle = c.faint
    g.ctx.fillRect(x0 - 8, h * 0.3 - 30, 8, 60)
    g.ctx.save()
    g.ctx.translate(0, 0)
    const pts: [number, number][] = [[x0, h * 0.3]]
    const coils = 12
    for (let i = 1; i < coils * 2; i++) pts.push([x0 + 10 + ((xe - x0 - 20) * i) / (coils * 2), h * 0.3 + (i % 2 ? -9 : 9)])
    pts.push([xe, h * 0.3])
    line(g, pts, c.fg, 2)
    g.ctx.restore()
    dashed(g, x0 + rest, h * 0.3 - 40, x0 + rest, h * 0.3 + 40)
    text(g, 'obelastad', x0 + rest, h * 0.3 + 54, { color: c.dim, size: 11, align: 'center' })
    arrow(g, xe, h * 0.3, xe + 14 + F * 9, h * 0.3, c.red)
    text(g, `F = ${fmt(F, 1)} N`, xe + 18 + F * 9, h * 0.3 - 8, { color: c.red, bold: true })
    if (dl > 0.005) {
      arrow(g, x0 + rest, h * 0.3 + 26, xe, h * 0.3 + 26, c.blue, 1.5)
      text(g, 'Δl', (x0 + rest + xe) / 2, h * 0.3 + 42, { color: c.blue, italic: true, align: 'center' })
    }
    // F som funktion av förlängningen: en rät linje, arean under är energin.
    const box = { x: w * 0.58, y: 20, w: w * 0.38, h: h - 50 }
    const dmax = 8 / 10
    const { px, py } = axes(g, box, [0, dmax], [0, 8.5], { x: 'Δl', y: 'F' })
    g.ctx.fillStyle = c.accentSoft
    g.ctx.beginPath()
    g.ctx.moveTo(px(0), py(0))
    g.ctx.lineTo(px(dl), py(F))
    g.ctx.lineTo(px(dl), py(0))
    g.ctx.closePath()
    g.ctx.fill()
    line(g, [
      [px(0), py(0)],
      [px(Math.min(dmax, 8.5 / k)), py(Math.min(8.5, k * dmax))],
    ], c.fg, 1.5)
    dot(g, px(dl), py(F), 5, c.red)
    text(g, 'E = kΔl²/2', px(dl * 0.66), py(F * 0.25), { color: c.accent, size: 12, align: 'center' })
  },
}

export const pendulum: AnimSpec = {
  aspect: 0.6,
  sliders: [
    { key: 'l', label: 'Längd l', min: 0.2, max: 2.5, step: 0.05, value: 1, unit: 'm' },
    { key: 'g', label: 'Tyngdacceleration g', min: 1.6, max: 25, step: 0.1, value: 9.82, unit: 'm/s²' },
    { key: 'a0', label: 'Utslag', min: 5, max: 40, step: 1, value: 15, unit: '°', digits: 0 },
    TEMPO,
  ],
  resetOn: ['a0'],
  choices: [
    {
      key: 'forces',
      label: 'Krafter',
      value: 'on',
      options: [
        { value: 'on', label: 'Visa krafter' },
        { value: 'off', label: 'Dölj krafter' },
      ],
    },
  ],
  init: (p) => ({ th: (n(p, 'a0') * Math.PI) / 180, w: 0 }),
  step(s, p, dt) {
    const st = s as { th: number; w: number }
    const k = n(p, 'g') / n(p, 'l')
    // Halvsteg (stabilt för svängningar).
    st.w += -k * Math.sin(st.th) * dt
    st.th += st.w * dt
  },
  readout: (p) => [`T = 2π√(l/g) = ${sig(2 * Math.PI * Math.sqrt(n(p, 'l') / n(p, 'g')), 3)} s`, 'Massan finns inte med i formeln.'],
  draw(g, p, _t, s) {
    const { c, w, h } = g
    const st = s as { th: number }
    const l = n(p, 'l')
    const scale = (h - 70) / 2.5
    const ox = w / 2
    const oy = 20
    const L = l * scale
    const bx = ox + L * Math.sin(st.th)
    const by = oy + L * Math.cos(st.th)
    g.ctx.fillStyle = c.faint
    g.ctx.fillRect(ox - 60, oy - 8, 120, 8)
    dashed(g, ox, oy, ox, oy + L + 20)
    const a0 = (n(p, 'a0') * Math.PI) / 180
    g.ctx.strokeStyle = c.grid
    g.ctx.lineWidth = 6
    g.ctx.beginPath()
    g.ctx.arc(ox, oy, L, Math.PI / 2 - a0, Math.PI / 2 + a0)
    g.ctx.stroke()
    line(g, [
      [ox, oy],
      [bx, by],
    ], c.fg, 1.6)
    dot(g, bx, by, 13, c.accent)
    if (p.forces === 'on') {
      const mg = 46
      arrow(g, bx, by, bx, by + mg, c.blue)
      text(g, 'mg', bx + 6, by + mg, { color: c.blue, bold: true })
      // Komposanten längs banan: mg·sin α, riktad mot jämviktsläget.
      const f1 = mg * Math.sin(st.th)
      arrow(g, bx, by, bx - f1 * Math.cos(st.th), by + f1 * Math.sin(st.th), c.red)
      if (Math.abs(f1) > 6) text(g, 'mg sin α', bx - f1 * Math.cos(st.th) - 4, by + f1 * Math.sin(st.th) - 8, { color: c.red, size: 12, align: f1 > 0 ? 'right' : 'left' })
    }
    text(g, `l = ${fmt(l)} m`, ox + 8, oy + L / 2, { color: c.dim, size: 12 })
  },
}

export const resonance: AnimSpec = {
  aspect: 0.55,
  sliders: [
    { key: 'fd', label: 'Knuffarnas frekvens', min: 0.3, max: 2, step: 0.02, value: 0.6, unit: 'Hz' },
    { key: 'tempo', label: 'Tempo', min: 0.2, max: 1, step: 0.05, value: 1, unit: '×' },
  ],
  init: () => ({ y: 0, v: 0, amp: 0 }),
  step(s, p, dt, t) {
    const st = s as { y: number; v: number; amp: number }
    const w0 = 2 * Math.PI * 1
    const wd = 2 * Math.PI * n(p, 'fd')
    const drive = 0.006 * Math.sin(wd * t)
    const a = -w0 * w0 * (st.y - drive) - 0.5 * st.v
    st.v += a * dt
    st.y += st.v * dt
    st.amp = Math.max(Math.abs(st.y), st.amp * Math.exp(-dt * 0.4))
  },
  readout: (p) => [`Resonansfrekvens: 1,0 Hz`, `Knuffar med ${fmt(n(p, 'fd'))} Hz`],
  draw(g, p, t, s) {
    const { c, w, h } = g
    const st = s as { y: number; amp: number }
    const wd = 2 * Math.PI * n(p, 'fd')
    const drive = 0.006 * Math.sin(wd * t)
    const scale = (h * 0.12) / 0.006 / 5
    const cx = w * 0.2
    const top = 30 + drive * scale * 5
    g.ctx.fillStyle = c.red
    g.ctx.fillRect(cx - 40, top - 8, 80, 8)
    text(g, 'knuffar', cx + 46, top, { color: c.red, size: 11 })
    const eq = h * 0.55
    const my = eq + st.y * scale
    spring(g, cx, top, my - 16, c.fg, 10, 16)
    g.ctx.fillStyle = c.accent
    g.ctx.fillRect(cx - 18, my - 16, 36, 32)
    dashed(g, cx - 60, eq, cx + 60, eq)
    // Hur stort utslaget blir för olika frekvenser.
    const box = { x: w * 0.45, y: 20, w: w * 0.5, h: h - 50 }
    const { px, py } = axes(g, box, [0.3, 2], [0, 1.1], { x: 'frekvens (Hz)', y: 'utslag' })
    const A = (f: number) => {
      const w0 = 2 * Math.PI
      const ww = 2 * Math.PI * f
      return 1 / Math.sqrt((w0 * w0 - ww * ww) ** 2 + (0.5 * ww) ** 2)
    }
    const amax = A(1)
    const pts: [number, number][] = []
    for (let i = 0; i <= 120; i++) {
      const f = 0.3 + (1.7 * i) / 120
      pts.push([px(f), py(A(f) / amax)])
    }
    line(g, pts, c.faint, 2)
    dot(g, px(n(p, 'fd')), py(A(n(p, 'fd')) / amax), 6, c.accent)
    dashed(g, px(1), py(0), px(1), py(1.05))
    text(g, 'resonans', px(1) + 4, py(1.05), { color: c.dim, size: 11 })
  },
}
