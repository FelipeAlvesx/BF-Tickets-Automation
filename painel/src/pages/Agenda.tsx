import { CalendarClock, Check, Image, Megaphone, Plus, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { Campo, Liga } from '@/components/Campo'
import { Drawer } from '@/components/Drawer'
import { Page, PageHeader } from '@/components/Page'
import { Chip, Empty, HoldButton, Skeleton, Switch } from '@/components/ui'
import { useTabela } from '@/hooks/useTabela'
import { cn } from '@/lib/format'
import { DIAS, eventoBloqueia } from '@/lib/rotulos'
import type { Evento, LinhaAgenda } from '@/lib/types'

type Form = Omit<LinhaAgenda, 'id' | 'evento' | 'evento_ativo' | 'evento_passou' | 'enviado_hoje'> & { id?: number }
const vazio: Form = { horario: '09:00', dias_semana: [0, 1, 2, 3, 4, 5, 6], texto: '', imagem_url: '', evento_id: null, enviar_grupo: true, lembrete_story: false, ativo: true }

export default function Agenda() {
  const { data, salvar, apagar } = useTabela<LinhaAgenda>('agenda')
  const { data: eventos } = useTabela<Evento>('eventos', 60_000)
  const [form, setForm] = useState<Form | null>(null)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f))
  const gravar = async () => {
    if (!form) return
    const { id, ...d } = form
    if (await salvar(id ?? null, { ...d, imagem_url: d.imagem_url || null }, id ? 'Linha salva' : 'Linha criada')) setForm(null)
  }
  const ativosHoje = (data ?? []).filter(a => a.ativo && a.enviar_grupo && !eventoBloqueia(a)).length
  return (
    <Page>
      <PageHeader title="Agenda do grupo" subtitle={`Mensagens automáticas no grupo (com 0–60 s de variação, anti-ban) e lembretes de story para você. ${ativosHoje} envios ativos para o grupo por dia; o recomendado é até 10.`}
        actions={<button className="btn-primary" onClick={() => setForm({ ...vazio })}><Plus className="size-4" />Nova linha</button>} />
      {!data ? <Skeleton className="h-64" /> : !data.length ? <div className="panel"><Empty icon={<CalendarClock className="size-5" />} titulo="Agenda vazia" /></div> : (
        <ul className="panel divide-y divide-border">
          {data.map(a => (
            <li key={a.id} className={cn('flex items-center gap-4 px-5 py-4', !a.ativo && 'opacity-55')}>
              <span className="w-14 font-display text-xl tabular">{a.horario.slice(0, 5)}</span>
              <button className="min-w-0 flex-1 text-left" onClick={() => setForm({ ...a, imagem_url: a.imagem_url ?? '' })}>
                <p className="truncate text-sm">{a.texto}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {a.evento && <Chip tom="brand">{a.evento}</Chip>}
                  {eventoBloqueia(a) && <Chip tom="red" ponto>não envia: evento {a.evento_ativo ? 'já passou' : 'desligado'}</Chip>}
                  {a.enviar_grupo && <Chip><Users className="size-3" />grupo</Chip>}
                  {a.lembrete_story && <Chip tom="violet"><Megaphone className="size-3" />story</Chip>}
                  {a.imagem_url && <Chip><Image className="size-3" />imagem</Chip>}
                  {a.dias_semana.length < 7 && <Chip>{a.dias_semana.map(d => DIAS[d]).join(' ')}</Chip>}
                  {a.enviado_hoje && <Chip tom="green"><Check className="size-3" />enviada hoje</Chip>}
                </div>
              </button>
              <Switch on={a.ativo} onChange={v => salvar(a.id, { ativo: v }, v ? 'Linha ligada' : 'Linha desligada')} label={`Linha das ${a.horario.slice(0, 5)} ativa`} size="sm" />
            </li>
          ))}
        </ul>
      )}
      <Drawer open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Editar linha' : 'Nova linha'}
        footer={<>
          <button className="btn-primary flex-1" onClick={gravar} disabled={!form?.texto || !form.dias_semana.length}>Salvar</button>
          {form?.id && <HoldButton label="Apagar linha" onConfirm={async () => { await apagar(form.id!); setForm(null) }}><Trash2 className="size-4" />Apagar</HoldButton>}
        </>}>
        {form && (
          <div className="space-y-4">
            <Campo rotulo="Horário"><input type="time" className="field w-36" value={form.horario.slice(0, 5)} onChange={e => set('horario', e.target.value)} /></Campo>
            <div>
              <p className="mb-1.5 text-sm font-medium">Dias</p>
              <div className="flex flex-wrap gap-1.5">
                {DIAS.map((d, i) => {
                  const on = form.dias_semana.includes(i)
                  return <button key={d} type="button" aria-pressed={on} onClick={() => set('dias_semana', on ? form.dias_semana.filter(x => x !== i) : [...form.dias_semana, i].sort())}
                    className={cn('btn-sm btn', on ? 'bg-brand text-brand-foreground' : 'bg-surface-2 text-muted')}>{d}</button>
                })}
              </div>
            </div>
            <Campo rotulo="Evento" dica="Preenche {nome}, {data}, {local}, {preco} e {link} no texto.">
              <select className="field" value={form.evento_id ?? ''} onChange={e => set('evento_id', e.target.value ? Number(e.target.value) : null)}>
                <option value="">Nenhum</option>
                {(eventos ?? []).map(ev => <option key={ev.id} value={ev.id}>{ev.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Texto" dica="Ex.: Últimos ingressos do {nome}! {preco} — {link}"><textarea data-autofocus className="field" rows={5} value={form.texto} onChange={e => set('texto', e.target.value)} /></Campo>
            <Campo rotulo="URL da imagem (opcional)" dica="Sem imagem aqui, usa a arte do evento."><input type="url" className="field" value={form.imagem_url ?? ''} onChange={e => set('imagem_url', e.target.value)} /></Campo>
            <Liga rotulo="Enviar no grupo" on={form.enviar_grupo} onChange={v => set('enviar_grupo', v)} />
            <Liga rotulo="Lembrete de story" dica="Manda para o seu número a arte, a legenda e o link separado, para postar o story." on={form.lembrete_story} onChange={v => set('lembrete_story', v)} />
            <Liga rotulo="Ativa" on={form.ativo} onChange={v => set('ativo', v)} />
          </div>
        )}
      </Drawer>
    </Page>
  )
}
