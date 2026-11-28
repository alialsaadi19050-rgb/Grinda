// GeoGebra i ett flyttbart fönster. GeoGebra körs i en iframe (public/geogebra/index.html) och
// laddas bara första gången man öppnar fönstret. Sedan ligger det kvar när man byter uppgift,
// och det man ritat sparas per uppgift på enheten.
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { updateSettings, useSettings } from '../settings/settings.ts'
import type { GraphTask } from './graphTask.ts'
import './geogebra.css'

const STORE = 'grinda.geogebra'
const KEEP = 40

type Saved = Record<string, { xml: string; at: number }>
const readAll = (): Saved => {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Saved
  } catch {
    return {}
  }
}
const writeOne = (id: string, xml: string | null) => {
  const all = readAll()
  if (xml) all[id] = { xml, at: Date.now() }
  else delete all[id]
  // Behåll bara de senaste uppgifterna, så att lagringen inte växer för evigt.
  const keep = Object.entries(all)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, KEEP)
  try {
    localStorage.setItem(STORE, JSON.stringify(Object.fromEntries(keep)))
  } catch {
    /* fullt – det man ritat finns kvar så länge fönstret är öppet */
  }
}

const MIN_W = 320
const MIN_H = 300

export function GeoGebraWindow({ open, onClose, exerciseId, task }: { open: boolean; onClose: () => void; exerciseId: string; task: GraphTask }) {
  const settings = useSettings()
  const [mounted, setMounted] = useState(open)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [moving, setMoving] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const drag = useRef<{ kind: 'move' | 'size'; dx: number; dy: number } | null>(null)
  const loaded = useRef<string | null>(null)

  useEffect(() => {
    if (open) setMounted(true)
  }, [open])

  const send = (m: Record<string, unknown>) => frame.current?.contentWindow?.postMessage({ target: 'grinda-ggb', ...m }, location.origin)

  // Meddelanden från GeoGebra-sidan.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow || e.data?.source !== 'grinda-ggb') return
      const m = e.data as { type: string; id?: string; xml?: string | null }
      if (m.type === 'ready') {
        loaded.current = null
        setState('ready')
      } else if (m.type === 'error') setState('error')
      else if (m.type === 'save' && m.id) writeOne(m.id, m.xml ?? null)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Ladda uppgiftens graf (eller ett tomt fönster med rätt intervall) när GeoGebra är klart och när uppgiften byts.
  const view = task.view
  useEffect(() => {
    if (state !== 'ready' || loaded.current === exerciseId) return
    loaded.current = exerciseId
    send({ type: 'load', id: exerciseId, xml: readAll()[exerciseId]?.xml ?? null, view })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, exerciseId])

  // Spara direkt när fönstret stängs.
  useEffect(() => {
    if (!open && state === 'ready') send({ type: 'flush' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const [, rerender] = useState(0)
  useEffect(() => {
    const onResize = () => rerender((n) => n + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (!mounted) return null

  const vw = window.innerWidth
  const vh = window.innerHeight
  const saved = settings.geogebra
  const w = Math.max(Math.min(MIN_W, vw - 16), Math.min(saved?.w ?? 640, vw - 16))
  const h = Math.max(Math.min(MIN_H, vh - 16), Math.min(saved?.h ?? 500, vh - 16))
  const clampX = (x: number, width = w) => Math.max(8, Math.min(vw - width - 8, x))
  const clampY = (y: number, height = h) => Math.max(8, Math.min(vh - height - 8, y))
  const x = clampX(saved?.x ?? vw - w - 24)
  const y = clampY(saved?.y ?? 76)

  const start = (kind: 'move' | 'size') => (e: PointerEvent) => {
    if (kind === 'move' && (e.target as HTMLElement).closest('button')) return
    const r = panel.current!.getBoundingClientRect()
    drag.current = kind === 'move' ? { kind, dx: e.clientX - r.left, dy: e.clientY - r.top } : { kind, dx: r.right - e.clientX, dy: r.bottom - e.clientY }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setMoving(true)
  }
  const move = (e: PointerEvent) => {
    const d = drag.current
    const el = panel.current
    if (!d || !el) return
    if (d.kind === 'move') {
      el.style.left = `${clampX(e.clientX - d.dx, el.offsetWidth)}px`
      el.style.top = `${clampY(e.clientY - d.dy, el.offsetHeight)}px`
    } else {
      const r = el.getBoundingClientRect()
      el.style.width = `${Math.max(MIN_W, Math.min(vw - r.left - 8, e.clientX + d.dx - r.left))}px`
      el.style.height = `${Math.max(MIN_H, Math.min(vh - r.top - 8, e.clientY + d.dy - r.top))}px`
    }
  }
  const end = () => {
    if (!drag.current || !panel.current) return
    drag.current = null
    setMoving(false)
    const r = panel.current.getBoundingClientRect()
    updateSettings({ geogebra: { x: r.left, y: r.top, w: r.width, h: r.height } })
  }

  return (
    <div
      ref={panel}
      className={`ggb-win ${moving ? 'moving' : ''}`}
      role="dialog"
      aria-label="GeoGebra"
      hidden={!open}
      style={{ left: x, top: y, width: w, height: h }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      <header className="ggb-head" onPointerDown={start('move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        <b>GeoGebra</b>
        <span className="ggb-tip">
          {task.degrees ? (
            <>
              Grader: skriv <code>°</code> efter x (Alt+O), t.ex. <code>y = sin(2x°)</code>.
            </>
          ) : (
            <>
              Skriv t.ex. <code>y = 2sin(x)</code>.
            </>
          )}{' '}
          Vågrät linje: <code>y = 0.5</code>. Decimalpunkt, inte komma. Klicka på en skärningspunkt för att se den.
        </span>
        <button
          className="ggb-btn"
          onClick={() => send({ type: 'reset', view })}
          disabled={state !== 'ready'}
          title="Ta bort allt du ritat i den här uppgiften"
        >
          Rensa
        </button>
        <button className="calc-close" onClick={onClose} aria-label="Stäng GeoGebra" title="Stäng (Esc)">
          ×
        </button>
      </header>
      <div className="ggb-body">
        <iframe ref={frame} src={`${import.meta.env.BASE_URL}geogebra/index.html`} title="GeoGebra grafritare" allow="clipboard-write; fullscreen" />
      </div>
      <div className="ggb-resize" onPointerDown={start('size')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} aria-hidden="true" title="Dra för att ändra storlek" />
    </div>
  )
}
