-- GERADO por scripts/build-workflows.mjs a partir de src/templates.js (TEXTOS_PADRAO).
-- Depois da primeira subida, edite os textos no NocoDB ou no painel.
insert into app.mensagens (chave, texto) values
  ('boas_vindas', 'Oi{nome_cliente}! Aqui é da BF Tickets 🎟
Como posso ajudar?

1 - Comprar ingresso
2 - Vender meu ingresso
3 - Ver eventos
4 - Falar com atendente'),
  ('escolher_evento', 'Pra qual evento?

{lista_eventos}

Responde com o número.'),
  ('sem_eventos', 'No momento não temos eventos à venda. Vou chamar alguém da equipe pra te ajudar.'),
  ('pedir_qtd', '{evento} — {preco} cada.
Quantos ingressos você quer?'),
  ('qtd_invalida', 'Me manda só o número de ingressos (de 1 a {max}).'),
  ('escolher_pagamento', 'Fechado: {quantidade}x {evento} = {total}.
Como prefere pagar?

1 - Link de compra (cartão)
2 - Pix'),
  ('enviar_link', 'Aqui o link oficial pra garantir o seu:'),
  ('link_fim', 'Qualquer dúvida é só chamar 😉'),
  ('resumo_pix', 'Resumo do pedido:
🎟 {evento}
🔢 {quantidade} ingresso(s)
💰 Total: {total}

A chave Pix vem na próxima mensagem 👇'),
  ('pix_instrucao', 'Titular: {pix_titular} ({pix_banco}).
Depois de pagar, manda aqui o comprovante (foto ou print).'),
  ('lembrar_comprovante', 'Tô aguardando o comprovante do Pix (foto ou print) pra seguir com o pedido.'),
  ('comprovante_recebido', 'Comprovante recebido ✅
Agora preciso de alguns dados pra emitir o ingresso.
Qual seu nome completo?'),
  ('nome_invalido', 'Me manda o nome completo, por favor (nome e sobrenome).'),
  ('pedir_cpf', 'Valeu! Agora o CPF:'),
  ('cpf_invalido', 'Esse CPF não parece válido. Confere e manda de novo?'),
  ('pedir_email', 'E o seu e-mail?'),
  ('email_invalido', 'Esse e-mail não parece válido. Manda de novo?'),
  ('aguardando_validacao', 'Pronto! Seu pedido #{pedido_id} está em validação. Assim que conferirmos o pagamento eu te aviso por aqui.'),
  ('ainda_validando', 'Seu pedido #{pedido_id} ainda está em validação. Já já te aviso!'),
  ('pedido_aprovado', 'Pagamento confirmado ✅ Pedido #{pedido_id} aprovado! Seu ingresso pra {evento} chega no seu e-mail.'),
  ('pedido_recusado', 'Não conseguimos validar o pedido #{pedido_id}.{motivo}
Se precisar, é só chamar.'),
  ('venda_evento', 'Massa! De qual evento é o ingresso que você quer vender?'),
  ('venda_qtd', 'Quantos ingressos?'),
  ('venda_setor', 'Qual o setor/tipo (pista, camarote, meia...)?'),
  ('venda_valor', 'Quanto você quer por cada um?'),
  ('venda_registrada', 'Anotado! Alguém da equipe vai te responder por aqui em breve.'),
  ('info_evento', '{nome}
📅 {data}
📍 {local}
💰 {preco}
🔗 {link}'),
  ('lista_eventos', 'Eventos com ingresso à venda:

{lista_eventos}'),
  ('nao_entendi', 'Não entendi muito bem 😅'),
  ('chamando_humano', 'Vou chamar alguém da equipe pra continuar com você. Só um instante!'),
  ('cancelado', 'Beleza, cancelei. Se quiser recomeçar é só mandar um oi.'),
  ('midia_nao_suportada', 'Por aqui só consigo ler texto, foto ou PDF. Pode escrever?'),
  ('admin_comprovante', '🧾 Comprovante recebido — pedido #{pedido_id}
{canal} · {contato}
{quantidade}x {evento} = {total}

Ainda faltam nome, CPF e e-mail do cliente. O aviso pra aprovar chega em seguida.'),
  ('admin_validar', '✅ Pedido #{pedido_id} pronto pra validar
{quantidade}x {evento} = {total}
{nome_cliente_completo} · CPF {cpf_mascarado} · {email}

/aprovar {pedido_id}
/recusar {pedido_id} motivo'),
  ('admin_humano', '🙋 {canal} · {contato} ({nome}) pediu atendente. Bot pausado nesse chat.'),
  ('admin_venda', '💸 Oferta de venda #{oferta_id}
{canal} · {contato} ({nome})
Evento: {evento_texto}
Qtd: {quantidade} · Setor: {setor} · Valor: {valor}'),
  ('admin_story', '📲 Hora do story! Arte acima, legenda e link abaixo:')
on conflict (chave) do nothing;
