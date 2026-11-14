import { CalendarClock, Check, ImagePlus, Megaphone, Plus, Sparkles, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { Campo, Liga } from '@/components/Campo'
import { Drawer } from '@/components/Drawer'
import { Page, PageHeader } from '@/components/Page'
import { Chip, Empty, HoldButton, Skeleton, Spinner, Switch } from '@/components/ui'
import { useTabela } from '@/hooks/useTabela'
import { post } from '@/lib/api'
import { useApp } from '@/lib/app'
import { cn } from '@/lib/format'
import { DIAS, eventoBloqueia } from '@/lib/rotulos'
import type { Evento, LinhaAgenda } from '@/lib/types'

type Form = Omit<LinhaAgenda, 'id' | 'evento' | 'evento_ativo' | 'evento_passou' | 'enviado_hoje'> & { id?: number }
const vazio: Form = { horario: '09:00', dias_semana: [0, 1, 2, 3, 4, 5, 6], texto: '', imagem_url: '', evento_id: null, enviar_grupo: true, lembrete_story: false, ativo: true }

// Reduz no navegador (máx. 1600 px, JPEG): sobe rápido, o WhatsApp recomprime nesse tamanho e a IA lê mais barato.
async function jpeg(arq: File) {
  const bmp = await createImageBitmap(arq).catch(() => { throw new Error('Não consegui abrir essa imagem. Use JPG, PNG ou WebP.') })
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) })
  const g = c.getContext('2d')!
  g.fillStyle = '#fff' // PNG transparente não vira fundo preto
  g.fillRect(0, 0, c.width, c.height)
  g.drawImage(bmp, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.85).split(',')[1]
}

export default function Agenda() {
  const { data, salvar, apagar } = useTabela<LinhaAgenda>('agenda')
  const { data: eventos } = useTabela<Evento>('eventos', 60_000)
  const { erro } = useApp()
  const [form, setForm] = useState<Form | null>(null)
  const [ocupado, setOcupado] = useState<'' | 'enviando' | 'gerando'>('')
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f))
  const gerar = async (imagem_url: string, evento_id: number | null) => {
    setOcupado('gerando')
    try {
      const r = await post<{ texto: string; evento_id: number | null }>('/legenda', { imagem_url, evento_id })
      setForm(f => f && { ...f, texto: r.texto, evento_id: f.evento_id ?? r.evento_id })
    } catch (e) { erro(e, 'Não consegui gerar o texto') } finally { setOcupado('') }
  }
  // Subiu a arte com o texto vazio: já gera. Com texto escrito, só troca a imagem (o botão gera quando quiser).
  const subir = async (arq?: File) => {
    if (!arq || !form) return
    setOcupado('enviando')
    try {
      const { url } = await post<{ url: string }>('/imagens', { base64: await jpeg(arq) })
      set('imagem_url', url)
      if (!form.texto.trim()) return await gerar(url, form.evento_id)
    } catch (e) { erro(e, 'Não consegui enviar a imagem') }
    setOcupado('')
  }
  const escolher = <input type="file" accept="image/*" className="sr-only" onChange={e => { subir(e.target.files?.[0]); e.target.value = '' }} />
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
              {a.imagem_url && <img src={a.imagem_url} alt="" loading="lazy" className="size-12 shrink-0 rounded-lg bg-surface-2 object-cover" />}
              <button className="min-w-0 flex-1 text-left" onClick={() => setForm({ ...a, imagem_url: a.imagem_url ?? '' })}>
                <p className="truncate text-sm">{a.texto}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {a.evento && <Chip tom="brand">{a.evento}</Chip>}
                  {eventoBloqueia(a) && <Chip tom="red" ponto>não envia: evento {a.evento_ativo ? 'já passou' : 'desligado'}</Chip>}
                  {a.enviar_grupo && <Chip><Users className="size-3" />grupo</Chip>}
                  {a.lembrete_story && <Chip tom="violet"><Megaphone className="size-3" />story</Chip>}
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
          <button className="btn-primary flex-1" onClick={gravar} disabled={!form?.texto || !form.dias_semana.length || !!ocupado}>Salvar</button>
          {form?.id && <HoldButton label="Apagar linha" onConfirm={async () => { await apagar(form.id!); setForm(null) }}><Trash2 className="size-4" />Apagar</HoldButton>}
        </>}>
        {form && (
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-sm font-medium">Imagem</p>
              {form.imagem_url ? (
                <div className="flex items-start gap-3">
                  <img src={form.imagem_url} alt="Arte da mensagem" className="size-28 shrink-0 rounded-xl bg-surface-2 object-cover" />
                  <div className="flex flex-col items-start gap-2">
                    <button type="button" className="btn-quiet btn-sm" disabled={!!ocupado} onClick={() => gerar(form.imagem_url!, form.evento_id)}>
                      <Sparkles className="size-4" />{form.texto.trim() ? 'Gerar outro texto' : 'Gerar texto com IA'}
                    </button>
                    <label className={cn('btn-quiet btn-sm cursor-pointer', ocupado && 'pointer-events-none opacity-50')}><ImagePlus className="size-4" />Trocar{escolher}</label>
                    <button type="button" className="btn-ghost btn-sm" disabled={!!ocupado} onClick={() => set('imagem_url', '')}>Remover</button>
                  </div>
                </div>
              ) : (
                <>
                  <label onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); subir(e.dataTransfer.files[0]) }}
                    className={cn('flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted hover:bg-surface-2', ocupado && 'pointer-events-none opacity-50')}>
                    <ImagePlus className="size-5" />
                    <span className="font-medium text-foreground">Envie a arte</span>
                    <span>Clique ou arraste aqui. A IA lê a imagem e escreve o texto.</span>
                    {escolher}
                  </label>
                  <input type="url" className="field mt-2" placeholder="ou cole o link da imagem (sem imagem, usa a arte do evento)" value={form.imagem_url ?? ''} onChange={e => set('imagem_url', e.target.value)} />
                </>
              )}
              {ocupado && <p className="mt-2 flex items-center gap-2 text-sm text-muted" aria-live="polite"><Spinner />{ocupado === 'enviando' ? 'Enviando a imagem…' : 'A IA está lendo a arte…'}</p>}
            </div>
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
            <Campo rotulo="Texto" dica="Ex.: Últimos ingressos do {nome}! {preco} — {link}. Revise antes de salvar."><textarea data-autofocus className="field" rows={5} value={form.texto} onChange={e => set('texto', e.target.value)} /></Campo>
            <Liga rotulo="Enviar no grupo" on={form.enviar_grupo} onChange={v => set('enviar_grupo', v)} />
            <Liga rotulo="Lembrete de story" dica="Manda para o seu número a arte, a legenda e o link separado, para postar o story." on={form.lembrete_story} onChange={v => set('lembrete_story', v)} />
            <Liga rotulo="Ativa" on={form.ativo} onChange={v => set('ativo', v)} />
          </div>
        )}
      </Drawer>
    </Page>
  )
}
