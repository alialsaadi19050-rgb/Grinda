// Tema som byggs av några få val (läge, accentfärg, bakgrundston, mjukhet).
// Alla övriga färger räknas fram i OKLCH så att kontrasten alltid håller.

/** Vilket läge som visas. */
export type Mode = 'dark' | 'light'
/** Vad du valt: ljust, mörkt eller samma som enheten (auto). */
export type ModeChoice = Mode | 'auto'

export interface ThemeSettings {
  mode: ModeChoice
  /** Accentfärg som hex, t.ex. "#ff6a2b". */
  accent: string
  /** Bakgrundens färgton i grader, 0–360. */
  bgHue: number
  /** Hur färgad bakgrunden är, 0–1. */
  bgTint: number
  /** Mörkt läge: hur djupt svart. Ljust läge: hur mjukt vitt. 0–1. */
  softness: number
}

export const PRESETS: { id: string; name: string; settings: Omit<ThemeSettings, 'mode' | 'softness'> }[] = [
  { id: 'glod', name: 'Glöd', settings: { accent: '#ff6a2b', bgHue: 45, bgTint: 0.35 } },
  { id: 'neon', name: 'Neon', settings: { accent: '#ff2e88', bgHue: 295, bgTint: 0.45 } },
  { id: 'syra', name: 'Syra', settings: { accent: '#b6ff3b', bgHue: 150, bgTint: 0.35 } },
  { id: 'hav', name: 'Hav', settings: { accent: '#2bb6ff', bgHue: 235, bgTint: 0.4 } },
  { id: 'lavendel', name: 'Lavendel', settings: { accent: '#a78bfa', bgHue: 280, bgTint: 0.3 } },
  { id: 'guld', name: 'Guld', settings: { accent: '#f5c542', bgHue: 70, bgTint: 0.25 } },
  { id: 'koral', name: 'Korall', settings: { accent: '#ff5d73', bgHue: 15, bgTint: 0.3 } },
  { id: 'grafit', name: 'Grafit', settings: { accent: '#e9e7e2', bgHue: 60, bgTint: 0 } },
]

export const DEFAULT_THEME: ThemeSettings = { mode: 'auto', ...PRESETS[0].settings, softness: 0.5 }

/** Läget som faktiskt visas: auto följer enhetens inställning. */
export const resolveMode = (m: ModeChoice): Mode => (m === 'auto' ? (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : m)

/* ---------- Färgmatematik: sRGB ↔ OKLCH ---------- */

type RGB = [number, number, number]
type LCH = [number, number, number]

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

export function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return [1, 0.5, 0.2]
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

function rgbToOklch([r, g, b]: RGB): LCH {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)]
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return [L, Math.hypot(a, bb), ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360]
}

