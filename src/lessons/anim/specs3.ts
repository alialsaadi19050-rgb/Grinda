// Animationer: ljudstyrka, dopplereffekt, svävningar, brytning, diffraktion, interferens
// och jordbävningsvågor.
import { createElement } from 'react'
import type { AnimSpec, G, Params } from './types.ts'
import { arrow, axes, circle, dashed, dot, fmt, line, sig, text } from './draw.ts'

const n = (p: Params, k: string) => Number(p[k])

export const intensity: AnimSpec = {
  aspect: 0.5,
  sliders: [
    { key: 'P', label: 'Ljudets effekt P', min: 0.01, max: 1, step: 0.01, value: 0.1, unit: 'W' },
    { key: 'r', label: 'Avstånd r', min: 1, max: 20, step: 0.5, value: 4, unit: 'm' },
  ],
  readout: (p) => {
    const A = 4 * Math.PI * n(p, 'r') ** 2
    const I = n(p, 'P') / A
    return [`A = 4πr² = ${sig(A, 3)} m²`, `I = P/A = ${sig(I, 2)} W/m²`, `L = 10 · lg(I/10⁻¹²) = ${fmt(10 * Math.log10(I / 1e-12), 0)} dB`]
  },
  draw(g, p, t) {
    const { c, w, h } = g
    const cx = w * 0.28
    const cy = h * 0.5
    const scale = (h * 0.46) / 20
    for (let i = 0; i < 6; i++) {
      const r = ((t * 2.2 + i * (20 / 6)) % 20) * scale
      g.ctx.globalAlpha = 1 - r / (20 * scale)
      circle(g, cx, cy, r, c.accent, 1.5)
    }
    g.ctx.globalAlpha = 1
    dot(g, cx, cy, 8, c.fg)
    const rr = n(p, 'r') * scale
    circle(g, cx, cy, rr, c.blue, 2)
    dot(g, cx + rr, cy, 6, c.blue)
    text(g, 'du', cx + rr + 8, cy + 4, { color: c.blue, bold: true })
    // Samma energi sprids över en allt större yta.
    const box = { x: w * 0.58, y: 20, w: w * 0.38, h: h - 50 }
    const { px, py } = axes(g, box, [1, 20], [0, 1], { x: 'r (m)', y: 'I' })
    const pts: [number, number][] = []
    for (let i = 0; i <= 100; i++) {
      const r = 1 + (19 * i) / 100
      pts.push([px(r), py(1 / (r * r))])
    }
    line(g, pts, c.faint, 2)
    dot(g, px(n(p, 'r')), py(1 / n(p, 'r') ** 2), 6, c.blue)
    text(g, 'I ∝ 1/r²', px(8), py(0.5), { color: c.dim, size: 12 })
  },
}

