import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn, iniciais } from '@/lib/format'
import { EASE_OUT, spring } from '@/lib/motion'

/** Chave liga/desliga (role=switch). A bolinha corre com mola; a cor troca junto. */
export function Switch({ on, onChange, label, disabled, size = 'md' }: {
  on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; size?: 'sm' | 'md'
}) {
  const w = size === 'sm' ? 'w-9 h-5' : 'w-11 h-6'
  const k = size === 'sm' ? 'size-4' : 'size-5'
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn('relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 disabled:opacity-50',
        w, on ? 'bg-brand justify-end' : 'bg-surface-3 justify-start')}>
      <motion.span layout transition={spring} className={cn('rounded-full bg-white shadow-sm', k)} />
    </button>
  )
}

/** Abas compactas: a pílula de fundo desliza para a escolhida (layoutId por grupo). */
export function Segmented<T extends string>({ value, onChange, options, className }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; count?: number }[]; className?: string
}) {
  const id = useId()
  return (
    <div role="tablist" className={cn('inline-flex rounded-xl bg-surface-2 p-1', className)}>
      {options.map(o => {
        const ativo = o.value === value
        return (
          <button key={o.value} role="tab" aria-selected={ativo} onClick={() => onChange(o.value)}
            className={cn('relative h-8 rounded-lg px-3 text-sm font-medium transition-colors duration-200', ativo ? 'text-foreground' : 'text-muted hover:text-foreground')}>
            {ativo && <motion.span layoutId={`seg-${id}`} transition={spring} className="absolute inset-0 rounded-lg bg-surface shadow-sm ring-1 ring-border" />}
            <span className="relative inline-flex items-center gap-1.5">
              {o.label}
              {!!o.count && <span className={cn('tabular rounded-full px-1.5 text-[0.78rem] leading-5', ativo ? 'bg-brand text-brand-foreground' : 'bg-surface-3 text-muted')}>{o.count}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Número que rola dígito a dígito quando muda (contador de painel). */
export function Rolling({ value, className }: { value: string | number; className?: string }) {
  const reduce = useReducedMotion()
  const s = String(value)
  return (
    <span className={cn('tabular inline-flex overflow-hidden', className)} aria-label={s}>
      {s.split('').map((c, i) => (
        <span key={`${s.length - i}`} className="relative inline-block" aria-hidden>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={c} className="inline-block"
              initial={reduce ? { opacity: 0 } : { y: '0.6em', opacity: 0, filter: 'blur(2px)' }}
              animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
              exit={reduce ? { opacity: 0 } : { y: '-0.6em', opacity: 0, filter: 'blur(2px)' }}
              transition={{ duration: 0.32, ease: EASE_OUT }}>
              {c}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  )
}

export function Avatar({ nome, className, tom = 'brand' }: { nome: string; className?: string; tom?: 'brand' | 'quiet' }) {
  return (
    <span className={cn('inline-grid shrink-0 place-items-center rounded-full text-[0.8rem] font-semibold',
      tom === 'brand' ? 'bg-brand-soft text-brand-ink' : 'bg-surface-3 text-muted', className || 'size-9')}>
      {iniciais(nome)}
    </span>
  )
}

const TOM: Record<string, string> = {
  amber: 'bg-amber/10 text-amber', blue: 'bg-blue/10 text-blue', green: 'bg-green/10 text-green',
  red: 'bg-red/10 text-red', violet: 'bg-violet/10 text-violet', slate: 'bg-slate/15 text-slate',
  brand: 'bg-brand-soft text-brand-ink',
}
export function Chip({ tom = 'slate', children, ponto, className }: { tom?: keyof typeof TOM | string; children: ReactNode; ponto?: boolean; className?: string }) {
  return (
    <span className={cn('chip', TOM[tom] || TOM.slate, className)}>
      {ponto && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/** Cor de cada status de agendamento (a mesma em todas as telas). */
export const STATUS_TOM: Record<string, string> = {
  pending: 'amber', confirmed: 'blue', completed: 'green', no_show: 'slate',
  rejected: 'slate', cancelled: 'slate', reschedule_requested: 'violet', cancel_requested: 'red',
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-surface-2', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-surface/70 to-transparent" />
    </div>
  )
}

export function Empty({ icon, titulo, texto, children }: { icon?: ReactNode; titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-surface-2 text-faint">{icon}</div>}
      <p className="font-display text-2xl">{titulo}</p>
      {texto && <p className="mt-1.5 max-w-sm text-sm text-muted">{texto}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  )
}

/** Bolinha "viva": pulso suave quando ligada. */
export function Pulse({ on = true, tom = 'green', className }: { on?: boolean; tom?: 'green' | 'red' | 'amber' | 'brand'; className?: string }) {
  const cor = { green: 'bg-green', red: 'bg-red', amber: 'bg-amber', brand: 'bg-brand' }[tom]
  return (
    <span className={cn('relative inline-flex size-2.5', className)}>
      {on && <span className={cn('absolute inset-0 rounded-full animate-ring', cor)} />}
      <span className={cn('relative inline-flex size-2.5 rounded-full', on ? cor : 'bg-slate/60')} />
    </span>
  )
}

/**
 * Segure para confirmar (cancelar horário, desconectar): um clique sem querer não faz nada.
 * Apertar enche devagar (900 ms, linear); soltar volta rápido (180 ms).
 */
export function HoldButton({ onConfirm, children, className, label, tempo = 900 }: {
  onConfirm: () => void; children: ReactNode; className?: string; label: string; tempo?: number
}) {
  const [segurando, setSegurando] = useState(false)
  const t = useRef<ReturnType<typeof setTimeout>>()
  const start = () => {
    setSegurando(true)
    t.current = setTimeout(() => { setSegurando(false); onConfirm() }, tempo)
  }
  const stop = () => { clearTimeout(t.current); setSegurando(false) }
  useEffect(() => () => clearTimeout(t.current), [])
  return (
    <button type="button" aria-label={label} title="Segure para confirmar"
      onPointerDown={e => { if (e.button === 0) start() }} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start() } }}
      onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') stop() }}
      className={cn('btn-danger relative overflow-hidden', className)}>
      <span className="absolute inset-0 bg-red/90"
        style={{ clipPath: segurando ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)', transition: `clip-path ${segurando ? tempo : 180}ms ${segurando ? 'linear' : 'cubic-bezier(0.23,1,0.32,1)'}` }} />
      <span className="relative inline-flex items-center gap-2">{children}</span>
      <span aria-hidden className="absolute inset-0 inline-flex items-center justify-center gap-2 text-white"
        style={{ clipPath: segurando ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)', transition: `clip-path ${segurando ? tempo : 180}ms ${segurando ? 'linear' : 'cubic-bezier(0.23,1,0.32,1)'}` }}>
        {children}
      </span>
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn('inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)} />
}
