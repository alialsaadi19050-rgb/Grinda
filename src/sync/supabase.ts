// Projektets publika adress och publiceringsnyckel. De är gjorda för att ligga i webbläsaren:
// tabellerna går inte att läsa direkt, bara via funktionerna (synken och inbjudningarna).
export const RPC_URL = 'https://vdiodkpjtylqzelujokw.supabase.co/rest/v1/rpc'
export const RPC_KEY = 'sb_publishable_YVyQGrd-cmdmfsI7q9C5hQ_Udho8-oU'

export class RpcError extends Error {
  /** HTTP-status, eller 0 om servern inte gick att nå. */
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** Anropar en funktion i databasen. Felmeddelanden från funktionerna skickas vidare. */
export async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${RPC_URL}/${fn}`, {
      method: 'POST',
      headers: { apikey: RPC_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new RpcError(navigator.onLine ? 'Kunde inte nå servern. Försök igen om en stund.' : 'Du är offline.', 0)
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string }
    throw new RpcError(err.message || `Servern svarade med fel (${res.status}).`, res.status)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}