function oklchToRgbRaw([L, C, H]: LCH): RGB {
  const a = C * Math.cos((H * Math.PI) / 180)
  const b = C * Math.sin((H * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

const inGamut = (rgb: RGB) => rgb.every((v) => v >= -0.0005 && v <= 1.0005)

/** OKLCH → sRGB, med kromat sänkt tills färgen går att visa. */
export function oklch(L: number, C: number, H: number): RGB {
  let c = C
  let rgb = oklchToRgbRaw([L, c, H])
  while (!inGamut(rgb) && c > 0) {
    c = Math.max(0, c - 0.005)
    rgb = oklchToRgbRaw([L, c, H])
  }
  return rgb.map((v) => Math.min(1, Math.max(0, v))) as RGB
}

function luminance([r, g, b]: RGB) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

export function contrast(a: RGB, b: RGB) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** Ändrar ljusheten tills kontrasten mot bakgrunden räcker. */
function ensureContrast(color: LCH, bg: RGB, min: number, direction: 1 | -1): RGB {
  let [L, C, H] = color
  let rgb = oklch(L, C, H)
  for (let i = 0; i < 60 && contrast(rgb, bg) < min; i++) {
    L = Math.min(0.99, Math.max(0.05, L + direction * 0.01))
    rgb = oklch(L, C, H)
  }
  return rgb
}

const rgbList = (c: RGB) => c.map((v) => Math.round(v * 255)).join(', ')

/* ---------- Bygg alla CSS-variabler ---------- */

export function buildTheme(t: ThemeSettings): Record<string, string> {
  const accentRgb = hexToRgb(t.accent)
  const [aL, aC, aH] = rgbToOklch(accentRgb)
  const dark = resolveMode(t.mode) === 'dark'
  const H = t.bgHue
  const tint = 0.004 + t.bgTint * 0.022

  // De två lägena är var sitt eget tema, inte varandras spegelbild.
  // Ljust: varmt papper som bakgrund, vita kort med mjuka skuggor.
  // Mörkt: mjuk grafit (inte svart), kort som är lite ljusare än bakgrunden.
  const baseL = dark ? 0.215 + t.softness * 0.05 : 0.975 - t.softness * 0.03
  const bg = oklch(baseL, dark ? tint * 0.9 : tint * 1.4, H)
  const surface = dark ? oklch(baseL + 0.045, tint * 0.8, H) : oklch(Math.min(1, baseL + 0.03), tint * 0.25, H)
  const surface2 = dark ? oklch(baseL + 0.085, tint * 0.8, H) : oklch(baseL - 0.028, tint * 1.6, H)
  const raised = dark ? oklch(baseL + 0.06, tint * 0.8, H) : oklch(1, 0, H)
  const sunken = dark ? oklch(baseL - 0.03, tint, H) : oklch(baseL - 0.045, tint * 1.6, H)
  const line = dark ? oklch(baseL + 0.11, tint, H) : oklch(baseL - 0.09, tint * 1.6, H)
  // Kontrasten mäts mot den svåraste ytan: kortet i mörkt läge (ljusare), bakgrunden i ljust (mörkare).
  const hardest = dark ? surface : bg
  const text = ensureContrast(dark ? [0.95, 0.01, H] : [0.26, Math.min(0.025, tint * 1.4), H], hardest, 8, dark ? 1 : -1)
  const dim = ensureContrast(dark ? [0.76, 0.015, H] : [0.5, Math.min(0.03, tint * 1.6), H], hardest, 4.7, dark ? 1 : -1)
  const tint1 = dark ? oklch(baseL + 0.05, Math.min(0.08, aC * 0.35), aH) : oklch(0.95, Math.min(0.05, aC * 0.3), aH)
  const tint2 = dark ? oklch(baseL + 0.025, tint * 2, (H + 40) % 360) : oklch(0.96, 0.025, (H + 40) % 360)

  // Accenten fylls som du valt. Text i accentfärg justeras för läsbarhet.
  const accentText = ensureContrast([aL, aC, aH], hardest, 4.6, dark ? 1 : -1)
  const accent2 = oklch(dark ? Math.max(0.74, aL) : Math.min(0.62, aL), Math.max(0.1, aC * 0.85), (aH + 40) % 360)
  const ink: RGB = contrast(accentRgb, [0, 0, 0]) >= contrast(accentRgb, [1, 1, 1]) ? oklch(0.2, 0.04, aH) : [1, 1, 1]
  const danger = dark ? oklch(0.7, 0.17, 20) : oklch(0.57, 0.19, 22)
  const dangerText = ensureContrast([dark ? 0.84 : 0.47, 0.09, 20], hardest, 4.6, dark ? 1 : -1)
  const ok = dark ? oklch(0.78, 0.15, 150) : oklch(0.55, 0.14, 150)
  const heroTop = dark ? text : oklch(Math.min(0.5, aL), Math.min(0.2, aC), aH)
  const shadowRgb = dark ? '0, 0, 0' : rgbList(oklch(0.3, 0.03, H))

  return {
    '--bg': rgbToHex(bg),
    '--bg-raised': rgbToHex(raised),
    '--bg-sunken': rgbToHex(sunken),
    '--bg-tint-1': rgbToHex(tint1),
    '--bg-tint-2': rgbToHex(tint2),
    '--surface': rgbToHex(surface),
    '--surface-2': rgbToHex(surface2),
    '--surface-shadow': dark
      ? `inset 0 0 0 1px rgba(255, 255, 255, 0.06), 0 10px 30px -18px rgba(0, 0, 0, 0.7)`
      : `0 0 0 1px rgba(${shadowRgb}, 0.07), 0 1px 2px rgba(${shadowRgb}, 0.05), 0 8px 24px -14px rgba(${shadowRgb}, 0.2)`,
    '--surface-shadow-hover': dark
      ? `inset 0 0 0 1px rgba(255, 255, 255, 0.1), 0 16px 40px -18px rgba(0, 0, 0, 0.8)`
      : `0 0 0 1px rgba(${shadowRgb}, 0.09), 0 2px 4px rgba(${shadowRgb}, 0.05), 0 16px 36px -16px rgba(${shadowRgb}, 0.26)`,
    '--shadow-rgb': shadowRgb,
    '--line': rgbToHex(line),
    '--text': rgbToHex(text),
    '--text-dim': rgbToHex(dim),
    '--fg-rgb': rgbList(text),
    '--scrim-rgb': rgbList(bg),
    '--glass-rgb': rgbList(surface),
    '--accent': t.accent,
    '--accent-rgb': rgbList(accentRgb),
    '--accent-text': rgbToHex(accentText),
    '--accent-2': rgbToHex(accent2),
    '--accent-ink': rgbToHex(ink),
    '--accent-soft': `rgba(${rgbList(accentRgb)}, ${dark ? 0.16 : 0.11})`,
    '--hero-num-top': rgbToHex(heroTop),
    '--danger': rgbToHex(danger),
    '--danger-rgb': rgbList(danger),
    '--danger-text': rgbToHex(dangerText),
    '--ok': rgbToHex(ok),
    '--ok-rgb': rgbList(ok),
  }
}

/* ---------- Spara och använda ---------- */

const KEY = 'matte.theme.v2'

export function loadTheme(): ThemeSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_THEME, ...JSON.parse(raw) }
  } catch {
    /* ingen lagring tillgänglig */
  }
  return DEFAULT_THEME
}

export function saveTheme(t: ThemeSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(t))
  } catch {
    /* temat gäller då bara den här sessionen */
  }
}

let followSystem: (() => void) | null = null

export function applyTheme(t: ThemeSettings, root: HTMLElement = document.documentElement) {
  const mode = resolveMode(t.mode)
  root.dataset.theme = mode
  const vars = buildTheme(t)
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', vars['--bg'])
  // Auto: byt när enheten byter mellan ljust och mörkt.
  if (typeof matchMedia === 'function') {
    const mq = matchMedia('(prefers-color-scheme: light)')
    if (followSystem) mq.removeEventListener('change', followSystem)
    followSystem = null
    if (t.mode === 'auto') {
      followSystem = () => applyTheme(t, root)
      mq.addEventListener('change', followSystem)
    }
  }
}
