import { Handshake, Instagram, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Page, PageHeader } from '@/components/Page'
import { Empty, Skeleton } from '@/components/ui'
import { useTabela } from '@/hooks/useTabela'
import { useApp } from '@/lib/app'
import { brl, fone, ha } from '@/lib/format'
import { STATUS_OFERTA } from '@/lib/rotulos'
import type { Oferta } from '@/lib/types'

export default function Ofertas() {
  const { refetchEstado } = useApp()
  const { data, salvar } = useTabela<Oferta>('ofertas_venda', 15_000)
  return (
    <Page>
      <PageHeader title="Querem vender" subtitle="Quem pediu para vender ingresso pelo bot. A negociação é com vocês: abra a conversa e responda." />
      {!data ? <Skeleton className="h-64" /> : !data.length ? <div className="panel"><Empty icon={<Handshake className="size-5" />} titulo="Nenhuma oferta ainda" /></div> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map(o => (
            <li key={o.id} className="panel p-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{o.evento_texto}</p>
                  <p className="text-sm text-muted">{o.quantidade}x · {o.setor} · {brl(Number(o.valor_pedido))} cada</p>
                  <Link to="/conversas" className="mt-1 flex items-center gap-1.5 text-sm text-brand-ink hover:underline">
                    {o.canal === 'instagram' ? <Instagram className="size-3.5" /> : <MessageCircle className="size-3.5" />}{o.canal === 'whatsapp' ? fone(o.contato_id) : o.contato_id} · {ha(o.criado_em)}
                  </Link>
                </div>
                <select className="field h-9 w-auto" value={o.status} aria-label="Status da oferta"
                  onChange={async e => { await salvar(o.id, { status: e.target.value }, 'Status da oferta atualizado'); refetchEstado() }}>
                  {Object.entries(STATUS_OFERTA).map(([v, [r]]) => <option key={v} value={v}>{r}</option>)}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}
