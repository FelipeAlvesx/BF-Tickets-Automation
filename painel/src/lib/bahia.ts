// O negócio roda em America/Bahia (UTC-3, sem horário de verão).
export function paraInput(iso?: string | null) {
  if (!iso) return ''
  const p = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  return p.replace(' ', 'T')
}
export const deInput = (v: string) => (v ? `${v}:00-03:00` : null)
export const dataBahia = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Bahia', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
