// Alla animationer, efter namn. Genomgångarna anger vilken som ska visas.
import type { AnimationKind } from '../../content/types.ts'
import type { AnimSpec } from './types.ts'
import { AnimFrame } from './frame.tsx'
import { hooke, pendulum, resonance, springEnergy, springOsc } from './specs1.ts'
import { pipe, pulseReflection, standingString, superposition, travellingWave, waterWave } from './specs2.ts'
import { beats, diffraction, doppler, earthquake, interference, intensity, refraction } from './specs3.ts'
import './anim.css'

const SPECS: Record<AnimationKind, AnimSpec> = {
  spring: springOsc,
  'spring-energy': springEnergy,
  pendulum,
  resonance,
  'pulse-reflection': pulseReflection,
  superposition,
  'travelling-wave': travellingWave,
  'standing-string': standingString,
  pipe,
  intensity,
  doppler,
  beats,
  'water-wave': waterWave,
  refraction,
  diffraction,
  interference,
  earthquake,
}

export function Animation({ kind, caption, options }: { kind: AnimationKind; caption: string; options?: Record<string, number | string | boolean> }) {
  // Hookes lag är en egen animation men hör till fjädrarna.
  const spec = kind === 'spring' && options?.mode === 'hooke' ? hooke : SPECS[kind]
  return <AnimFrame spec={spec} caption={caption} options={options?.mode === 'hooke' ? undefined : options} />
}
