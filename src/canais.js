// Adaptadores: Evolution (WhatsApp) e ManyChat (Instagram) <-> formato do core.
// Mensagem do core: {tipo:'texto', texto} | {tipo:'imagem'|'documento', url?|base64?, texto?, mimetype?, fileName?}

// Celular BR: o WhatsApp às vezes entrega 5571 + 8 dígitos (sem o 9 extra) e a gente guarda com 9.
// Devolve as formas equivalentes do mesmo número, para comparar e para buscar no banco.
export function variantesNumero(n) {
  const d = String(n ?? '').replace(/\D/g, '');
  const sem9 = d.match(/^(55\d{2})(\d{8})$/);
  const com9 = d.match(/^(55\d{2})9(\d{8})$/);
  return [d, sem9 && `${sem9[1]}9${sem9[2]}`, com9 && `${com9[1]}${com9[2]}`].filter(Boolean);
}

// Webhook messages.upsert da Evolution v2 -> {id, contato_id, nome, texto, midia, fromMe} ou null (ignorar).
// Mensagens enviadas pela API não voltam aqui (emitOwnEvents=false): fromMe = alguém digitou no celular.
export function normalizarEvolution(body) {
  if (!body || body.event !== 'messages.upsert') return null;
  const d = Array.isArray(body.data) ? body.data[0] : body.data;
  const key = d?.key ?? {};
  const jid = key.remoteJidAlt && String(key.remoteJid).endsWith('@lid') ? key.remoteJidAlt : key.remoteJid;
  if (!jid || !key.id) return null;
  if (/@(g\.us|broadcast|newsletter)$/.test(jid)) return null; // grupos, status, canais
  const m = d.message ?? {};
  const texto = m.conversation ?? m.extendedTextMessage?.text ?? m.imageMessage?.caption ?? m.documentMessage?.caption
    ?? m.documentWithCaptionMessage?.message?.documentMessage?.caption ?? m.buttonsResponseMessage?.selectedDisplayText
    ?? m.listResponseMessage?.title ?? '';
  let midia = null;
  const doc = m.documentMessage ?? m.documentWithCaptionMessage?.message?.documentMessage;
  if (m.imageMessage) midia = { tipo: 'imagem', mimetype: m.imageMessage.mimetype ?? 'image/jpeg' };
  else if (doc) midia = { tipo: 'documento', mimetype: doc.mimetype ?? '', fileName: doc.fileName ?? 'arquivo' };
  else if (m.audioMessage || m.videoMessage || m.stickerMessage) midia = { tipo: m.audioMessage ? 'audio' : m.videoMessage ? 'video' : 'sticker' };
  if (midia) {
    midia.ref = `wa:${key.id}`;
    if (m.base64) midia.base64 = m.base64;
  }
  if (!texto && !midia) return null; // reação, protocolo, enquete...
  return {
    id: key.id,
    contato_id: String(jid).split('@')[0],
    nome: key.fromMe ? null : d.pushName || null,
    texto: String(texto).trim(),
    midia,
    fromMe: !!key.fromMe,
  };
}

// Mensagens do core -> chamadas da Evolution. `numero` = dígitos ou JID de grupo.
// O `delay` da Evolution mostra "digitando..." antes de enviar (anti-ban: 1–4 s pelo tamanho).
export function chamadasEvolution(numero, mensagens) {
  return (mensagens ?? []).map((m) => {
    const delay = atrasoDigitando(m.texto);
    if (m.tipo === 'texto') return { endpoint: 'sendText', body: { number: numero, text: m.texto, delay } };
    const mediatype = m.tipo === 'imagem' ? 'image' : 'document';
    const body = { number: numero, mediatype, media: m.base64 ?? m.url, caption: m.texto ?? '', delay };
    if (m.mimetype) body.mimetype = m.mimetype;
    if (mediatype === 'document') body.fileName = m.fileName ?? 'comprovante.pdf';
    return { endpoint: 'sendMedia', body };
  });
}

export function atrasoDigitando(texto) {
  return Math.min(4000, Math.max(1000, 1000 + String(texto ?? '').length * 25));
}

// Corpo do External Request do ManyChat (ver manychat/SETUP.md). Aceita o corpo montado
// ({contato_id, nome, texto, comprovante_url}) e o "Full Contact Data" ({id, name, last_input_text, custom_fields}).
export function normalizarManychat(body) {
  const b = body ?? {};
  const contato = String(b.contato_id ?? b.id ?? '').trim();
  if (!contato) return null;
  let texto = String(b.texto ?? b.last_input_text ?? '').trim();
  const url = String(b.comprovante_url ?? b.custom_fields?.comprovante_url ?? '').trim() || (/^https?:\/\/\S+$/.test(texto) && /cdn|fbsbx|lookaside|instagram/.test(texto) ? texto : '');
  if (url && url === texto) texto = '';
  return {
    contato_id: contato,
    nome: String(b.nome ?? b.name ?? '').trim() || null,
    texto,
    midia: url ? { tipo: /\.pdf(\?|$)/i.test(url) ? 'documento' : 'imagem', url, mimetype: /\.pdf(\?|$)/i.test(url) ? 'application/pdf' : 'image/jpeg' } : null,
  };
}

// Resposta Dynamic Block v2 (Instagram): até 10 mensagens; só texto e imagem.
// A action grava o estado no campo `estado` do ManyChat (o fluxo usa para pedir o comprovante).
export function respostaManychat(mensagens, estado) {
  const msgs = (mensagens ?? []).flatMap((m) => {
    if (m.tipo === 'imagem' && m.url) return [{ type: 'image', url: m.url }, ...(m.texto ? [{ type: 'text', text: m.texto }] : [])];
    return m.texto ? [{ type: 'text', text: m.texto }] : [];
  }).slice(0, 10);
  const content = { type: 'instagram', messages: msgs, actions: [], quick_replies: [] };
  if (estado) {
    content.actions.push({ action: 'set_field_value', field_name: 'estado', value: estado });
    content.actions.push({ action: 'unset_field_value', field_name: 'comprovante_url' }); // já foi lido; não reenviar
  }
  return { version: 'v2', content };
}

// Corpo do sendContent da API do ManyChat (aviso de /aprovar e /recusar no Instagram).
export function sendContentManychat(subscriberId, mensagens) {
  const { content } = respostaManychat(mensagens, null);
  delete content.actions;
  delete content.quick_replies;
  return { subscriber_id: Number(subscriberId), data: { version: 'v2', content } };
}
