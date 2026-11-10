// ”Nya siffror”: egna övningsuppgifter där talen slumpas fram, så att du kan öva på samma
// sorts uppgift hur många gånger som helst. Uppgifterna är inte bokens – de är skrivna för
// appen och hör ihop med bokens delområden.
import type { Answer } from '../content/types.ts'
import type { Subject } from '../subject/subject.ts'

export interface Generated {
  prompt: string
  answer: Answer
  facit: string
  solution: string
}

export interface Generator {
  id: string
  subject: Subject
  /** Samma delområde som bokens uppgifter (Exercise.topic). */
  topic: string
  make: (r: Rng) => Generated
}

/* ---------- Slump med frö, så att samma länk ger samma uppgift ---------- */

export interface Rng {
  /** Tal i [0, 1). */
  (): number
  int: (from: number, to: number) => number
  pick: <T>(list: readonly T[]) => T
}

export function rng(seed: number): Rng {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const r = next as Rng
  r.int = (from, to) => from + Math.floor(next() * (to - from + 1))
  r.pick = (list) => list[Math.floor(next() * list.length)]
  return r
}

/* ---------- Hjälpare ---------- */

/** Tal med svenskt decimalkomma och `sig` värdesiffror, utan onödiga nollor. */
export function num(x: number, sig = 3): string {
  if (x === 0) return '0'
  const abs = Math.abs(x)
  if (abs >= 1e5 || abs < 1e-3) {
    const exp = Math.floor(Math.log10(abs))
    const m = Number((x / 10 ** exp).toPrecision(sig))
    return `${String(m).replace('.', ',')} · 10^${exp}`
  }
  return String(Number(x.toPrecision(sig))).replace('.', ',')
}
/** Samma tal för KaTeX. */
const tex = (x: number, sig = 3) => num(x, sig).replace(',', '{,}').replace(/ · 10\^(-?\d+)/, ' \\cdot 10^{$1}')
const texUnit = (u: string) => `\\ \\text{${u.replace(/\^(-?\d+)/g, (_, e: string) => ({ '2': '²', '3': '³', '-1': '⁻¹' })[e] ?? `^${e}`)}}`

/** Fysiksvar: tal + enhet, 2 % tolerans. */
function q(value: number, unit: string, tol?: number): { answer: Answer; facit: string } {
  return { answer: { type: 'number', value: String(Number(value.toPrecision(8))), unit, ...(tol ? { tol } : {}) }, facit: `$${tex(value)}${texUnit(unit)}$` }
}
/** Heltalssvar. */
const whole = (value: number, expr = String(value)): { answer: Answer; facit: string } => ({ answer: { type: 'number', value: expr }, facit: `$${value.toLocaleString('sv-SE').replace(/\u00a0/g, '\\,')}$` })

const G = 9.82
const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1))
const comb = (n: number, k: number) => Math.round(fact(n) / (fact(k) * fact(n - k)))

/* ---------- Fysik 2: mekaniska vågor ---------- */

