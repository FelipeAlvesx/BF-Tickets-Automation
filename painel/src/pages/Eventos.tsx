import { CalendarDays, MapPin, Plus, Ticket, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Campo, Liga } from '@/components/Campo'
import { Drawer } from '@/components/Drawer'
import { Page, PageHeader } from '@/components/Page'
import { Chip, Empty, HoldButton, Skeleton, Switch } from '@/components/ui'
import { useTabela } from '@/hooks/useTabela'
import { dataBahia, deInput, paraInput } from '@/lib/bahia'
import { brl } from '@/lib/format'
import type { Evento } from '@/lib/types'

type Form = Omit<Evento, 'id' | 'data_evento'> & { id?: number; data_evento: string }
const vazio: Form = { nome: '', data_evento: '', local: '', link_compra: '', preco: '', imagem_url: '', ticketeira: '', ativo: true }

export default function Eventos() {
  const { data, salvar, apagar } = useTabela<Evento>('eventos')
  const [form, setForm] = useState<Form | null>(null)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f))
  const gravar = async () => {
    if (!form) return
    const { id, ...d } = form
    const r = await salvar(id ?? null, { ...d, data_evento: deInput(d.data_evento) ?? undefined, preco: String(d.preco).replace(',', '.') } as Partial<Evento>, id ? 'Evento salvo' : 'Evento criado')
    if (r) setForm(null)
  }
  return (
    <Page>
      <PageHeader title="Eventos" subtitle="O bot só fala de eventos ativos e usa exatamente o preço, a data e o link daqui." actions={<button className="btn-primary" onClick={() => setForm({ ...vazio })}><Plus className="size-4" />Novo evento</button>} />
      {!data ? <Skeleton className="h-64" /> : !data.length ? <div className="panel"><Empty icon={<Ticket className="size-5" />} titulo="Nenhum evento" texto="Cadastre o primeiro para o bot começar a vender." /></div> : (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.map(e => (
            <li key={e.id} className={`panel flex overflow-hidden ${e.ativo ? '' : 'opacity-60'}`}>
              {e.imagem_url && <img src={e.imagem_url} alt="" className="w-28 shrink-0 object-cover" />}
              <button className="min-w-0 flex-1 p-5 text-left" onClick={() => setForm({ ...e, data_evento: paraInput(e.data_evento) })}>
                <p className="font-display text-xl leading-tight">{e.nome}</p>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-muted"><CalendarDays className="size-4" />{dataBahia(e.data_evento)}</p>
                <p className="flex items-center gap-1.5 text-sm text-muted"><MapPin className="size-4" />{e.local || '—'}</p>
                <p className="flex items-center gap-1.5 text-sm text-muted"><Ticket className="size-4" />{e.ticketeira || 'Ticketeira não cadastrada'}</p>
                <p className="mt-2 font-semibold tabular">{brl(Number(e.preco))}</p>
              </button>
              <div className="flex flex-col items-end justify-between p-4">
                <Switch on={e.ativo} onChange={v => salvar(e.id, { ativo: v }, v ? 'Evento ativo no bot' : 'Evento escondido do bot')} label={`Evento ${e.nome} ativo`} size="sm" />
                {!e.ativo && <Chip>inativo</Chip>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Drawer open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Editar evento' : 'Novo evento'}
        footer={<>
          <button className="btn-primary flex-1" onClick={gravar} disabled={!form?.nome || !form?.data_evento}>Salvar</button>
          {form?.id && <HoldButton label="Apagar evento" onConfirm={async () => { await apagar(form.id!); setForm(null) }}><Trash2 className="size-4" />Apagar</HoldButton>}
        </>}>
        {form && (
          <div className="space-y-4">
            <Campo rotulo="Nome"><input data-autofocus className="field" value={form.nome} onChange={e => set('nome', e.target.value)} /></Campo>
            <Campo rotulo="Data e hora (horário da Bahia)"><input type="datetime-local" className="field" value={form.data_evento} onChange={e => set('data_evento', e.target.value)} /></Campo>
            <Campo rotulo="Local"><input className="field" value={form.local ?? ''} onChange={e => set('local', e.target.value)} /></Campo>
            <Campo rotulo="Preço por ingresso (R$)"><input className="field" inputMode="decimal" value={form.preco} onChange={e => set('preco', e.target.value)} /></Campo>
            <Campo rotulo="Ticketeira de origem" dica="Ex.: Ticketmaker, Ingresse, Sympla. O bot pede ao cliente o e-mail da conta dele nessa ticketeira, porque é lá que o ingresso cai."><input className="field" placeholder="Ticketmaker" value={form.ticketeira ?? ''} onChange={e => set('ticketeira', e.target.value)} /></Campo>
            <Campo rotulo="Link oficial de compra" dica="É o que o bot manda quando o cliente escolhe pagar pelo link."><input type="url" className="field" value={form.link_compra ?? ''} onChange={e => set('link_compra', e.target.value)} /></Campo>
            <Campo rotulo="URL da arte" dica="Usada no grupo e no lembrete de story quando a linha da agenda não tem imagem própria."><input type="url" className="field" value={form.imagem_url ?? ''} onChange={e => set('imagem_url', e.target.value)} /></Campo>
            <Liga rotulo="Ativo" dica="Desligado, o bot não oferece este evento." on={form.ativo} onChange={v => set('ativo', v)} />
          </div>
        )}
      </Drawer>
    </Page>
  )
}
