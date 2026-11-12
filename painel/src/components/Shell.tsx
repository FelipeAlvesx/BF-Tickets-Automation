import { AnimatePresence, motion } from 'framer-motion'
import { CalendarClock, Handshake, Home, Menu, MessageSquareText, MessagesSquare, Moon, Settings2, Smartphone, Sun, Ticket, TicketCheck, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { usePoll } from '@/hooks/usePoll'
import { api } from '@/lib/api'
import { useApp } from '@/lib/app'
import { cn } from '@/lib/format'
import { EASE_DRAWER, spring } from '@/lib/motion'
import type { WhatsApp } from '@/lib/types'
import { Pulse, Rolling, Switch } from './ui'

interface Item { to: string; label: string; icon: typeof Home; badge?: number; urgente?: boolean }

function useGrupos(): [string, Item[]][] {
  const { estado } = useApp()
  return [
    ['Operação', [
      { to: '/', label: 'Hoje', icon: Home },
      { to: '/pedidos', label: 'Pedidos', icon: TicketCheck, badge: estado?.validar, urgente: true },
      { to: '/conversas', label: 'Conversas', icon: MessagesSquare, badge: estado?.pausadas },
      { to: '/ofertas', label: 'Querem vender', icon: Handshake, badge: estado?.ofertas_novas, urgente: true },
    ]],
    ['Conteúdo', [
      { to: '/eventos', label: 'Eventos', icon: Ticket },
      { to: '/agenda', label: 'Agenda do grupo', icon: CalendarClock },
      { to: '/textos', label: 'Textos do bot', icon: MessageSquareText },
    ]],
    ['Sistema', [
      { to: '/whatsapp', label: 'WhatsApp', icon: Smartphone },
      { to: '/ajustes', label: 'Ajustes', icon: Settings2 },
    ]],
  ]
}

function NavItem({ item }: { item: Item }) {
  const I = item.icon
  return (
    <NavLink to={item.to} end={item.to === '/'}
      className={({ isActive }) => cn('relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-200', isActive ? 'text-foreground' : 'text-muted hover:text-foreground')}>
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="nav-pill" transition={spring} className="absolute inset-0 rounded-xl bg-surface shadow-sm ring-1 ring-border" />}
          <I className={cn('relative size-[18px] shrink-0', isActive && 'text-brand-ink')} strokeWidth={1.9} />
          <span className="relative flex-1 truncate">{item.label}</span>
          {!!item.badge && (
            <span className={cn('relative min-w-6 rounded-full px-1.5 text-center text-[0.8rem] font-semibold leading-6', item.urgente ? 'bg-brand text-brand-foreground' : 'bg-surface-3 text-muted')}>
              <Rolling value={item.badge} />
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

function Lateral() {
  const { estado, setBot, tema, trocarTema } = useApp()
  const { data: zap } = usePoll(() => api<WhatsApp>('/whatsapp'), 30_000)
  const on = estado?.bot_ligado ?? true
  const zapOk = zap?.estado === 'open'
  return (
    <>
      <div className="flex items-center gap-3 px-2">
        <span className="grid size-10 place-items-center rounded-xl bg-brand text-brand-foreground"><Ticket className="size-5" /></span>
        <div className="min-w-0"><p className="font-display text-[1.15rem] leading-tight">BF Tickets</p><p className="truncate text-sm text-muted">Painel do bot</p></div>
      </div>
      <nav className="-mx-1 flex flex-1 flex-col gap-0.5 overflow-y-auto px-1" aria-label="Principal">
        {useGrupos().map(([titulo, itens]) => (
          <div key={titulo} className="flex flex-col gap-0.5">
            <p className="label px-3 pb-1.5 pt-4 first:pt-1">{titulo}</p>
            {itens.map(i => <NavItem key={i.to} item={i} />)}
          </div>
        ))}
      </nav>
      <div className="panel-quiet flex items-center gap-3 p-3">
        <Pulse on={on} tom={on ? 'green' : 'amber'} />
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Bot</p><p className="truncate text-sm text-muted">{on ? 'Respondendo' : 'Pausado para todos'}</p></div>
        <Switch on={on} onChange={setBot} label={on ? 'Pausar o bot para todos' : 'Ligar o bot'} />
      </div>
      <div className="flex items-center gap-1 px-1">
        <NavLink to="/whatsapp" className="btn-ghost flex-1 justify-start gap-2.5 px-2.5">
          <Pulse on={zapOk} tom={zapOk ? 'green' : 'red'} />
          <span className="truncate text-sm">{!zap ? 'WhatsApp…' : zapOk ? 'WhatsApp conectado' : zap.estado === 'offline' ? 'Evolution fora do ar' : 'WhatsApp desconectado'}</span>
        </NavLink>
        <button className="btn-ghost size-10 px-0" onClick={trocarTema} aria-label={tema === 'dark' ? 'Tema claro' : 'Tema escuro'}>
          {tema === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </button>
      </div>
    </>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false)
  const loc = useLocation()
  useEffect(() => setMenu(false), [loc.pathname])
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-4 border-r border-border px-3 py-5 lg:flex"><Lateral /></aside>
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur lg:hidden">
        <button className="btn-ghost -ml-2 size-10 px-0" onClick={() => setMenu(true)} aria-label="Abrir menu"><Menu className="size-5" /></button>
        <p className="truncate font-display text-lg">BF Tickets</p>
      </header>
      <AnimatePresence>
        {menu && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-[hsl(var(--shadow)/0.3)]" onClick={() => setMenu(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.aside className="absolute inset-y-0 left-0 flex w-[min(300px,86vw)] flex-col gap-4 bg-background px-3 py-5 shadow-float"
              initial={{ transform: 'translateX(-100%)' }} animate={{ transform: 'translateX(0%)', transition: { duration: 0.4, ease: EASE_DRAWER } }}
              exit={{ transform: 'translateX(-100%)', transition: { duration: 0.24, ease: EASE_DRAWER } }}>
              <button className="btn-ghost absolute right-3 top-4 size-10 px-0" onClick={() => setMenu(false)} aria-label="Fechar menu"><X className="size-5" /></button>
              <Lateral />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
      <main className="min-w-0">{children}</main>
    </div>
  )
}