const fysik: Generator[] = [
  {
    id: 'fjadrar',
    subject: 'fysik',
    topic: 'Fjädrar',
    make: (r) => {
      const kind = r.int(0, 2)
      if (kind === 0) {
        const m = r.pick([50, 100, 150, 200, 250, 400, 500])
        const dl = r.pick([2.5, 3.2, 4.0, 5.5, 6.4, 8.0, 12])
        const k = ((m / 1000) * G) / (dl / 100)
        return {
          prompt: `En vikt på ${m} g hängs i en fjäder. Fjädern förlängs då ${num(dl)} cm. Bestäm fjäderkonstanten.`,
          ...q(k, 'N/m'),
          solution: `Vikten hänger stilla, så fjäderkraften är lika stor som tyngden: $k \\cdot \\Delta l = mg$.\n\n$$k = \\frac{mg}{\\Delta l} = \\frac{${tex(m / 1000)} \\cdot 9{,}82}{${tex(dl / 100)}}\\ \\text{N/m} = ${tex(k)}\\ \\text{N/m}$$`,
        }
      }
      if (kind === 1) {
        const k = r.pick([35, 60, 85, 120, 250, 400])
        const x = r.pick([2.0, 3.5, 5.0, 7.5, 12, 15])
        const F = k * (x / 100)
        return {
          prompt: `En fjäder har fjäderkonstanten ${k} N/m. Hur stor kraft behövs för att förlänga den ${num(x)} cm?`,
          ...q(F, 'N'),
          solution: `Hookes lag: $F = k \\cdot \\Delta l$.\n\n$$F = ${k} \\cdot ${tex(x / 100)}\\ \\text{N} = ${tex(F)}\\ \\text{N}$$`,
        }
      }
      const k = r.pick([80, 150, 240, 600, 1200])
      const x = r.pick([3.0, 4.5, 6.0, 8.0, 10, 15])
      const E = (k * (x / 100) ** 2) / 2
      return {
        prompt: `En fjäder med fjäderkonstanten ${k} N/m trycks ihop ${num(x)} cm. Hur mycket energi lagras i fjädern?`,
        ...q(E, 'J'),
        solution: `Energin i en fjäder är $E = \\dfrac{k \\cdot (\\Delta l)^2}{2}$.\n\n$$E = \\frac{${k} \\cdot ${tex(x / 100)}^2}{2}\\ \\text{J} = ${tex(E)}\\ \\text{J}$$`,
      }
    },
  },
  {
    id: 'harmoniska',
    subject: 'fysik',
    topic: 'Harmoniska svängningar',
    make: (r) => {
      const kind = r.int(0, 2)
      if (kind === 0) {
        const m = r.pick([0.1, 0.15, 0.25, 0.4, 0.5, 0.8, 1.2])
        const k = r.pick([12, 20, 35, 50, 80, 140])
        const T = 2 * Math.PI * Math.sqrt(m / k)
        return {
          prompt: `En vikt på ${num(m)} kg hänger i en fjäder med fjäderkonstanten ${k} N/m och svänger upp och ner. Bestäm svängningstiden.`,
          ...q(T, 's'),
          solution: `$$T = 2\\pi\\sqrt{\\frac{m}{k}} = 2\\pi\\sqrt{\\frac{${tex(m)}}{${k}}}\\ \\text{s} = ${tex(T)}\\ \\text{s}$$`,
        }
      }
      const A = r.pick([2.0, 3.5, 4.0, 6.0, 8.5, 12])
      const T = r.pick([0.4, 0.5, 0.8, 1.2, 1.5, 2.0])
      const w = (2 * Math.PI) / T
      if (kind === 1) {
        const v = w * (A / 100)
        return {
          prompt: `En vikt svänger harmoniskt med amplituden ${num(A)} cm och svängningstiden ${num(T)} s. Bestäm viktens största hastighet.`,
          ...q(v, 'm/s'),
          solution: `Vinkelhastigheten är $\\omega = \\dfrac{2\\pi}{T} = ${tex(w)}\\ \\text{rad/s}$.\n\n$$v_{max} = \\omega A = ${tex(w)} \\cdot ${tex(A / 100)}\\ \\text{m/s} = ${tex(v)}\\ \\text{m/s}$$`,
        }
      }
      const a = w * w * (A / 100)
      return {
        prompt: `En vikt svänger harmoniskt med amplituden ${num(A)} cm och svängningstiden ${num(T)} s. Bestäm viktens största acceleration.`,
        ...q(a, 'm/s^2'),
        solution: `Vinkelhastigheten är $\\omega = \\dfrac{2\\pi}{T} = ${tex(w)}\\ \\text{rad/s}$.\n\n$$a_{max} = \\omega^2 A = ${tex(w)}^2 \\cdot ${tex(A / 100)}\\ \\text{m/s}^2 = ${tex(a)}\\ \\text{m/s}^2$$`,
      }
    },
  },
  {
    id: 'pendlar',
    subject: 'fysik',
    topic: 'Pendlar',
    make: (r) => {
      if (r.int(0, 1)) {
        const l = r.pick([0.25, 0.4, 0.6, 0.85, 1.2, 1.8, 2.5, 4.0])
        const T = 2 * Math.PI * Math.sqrt(l / G)
        return {
          prompt: `En pendel är ${num(l)} m lång. Bestäm svängningstiden.`,
          ...q(T, 's'),
          solution: `$$T = 2\\pi\\sqrt{\\frac{l}{g}} = 2\\pi\\sqrt{\\frac{${tex(l)}}{9{,}82}}\\ \\text{s} = ${tex(T)}\\ \\text{s}$$`,
        }
      }
      const T = r.pick([1.0, 1.4, 1.8, 2.0, 2.6, 3.2, 4.5])
      const l = (T * T * G) / (4 * Math.PI ** 2)
      return {
        prompt: `Hur lång ska en pendel vara för att svängningstiden ska bli ${num(T)} s?`,
        ...q(l, 'm'),
        solution: `Lös ut $l$ ur $T = 2\\pi\\sqrt{\\dfrac{l}{g}}$:\n\n$$l = \\frac{T^2 g}{4\\pi^2} = \\frac{${tex(T)}^2 \\cdot 9{,}82}{4\\pi^2}\\ \\text{m} = ${tex(l)}\\ \\text{m}$$`,
      }
    },
  },
  {
    id: 'fortskridande',
    subject: 'fysik',
    topic: 'Fortskridande vågor',
    make: (r) => {
      const kind = r.int(0, 2)
      if (kind === 0) {
        const f = r.pick([2.5, 4.0, 12, 50, 120, 440])
        const lam = r.pick([0.15, 0.4, 0.75, 1.2, 2.5])
        return {
          prompt: `En våg har frekvensen ${num(f)} Hz och våglängden ${num(lam)} m. Med vilken hastighet utbreder den sig?`,
          ...q(f * lam, 'm/s'),
          solution: `$$v = f \\cdot \\lambda = ${tex(f)} \\cdot ${tex(lam)}\\ \\text{m/s} = ${tex(f * lam)}\\ \\text{m/s}$$`,
        }
      }
      if (kind === 1) {
        const T = r.pick([0.02, 0.05, 0.25, 0.4, 0.8, 2.5])
        return {
          prompt: `En våg har periodtiden ${num(T)} s. Vilken frekvens har den?`,
          ...q(1 / T, 'Hz'),
          solution: `$$f = \\frac{1}{T} = \\frac{1}{${tex(T)}}\\ \\text{Hz} = ${tex(1 / T)}\\ \\text{Hz}$$`,
        }
      }
      const v = r.pick([340, 1500, 12, 3.5, 60])
      const f = r.pick([4.0, 25, 80, 250, 1000])
      return {
        prompt: `En våg utbreder sig med hastigheten ${num(v)} m/s och har frekvensen ${num(f)} Hz. Bestäm våglängden.`,
        ...q(v / f, 'm'),
        solution: `$$\\lambda = \\frac{v}{f} = \\frac{${tex(v)}}{${tex(f)}}\\ \\text{m} = ${tex(v / f)}\\ \\text{m}$$`,
      }
    },
  },
  {
    id: 'staende',
    subject: 'fysik',
    topic: 'Stående vågor i strängar',
    make: (r) => {
      const l = r.pick([0.33, 0.5, 0.65, 0.8, 1.2])
      const v = r.pick([120, 185, 240, 310, 420])
      const n = r.int(1, 4)
      const name = ['grundtonen', 'första övertonen', 'andra övertonen', 'tredje övertonen'][n - 1]
      if (r.int(0, 1)) {
        const f = (n * v) / (2 * l)
        return {
          prompt: `En sträng är ${num(l)} m lång. Vågorna utbreder sig med ${v} m/s längs strängen. Vilken frekvens har ${name}?`,
          ...q(f, 'Hz'),
          solution: `För ${name} är $n = ${n}$, så $l = ${n} \\cdot \\dfrac{\\lambda}{2}$ och $\\lambda = \\dfrac{2l}{${n}} = ${tex((2 * l) / n)}\\ \\text{m}$.\n\n$$f = \\frac{v}{\\lambda} = \\frac{${v}}{${tex((2 * l) / n)}}\\ \\text{Hz} = ${tex(f)}\\ \\text{Hz}$$`,
        }
      }
      return {
        prompt: `En sträng är ${num(l)} m lång och sitter fast i båda ändarna. Vilken våglängd har ${name}?`,
        ...q((2 * l) / n, 'm'),
        solution: `För ${name} är $n = ${n}$ i $l = n \\cdot \\dfrac{\\lambda}{2}$.\n\n$$\\lambda = \\frac{2l}{n} = \\frac{2 \\cdot ${tex(l)}}{${n}}\\ \\text{m} = ${tex((2 * l) / n)}\\ \\text{m}$$`,
      }
    },
  },
  {
    id: 'pipor',
    subject: 'fysik',
    topic: 'Ljud och pipor',
    make: (r) => {
      const kind = r.int(0, 2)
      if (kind === 2) {
        const t = r.pick([-15, -5, 0, 10, 20, 30])
        const v = 331.4 * Math.sqrt((273 + t) / 273)
        return {
          prompt: `Bestäm ljudets hastighet i luft när temperaturen är ${t === 0 ? '0' : String(t).replace('-', '−')} °C.`,
          ...q(v, 'm/s', 0.01),
          solution: `Temperaturen i kelvin är $T = ${273 + t}\\ \\text{K}$.\n\n$$v = 331{,}4 \\cdot \\sqrt{\\frac{T}{273}} = 331{,}4 \\cdot \\sqrt{\\frac{${273 + t}}{273}}\\ \\text{m/s} = ${tex(v)}\\ \\text{m/s}$$`,
        }
      }
      const l = r.pick([0.17, 0.25, 0.34, 0.5, 0.85, 1.7, 2.45])
      if (kind === 0) {
        const f = 340 / (2 * l)
        return {
          prompt: `En pipa som är öppen i båda ändarna är ${num(l)} m lång. Vilken frekvens har grundtonen? Räkna med ljudhastigheten 340 m/s.`,
          ...q(f, 'Hz'),
          solution: `I en öppen pipa är $l = \\dfrac{\\lambda}{2}$ för grundtonen, så $\\lambda = 2l = ${tex(2 * l)}\\ \\text{m}$.\n\n$$f = \\frac{v}{\\lambda} = \\frac{340}{${tex(2 * l)}}\\ \\text{Hz} = ${tex(f)}\\ \\text{Hz}$$`,
        }
      }
      const f = 340 / (4 * l)
      return {
        prompt: `En halvöppen pipa är ${num(l)} m lång. Vilken frekvens har grundtonen? Räkna med ljudhastigheten 340 m/s.`,
        ...q(f, 'Hz'),
        solution: `I en halvöppen pipa är $l = \\dfrac{\\lambda}{4}$ för grundtonen, så $\\lambda = 4l = ${tex(4 * l)}\\ \\text{m}$.\n\n$$f = \\frac{v}{\\lambda} = \\frac{340}{${tex(4 * l)}}\\ \\text{Hz} = ${tex(f)}\\ \\text{Hz}$$`,
      }
    },
  },
  {
    id: 'ljudstyrka',
    subject: 'fysik',
    topic: 'Ljudstyrka',
    make: (r) => {
      const kind = r.int(0, 2)
      if (kind === 0) {
        const m = r.pick([1, 2, 3.2, 5, 6.3, 8])
        const e = r.int(-9, -3)
        const I = m * 10 ** e
        const L = 10 * Math.log10(I / 1e-12)
        return {
          prompt: `Ljudintensiteten på en plats är $${tex(I, 2)}\\ \\text{W/m}^2$. Vilken ljudnivå motsvarar det?`,
          ...q(L, 'dB', 0.012),
          solution: `$$L = 10 \\cdot \\lg\\left(\\frac{I}{10^{-12}}\\right) = 10 \\cdot \\lg\\left(\\frac{${tex(I, 2)}}{10^{-12}}\\right) = ${tex(L)}\\ \\text{dB}$$`,
        }
      }
      if (kind === 1) {
        const P = r.pick([0.5, 2.0, 15, 40, 100])
        const d = r.pick([2.0, 3.5, 5.0, 8.0, 12, 25])
        const I = P / (4 * Math.PI * d * d)
        return {
          prompt: `En högtalare sänder ut ljud med effekten ${num(P)} W åt alla håll. Hur stor är ljudintensiteten ${num(d)} m från högtalaren?`,
          ...q(I, 'W/m^2', 0.03),
          solution: `Ljudet sprids över en sfär med arean $A = 4\\pi r^2$.\n\n$$I = \\frac{P}{A} = \\frac{${tex(P)}}{4\\pi \\cdot ${tex(d)}^2}\\ \\text{W/m}^2 = ${tex(I)}\\ \\text{W/m}^2$$`,
        }
      }
      const L = r.pick([35, 48, 60, 72, 85, 96, 110])
      const I = 1e-12 * 10 ** (L / 10)
      return {
        prompt: `Ljudnivån vid en väg är ${L} dB. Hur stor är ljudintensiteten?`,
        ...q(I, 'W/m^2', 0.06),
        solution: `Lös ut $I$ ur $L = 10 \\cdot \\lg\\left(\\dfrac{I}{10^{-12}}\\right)$:\n\n$$I = 10^{-12} \\cdot 10^{L/10} = 10^{-12} \\cdot 10^{${tex(L / 10)}}\\ \\text{W/m}^2 = ${tex(I, 2)}\\ \\text{W/m}^2$$`,
      }
    },
  },
  {
    id: 'doppler',
    subject: 'fysik',
    topic: 'Dopplereffekt',
    make: (r) => {
      const f = r.pick([400, 520, 680, 850, 1000, 1200])
      const v = r.pick([12, 18, 25, 30, 40])
      const toward = r.int(0, 1) === 1
      const fm = (f * 340) / (340 - (toward ? v : -v))
      return {
        prompt: `En ambulans med en siren på ${f} Hz kör med ${v} m/s rakt ${toward ? 'mot' : 'bort från'} dig. Du står stilla. Vilken frekvens hör du? Räkna med ljudhastigheten 340 m/s.`,
        ...q(fm, 'Hz', 0.01),
        solution: `Du står stilla, så $v_m = 0$. Sändaren rör sig ${toward ? 'mot dig, så $v_s$ är positiv' : 'bort från dig, så $v_s$ är negativ'}.\n\n$$f_m = f_s \\cdot \\frac{v_{ljud} + v_m}{v_{ljud} - v_s} = ${f} \\cdot \\frac{340}{340 ${toward ? '-' : '+'} ${v}}\\ \\text{Hz} = ${tex(fm)}\\ \\text{Hz}$$`,
      }
    },
  },
  {
    id: 'svavningar',
    subject: 'fysik',
    topic: 'Svävningar',
    make: (r) => {
      const f1 = r.pick([220, 256, 330, 440, 523])
      const d = r.int(1, 8)
      const f2 = f1 + (r.int(0, 1) ? d : -d)
      return {
        prompt: `Två stämgafflar ljuder samtidigt. Den ena har frekvensen ${f1} Hz och den andra ${f2} Hz. Vilken frekvens har svävningarna?`,
        ...q(d, 'Hz'),
        solution: `$$f_{svävning} = |f_1 - f_2| = |${f1} - ${f2}|\\ \\text{Hz} = ${d}\\ \\text{Hz}$$`,
      }
    },
  },
  {
    id: 'ekolod',
    subject: 'fysik',
    topic: 'Infraljud och ultraljud',
    make: (r) => {
      const t = r.pick([0.04, 0.12, 0.25, 0.4, 0.64, 1.2])
      const s = (1500 * t) / 2
      return {
        prompt: `Ett ekolod skickar en ultraljudspuls rakt ner i vattnet. Ekot kommer tillbaka efter ${num(t)} s. Hur djupt är det? Ljudhastigheten i vatten är 1500 m/s.`,
        ...q(s, 'm'),
        solution: `Ljudet går ner och upp igen, så djupet är halva sträckan.\n\n$$s = \\frac{v \\cdot t}{2} = \\frac{1500 \\cdot ${tex(t)}}{2}\\ \\text{m} = ${tex(s)}\\ \\text{m}$$`,
      }
    },
  },
  {
    id: 'brytning',
    subject: 'fysik',
    topic: 'Vattenvågor och brytning',
    make: (r) => {
      if (r.int(0, 1)) {
        const h = r.pick([0.5, 1.2, 2.5, 4.0, 10, 40])
        const v = Math.sqrt(G * h)
        return {
          prompt: `Hur fort rör sig vattenvågor nära land där vattendjupet är ${num(h)} m?`,
          ...q(v, 'm/s'),
          solution: `$$v = \\sqrt{g h} = \\sqrt{9{,}82 \\cdot ${tex(h)}}\\ \\text{m/s} = ${tex(v)}\\ \\text{m/s}$$`,
        }
      }
      const v1 = r.pick([2.0, 2.4, 3.0, 4.5])
      const v2 = r.pick([1.0, 1.2, 1.6, 1.8])
      const i = r.pick([20, 30, 40, 50, 60])
      const b = (Math.asin((Math.sin((i * Math.PI) / 180) * v2) / v1) * 180) / Math.PI
      return {
        prompt: `En vattenvåg går från djupt vatten, där hastigheten är ${num(v1)} m/s, in över grundare vatten, där hastigheten är ${num(v2)} m/s. Infallsvinkeln är ${i}°. Bestäm brytningsvinkeln.`,
        ...q(b, '°', 0.02),
        solution: `Brytningslagen: $\\dfrac{\\sin i}{\\sin b} = \\dfrac{v_1}{v_2}$.\n\n$$\\sin b = \\sin ${i}^\\circ \\cdot \\frac{${tex(v2)}}{${tex(v1)}} = ${tex((Math.sin((i * Math.PI) / 180) * v2) / v1)} \\quad\\Rightarrow\\quad b = ${tex(b)}^\\circ$$`,
      }
    },
  },
  {
    id: 'jordbavningar',
    subject: 'fysik',
    topic: 'Huygens och jordbävningar',
    make: (r) => {
      const M = r.pick([2.0, 3.5, 4.0, 5.5, 6.0, 7.0, 8.5])
      const E = 1.74 * 10 ** (5 + 1.44 * M)
      return {
        prompt: `Hur mycket energi frigörs vid en jordbävning med magnituden ${num(M)} på richterskalan?`,
        ...q(E, 'J', 0.05),
        solution: `$$E = 1{,}74 \\cdot 10^{5 + 1{,}44M} = 1{,}74 \\cdot 10^{5 + 1{,}44 \\cdot ${tex(M)}}\\ \\text{J} = ${tex(E, 2)}\\ \\text{J}$$`,
      }
    },
  },
  {
    id: 'interferens',
    subject: 'fysik',
    topic: 'Interferens',
    make: (r) => {
      if (r.int(0, 1)) {
        const a = r.pick([3.2, 4.5, 6.0, 8.4, 12.5])
        const d = r.pick([0.4, 0.75, 1.2, 2.0])
        return {
          prompt: `Två vågkällor svänger i fas. I en punkt på första nodlinjen är avståndet ${num(a + d)} m till den ena källan och ${num(a)} m till den andra. Bestäm våglängden.`,
          ...q(2 * d, 'm'),
          solution: `På första nodlinjen är vägskillnaden en halv våglängd: $\\Delta s = \\dfrac{\\lambda}{2}$.\n\n$$\\Delta s = ${tex(a + d)} - ${tex(a)} = ${tex(d)}\\ \\text{m} \\quad\\Rightarrow\\quad \\lambda = 2 \\cdot ${tex(d)}\\ \\text{m} = ${tex(2 * d)}\\ \\text{m}$$`,
        }
      }
      const lam = r.pick([0.2, 0.4, 0.5, 0.8])
      const k = r.pick([1, 1.5, 2, 2.5, 3, 3.5])
      const whole = Number.isInteger(k)
      return {
        prompt: `Två högtalare som är i fas sänder ut ljud med våglängden ${num(lam)} m. I en punkt är vägskillnaden till högtalarna ${num(k * lam)} m. Är interferensen konstruktiv eller destruktiv där?`,
        answer: { type: 'choice', options: ['Konstruktiv', 'Destruktiv'], value: whole ? 'Konstruktiv' : 'Destruktiv' },
        facit: whole ? 'Konstruktiv' : 'Destruktiv',
        solution: `$\\dfrac{\\Delta s}{\\lambda} = \\dfrac{${tex(k * lam)}}{${tex(lam)}} = ${tex(k)}$. ${whole ? 'Vägskillnaden är ett helt antal våglängder, så vågorna förstärker varandra.' : 'Vägskillnaden är ett udda antal halva våglängder, så vågorna släcker ut varandra.'}`,
      }
    },
  },
]