export const doppler: AnimSpec = {
  aspect: 0.5,
  speed: 1,
  sliders: [
    { key: 'vs', label: 'Sändarens fart (del av ljudets fart)', min: 0, max: 1.6, step: 0.05, value: 0.5, unit: '· v_ljud' },
    { key: 'fs', label: 'Sändarens frekvens f_s', min: 200, max: 1000, step: 10, value: 440, unit: 'Hz', digits: 0 },
  ],
  resetOn: ['vs'],
  readout: (p) => {
    const vs = n(p, 'vs')
    const fs = n(p, 'fs')
    if (vs >= 1) return [`Sändaren är snabbare än ljudet (Mach ${fmt(vs)}) – det bildas en tryckfront i en kon.`]
    return [`Framför: f_m = f_s · v/(v − v_s) = ${fmt(fs / (1 - vs), 0)} Hz`, `Bakom: f_m = f_s · v/(v + v_s) = ${fmt(fs / (1 + vs), 0)} Hz`]
  },
  draw(g, p, t) {
    const { c, w, h } = g
    const vs = n(p, 'vs')
    const v = w * 0.12
    const T = 0.45
    const period = 7
    const tt = t % period
    const x0 = w * 0.12
    const sx = (time: number) => x0 + vs * v * time
    const cy = h * 0.5
    for (let k = 0; k * T <= tt; k++) {
      const te = k * T
      const r = v * (tt - te)
      if (r > w * 1.4) continue
      circle(g, sx(te), cy, r, `rgba(${c.fgRgb}, ${Math.max(0.12, 0.8 - r / w)})`, 1.4)
    }
    const x = sx(tt)
    dot(g, x, cy, 9, c.accent)
    arrow(g, x + 12, cy, x + 12 + 26, cy, c.accent, 2)
    dot(g, w - 24, cy, 6, c.blue)
    text(g, 'framför', w - 24, cy - 14, { color: c.blue, size: 11.5, align: 'center' })
    dot(g, 24, cy, 6, c.green)
    text(g, 'bakom', 24, cy - 14, { color: c.green, size: 11.5, align: 'center' })
    if (vs >= 1 && tt > 1) {
      const half = Math.asin(1 / vs)
      dashed(g, x, cy, x - Math.cos(half) * w, cy - Math.sin(half) * w, c.red)
      dashed(g, x, cy, x - Math.cos(half) * w, cy + Math.sin(half) * w, c.red)
    }
  },
}

let audio: AudioContext | null = null
function playBeats(f1: number, f2: number) {
  try {
    audio ??= new AudioContext()
    const ctx = audio
    const df = Math.abs(f1 - f2)
    for (const f of [440, 440 + df]) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = f
      g.gain.setValueAtTime(0, ctx.currentTime)
      g.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.05)
      g.gain.setValueAtTime(0.08, ctx.currentTime + 2.8)
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 3)
      o.connect(g).connect(ctx.destination)
      o.start()
      o.stop(ctx.currentTime + 3.1)
    }
  } catch {
    /* inget ljud */
  }
}

export const beats: AnimSpec = {
  aspect: 0.55,
  speed: 0.25,
  sliders: [
    { key: 'f1', label: 'Frekvens f₁', min: 5, max: 15, step: 0.5, value: 9, unit: 'Hz' },
    { key: 'f2', label: 'Frekvens f₂', min: 5, max: 15, step: 0.5, value: 11, unit: 'Hz' },
  ],
  readout: (p) => [`f_svävning = |f₁ − f₂| = ${fmt(Math.abs(n(p, 'f1') - n(p, 'f2')))} Hz`],
  extra: (p) =>
    createElement(
      'button',
      { className: 'anim-reset', onClick: () => playBeats(n(p, 'f1'), n(p, 'f2')), title: 'Spelar 440 Hz och en ton som skiljer lika mycket' },
      '♪ Lyssna',
    ),
  draw(g, p, t) {
    const { c, w, h } = g
    const f1 = n(p, 'f1')
    const f2 = n(p, 'f2')
    const span = 2
    const sy = (y: number, base: number, a: number) => base - y * a
    const rows: [number, string, (x: number) => number, number][] = [
      [h * 0.16, c.blue, (x) => Math.sin(2 * Math.PI * f1 * x), h * 0.1],
      [h * 0.38, c.green, (x) => Math.sin(2 * Math.PI * f2 * x), h * 0.1],
      [h * 0.72, c.fg, (x) => Math.sin(2 * Math.PI * f1 * x) + Math.sin(2 * Math.PI * f2 * x), h * 0.12],
    ]
    for (const [base, col, f, a] of rows) {
      const pts: [number, number][] = []
      for (let i = 0; i <= 600; i++) {
        const x = (span * i) / 600
        pts.push([20 + ((w - 40) * i) / 600, sy(f(x), base, a)])
      }
      line(g, pts, col, base > h * 0.6 ? 1.8 : 1.4)
    }
    // Amplituden varierar med svävningsfrekvensen.
    const df = Math.abs(f1 - f2)
    const env: [number, number][] = []
    for (let i = 0; i <= 300; i++) {
      const x = (span * i) / 300
      env.push([20 + ((w - 40) * i) / 300, sy(2 * Math.abs(Math.cos(Math.PI * df * x)), h * 0.72, h * 0.12)])
    }
    line(g, env, c.accent, 1.4, [5, 4])
    const cur = 20 + ((w - 40) * ((t % span) / span))
    dashed(g, cur, 10, cur, h - 20, c.faint)
    text(g, 'f₁', 4, h * 0.16 + 4, { color: c.blue, size: 12 })
    text(g, 'f₂', 4, h * 0.38 + 4, { color: c.green, size: 12 })
    text(g, 'summa', 20, h - 6, { color: c.dim, size: 11.5 })
  },
}

