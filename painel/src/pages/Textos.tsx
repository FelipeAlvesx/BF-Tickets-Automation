import { Search } from 'lucide-react'
import { useState } from 'react'
import { Page, PageHeader } from '@/components/Page'
import { Skeleton } from '@/components/ui'
import { useTabela } from '@/hooks/useTabela'

interface Texto { chave: string; texto: string }

export default function Textos() {
  const { data, salvar } = useTabela<Texto>('mensagens', 0)
  const [edit, setEdit] = useState<Record<string, string>>({})
  const [busca, setBusca] = useState('')
  const lista = (data ?? []).filter(t => !busca || `${t.chave} ${t.texto}`.toLowerCase().includes(busca.toLowerCase()))
  return (
    <Page>
      <PageHeader title="Textos do bot" subtitle="Tudo que o bot fala. Mantenha as {variáveis} entre chaves: elas viram nome do evento, preço, número do pedido…" />
      <label className="relative mb-6 block max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input className="field pl-9" placeholder="Buscar texto" value={busca} onChange={e => setBusca(e.target.value)} />
      </label>
      {!data ? <Skeleton className="h-96" /> : (
        <ul className="space-y-3">
          {lista.map(t => {
            const v = edit[t.chave] ?? t.texto
            const mudou = v !== t.texto
            return (
              <li key={t.chave} className="panel p-4">
                <div className="mb-2 flex items-center gap-3">
                  <code className="flex-1 text-sm text-brand-ink">{t.chave}</code>
                  {mudou && <>
                    <button className="btn-ghost btn-sm" onClick={() => setEdit(e => { const { [t.chave]: _, ...r } = e; return r })}>Desfazer</button>
                    <button className="btn-primary btn-sm" onClick={async () => { if (await salvar(t.chave, { texto: v }, 'Texto salvo')) setEdit(e => { const { [t.chave]: _, ...r } = e; return r }) }}>Salvar</button>
                  </>}
                </div>
                <textarea className="field" rows={Math.min(8, v.split('\n').length + 1)} value={v} onChange={e => setEdit(s => ({ ...s, [t.chave]: e.target.value }))} aria-label={t.chave} />
              </li>
            )
          })}
        </ul>
      )}
    </Page>
  )
}
