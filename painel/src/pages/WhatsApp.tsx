import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, CircleAlert, QrCode, RefreshCw, Search, Smartphone, Unplug, Users, Webhook } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Page, PageHeader } from '@/components/Page'
import { Chip, HoldButton, Pulse, Spinner } from '@/components/ui'
import { usePoll } from '@/hooks/usePoll'
import { api, post, put } from '@/lib/api'
import { useApp } from '@/lib/app'
import { fone } from '@/lib/format'
import { EASE_OUT, rise } from '@/lib/motion'
import type { WhatsApp } from '@/lib/types'

const ROTULO: Record<WhatsApp['estado'], [string, 'green' | 'amber' | 'red']> = {
  open: ['Conectado', 'green'], connecting: ['Esperando o QR', 'amber'], close: ['Desconectado', 'red'], missing: ['Número ainda não pareado', 'red'], offline: ['Evolution fora do ar', 'red'],
}

export function Bloco({ titulo, texto, children }: { titulo: string; texto?: string; children: ReactNode }) {
  return (
    <motion.section variants={rise} className="grid gap-x-12 gap-y-4 border-t border-border py-8 first:border-t-0 first:pt-0 md:grid-cols-[240px_1fr]">
      <div><h2 className="text-[1.05rem] font-semibold">{titulo}</h2>{texto && <p className="mt-1 text-sm text-muted">{texto}</p>}</div>
      <div className="min-w-0">{children}</div>
    </motion.section>
  )
}

export default function WhatsAppPage() {
  const { toast, erro } = useApp()
  const [qr, setQr] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const { data, setData, refetch } = usePoll(() => api<WhatsApp>('/whatsapp'), qr ? 3000 : 15_000, !!qr)
  useEffect(() => { if (qr && data?.estado === 'open') { setQr(null); toast('WhatsApp conectado', 'O bot já recebe as mensagens.') } }, [data?.estado]) // eslint-disable-line react-hooks/exhaustive-deps

  const acao = async (nome: string, fn: () => Promise<WhatsApp>, msg?: string) => {
    setOcupado(nome)
    try {
      const r = await fn()
      setData(r)
      if (r.qr) setQr(r.qr.startsWith('data:') ? r.qr : `data:image/png;base64,${r.qr}`)
      if (msg) toast(msg)
    } catch (e) { erro(e) } finally { setOcupado(null) }
  }
  const est = data?.estado
  const conectado = est === 'open'

  return (
    <Page>
      <PageHeader title="WhatsApp" subtitle="O número dedicado do bot (instância da Evolution), o webhook que liga ele ao n8n e o grupo das mensagens agendadas." />

      <Bloco titulo="Número e instância" texto="Pareie o celular do bot pelo QR. Desconectar derruba o atendimento no WhatsApp até parear de novo.">
        <div className="panel p-5">
          <div className="flex flex-wrap items-center gap-4">
            {data?.foto ? <img src={data.foto} alt="" className="size-12 rounded-full object-cover" /> : <span className="grid size-12 place-items-center rounded-full bg-surface-2"><Smartphone className="size-5 text-brand-ink" /></span>}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-semibold"><Pulse on={conectado} tom={est ? ROTULO[est][1] : 'amber'} />{est ? ROTULO[est][0] : 'Consultando…'}</p>
              <p className="text-sm text-muted">{data?.numero ? `${fone(data.numero)}${data.nome ? ` · ${data.nome}` : ''}` : 'Sem número pareado'} · instância <code>{data?.instancia ?? '—'}</code></p>
            </div>
            {data && !conectado && (
              <button className="btn-primary" disabled={!!ocupado || est === 'offline'} onClick={() => acao('conectar', () => post<WhatsApp>('/whatsapp/conectar'))}>
                {ocupado === 'conectar' ? <Spinner /> : <QrCode className="size-4" />}{qr ? 'Gerar novo QR' : est === 'missing' ? 'Criar e conectar' : 'Conectar'}
              </button>
            )}
            {conectado && <>
              <button className="btn-quiet" disabled={!!ocupado} onClick={() => acao('reiniciar', () => post<WhatsApp>('/whatsapp/reiniciar'), 'Instância reiniciada')}>{ocupado === 'reiniciar' ? <Spinner /> : <RefreshCw className="size-4" />}Reiniciar</button>
              <HoldButton label="Desconectar o WhatsApp" onConfirm={() => acao('sair', () => post<WhatsApp>('/whatsapp/desconectar'), 'WhatsApp desconectado')}><Unplug className="size-4" />Desconectar</HoldButton>
            </>}
          </div>
          <AnimatePresence>
            {qr && !conectado && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: EASE_OUT }} className="overflow-hidden">
                <div className="mt-5 flex flex-wrap items-center gap-6 border-t border-border pt-5">
                  <img src={qr} alt="QR Code para conectar o WhatsApp" className="size-52 rounded-xl bg-white p-2" />
                  <ol className="space-y-2 text-sm text-muted">
                    <li>1. No celular do bot, abra o WhatsApp (de preferência o Business).</li>
                    <li>2. Toque em Aparelhos conectados → Conectar aparelho.</li>
                    <li>3. Aponte a câmera. Se expirar, gere um novo QR.</li>
                  </ol>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {est === 'offline' && <p className="mt-4 rounded-xl bg-red/10 px-4 py-3 text-sm text-red">O container da Evolution não respondeu. No servidor: <code>docker compose up -d evolution</code>.</p>}
        </div>
      </Bloco>

      <Bloco titulo="Webhook" texto="É por ele que cada mensagem recebida chega ao n8n. Se estiver errado, o bot fica mudo.">
        <div className="panel flex flex-wrap items-center gap-4 p-5">
          <Webhook className="size-5 text-brand-ink" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-semibold">{data?.webhook?.ok ? <><CheckCircle2 className="size-4 text-green" />Ligado ao n8n</> : <><CircleAlert className="size-4 text-red" />Não configurado</>}</p>
            <p className="truncate text-sm text-muted">{data?.webhook?.url ?? '—'}</p>
          </div>
          {data && est !== 'missing' && est !== 'offline' && !data.webhook?.ok && (
            <button className="btn-primary" disabled={!!ocupado} onClick={() => acao('webhook', () => post<WhatsApp>('/whatsapp/webhook'), 'Webhook configurado')}>{ocupado === 'webhook' ? <Spinner /> : null}Corrigir</button>
          )}
        </div>
      </Bloco>

      <Bloco titulo="Grupo das mensagens" texto="O grupo que recebe a agenda. O número do bot precisa estar no grupo (de preferência como admin).">
        <Grupo atual={data?.grupo_jid ?? ''} conectado={conectado} onSalvo={refetch} />
      </Bloco>
    </Page>
  )
}

