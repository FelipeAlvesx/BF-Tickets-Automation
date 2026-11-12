import type { Transition, Variants } from 'framer-motion'

// Um vocabulário só de movimento para o painel inteiro. Valores do bar de motion que vale
// para os projetos do Felipe: ease-out forte para entrar, curva de iOS para gaveta,
// mola sem quique para o que se reorganiza. Nada de UI acima de ~320 ms.

export const EASE_OUT = [0.23, 1, 0.32, 1] as const
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const

export const spring: Transition = { type: 'spring', duration: 0.42, bounce: 0 }
export const springSoft: Transition = { type: 'spring', duration: 0.55, bounce: 0.12 }
export const quick: Transition = { duration: 0.18, ease: EASE_OUT }

/** Entrada de tela: sobe 8 px, tira o desfoque. Os filhos entram em cascata curta. */
export const page: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2, ease: EASE_OUT, staggerChildren: 0.045, delayChildren: 0.02 } },
}
export const rise: Variants = {
  hidden: { opacity: 0, y: 8, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.34, ease: EASE_OUT } },
}

/** Item de lista que entra e sai (conversa nova, toast, linha da fila). */
export const item: Variants = {
  hidden: { opacity: 0, y: -6, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: spring },
  exit: { opacity: 0, scale: 0.985, transition: { duration: 0.14, ease: EASE_OUT } },
}