/** Ritar ett fält (t.ex. vågtoppar) pixel för pixel i låg upplösning och skalar upp. */
function field(g: G, res: number, value: (x: number, y: number) => number | null, color: [number, number, number]) {
  const W = Math.max(40, Math.round(g.w / res))
  const H = Math.max(30, Math.round(g.h / res))
  const img = g.ctx.createImageData(W, H)
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const v = value(((i + 0.5) / W) * g.w, ((j + 0.5) / H) * g.h)
      const k = (j * W + i) * 4
      if (v === null) continue
      img.data[k] = color[0]
      img.data[k + 1] = color[1]
      img.data[k + 2] = color[2]
      img.data[k + 3] = Math.round(Math.max(0, Math.min(1, v)) * 255)
    }
  }
  const off = document.createElement('canvas')
  off.width = W
  off.height = H
  off.getContext('2d')!.putImageData(img, 0, 0)
  g.ctx.imageSmoothingEnabled = true
  g.ctx.drawImage(off, 0, 0, g.w, g.h)
}

const BLUE: [number, number, number] = [79, 141, 255]

export const refraction: AnimSpec = {
  aspect: 0.6,
  speed: 1,
  sliders: [
    { key: 'i', label: 'Infallsvinkel i', min: 0, max: 70, step: 1, value: 40, unit: '°', digits: 0 },
    { key: 'v1', label: 'Hastighet v₁ (medium 1)', min: 0.5, max: 3, step: 0.1, value: 2, unit: 'm/s' },
    { key: 'v2', label: 'Hastighet v₂ (medium 2)', min: 0.5, max: 3, step: 0.1, value: 1, unit: 'm/s' },
  ],
  readout: (p) => {
    const s = (Math.sin((n(p, 'i') * Math.PI) / 180) * n(p, 'v2')) / n(p, 'v1')
    if (s > 1) return ['sin b blir större än 1 – vågen kan inte gå in i medium 2 (den reflekteras).']
    return [`sin i / sin b = v₁/v₂ ⇒ b = ${fmt((Math.asin(s) * 180) / Math.PI, 1)}°`, 'Frekvensen är densamma – våglängden ändras.']
  },
  draw(g, p, t) {
    const { c, w, h } = g
    const i = (n(p, 'i') * Math.PI) / 180
    const v1 = n(p, 'v1')
    const v2 = n(p, 'v2')
    const sb = (Math.sin(i) * v2) / v1
    const b = sb <= 1 ? Math.asin(sb) : null
    const yb = h * 0.5
    const lam1 = 46 * (v1 / 2)
    const k1 = (2 * Math.PI) / lam1
    const k2 = (2 * Math.PI) / (lam1 * (v2 / v1))
    const om = 2 * Math.PI * 0.6
    g.ctx.fillStyle = 'rgba(79, 141, 255, 0.10)'
    g.ctx.fillRect(0, yb, w, h - yb)
    field(g, 3, (x, y) => {
      let ph: number
      if (y < yb) ph = k1 * ((x - w / 2) * Math.sin(i) + (y - yb) * Math.cos(i))
      else if (b !== null) ph = k2 * ((x - w / 2) * Math.sin(b) + (y - yb) * Math.cos(b))
      else return null
      const v = Math.cos(ph - om * t)
      return v > 0.82 ? (v - 0.82) * 5 : 0
    }, BLUE)
    line(g, [
      [0, yb],
      [w, yb],
    ], c.fg, 1.5)
    dashed(g, w / 2, 10, w / 2, h - 10)
    const L = h * 0.42
    arrow(g, w / 2 - Math.sin(i) * L, yb - Math.cos(i) * L, w / 2, yb, c.accent, 2)
    if (b !== null) arrow(g, w / 2, yb, w / 2 + Math.sin(b) * L, yb + Math.cos(b) * L, c.accent, 2)
    text(g, 'i', w / 2 - 18, yb - 30, { color: c.accent, bold: true, italic: true })
    if (b !== null) text(g, 'b', w / 2 + 10, yb + 40, { color: c.accent, bold: true, italic: true })
    text(g, 'medium 1', 10, yb - 8, { color: c.dim, size: 12 })
    text(g, 'medium 2', 10, yb + 18, { color: c.dim, size: 12 })
  },
}

