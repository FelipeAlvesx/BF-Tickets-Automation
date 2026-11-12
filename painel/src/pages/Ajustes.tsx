import { Copy, Database, ExternalLink, Moon, Server, Sun, Workflow } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Campo, Liga } from '@/components/Campo'
import { Page, PageHeader } from '@/components/Page'
import { Pulse, Segmented } from '@/components/ui'
import { usePoll } from '@/hooks/usePoll'
import { useTabela } from '@/hooks/useTabela'
import { api } from '@/lib/api'
import { useApp } from '@/lib/app'
import type { Sistema } from '@/lib/types'
import { Bloco } from './WhatsApp'

interface Cfg { chave: string; valor: string }
const PIX = [['pix_chave', 'Chave Pix', 'Vai sozinha numa mensagem, fácil de copiar.'], ['pix_titular', 'Titular', ''], ['pix_banco', 'Banco', '']] as const

export default function Ajustes() {
  const { estado, setBot, tema, trocarTema, toast } = useApp()
  const { data, salvar } = useTabela<Cfg>('config', 0)
  const { data: sis } = usePoll(() => api<Sistema>('/sistema'), 30_000)
  const [form, setForm] = useState<Record<string, string>>({})
  useEffect(() => { if (data) setForm(Object.fromEntries(data.map(c => [c.chave, c.valor]))) }, [data])
  const valor = (k: string) => data?.find(c => c.chave === k)?.valor ?? ''
  const salvarCampos = async (chaves: readonly string[], msg: string) => {
    for (const k of chaves) if (form[k] !== valor(k)) await salvar(k, { valor: form[k] ?? '' }, msg)
  }
  const mudou = (chaves: readonly string[]) => chaves.some(k => (form[k] ?? '') !== valor(k))
  const horas = valor('pausa_humano_horas') || '12'

  return (
    <Page>
      <PageHeader title="Ajustes" subtitle="Como o bot se comporta, os dados do Pix e o estado de cada peça do sistema." />

      <Bloco titulo="Bot" texto="Pausado para todos, ele só grava as mensagens; ninguém recebe resposta automática.">
        <Liga rotulo={estado?.bot_ligado ? 'Respondendo WhatsApp e Instagram' : 'Pausado para todos'} on={estado?.bot_ligado ?? true} onChange={setBot} />
        <div className="mt-5">
          <p className="mb-2 text-sm font-medium">Pausa quando um humano assume</p>
          <p className="mb-3 text-sm text-muted">Quanto tempo o bot fica calado num chat depois que alguém responde pelo celular, pelo painel ou o cliente pede atendente.</p>
          <Segmented value={['2', '6', '12', '24'].includes(horas) ? horas : '12'} onChange={v => salvar('pausa_humano_horas', { valor: v }, `Pausa de ${v} h`)}
            options={['2', '6', '12', '24'].map(h => ({ value: h, label: `${h} h` }))} />
        </div>
      </Bloco>

      <Bloco titulo="Pix" texto="O que o bot manda quando o cliente escolhe pagar por Pix.">
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); salvarCampos(PIX.map(p => p[0]), 'Pix atualizado') }}>
          {PIX.map(([k, r, d]) => <Campo key={k} rotulo={r} dica={d}><input className="field" value={form[k] ?? ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></Campo>)}
          <button className="btn-primary" disabled={!mudou(PIX.map(p => p[0]))}>Salvar Pix</button>
        </form>
      </Bloco>

      <Bloco titulo="Número do admin" texto="Recebe comprovantes, pedidos para validar, pedidos de atendente e os lembretes de story. Só ele pode mandar /comandos.">
        <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); salvarCampos(['admin_numero'], 'Número do admin salvo') }}>
          <Campo rotulo="WhatsApp com DDI e DDD (só números)"><input className="field w-64" inputMode="numeric" value={form.admin_numero ?? ''} onChange={e => setForm(f => ({ ...f, admin_numero: e.target.value.replace(/\D/g, '') }))} placeholder="5571999999999" /></Campo>
          <button className="btn-primary" disabled={!mudou(['admin_numero'])}>Salvar</button>
        </form>
      </Bloco>

      <Bloco titulo="Instagram (ManyChat)" texto="Cole esta URL no External Request do fluxo do ManyChat (passo a passo em manychat/SETUP.md).">
        <div className="panel flex items-center gap-3 p-4">
          <code className="min-w-0 flex-1 truncate text-sm">{sis?.webhook_manychat ?? '…'}</code>
          <button className="btn-quiet btn-sm" onClick={() => { navigator.clipboard.writeText(sis?.webhook_manychat ?? ''); toast('URL copiada') }}><Copy className="size-4" />Copiar</button>
        </div>
        {sis && !sis.tunel && sis.webhook_manychat.startsWith('http://localhost') && <p className="mt-2 text-sm text-amber">Localhost não é alcançável pelo ManyChat. Em teste, rode <code>make tunel</code>; na VPS, use o domínio com HTTPS.</p>}
      </Bloco>

      <Bloco titulo="Sistema" texto="Cada container do projeto. NocoDB é a planilha do banco; o n8n é onde estão os fluxos.">
        <ul className="panel divide-y divide-border">
          {([['banco', 'Banco (Postgres)', Database], ['evolution', 'Evolution (WhatsApp)', Server], ['n8n', 'n8n (fluxos)', Workflow], ['nocodb', 'NocoDB (planilha)', Database]] as const).map(([k, r, I]) => (
            <li key={k} className="flex items-center gap-3 px-5 py-3">
              <I className="size-4 text-faint" /><span className="flex-1 text-sm">{r}</span>
              <Pulse on={!!sis?.servicos[k]} tom={sis ? (sis.servicos[k] ? 'green' : 'red') : 'amber'} />
              <span className="w-16 text-sm text-muted">{!sis ? '…' : sis.servicos[k] ? 'no ar' : 'fora'}</span>
              {k === 'n8n' && sis && <a className="btn-ghost btn-sm" href={sis.links.n8n} target="_blank" rel="noreferrer">Abrir<ExternalLink className="size-3.5" /></a>}
              {k === 'nocodb' && sis && <a className="btn-ghost btn-sm" href={sis.links.nocodb} target="_blank" rel="noreferrer">Abrir<ExternalLink className="size-3.5" /></a>}
            </li>
          ))}
        </ul>
      </Bloco>

      <Bloco titulo="Aparência" texto="Vale só neste aparelho.">
        <div className="flex gap-3">
          {(['light', 'dark'] as const).map(t => (
            <button key={t} onClick={() => tema !== t && trocarTema()} aria-pressed={tema === t} className={`panel flex flex-1 items-center gap-3 p-4 text-left ${tema === t ? 'ring-2 ring-brand' : ''}`}>
              {t === 'light' ? <Sun className="size-5" /> : <Moon className="size-5" />}<span className="text-sm font-medium">{t === 'light' ? 'Claro' : 'Escuro'}</span>
            </button>
          ))}
        </div>
      </Bloco>
    </Page>
  )
}
