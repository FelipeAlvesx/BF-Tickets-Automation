// Textos padrão do bot e renderização de templates.
// Fonte única: db/mensagens.sql é gerado daqui (scripts/build-workflows.mjs) e o
// dono edita no NocoDB. Se uma linha sumir do banco, vale o padrão abaixo.

export const TEXTOS_PADRAO = {
  boas_vindas: 'Oi{nome_cliente}! Aqui é da BF Tickets 🎟\nComo posso ajudar?\n\n1 - Comprar ingresso\n2 - Vender meu ingresso\n3 - Ver eventos\n4 - Falar com atendente',
  escolher_evento: 'Pra qual evento?\n\n{lista_eventos}\n\nResponde com o número.',
  sem_eventos: 'No momento não temos eventos à venda. Vou chamar alguém da equipe pra te ajudar.',
  pedir_qtd: '{evento} — {preco} cada.\nQuantos ingressos você quer?',
  qtd_invalida: 'Me manda só o número de ingressos (de 1 a {max}).',
  escolher_pagamento: 'Fechado: {quantidade}x {evento} = {total}.\nComo prefere pagar?\n\n1 - Link de compra (cartão)\n2 - Pix',
  enviar_link: 'Aqui o link oficial pra garantir o seu:',
  link_fim: 'Qualquer dúvida é só chamar 😉',
  resumo_pix: 'Resumo do pedido:\n🎟 {evento}\n🔢 {quantidade} ingresso(s)\n💰 Total: {total}\n\nA chave Pix vem na próxima mensagem 👇',
  pix_instrucao: 'Titular: {pix_titular} ({pix_banco}).\nDepois de pagar, manda aqui o comprovante (foto ou print).',
  // Instagram: o pedido do comprovante é a pergunta da coleta de imagem do ManyChat (manychat/SETUP.md).
  pix_titular: 'Titular: {pix_titular} ({pix_banco}).',
  lembrar_comprovante: 'Tô aguardando o comprovante do Pix (foto ou print) pra seguir com o pedido.',
  comprovante_recebido: 'Comprovante recebido ✅\nAgora preciso de alguns dados pra emitir o ingresso.\nQual seu nome completo?',
  nome_invalido: 'Me manda o nome completo, por favor (nome e sobrenome).',
  pedir_cpf: 'Valeu! Agora o CPF:',
  cpf_invalido: 'Esse CPF não parece válido. Confere e manda de novo?',
  pedir_email: 'E o seu e-mail?',
  email_invalido: 'Esse e-mail não parece válido. Manda de novo?',
  // Textos do cliente não mostram o número do pedido (só o admin vê, para aprovar).
  aguardando_validacao: 'Pronto! Seu pedido está em validação. Assim que conferirmos o pagamento eu te aviso por aqui.',
  ainda_validando: 'Seu pedido ainda está em validação. Já já te aviso!',
  pedido_aprovado: 'Pagamento confirmado ✅ Seu pedido pra {evento} foi aprovado! O ingresso chega no seu e-mail.',
  pedido_recusado: 'Não conseguimos validar o seu pedido pra {evento}.{motivo}\nSe precisar, é só chamar.',
  venda_evento: 'Massa! De qual evento é o ingresso que você quer vender?',
  venda_qtd: 'Quantos ingressos?',
  venda_setor: 'Qual o setor/tipo (pista, camarote, meia...)?',
  venda_valor: 'Quanto você quer por cada um?',
  venda_registrada: 'Anotado! Alguém da equipe vai te responder por aqui em breve.',
  info_evento: '{nome}\n📅 {data}\n📍 {local}\n💰 {preco}\n🔗 {link}',
  lista_eventos: 'Eventos com ingresso à venda:\n\n{lista_eventos}',
  nao_entendi: 'Não entendi muito bem 😅',
  chamando_humano: 'Vou chamar alguém da equipe pra continuar com você. Só um instante!',
  cancelado: 'Beleza, cancelei. Se quiser recomeçar é só mandar um oi.',
  midia_nao_suportada: 'Por aqui só consigo ler texto, foto ou PDF. Pode escrever?',
  // avisos ao admin
  admin_comprovante: '🧾 Comprovante recebido — pedido #{pedido_id}\n{canal} · {contato}\n{quantidade}x {evento} = {total}\n\nAinda faltam nome, CPF e e-mail do cliente. O aviso pra aprovar chega em seguida.',
  admin_validar: '✅ Pedido #{pedido_id} pronto pra validar\n{quantidade}x {evento} = {total}\n{nome_cliente_completo} · CPF {cpf_mascarado} · {email}\n\n/aprovar {pedido_id}\n/recusar {pedido_id} motivo',
  admin_humano: '🙋 {canal} · {contato} ({nome}) pediu atendente. Bot pausado nesse chat.',
  admin_venda: '💸 Oferta de venda #{oferta_id}\n{canal} · {contato} ({nome})\nEvento: {evento_texto}\nQtd: {quantidade} · Setor: {setor} · Valor: {valor}',
  admin_story: '📲 Hora do story! Arte acima, legenda e link abaixo:',
};

export function textoBot(textos, chave, vars = {}) {
  const t = textos?.[chave] ?? TEXTOS_PADRAO[chave] ?? chave;
  return render(t, vars);
}

// {chave} -> valor; chave sem valor fica vazia.
export function render(t, vars = {}) {
  return String(t).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '') + '');
}

const TZ = 'America/Bahia';

export function formatarData(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit' }).format(d);
  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(d);
  return `${dia.replace('.', '')} às ${hora}`;
}

export function formatarPreco(v) {
  if (v === null || v === undefined || v === '') return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v)).replace(/\s/g, ' ');
}

export function varsEvento(e) {
  if (!e) return {};
  return { nome: e.nome, evento: e.nome, data: formatarData(e.data_evento), local: e.local ?? '', link: e.link_compra ?? '', preco: formatarPreco(e.preco) };
}

export function listaEventos(eventos) {
  return eventos.map((e, i) => `${i + 1} - ${e.nome} (${formatarData(e.data_evento)})`).join('\n');
}