export const diffraction: AnimSpec = {
  aspect: 0.6,
  speed: 1,
  sliders: [{ key: 'a', label: 'Öppningens bredd (i våglängder)', min: 0.5, max: 6, step: 0.25, value: 1, unit: 'λ' }],
  readout: (p) => [n(p, 'a') <= 1.5 ? 'Smal öppning: vågen sprids ut i nästan en halvcirkel.' : 'Bred öppning: vågen fortsätter nästan rakt fram och sprids lite i kanterna.'],
  draw(g, p, t) {
    const { c, w, h } = g
    const lam = 26
    const k = (2 * Math.PI) / lam
    const om = 2 * Math.PI * 0.7
    const wx = w * 0.32
    const half = (n(p, 'a') * lam) / 2
    const cy = h / 2
    const srcs: number[] = []
    const N = Math.max(3, Math.round(n(p, 'a') * 4))
    for (let s = 0; s < N; s++) srcs.push(cy - half + (2 * half * (s + 0.5)) / N)
    field(g, 3, (x, y) => {
      if (x < wx) {
        const v = Math.cos(k * (x - wx) - om * t)
        return v > 0.82 ? (v - 0.82) * 5 : 0
      }
      let re = 0
      let im = 0
      for (const sy of srcs) {
        const r = Math.hypot(x - wx, y - sy)
        const ph = k * r - om * t
        re += Math.cos(ph) / Math.sqrt(r + 4)
        im += Math.sin(ph) / Math.sqrt(r + 4)
      }
      const v = re / (N / Math.sqrt(30))
      void im
      return v > 0.35 ? Math.min(1, (v - 0.35) * 2.2) : 0
    }, BLUE)
    g.ctx.fillStyle = c.fg
    g.ctx.fillRect(wx - 3, 0, 6, cy - half)
    g.ctx.fillRect(wx - 3, cy + half, 6, h - cy - half)
    text(g, 'Huygens: varje punkt i öppningen blir en ny vågkälla.', 10, h - 8, { color: c.dim, size: 11.5 })
  },
}

