import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/format'
import { EASE_DRAWER, EASE_OUT } from '@/lib/motion'

/**
 * Gaveta lateral (detalhe de horário, novo horário, ficha). Curva de iOS na entrada,
 * saída mais rápida. Esc e clique fora fecham; o foco entra na gaveta e volta para quem abriu.
 */
export function Drawer({ open, onClose, title, subtitle, children, footer, width = 460 }: {
  open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; width?: number
}) {
  const box = useRef<HTMLDivElement>(null)
  const volta = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) return
    volta.current = document.activeElement as HTMLElement
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', esc)
    const t = setTimeout(() => box.current?.querySelector<HTMLElement>('[data-autofocus], button, input, textarea, select')?.focus(), 60)
    return () => {
      removeEventListener('keydown', esc)
      clearTimeout(t)
      volta.current?.focus?.()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]">
          <motion.div className="absolute inset-0 bg-[hsl(var(--shadow)/0.28)] backdrop-blur-[2px]" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.24, ease: EASE_OUT } }} exit={{ opacity: 0, transition: { duration: 0.18 } }} />
          <motion.aside ref={box} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
            style={{ width: `min(${width}px, 100vw)` }}
            className="absolute inset-y-0 right-0 flex flex-col bg-surface shadow-float"
            initial={{ transform: 'translateX(100%)' }}
            animate={{ transform: 'translateX(0%)', transition: { duration: 0.42, ease: EASE_DRAWER } }}
            exit={{ transform: 'translateX(100%)', transition: { duration: 0.26, ease: EASE_DRAWER } }}>
            <header className="flex items-start gap-3 border-b border-border px-6 pb-4 pt-5">
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-[1.7rem] leading-tight">{title}</h2>
                {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
              </div>
              <button className="btn-ghost size-9 px-0" onClick={onClose} aria-label="Fechar"><X className="size-5" /></button>
            </header>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <footer className={cn('flex flex-wrap items-center gap-2 border-t border-border px-6 py-4')}>{footer}</footer>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
