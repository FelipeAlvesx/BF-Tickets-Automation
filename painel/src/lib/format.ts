import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...v: ClassValue[]) => twMerge(clsx(v))

const DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const num = (v: number) => (v || 0).toLocaleString('pt-BR')

export function hora(iso?: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const dia0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
export const diasEntre = (a: Date, b: Date) => Math.round((dia0(a) - dia0(b)) / 864e5)

/** "Hoje", "Ontem", "Amanhã", "quinta" (na semana) ou "12 de out". */
export function dia(iso: string, base = new Date()) {
  const d = new Date(iso)
  const n = diasEntre(d, base)
  if (n === 0) return 'Hoje'
  if (n === -1) return 'Ontem'
  if (n === 1) return 'Amanhã'
  if (n > 1 && n < 7) return DIA[d.getDay()]
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '')
}

export const quando = (iso: string) => `${dia(iso)}, ${hora(iso)}`

/** Para a lista de conversas: "14:32", "ontem", "seg", "12/10". */
export function curto(iso: string) {
  const d = new Date(iso)
  const n = diasEntre(new Date(), d)
  if (n === 0) return hora(iso)
  if (n === 1) return 'ontem'
  if (n < 7) return DIA[d.getDay()].slice(0, 3)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function ha(iso: string, agora = Date.now()) {
  const s = Math.max(0, (agora - new Date(iso).getTime()) / 1000)
  if (s < 45) return 'agora'
  if (s < 3600) return `há ${Math.round(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  const d = Math.round(s / 86400)
  return d === 1 ? 'ontem' : `há ${d} dias`
}

export function fone(phone: string) {
  const d = String(phone || '').split('@')[0].replace(/\D/g, '')
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return `(${d.slice(2, 4)}) ${d.slice(4, -4)}-${d.slice(-4)}`
  if (d.startsWith('57') && d.length === 12) return `+57 ${d.slice(2, 5)} ${d.slice(5, 8)}-${d.slice(8)}`
  return d.length && d.length <= 13 ? `+${d}` : 'Contato do WhatsApp'
}

export const iniciais = (nome: string) =>
  (nome || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '·'

export const primeiro = (nome: string) => (nome || '').trim().split(/\s+/)[0] || ''

/** `*negrito*` e `_itálico_` do WhatsApp, sem innerHTML. */
export function partesZap(texto: string): { t: string; b?: boolean; i?: boolean }[] {
  const out: { t: string; b?: boolean; i?: boolean }[] = []
  const re = /\*([^*\n]+)\*|(?:^|(?<=\s))_([^_\n]+)_(?=\s|$)/g
  let last = 0
  for (const m of texto.matchAll(re)) {
    if (m.index! > last) out.push({ t: texto.slice(last, m.index) })
    out.push(m[1] ? { t: m[1], b: true } : { t: m[2], i: true })
    last = m.index! + m[0].length
  }
  if (last < texto.length) out.push({ t: texto.slice(last) })
  return out
}

export const isoDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
