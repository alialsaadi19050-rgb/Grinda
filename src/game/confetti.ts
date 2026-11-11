// Konfetti över hela skärmen. Ritas på en egen canvas som tas bort när den är klar.
import { getSettings } from '../settings/settings.ts'

const COLORS = ['#ff6a2b', '#ffd84a', '#7dea8c', '#7db0ff', '#ff8fc4', '#ffffff']

interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  rot: number
  spin: number
  color: string
  life: number
}

let running: { canvas: HTMLCanvasElement; pieces: Piece[] } | null = null

/** Skjuter konfetti från nederkanten. `power` 1 = lagom, 2 = mycket. */
export function fireConfetti(power = 1) {
  if (!getSettings().celebrate) return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const count = Math.round(90 * power)
  const W = innerWidth
  const H = innerHeight
  const make = (): Piece => {
    const left = Math.random() < 0.5
    const angle = (left ? -Math.PI / 3 : (-2 * Math.PI) / 3) + (Math.random() - 0.5) * 0.9
    const speed = (0.9 + Math.random() * 0.9) * Math.min(1100, H * 1.25)
    return {
      x: left ? W * 0.12 : W * 0.88,
      y: H + 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 14,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 0,
    }
  }
  const pieces = Array.from({ length: count }, make)
  if (running) {
    running.pieces.push(...pieces)
    return
  }
  const canvas = document.createElement('canvas')
  canvas.className = 'confetti'
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '9999' })
  const dpr = Math.min(devicePixelRatio || 1, 2)
  canvas.width = W * dpr
  canvas.height = H * dpr
  // Är en dialog öppen (t.ex. Inställningar) ligger den överst; då läggs konfettin i den så att den syns.
  ;(document.querySelector('dialog[open]') ?? document.body).append(canvas)
  const ctx = canvas.getContext('2d')!
  running = { canvas, pieces }
  let last = performance.now()
  const tick = (t: number) => {
    const dt = Math.min(0.04, (t - last) / 1000)
    last = t
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const live = running!.pieces
    for (const p of live) {
      p.life += dt
      p.vy += 1500 * dt
      p.vx *= 1 - 0.9 * dt
      p.vy *= 1 - 0.35 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.spin * dt
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.globalAlpha = Math.max(0, Math.min(1, 3.2 - p.life))
      ctx.fillStyle = p.color
      // Bredden ”vänder sig” som ett papper som snurrar.
      ctx.fillRect((-p.w / 2) * Math.cos(p.life * 9), -p.h / 2, p.w * Math.cos(p.life * 9), p.h)
      ctx.restore()
    }
    running!.pieces = live.filter((p) => p.life < 3.2 && p.y < H + 40)
    if (running!.pieces.length) requestAnimationFrame(tick)
    else {
      canvas.remove()
      running = null
    }
  }
  requestAnimationFrame(tick)
}
