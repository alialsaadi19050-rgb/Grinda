// Ramen runt varje animation: duk, start/paus/återställ, reglage och avläsningar.
// Själva rörelserna beskrivs i specs.ts som rena ritfunktioner.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AnimSpec, Colors, Params } from './types.ts'

function readColors(el: Element): Colors {
  const cs = getComputedStyle(el)
  const v = (n: string, fb: string) => cs.getPropertyValue(n).trim() || fb
  const fgRgb = v('--fg-rgb', '246, 238, 231')
  return {
    fg: v('--text', '#f6eee7'),
    dim: v('--text-dim', '#a8998d'),
    faint: `rgba(${fgRgb}, 0.18)`,
    grid: `rgba(${fgRgb}, 0.08)`,
    accent: v('--accent', '#ff6a2b'),
    accentSoft: `rgba(${v('--accent-rgb', '255, 106, 43')}, 0.18)`,
    blue: '#4f8dff',
    green: '#2fbf71',
    red: v('--danger', '#ff4d5e'),
    yellow: '#f5b301',
    fgRgb,
  }
}

export function AnimFrame({ spec, caption, options }: { spec: AnimSpec; caption: string; options?: Record<string, number | string | boolean> }) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const initial = useMemo<Params>(() => {
    const p: Params = {}
    for (const s of spec.sliders ?? []) p[s.key] = s.value
    for (const c of spec.choices ?? []) p[c.key] = c.value
    return { ...p, ...(options ?? {}) }
  }, [spec, options])
  const [params, setParams] = useState<Params>(initial)
  const [playing, setPlaying] = useState(false)
  const t = useRef(0)
  const state = useRef<unknown>(spec.init?.(initial))
  const size = useRef({ w: 600, h: 300 })
  const paramsRef = useRef(params)
  paramsRef.current = params
  const [, setTick] = useState(0)

  const draw = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const { w, h } = size.current
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    spec.draw({ ctx, w, h, c: readColors(c) }, paramsRef.current, t.current, state.current)
  }

  // Duken följer bredden på sidan.
  useEffect(() => {
    const el = wrap.current!
    const ro = new ResizeObserver(() => {
      const w = Math.max(260, el.clientWidth)
      const h = Math.round(Math.min(440, w * spec.aspect))
      size.current = { w, h }
      const c = canvas.current!
      const dpr = window.devicePixelRatio || 1
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      c.style.height = `${h}px`
      draw()
    })
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const real = Math.min(0.05, (now - last) / 1000)
      last = now
      const dt = real * (spec.speed ?? 1) * Number(paramsRef.current.tempo ?? 1)
      if (spec.step) {
        // Små steg ger en stabil simulering.
        const n = Math.max(1, Math.ceil(dt / 0.002))
        for (let i = 0; i < n; i++) spec.step(state.current, paramsRef.current, dt / n, t.current + (i * dt) / n)
      }
      t.current += dt
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, spec])

  // Rita om när ett reglage ändras medan animationen står still.
  useEffect(() => {
    if (!playing) draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const reset = () => {
    t.current = 0
    state.current = spec.init?.(paramsRef.current)
    setTick((n) => n + 1)
    draw()
  }

  const set = (key: string, value: number | string) => {
    const next = { ...paramsRef.current, [key]: value }
    paramsRef.current = next
    setParams(next)
    if (spec.resetOn?.includes(key)) reset()
  }

  const readout = spec.readout?.(params) ?? []

  return (
    <div className="anim">
      <div className="anim-stage" ref={wrap}>
        <canvas ref={canvas} role="img" aria-label={caption} />
      </div>
      <div className="anim-controls">
        <button className={`anim-play ${playing ? 'on' : ''}`} onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
          {playing ? '❚❚ Paus' : '▶ Start'}
        </button>
        <button className="anim-reset" onClick={reset}>
          ↺ Återställ
        </button>
        {spec.choices?.map((ch) => (
          <div key={ch.key} className="anim-choice" role="radiogroup" aria-label={ch.label}>
            {ch.options.map((o) => (
              <button key={o.value} role="radio" aria-checked={params[ch.key] === o.value} className={params[ch.key] === o.value ? 'on' : ''} onClick={() => set(ch.key, o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        ))}
        {spec.extra?.(params)}
      </div>
      {spec.sliders?.length ? (
        <div className="anim-sliders">
          {spec.sliders.map((s) => (
            <label key={s.key} className="anim-slider">
              <span>
                {s.label} <b>{Number(params[s.key]).toLocaleString('sv-SE', { maximumFractionDigits: s.digits ?? 2 })}{s.unit ? ` ${s.unit}` : ''}</b>
              </span>
              <input type="range" min={s.min} max={s.max} step={s.step} value={Number(params[s.key])} onChange={(e) => set(s.key, Number(e.target.value))} />
            </label>
          ))}
        </div>
      ) : null}
      {readout.length > 0 && (
        <p className="anim-readout">
          {readout.map((r, i) => (
            <span key={i}>{r}</span>
          ))}
        </p>
      )}
    </div>
  )
}
