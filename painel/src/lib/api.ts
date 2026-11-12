// Cliente da agente: mesma origem (/api), o nginx do painel repassa para ela.
// O backend devolve {error: "frase em pt-BR"}, que vira o texto do toast.

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init
  const res = await fetch(`/api${path}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...(rest.headers || {}) },
    body: json === undefined ? rest.body : JSON.stringify(json),
  })
  const text = await res.text()
  const data = text ? safeJson(text) : null
  if (!res.ok) {
    const msg = (data && typeof data === 'object' && 'error' in data && String((data as { error: unknown }).error)) || `Erro ${res.status}`
    throw new ApiError(msg, res.status)
  }
  return data as T
}

function safeJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export const post = <T = unknown>(path: string, json: unknown = {}) => api<T>(path, { method: 'POST', json })
export const put = <T = unknown>(path: string, json: unknown = {}) => api<T>(path, { method: 'PUT', json })
export const del = <T = unknown>(path: string) => api<T>(path, { method: 'DELETE' })
export const enc = (phone: string) => encodeURIComponent(phone)