function Grupo({ atual, conectado, onSalvo }: { atual: string; conectado: boolean; onSalvo: () => void }) {
  const { toast, erro } = useApp()
  const [grupos, setGrupos] = useState<{ jid: string; nome: string; tamanho: number | null }[] | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [busca, setBusca] = useState('')
  const carregar = async () => {
    setCarregando(true)
    try { setGrupos(await api('/whatsapp/grupos')) } catch (e) { erro(e) } finally { setCarregando(false) }
  }
  const escolher = async (jid: string) => {
    try { await put('/whatsapp/grupo', { jid }); onSalvo(); toast(jid ? 'Grupo escolhido' : 'Grupo removido', jid ? 'A agenda passa a enviar para ele.' : 'A agenda não envia para grupo nenhum.', 'ok') } catch (e) { erro(e) }
  }
  const nomeAtual = grupos?.find(g => g.jid === atual)?.nome
  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-center gap-4">
        <Users className="size-5 text-brand-ink" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{atual ? (nomeAtual ?? 'Grupo escolhido') : 'Nenhum grupo escolhido'}</p>
          <p className="truncate text-sm text-muted">{atual || 'Sem grupo, a agenda só manda os lembretes de story.'}</p>
        </div>
        {atual && <button className="btn-ghost btn-sm" onClick={() => escolher('')}>Remover</button>}
        <button className="btn-quiet" disabled={!conectado || carregando} onClick={carregar} title={conectado ? undefined : 'Conecte o WhatsApp primeiro'}>{carregando ? <Spinner /> : <Search className="size-4" />}Escolher grupo</button>
      </div>
      {grupos && (
        <div className="mt-5 border-t border-border pt-4">
          <input className="field mb-3" placeholder="Filtrar pelo nome" value={busca} onChange={e => setBusca(e.target.value)} />
          <ul className="max-h-72 divide-y divide-border overflow-y-auto">
            {grupos.filter(g => !busca || g.nome?.toLowerCase().includes(busca.toLowerCase())).map(g => (
              <li key={g.jid} className="flex items-center gap-3 py-2.5">
                <p className="min-w-0 flex-1 truncate text-sm">{g.nome}{g.tamanho ? <span className="text-faint"> · {g.tamanho} pessoas</span> : null}</p>
                {g.jid === atual ? <Chip tom="green">em uso</Chip> : <button className="btn-quiet btn-sm" onClick={() => escolher(g.jid)}>Usar</button>}
              </li>
            ))}
            {!grupos.length && <li className="py-3 text-sm text-muted">O número não está em nenhum grupo.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