export const interference: AnimSpec = {
  aspect: 0.62,
  speed: 1,
  sliders: [
    { key: 'd', label: 'Avstånd mellan källorna', min: 1, max: 6, step: 0.25, value: 3, unit: 'λ' },
  ],
  choices: [
    {
      key: 'nodes',
      label: 'Nodlinjer',
      value: 'on',
      options: [
        { value: 'on', label: 'Visa nodlinjer' },
        { value: 'off', label: 'Dölj' },
      ],
    },
  ],
  readout: (p) => {
    const d = n(p, 'd')
    const k = Math.floor(d + 0.5 - 1e-9)
    return [`Nodlinjer där Δs = (k + ½) · λ: ${2 * k} st`, 'Centralmax: Δs = 0']
  },
  draw(g, p, t) {
    const { c, w, h } = g
    const lam = 30
    const k = (2 * Math.PI) / lam
    const om = 2 * Math.PI * 0.6
    const d = n(p, 'd') * lam
    const sx = 26
    const s1 = h / 2 - d / 2
    const s2 = h / 2 + d / 2
    const nodes = p.nodes === 'on'
    field(g, 3, (x, y) => {
      const r1 = Math.hypot(x - sx, y - s1)
      const r2 = Math.hypot(x - sx, y - s2)
      const v = (Math.cos(k * r1 - om * t) + Math.cos(k * r2 - om * t)) / 2
      return v > 0.3 ? (v - 0.3) * 1.6 : 0
    }, BLUE)
    if (nodes) {
      // Punkter där vägskillnaden är ett udda antal halva våglängder.
      g.ctx.fillStyle = c.red
      for (let y = 4; y < h; y += 4) {
        for (let x = sx + 8; x < w; x += 3) {
          const ds = Math.abs(Math.hypot(x - sx, y - s1) - Math.hypot(x - sx, y - s2)) / lam
          const frac = ds - Math.floor(ds)
          if (Math.abs(frac - 0.5) < 0.012) g.ctx.fillRect(x, y, 2, 2)
        }
      }
    }
    dashed(g, sx, h / 2, w, h / 2, c.accent)
    text(g, 'centralmax', w - 8, h / 2 - 6, { color: c.accent, size: 11.5, align: 'right' })
    dot(g, sx, s1, 6, c.fg)
    dot(g, sx, s2, 6, c.fg)
    text(g, 'A', sx - 16, s1 + 4, { color: c.fg, bold: true })
    text(g, 'B', sx - 16, s2 + 4, { color: c.fg, bold: true })
  },
}

export const earthquake: AnimSpec = {
  aspect: 0.55,
  speed: 1,
  sliders: [{ key: 'tempo', label: 'Tempo', min: 0.2, max: 1, step: 0.05, value: 0.6, unit: '×' }],
  readout: () => ['Primärvågen (P) är ungefär dubbelt så snabb som sekundärvågen (S).', 'Ju större tidsskillnad, desto längre bort är skalvet.'],
  draw(g, _p, t) {
    const { c, w, h } = g
    const hx = w * 0.42
    const hy = h * 0.55
    const stations: [number, number, string][] = [
      [w * 0.12, h * 0.2, '1'],
      [w * 0.82, h * 0.3, '2'],
      [w * 0.62, h * 0.88, '3'],
    ]
    const vp = w * 0.12
    const vs = vp / 2
    const tt = t % 9
    circle(g, hx, hy, vp * tt, c.accent, 2)
    circle(g, hx, hy, vs * tt, c.blue, 2)
    dot(g, hx, hy, 7, c.red)
    text(g, 'skalvet', hx + 10, hy + 4, { color: c.red, size: 12 })
    for (const [x, y, name] of stations) {
      const r = Math.hypot(x - hx, y - hy)
      const pIn = vp * tt >= r
      const sIn = vs * tt >= r
      g.ctx.fillStyle = sIn ? c.blue : pIn ? c.accent : c.dim
      g.ctx.fillRect(x - 7, y - 7, 14, 14)
      const label = `seismograf ${name}${pIn ? ` · P efter ${fmt(r / vp, 1)}` : ''}${sIn ? ` · S efter ${fmt(r / vs, 1)}` : ''}`
      text(g, label, x + (x > w * 0.6 ? -10 : 10), y - 12, { color: c.fg, size: 11.5, align: x > w * 0.6 ? 'right' : 'left' })
    }
    text(g, 'P', hx + vp * tt * 0.7, hy - vp * tt * 0.7, { color: c.accent, bold: true })
    text(g, 'S', hx + vs * tt * 0.7, hy - vs * tt * 0.7, { color: c.blue, bold: true })
  },
}