/* ---------- Matte 5: diskret matematik ---------- */

const matte: Generator[] = [
  {
    id: 'ladprincipen',
    subject: 'matte',
    topic: 'Lådprincipen',
    make: (r) => {
      const k = r.int(2, 6)
      const [boxes, what] = r.pick([
        [12, 'fyller år i samma månad'],
        [7, 'är födda på samma veckodag'],
        [4, 'har samma blodgrupp (A, B, AB eller 0)'],
      ] as const)
      const n = boxes * (k - 1) + 1
      return {
        prompt: `Hur många personer måste det minst finnas i ett rum för att man säkert ska veta att minst ${k} av dem ${what}?`,
        ...whole(n),
        solution: `Det finns ${boxes} lådor. Med ${k - 1} personer i varje låda får man plats med $${boxes} \\cdot ${k - 1} = ${boxes * (k - 1)}$ personer utan att någon låda har ${k}. En person till tvingar fram ${k} i samma låda: $${boxes * (k - 1)} + 1 = ${n}$.`,
      }
    },
  },
  {
    id: 'multiplikationsprincipen',
    subject: 'matte',
    topic: 'Multiplikations- och additionsprincipen',
    make: (r) => {
      if (r.int(0, 1)) {
        const [a, b, c] = [r.int(2, 6), r.int(3, 8), r.int(2, 5)]
        return {
          prompt: `En restaurang har ${a} förrätter, ${b} varmrätter och ${c} efterrätter. På hur många sätt kan man välja en trerättersmiddag?`,
          ...whole(a * b * c),
          solution: `Valen görs efter varandra, så multiplikationsprincipen ger $${a} \\cdot ${b} \\cdot ${c} = ${a * b * c}$ sätt.`,
        }
      }
      const n = r.int(3, 6)
      const letters = r.int(2, 3)
      const total = 26 ** letters * 10 ** n
      return {
        prompt: `En kod består av ${letters} bokstäver (A–Z, 26 stycken) följda av ${n} siffror (0–9). Hur många olika koder finns det?`,
        ...whole(total, `26^${letters}*10^${n}`),
        solution: `Varje bokstav kan väljas på 26 sätt och varje siffra på 10 sätt: $26^{${letters}} \\cdot 10^{${n}} = ${total.toLocaleString('sv-SE').replace(/\u00a0/g, '\\,')}$.`,
      }
    },
  },
  {
    id: 'permutationer',
    subject: 'matte',
    topic: 'Permutationer',
    make: (r) => {
      if (r.int(0, 1)) {
        const n = r.int(4, 9)
        return {
          prompt: `På hur många sätt kan ${n} personer ställa sig i en kö?`,
          ...whole(fact(n), `factorial(${n})`),
          solution: `Första platsen kan väljas på ${n} sätt, nästa på ${n - 1} sätt och så vidare: $${n}! = ${fact(n).toLocaleString('sv-SE').replace(/\u00a0/g, '\\,')}$.`,
        }
      }
      const n = r.int(6, 15)
      const k = r.int(2, 4)
      const p = fact(n) / fact(n - k)
      const roles = ['ordförande', 'sekreterare', 'kassör', 'vice ordförande'].slice(0, k)
      return {
        prompt: `En förening med ${n} medlemmar ska välja ${roles.slice(0, -1).join(', ')} och ${roles.at(-1)}. På hur många sätt kan det göras?`,
        ...whole(p, `permutations(${n},${k})`),
        solution: `Ordningen spelar roll (posterna är olika), så det är en permutation av ${k} bland ${n}:\n\n$$P(${n}, ${k}) = \\frac{${n}!}{${n - k}!} = ${Array.from({ length: k }, (_, i) => n - i).join(' \\cdot ')} = ${p.toLocaleString('sv-SE').replace(/\u00a0/g, '\\,')}$$`,
      }
    },
  },
  {
    id: 'kombinationer',
    subject: 'matte',
    topic: 'Kombinationer',
    make: (r) => {
      if (r.int(0, 1)) {
        const n = r.int(5, 20)
        return {
          prompt: `På en fest med ${n} personer skakar alla hand med varandra en gång. Hur många handskakningar blir det?`,
          ...whole(comb(n, 2), `combinations(${n},2)`),
          solution: `Varje handskakning är ett val av 2 personer bland ${n}, utan ordning:\n\n$$\\binom{${n}}{2} = \\frac{${n} \\cdot ${n - 1}}{2} = ${comb(n, 2)}$$`,
        }
      }
      const n = r.int(7, 16)
      const k = r.int(2, Math.min(5, n - 2))
      return {
        prompt: `På hur många sätt kan man välja ut en grupp på ${k} elever ur en klass med ${n} elever?`,
        ...whole(comb(n, k), `combinations(${n},${k})`),
        solution: `Ordningen spelar ingen roll, så det är en kombination:\n\n$$\\binom{${n}}{${k}} = \\frac{${n}!}{${k}! \\cdot ${n - k}!} = ${comb(n, k).toLocaleString('sv-SE').replace(/\u00a0/g, '\\,')}$$`,
      }
    },
  },
  {
    id: 'sannolikhet',
    subject: 'matte',
    topic: 'Sannolikhet',
    make: (r) => {
      const red = r.int(3, 8)
      const blue = r.int(2, 7)
      const n = red + blue
      const p = (red * (red - 1)) / (n * (n - 1))
      const g = (a: number, b: number): number => (b ? g(b, a % b) : a)
      const d = g(red * (red - 1), n * (n - 1))
      return {
        prompt: `I en påse finns ${red} röda och ${blue} blå kulor. Du tar två kulor utan att lägga tillbaka den första. Hur stor är sannolikheten att båda är röda? Svara exakt eller med minst två värdesiffror.`,
        answer: { type: 'number', value: `${red * (red - 1)}/${n * (n - 1)}`, approx: p.toPrecision(2) },
        facit: `$\\dfrac{${(red * (red - 1)) / d}}{${(n * (n - 1)) / d}} \\approx ${tex(p, 2)}$`,
        solution: `Första kulan är röd med sannolikheten $\\dfrac{${red}}{${n}}$. Då finns ${red - 1} röda kvar bland ${n - 1} kulor.\n\n$$P = \\frac{${red}}{${n}} \\cdot \\frac{${red - 1}}{${n - 1}} = \\frac{${(red * (red - 1)) / d}}{${(n * (n - 1)) / d}} \\approx ${tex(p, 2)}$$`,
      }
    },
  },
  {
    id: 'binomialsatsen',
    subject: 'matte',
    topic: 'Binomialsatsen',
    make: (r) => {
      const n = r.int(4, 9)
      const k = r.int(2, n - 1)
      const a = r.pick([1, 1, 2, 3])
      const c = comb(n, k) * a ** (n - k)
      return {
        prompt: `Bestäm koefficienten för $x^{${k}}$ i utvecklingen av $(${a === 1 ? '1' : a} + x)^{${n}}$.`,
        ...whole(c, a === 1 ? `combinations(${n},${k})` : `combinations(${n},${k})*${a}^${n - k}`),
        solution: `Termen med $x^{${k}}$ är $\\dbinom{${n}}{${k}} \\cdot ${a}^{${n - k}} \\cdot x^{${k}}$.\n\n$$\\binom{${n}}{${k}} \\cdot ${a}^{${n - k}} = ${comb(n, k)} \\cdot ${a ** (n - k)} = ${c.toLocaleString('sv-SE').replace(/\u00a0/g, '\\,')}$$`,
      }
    },
  },
  {
    id: 'mangder',
    subject: 'matte',
    topic: 'Mängder',
    make: (r) => {
      const n = r.int(3, 10)
      return {
        prompt: `Hur många delmängder har en mängd med ${n} element? Räkna med den tomma mängden och mängden själv.`,
        ...whole(2 ** n, `2^${n}`),
        solution: `Varje element är antingen med eller inte med i en delmängd – två val per element:\n\n$$2^{${n}} = ${2 ** n}$$`,
      }
    },
  },
  {
    id: 'mangdoperationer',
    subject: 'matte',
    topic: 'Mängdoperationer',
    make: (r) => {
      const both = r.int(2, 9)
      const a = both + r.int(3, 15)
      const b = both + r.int(3, 15)
      return {
        prompt: `Mängden $A$ har ${a} element och mängden $B$ har ${b} element. Snittet $A \\cap B$ har ${both} element. Hur många element har unionen $A \\cup B$?`,
        ...whole(a + b - both),
        solution: `Elementen i snittet räknas två gånger om man bara lägger ihop, så de dras bort en gång:\n\n$$|A \\cup B| = |A| + |B| - |A \\cap B| = ${a} + ${b} - ${both} = ${a + b - both}$$`,
      }
    },
  },
  {
    id: 'venndiagram',
    subject: 'matte',
    topic: 'Venndiagram',
    make: (r) => {
      const both = r.int(2, 8)
      const a = both + r.int(4, 10)
      const b = both + r.int(3, 9)
      const none = r.int(1, 7)
      const n = a + b - both + none
      return {
        prompt: `I en klass med ${n} elever läser ${a} spanska och ${b} tyska. ${both} elever läser båda språken. Hur många läser inget av språken?`,
        ...whole(none),
        solution: `Minst ett av språken läser $${a} + ${b} - ${both} = ${a + b - both}$ elever. Resten läser inget av dem:\n\n$$${n} - ${a + b - both} = ${none}$$`,
      }
    },
  },
]

export const GENERATORS: Generator[] = [...fysik, ...matte]

export const generatorFor = (topic: string | undefined) => GENERATORS.find((g) => g.topic === topic)
export const generatorHref = (id: string, seed = Math.floor(Math.random() * 1e9)) => `#/ova/nya/${id}?n=${seed}`
