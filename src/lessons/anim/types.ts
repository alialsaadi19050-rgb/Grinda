import type { ReactNode } from 'react'

export type Params = Record<string, number | string | boolean>

export interface Colors {
  fg: string
  dim: string
  faint: string
  grid: string
  accent: string
  accentSoft: string
  blue: string
  green: string
  red: string
  yellow: string
  fgRgb: string
}

export interface G {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
  c: Colors
}

export interface Slider {
  key: string
  label: string
  min: number
  max: number
  step: number
  value: number
  unit?: string
  digits?: number
}

export interface Choice {
  key: string
  label: string
  options: { value: string; label: string }[]
  value: string
}

export interface AnimSpec {
  /** Höjd / bredd. */
  aspect: number
  sliders?: Slider[]
  choices?: Choice[]
  /** Hur fort animationens tid går jämfört med verklig tid. */
  speed?: number
  /** Reglage som startar om simuleringen när de ändras. */
  resetOn?: string[]
  readout?: (p: Params) => string[]
  /** Startläge för animationer som simuleras steg för steg. */
  init?: (p: Params) => unknown
  step?: (state: unknown, p: Params, dt: number, t: number) => void
  draw: (g: G, p: Params, t: number, state: unknown) => void
  /** Fler kontroller, t.ex. en knapp för att lyssna. */
  extra?: (p: Params) => ReactNode
}
