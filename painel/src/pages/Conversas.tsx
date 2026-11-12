import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Bot, Instagram, MessageCircle, Pause, Play, Send, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Page, PageHeader } from '@/components/Page'
import { Avatar, Chip, Empty, Segmented, Skeleton, Spinner } from '@/components/ui'
import { usePoll } from '@/hooks/usePoll'
import { api, post } from '@/lib/api'
import { useApp } from '@/lib/app'
import { cn, curto, fone, hora } from '@/lib/format'
import { item } from '@/lib/motion'
import { ESTADO_CONVERSA, STATUS_PEDIDO } from '@/lib/rotulos'
import type { ConversaDetalhe, ConversaItem } from '@/lib/types'

const nomeDe = (c: { nome: string | null; canal: string; contato_id: string }) => c.nome || (c.canal === 'whatsapp' ? fone(c.contato_id) : `Instagram ${c.contato_id}`)

export default function Conversas() {
  const [filtro, setFiltro] = useState<'todas' | 'pausadas'>('todas')
  const { data } = usePoll(() => api<ConversaItem[]>('/conversas'), 6000)
  const [sel, setSel] = useState<{ canal: string; id: string } | null>(null)
  const lista = (data ?? []).filter(c => filtro === 'todas' || c.pausado)
  return (
    <Page wide>
      <PageHeader title="Conversas" subtitle="WhatsApp e Instagram num lugar só. Responder daqui pausa o bot naquele chat." />
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className={cn('min-w-0', sel && 'hidden lg:block')}>
          <Segmented className="mb-3" value={filtro} onChange={setFiltro} options={[{ value: 'todas', label: 'Todas' }, { value: 'pausadas', label: 'Com atendente', count: (data ?? []).filter(c => c.pausado).length }]} />
          {!data ? <Skeleton className="h-96" /> : !lista.length ? <div className="panel"><Empty titulo="Nenhuma conversa" texto="Quando alguém chamar no WhatsApp ou no Instagram, aparece aqui." /></div> : (
            <ul className="panel max-h-[calc(100dvh-240px)] divide-y divide-border overflow-y-auto">
              <AnimatePresence initial={false}>
                {lista.map(c => {
                  const ativo = sel?.canal === c.canal && sel.id === c.contato_id
                  return (
                    <motion.li key={`${c.canal}:${c.contato_id}`} layout variants={item} initial="hidden" animate="show" exit="exit">
                      <button onClick={() => setSel({ canal: c.canal, id: c.contato_id })} className={cn('flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2', ativo && 'bg-brand-soft')}>
                        <Avatar nome={nomeDe(c)} />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 text-sm font-semibold">
                            {c.canal === 'instagram' ? <Instagram className="size-3.5 shrink-0 text-faint" /> : <MessageCircle className="size-3.5 shrink-0 text-faint" />}
                            <span className="truncate">{nomeDe(c)}</span>
                            <span className="ml-auto shrink-0 text-[0.8rem] font-normal text-faint">{curto(c.ultima_em ?? c.atualizado_em)}</span>
                          </p>
                          <p className="truncate text-sm text-muted">{c.ultima_direcao === 'out' ? 'Bot: ' : c.ultima_direcao === 'humano' ? 'Você: ' : ''}{c.ultima ?? '—'}</p>
                          <div className="mt-1 flex gap-1.5">
                            {c.pausado && <Chip tom="amber" ponto>com atendente</Chip>}
                            {!!c.pedidos_abertos && <Chip tom="brand">pedido aberto</Chip>}
                          </div>
                        </div>
                      </button>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
        <div className={cn('min-w-0', !sel && 'hidden lg:block')}>
          {sel ? <Detalhe canal={sel.canal} id={sel.id} voltar={() => setSel(null)} /> : <div className="panel"><Empty icon={<MessageCircle className="size-5" />} titulo="Escolha uma conversa" /></div>}
        </div>
      </div>
    </Page>
  )
}

function Detalhe({ canal, id, voltar }: { canal: string; id: string; voltar: () => void }) {
  const { toast, erro, refetchEstado } = useApp()
  const { data, refetch } = usePoll(() => api<ConversaDetalhe>(`/conversas/${canal}/${encodeURIComponent(id)}`), 5000, `${canal}:${id}`)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const fim = useRef<HTMLDivElement>(null)
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }) }, [data?.historico.length])
  if (!data) return <Skeleton className="h-[60vh]" />
  const c = data.conversa
  const pausa = async (pausar: boolean) => {
    try { await post(`/conversas/${canal}/${encodeURIComponent(id)}/pausa`, { pausar }); refetch(); refetchEstado(); toast(pausar ? 'Bot pausado neste chat' : 'Chat devolvido ao bot', pausar ? 'Agora é com você.' : 'Ele recomeça do menu na próxima mensagem.', 'info') } catch (e) { erro(e) }
  }
  const enviar = async () => {
    if (!texto.trim()) return
    setEnviando(true)
    try { await post(`/conversas/${canal}/${encodeURIComponent(id)}/mensagem`, { texto }); setTexto(''); refetch(); refetchEstado() } catch (e) { erro(e, 'Não foi enviada') } finally { setEnviando(false) }
  }
  return (
    <div className="panel flex h-[calc(100dvh-200px)] min-h-[480px] flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <button className="btn-ghost -ml-2 size-9 px-0 lg:hidden" onClick={voltar} aria-label="Voltar"><ArrowLeft className="size-5" /></button>
        <Avatar nome={nomeDe(c)} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{nomeDe(c)}</p>
          <p className="truncate text-sm text-muted">{canal === 'whatsapp' ? fone(id) : `Instagram · ${id}`} · {ESTADO_CONVERSA[c.estado] ?? c.estado}</p>
        </div>
        {c.pausado
          ? <button className="btn-primary btn-sm" onClick={() => pausa(false)}><Play className="size-4" />Devolver ao bot</button>
          : <button className="btn-quiet btn-sm" onClick={() => pausa(true)}><Pause className="size-4" />Assumir conversa</button>}
      </header>
      {!!data.pedidos.length && (
        <div className="flex gap-2 overflow-x-auto border-b border-border px-5 py-2">
          {data.pedidos.map(p => <Chip key={p.id} tom={STATUS_PEDIDO[p.status]?.[1]}>#{p.id} · {p.quantidade}x {p.evento} · {STATUS_PEDIDO[p.status]?.[0]}</Chip>)}
        </div>
      )}
      <div className="flex-1 space-y-2 overflow-y-auto bg-surface-2/50 px-5 py-4">
        {data.historico.map((m, i) => (
          <div key={i} className={cn('flex', m.direcao === 'in' ? 'justify-start' : 'justify-end')}>
            <div className={cn('max-w-[78%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm',
              m.direcao === 'in' ? 'bg-surface shadow-hair' : m.direcao === 'humano' ? 'bg-brand text-brand-foreground' : 'bg-brand-soft')}>
              {m.direcao !== 'in' && <span className="mb-0.5 flex items-center gap-1 text-[0.75rem] opacity-70">{m.direcao === 'out' ? <Bot className="size-3" /> : <UserRound className="size-3" />}{m.direcao === 'out' ? 'Bot' : 'Atendente'}</span>}
              {m.texto}
              <span className="ml-2 align-bottom text-[0.72rem] opacity-60">{hora(m.criado_em)}</span>
            </div>
          </div>
        ))}
        <div ref={fim} />
      </div>
      <form className="flex gap-2 border-t border-border p-3" onSubmit={e => { e.preventDefault(); enviar() }}>
        <textarea className="field min-h-10 flex-1 resize-none" rows={1} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Responder como atendente (pausa o bot neste chat)"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }} />
        <button className="btn-primary" disabled={enviando || !texto.trim()} aria-label="Enviar">{enviando ? <Spinner /> : <Send className="size-4" />}</button>
      </form>
    </div>
  )
}
