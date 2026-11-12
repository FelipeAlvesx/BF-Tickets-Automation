import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Busca e repete a cada `ms`. Em erro, mantém o último dado bom (o painel não pisca vazio).
 * Com a aba escondida, espaça 3x: os alertas continuam, o servidor respira.
 * `key` muda → busca de novo na hora (ex.: trocou a conversa aberta).
 */
export function usePoll<T>(fn: () => Promise<T>, ms: number, key: unknown = null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const vez = useRef(0)

  const refetch = useCallback(async () => {
    const minha = ++vez.current
    try {
      const d = await fnRef.current()
      if (minha === vez.current) {
        setData(d)
        setError(null)
      }
    } catch (e) {
      if (minha === vez.current) setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (minha === vez.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    setData(null)
    let t: ReturnType<typeof setTimeout>
    let vivo = true
    const ciclo = async () => {
      await refetch()
      if (vivo && ms > 0) t = setTimeout(ciclo, document.hidden ? ms * 3 : ms)
    }
    ciclo()
    const volta = () => { if (!document.hidden) refetch() }
    document.addEventListener('visibilitychange', volta)
    return () => {
      vivo = false
      clearTimeout(t)
      document.removeEventListener('visibilitychange', volta)
    }
  }, [ms, key, refetch])

  return { data, error, loading, refetch, setData }
}
