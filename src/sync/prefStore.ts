// Små inställningar som följer med kontot mellan enheter: studiemålen, repetitionens
// justeringar och färgerna. Varje del är ett eget synkdokument ("pref:study" osv.) och den
// senast ändrade vinner. Här sparas bara när varje del senast ändrades på den här enheten.
import { markDirty } from './changes.ts'

const KEY = 'grinda.prefs.at.v1'

export type PrefId = 'study' | 'srs' | 'theme'

function readAt(): Partial<Record<PrefId, number>> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Record<PrefId, number>>
  } catch {
    return {}
  }
}

export const prefChangedAt = (id: PrefId): number | undefined => readAt()[id]

function writeAt(id: PrefId, at: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAt(), [id]: at }))
  } catch {
    /* då synkas inte ändringen förrän nästa gång */
  }
}

/** Anmäl att en del ändrats här, så att den skickas till dina andra enheter. */
export function prefChanged(id: PrefId) {
  writeAt(id, Date.now())
  markDirty('doc', `pref:${id}`)
}

/** En ändring från en annan enhet: gäller bara om den är nyare än den lokala. */
export function acceptRemotePref(id: PrefId, updatedAt: number): boolean {
  if ((readAt()[id] ?? 0) >= updatedAt) return false
  writeAt(id, updatedAt)
  return true
}
