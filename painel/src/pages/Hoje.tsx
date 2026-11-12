import { motion } from 'framer-motion'
import { ArrowRight, CalendarClock, Check, Clock3, Megaphone, Smartphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Page, PageHeader, Section } from '@/components/Page'
import { Chip, Empty, Pulse, Rolling, Skeleton } from '@/components/ui'
import { usePoll } from '@/hooks/usePoll'
import { api } from '@/lib/api'
import { useApp } from '@/lib/app'
import { brl, ha } from '@/lib/format'
import { rise } from '@/lib/motion'
import { DIAS, STATUS_PEDIDO, contato, eventoBloqueia } from '@/lib/rotulos'
import type { LinhaAgenda, Pedido, WhatsApp } from '@/lib/types'

function Kpi({ rotulo, valor, to, destaque }: { rotulo: string; valor: number | string | undefined; to?: string; destaque?: boolean }) {
  const corpo = (
    <div className={`panel h-full p-5 ${destaque ? 'ring-2 ring-brand/40' : ''}`}>
      <p className="text-sm text-muted">{rotulo}</p>
      <p className="mt-2 font-display text-4xl tabular">{valor === undefined ? '—' : <Rolling value={valor} />}</p>
    </div>
  )
  return <motion.div variants={rise}>{to ? <Link to={to} className="block h-full">{corpo}</Link> : corpo}</motion.div>
}

export default function Hoje() {
  const { estado: e } = useApp()
  const { data: pedidos } = usePoll(() => api<Pedido[]>('/pedidos?status=aguardando_validacao'), 15_000)
  const { data: agenda } = usePoll(() => api<LinhaAgenda[]>('/t/agenda'), 30_000)
  const { data: zap } = usePoll(() => api<WhatsApp>('/whatsapp'), 30_000)
  const dow = new Date().getDay()
  const hoje = (agenda ?? []).filter(a => a.ativo && !eventoBloqueia(a) && a.dias_semana.includes(dow))
  const agoraHm = new Date().toTimeString().slice(0, 5)
  const saud = new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <Page>
      <PageHeader eyebrow={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} title={saud} subtitle="O que precisa de você agora e como o bot está indo hoje." />

      {zap && zap.estado !== 'open' && (
        <motion.div variants={rise}>
          <Link to="/whatsapp" className="mb-8 flex items-center gap-4 rounded-2xl bg-red/10 p-4 text-red">
            <Smartphone className="size-5" />
            <p className="flex-1 text-sm font-medium">{zap.estado === 'offline' ? 'A Evolution está fora do ar: o WhatsApp não recebe nem envia.' : 'O WhatsApp está desconectado. Conecte pelo QR para o bot voltar a atender.'}</p>
            <ArrowRight className="size-4" />
          </Link>
        </motion.div>
      )}

      <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Pedidos para validar" valor={e?.validar} to="/pedidos" destaque={!!e?.validar} />
        <Kpi rotulo="Em andamento (Pix)" valor={e?.em_andamento} to="/pedidos" />
        <Kpi rotulo="Querem vender" valor={e?.ofertas_novas} to="/ofertas" destaque={!!e?.ofertas_novas} />
        <Kpi rotulo="Chats com atendente" valor={e?.pausadas} to="/conversas" />
        <Kpi rotulo="Pessoas atendidas hoje" valor={e?.contatos_hoje} />
        <Kpi rotulo="Mensagens recebidas hoje" valor={e?.mensagens_hoje} />
        <Kpi rotulo="Aprovados hoje" valor={e?.aprovados_hoje} />
        <Kpi rotulo="Vendido hoje (Pix)" valor={e ? brl(e.receita_hoje) : undefined} />
      </div>

      <div className="grid gap-x-10 lg:grid-cols-[1.2fr_1fr]">
        <Section title="Pix para conferir" aside={<Link to="/pedidos" className="hover:text-foreground">ver todos</Link>}>
          {!pedidos ? <Skeleton className="h-40" /> : !pedidos.length ? (
            <div className="panel"><Empty icon={<Check className="size-5" />} titulo="Tudo em dia" texto="Nenhum comprovante esperando validação." /></div>
          ) : (
            <ul className="panel divide-y divide-border">
              {pedidos.slice(0, 6).map(p => (
                <li key={p.id}>
                  <Link to={`/pedidos?abrir=${p.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-2">
                    <span className="font-display text-xl tabular text-brand-ink">#{p.id}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.quantidade}x {p.evento} · {brl(Number(p.valor_total))}</p>
                      <p className="truncate text-sm text-muted">{p.nome || contato(p.canal, p.contato_id)} · {ha(p.atualizado_em)}</p>
                    </div>
                    <Chip tom={STATUS_PEDIDO[p.status]?.[1]}>{STATUS_PEDIDO[p.status]?.[0]}</Chip>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Agenda do grupo hoje" aside={e ? `${e.agenda_enviadas} de ${e.agenda_hoje} enviadas` : undefined}>
          {!agenda ? <Skeleton className="h-40" /> : !hoje.length ? (
            <div className="panel"><Empty icon={<CalendarClock className="size-5" />} titulo="Sem envios hoje" texto={`Nenhuma linha ativa para ${DIAS[dow]}.`} /></div>
          ) : (
            <ol className="panel divide-y divide-border">
              {hoje.map(a => {
                const passou = a.horario.slice(0, 5) <= agoraHm
                return (
                  <li key={a.id} className="flex items-center gap-4 px-5 py-3">
                    <span className="w-12 font-medium tabular">{a.horario.slice(0, 5)}</span>
                    <p className="min-w-0 flex-1 truncate text-sm text-muted">{a.texto}</p>
                    {a.lembrete_story && <Megaphone className="size-4 text-brand-ink" aria-label="Lembrete de story" />}
                    {a.enviado_hoje ? <Check className="size-4 text-green" aria-label="Enviada" /> : passou ? <Pulse on={false} tom="amber" /> : <Clock3 className="size-4 text-faint" aria-label="Agendada" />}
                  </li>
                )
              })}
            </ol>
          )}
        </Section>
      </div>
    </Page>
  )
}
