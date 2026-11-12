import type { ReactNode } from 'react'
import { Switch } from './ui'

export function Campo({ rotulo, dica, children }: { rotulo: string; dica?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-[0.85rem] text-muted">{dica}</span>}
    </label>
  )
}

export function Liga({ rotulo, dica, on, onChange }: { rotulo: string; dica?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-surface-2 px-4 py-3">
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{rotulo}</p>{dica && <p className="text-[0.85rem] text-muted">{dica}</p>}</div>
      <Switch on={on} onChange={onChange} label={rotulo} />
    </div>
  )
}
