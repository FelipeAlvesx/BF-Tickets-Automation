export interface Estado {
  bot_ligado: boolean; validar: number; em_andamento: number; ofertas_novas: number; pausadas: number
  contatos_hoje: number; mensagens_hoje: number; aprovados_hoje: number; receita_hoje: number
  agenda_enviadas: number; agenda_hoje: number; agora: string
}
export type Canal = 'whatsapp' | 'instagram'
export interface WhatsApp {
  estado: 'open' | 'connecting' | 'close' | 'missing' | 'offline'; instancia: string
  numero?: string | null; nome?: string | null; foto?: string | null
  webhook?: { url: string | null; ok: boolean }; grupo_jid: string; qr?: string | null
}
export interface ConversaItem {
  canal: Canal; contato_id: string; nome: string | null; estado: string; pausado: boolean; pausado_ate: string | null
  ultima: string | null; ultima_direcao: 'in' | 'out' | 'humano' | null; ultima_em: string | null; atualizado_em: string; pedidos_abertos: number
}
export interface Pedido {
  id: number; canal: Canal; contato_id: string; evento: string | null; evento_id: number; quantidade: number; valor_total: string
  forma: string; status: string; comprovante_url: string | null; nome: string | null; cpf: string | null; email: string | null
  motivo_recusa: string | null; criado_em: string; atualizado_em: string; nome_contato?: string | null
}
export interface ConversaDetalhe {
  conversa: ConversaItem & { contexto: Record<string, unknown> }
  historico: { direcao: 'in' | 'out' | 'humano'; texto: string; criado_em: string }[]
  pedidos: Pedido[]
}
export interface Evento { id: number; nome: string; data_evento: string; local: string | null; link_compra: string | null; preco: string; imagem_url: string | null; ativo: boolean }
export interface LinhaAgenda {
  id: number; horario: string; dias_semana: number[]; texto: string; imagem_url: string | null; evento_id: number | null
  enviar_grupo: boolean; lembrete_story: boolean; ativo: boolean; evento: string | null; enviado_hoje: boolean
}
export interface Oferta { id: number; canal: Canal; contato_id: string; evento_texto: string; quantidade: number; setor: string; valor_pedido: string; status: string; criado_em: string }
export interface Sistema {
  servicos: Record<'banco' | 'evolution' | 'n8n' | 'nocodb', boolean>
  links: { n8n: string; nocodb: string }; webhook_manychat: string; tunel: boolean
}
