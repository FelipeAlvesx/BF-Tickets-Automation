import { Check, FileText, Instagram, MessageCircle, Ticket, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Drawer } from '@/components/Drawer'
import { Page, PageHeader } from '@/components/Page'
import { Chip, Empty, Segmented, Skeleton, Spinner } from '@/components/ui'
import { usePoll } from '@/hooks/usePoll'
import { api, post } from '@/lib/api'
import { useApp } from '@/lib/app'
import { brl, ha, quando } from '@/lib/format'
import { STATUS_PEDIDO, contato } from '@/lib/rotulos'
import type { Pedido } from '@/lib/types'

type Filtro = 'aguardando_validacao' | 'abertos' | 'aprovado' | 'recusado' | 'todos'

export default function Pedidos() {
  const { estado, refetchEstado } = useApp()
  const [params, setParams] = useSearchParams()
  const [filtro, setFiltro] = useState<Filtro>('aguardando_validacao')
  const { data, refetch } = usePoll(() => api<Pedido[]>(`/pedidos?status=${filtro}`), 15_000, filtro)
  const abrirId = Number(params.get('abrir')) || null
  const [aberto, setAberto] = useState<Pedido | null>(null)
  useEffect(() => {
    if (!abrirId) return
    api<Pedido[]>('/pedidos?status=todos').then(l => setAberto(l.find(p => p.id === abrirId) ?? null)).catch(() => {})
  }, [abrirId])
  const fechar = () => { setAberto(null); if (abrirId) setParams({}) }

  return (
    <Page>
      <PageHeader title="Pedidos" subtitle="Pix pago pelo cliente: confira o comprovante no banco e aprove. O bot avisa o cliente na hora." />
      <Segmented className="mb-6" value={filtro} onChange={setFiltro} options={[
        { value: 'aguardando_validacao', label: 'Para validar', count: estado?.validar },
        { value: 'abertos', label: 'Em aberto' }, { value: 'aprovado', label: 'Aprovados' }, { value: 'recusado', label: 'Recusados' }, { value: 'todos', label: 'Todos' },
      ]} />
      {!data ? <Skeleton className="h-64" /> : !data.length ? (
        <div className="panel"><Empty icon={<Ticket className="size-5" />} titulo="Nada por aqui" texto="Quando alguém pagar por Pix e mandar o comprovante, o pedido aparece nesta lista." /></div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-faint">
              {['#', 'Cliente', 'Evento', 'Total', 'Status', 'Atualizado'].map(h => <th key={h} className="px-5 py-3 font-medium">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-border">
              {data.map(p => (
                <tr key={p.id} onClick={() => setAberto(p)} className="cursor-pointer hover:bg-surface-2">
                  <td className="px-5 py-3 font-display text-lg tabular text-brand-ink">{p.id}</td>
                  <td className="px-5 py-3"><span className="flex items-center gap-2">{p.canal === 'instagram' ? <Instagram className="size-4 text-faint" /> : <MessageCircle className="size-4 text-faint" />}{p.nome || p.nome_contato || contato(p.canal, p.contato_id)}</span></td>
                  <td className="px-5 py-3">{p.quantidade}x {p.evento}</td>
                  <td className="px-5 py-3 tabular">{brl(Number(p.valor_total))}</td>
                  <td className="px-5 py-3"><Chip tom={STATUS_PEDIDO[p.status]?.[1]}>{STATUS_PEDIDO[p.status]?.[0] ?? p.status}</Chip></td>
                  <td className="px-5 py-3 text-muted">{ha(p.atualizado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <DetalhePedido pedido={aberto} onClose={fechar} onFeito={() => { fechar(); refetch(); refetchEstado() }} />
    </Page>
  )
}

function DetalhePedido({ pedido: p, onClose, onFeito }: { pedido: Pedido | null; onClose: () => void; onFeito: () => void }) {
  const { toast, erro } = useApp()
  const [recusando, setRecusando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => { setRecusando(false); setMotivo('') }, [p?.id])
  if (!p) return <Drawer open={false} onClose={onClose} title="">{null}</Drawer>
  const aberto = ['aguardando_comprovante', 'coletando_dados', 'aguardando_validacao'].includes(p.status)
  const agir = async (acao: 'aprovar' | 'recusar') => {
    setOcupado(true)
    try {
      const r = await post<{ texto: string }>(`/pedidos/${p.id}/${acao}`, acao === 'recusar' ? { motivo } : {})
      toast(acao === 'aprovar' ? `Pedido #${p.id} aprovado` : `Pedido #${p.id} recusado`, r.texto)
      onFeito()
    } catch (e) { erro(e) } finally { setOcupado(false) }
  }
  const comprovante = `/api/pedidos/${p.id}/comprovante`
  return (
    <Drawer open onClose={onClose} title={`Pedido #${p.id}`} subtitle={<Chip tom={STATUS_PEDIDO[p.status]?.[1]}>{STATUS_PEDIDO[p.status]?.[0] ?? p.status}</Chip>}
      footer={aberto && (recusando ? (
        <form className="flex w-full gap-2" onSubmit={e => { e.preventDefault(); agir('recusar') }}>
          <input data-autofocus className="field flex-1" placeholder="Motivo (vai para o cliente)" value={motivo} onChange={e => setMotivo(e.target.value)} />
          <button className="btn-danger" disabled={ocupado}>{ocupado ? <Spinner /> : <X className="size-4" />}Recusar</button>
          <button type="button" className="btn-ghost" onClick={() => setRecusando(false)}>Voltar</button>
        </form>
      ) : (
        <>
          <button className="btn-primary flex-1" disabled={ocupado} onClick={() => agir('aprovar')}>{ocupado ? <Spinner /> : <Check className="size-4" />}Aprovar e avisar o cliente</button>
          <button className="btn-quiet" onClick={() => setRecusando(true)}>Recusar</button>
        </>
      ))}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
        {[
          ['Evento', p.evento], ['Quantidade', `${p.quantidade} ingresso(s)`], ['Total', brl(Number(p.valor_total))], ['Forma', p.forma.toUpperCase()],
          ['Nome completo', p.nome], ['CPF', p.cpf], ['E-mail', p.email], ['Contato', `${p.canal} · ${p.contato_id}`],
          ['Criado', quando(p.criado_em)], ['Motivo da recusa', p.motivo_recusa],
        ].filter(([, v]) => v).map(([r, v]) => <div key={r}><dt className="text-faint">{r}</dt><dd className="break-words font-medium">{v}</dd></div>)}
      </dl>
      <p className="label mb-2 mt-8">Comprovante</p>
      {!p.comprovante_url ? <p className="text-sm text-muted">O cliente ainda não mandou.</p> : (
        <a href={comprovante} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl bg-surface-2">
          <img src={comprovante} alt={`Comprovante do pedido ${p.id}`} className="max-h-[420px] w-full object-contain"
            onError={e => { (e.currentTarget as HTMLImageElement).replaceWith(Object.assign(document.createElement('span'), { className: 'flex items-center gap-2 p-4 text-sm', textContent: 'Abrir comprovante (PDF ou arquivo)' })) }} />
        </a>
      )}
      {p.comprovante_url && <p className="mt-2 flex items-center gap-1.5 text-sm text-muted"><FileText className="size-4" />Confira o valor e o nome no extrato antes de aprovar.</p>}
    </Drawer>
  )
}
