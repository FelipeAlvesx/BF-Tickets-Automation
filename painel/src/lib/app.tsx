import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, CircleAlert, Info } from 'lucide-react'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { usePoll } from '@/hooks/usePoll'
import { api, put } from './api'
import { spring } from './motion'
import type { Estado } from './types'

type Tom = 'ok' | 'erro' | 'info'
interface Toast { id: number; tom: Tom; titulo: string; texto?: string }
interface App {
  estado: Estado | null
  refetchEstado: () => void
  toast: (titulo: string, texto?: string, tom?: Tom) => void
  erro: (e: unknown, titulo?: string) => void
  tema: 'light' | 'dark'
  trocarTema: () => void
  setBot: (ligado: boolean) => Promise<void>
}

const Ctx = createContext<App | null>(null)
export const useApp = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useApp fora do AppProvider')
  return c
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { data: estado, refetch: refetchEstado } = usePoll(() => api<Estado>('/estado'), 8000)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [tema, setTema] = useState<'light' | 'dark'>(() => (document.documentElement.dataset.theme as 'light' | 'dark') || 'light')
  const seq = useRef(0)

  const toast = useCallback((titulo: string, texto?: string, tom: Tom = 'ok') => {
    const id = ++seq.current
    setToasts(t => [...t.slice(-3), { id, tom, titulo, texto }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), tom === 'erro' ? 6500 : 3600)
  }, [])
  const erro = useCallback((e: unknown, titulo = 'Não deu certo') => toast(titulo, e instanceof Error ? e.message : String(e), 'erro'), [toast])
  const trocarTema = useCallback(() => {
    const novo = tema === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = novo
    try { localStorage.setItem('bf-tema', novo) } catch { /* sem storage */ }
    setTema(novo)
  }, [tema])
  const setBot = useCallback(async (ligado: boolean) => {
    try {
      await put('/t/config/bot_ligado', { valor: ligado ? 'true' : 'false' })
      refetchEstado()
      toast(ligado ? 'Bot ligado' : 'Bot pausado para todos', ligado ? 'Voltou a responder WhatsApp e Instagram.' : 'As mensagens continuam chegando e ficam no histórico.', ligado ? 'ok' : 'info')
    } catch (e) { erro(e) }
  }, [refetchEstado, toast, erro])

  return (
    <Ctx.Provider value={{ estado, refetchEstado, toast, erro, tema, trocarTema, setBot }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map(t => {
            const I = t.tom === 'erro' ? CircleAlert : t.tom === 'info' ? Info : CheckCircle2
            return (
              <motion.div key={t.id} layout initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={spring}
                className="panel pointer-events-auto flex gap-3 p-4 shadow-float">
                <I className={t.tom === 'erro' ? 'size-5 shrink-0 text-red' : t.tom === 'info' ? 'size-5 shrink-0 text-blue' : 'size-5 shrink-0 text-green'} />
                <div className="min-w-0"><p className="text-sm font-semibold">{t.titulo}</p>{t.texto && <p className="text-sm text-muted">{t.texto}</p>}</div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}
