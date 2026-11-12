import { useCallback } from 'react'
import { usePoll } from './usePoll'
import { api, del, post, put } from '@/lib/api'
import { useApp } from '@/lib/app'

/** Lista uma tabela editável do painel (/api/t/<nome>) e salva com toast. */
export function useTabela<T>(nome: string, ms = 30_000) {
  const { toast, erro } = useApp()
  const poll = usePoll(() => api<T[]>(`/t/${nome}`), ms)
  const salvar = useCallback(async (pk: string | number | null, dados: Partial<T>, msg = 'Salvo') => {
    try {
      const r = pk === null ? await post<T>(`/t/${nome}`, dados) : await put<T>(`/t/${nome}/${encodeURIComponent(String(pk))}`, dados)
      poll.refetch()
      toast(msg)
      return r
    } catch (e) { erro(e); return null }
  }, [nome, poll, toast, erro])
  const apagar = useCallback(async (pk: string | number) => {
    try { await del(`/t/${nome}/${encodeURIComponent(String(pk))}`); poll.refetch(); toast('Apagado', undefined, 'info') } catch (e) { erro(e) }
  }, [nome, poll, toast, erro])
  return { ...poll, salvar, apagar }
}
