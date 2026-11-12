export const STATUS_PEDIDO: Record<string, [string, string]> = {
  aguardando_comprovante: ['Aguardando Pix', 'amber'],
  coletando_dados: ['Coletando dados', 'blue'],
  aguardando_validacao: ['Para validar', 'brand'],
  aprovado: ['Aprovado', 'green'],
  recusado: ['Recusado', 'red'],
  cancelado: ['Cancelado', 'slate'],
}
export const ESTADO_CONVERSA: Record<string, string> = {
  inicio: 'No menu', escolhendo_evento: 'Escolhendo evento', escolhendo_qtd: 'Escolhendo quantidade',
  escolhendo_pagamento: 'Escolhendo pagamento', aguardando_comprovante: 'Aguardando Pix', coletando_nome: 'Mandando nome',
  coletando_cpf: 'Mandando CPF', coletando_email: 'Mandando e-mail', aguardando_validacao: 'Aguardando validação',
  venda_coletando: 'Quer vender', humano: 'Com atendente',
}
export const STATUS_OFERTA: Record<string, [string, string]> = {
  nova: ['Nova', 'brand'], em_negociacao: ['Negociando', 'amber'], comprada: ['Comprada', 'green'], descartada: ['Descartada', 'slate'],
}
export const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export const contato = (canal: string, id: string) => (canal === 'instagram' ? `IG ${id}` : id)

/** Linha ligada a evento desligado ou já encerrado não é enviada (mesma regra do servidor). */
export const eventoBloqueia = (a: { evento_id: number | null; evento_ativo: boolean | null; evento_passou: boolean | null }) =>
  !!a.evento_id && (!a.evento_ativo || !!a.evento_passou)
