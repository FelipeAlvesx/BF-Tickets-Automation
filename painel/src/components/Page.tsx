import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/format'
import { page, rise } from '@/lib/motion'

/** Cabeçalho de tela: título grande, subtítulo e ações à direita. */
export function PageHeader({ eyebrow, title, subtitle, actions }: {
  eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode
}) {
  return (
    <header className="relative isolate mb-8 flex flex-wrap items-end gap-x-6 gap-y-4 pt-2">
      <motion.div variants={rise} className="min-w-0 flex-1">
        {eyebrow && <p className="mb-2 text-sm font-medium text-brand-ink">{eyebrow}</p>}
        <h1 className="font-display text-[clamp(2.1rem,4vw,2.9rem)] leading-[1.05]">{title}</h1>
        {subtitle && <p className="mt-2 text-base text-muted">{subtitle}</p>}
      </motion.div>
      {actions && <motion.div variants={rise} className="flex flex-wrap items-center gap-2">{actions}</motion.div>}
    </header>
  )
}

/** Moldura de tela: largura, respiro e a cascata curta de entrada. */
export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <motion.div variants={page} initial="hidden" animate="show"
      className={cn('mx-auto w-full px-5 pb-16 pt-6 md:px-8 md:pt-10', wide ? 'max-w-[1400px]' : 'max-w-6xl', className)}>
      {children}
    </motion.div>
  )
}

/** Bloco com título de seção (sem caixa: hierarquia por tipografia e espaço). */
export function Section({ title, aside, children, className }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <motion.section variants={rise} className={cn('mb-10 min-w-0', className)}>
      {(title || aside) && (
        <div className="mb-3 flex items-baseline justify-between gap-4">
          {title && <h2 className="text-[1.05rem] font-semibold tracking-[-0.005em]">{title}</h2>}
          {aside && <div className="text-sm text-muted">{aside}</div>}
        </div>
      )}
      {children}
    </motion.section>
  )
}
