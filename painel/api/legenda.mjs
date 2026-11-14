// Texto da agenda gerado pela IA a partir da arte. Funções puras; a chamada à API fica no server.mjs.
// Preço, link, data e local nunca saem da IA: ela escreve {preco}, {link}... e o envio preenche com o cadastro.

export const PROMPT = `Você escreve o texto que acompanha uma arte no grupo de WhatsApp da BF Tickets, revenda de ingressos de shows e festas.

Leia a arte (atrações, nome do evento, lote, setor, novidades) e escreva a mensagem:
- Português do Brasil, tom de conversa, direto, como alguém da equipe postando no grupo.
- De 2 a 5 linhas curtas, no máximo 400 caracteres. Até 3 emojis.
- Comece pelo gancho: a atração ou a novidade (virada de lote, últimos ingressos, line-up).
- Negrito do WhatsApp com *um asterisco* só no que importa. Sem hashtags, sem títulos, sem aspas em volta do texto.
- Feche com uma chamada para garantir o ingresso.

Valores (regra rígida):
- Nunca escreva preço, link, data ou local por extenso, nem copiando da arte. Use as variáveis, que o sistema troca pelos dados cadastrados: {nome}, {data}, {local}, {preco}, {link}.
- Com evento (evento_id diferente de 0): use as variáveis que fizerem sentido e termine com {link} sozinho na última linha.
- Sem evento (evento_id 0): não use variáveis; a chamada é para chamar a gente no privado.

evento_id: o id da lista "Eventos" que a arte divulga, só quando for claramente o mesmo evento; 0 se nenhum bater ou se tiver dúvida. Se vier "Evento já escolhido", devolva esse id.`;

const dia = (iso) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' });

// imagem: source da API ({type:'base64', media_type, data} ou {type:'url', url}).
// effort low + JSON fechado (enum dos ids): barato e sem id inventado.
export function pedidoLegenda({ modelo, imagem, eventos, eventoId = null }) {
  const lista = eventos.map((e) => `${e.id}: ${e.nome} (${dia(e.data_evento)})`).join('\n') || '(nenhum)';
  const escolhido = eventos.some((e) => e.id === eventoId) ? `\n\nEvento já escolhido: ${eventoId}` : '';
  return {
    model: modelo,
    max_tokens: 2000,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: {
        type: 'object', additionalProperties: false, required: ['evento_id', 'texto'],
        properties: { evento_id: { type: 'integer', enum: [0, ...eventos.map((e) => e.id)] }, texto: { type: 'string' } },
      } },
    },
    system: PROMPT,
    messages: [{ role: 'user', content: [{ type: 'image', source: imagem }, { type: 'text', text: `Eventos:\n${lista}${escolhido}` }] }],
  };
}

const falha = (message) => Object.assign(new Error(message), { status: 502 });

export function lerLegenda(resp, eventos = []) {
  if (resp?.stop_reason === 'refusal') throw falha('A IA não quis escrever sobre essa imagem. Tente outra arte.');
  let j;
  try {
    j = JSON.parse((resp?.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join(''));
  } catch {
    throw falha('A IA devolveu uma resposta incompleta. Tente de novo.');
  }
  const texto = String(j?.texto ?? '').trim();
  if (!texto) throw falha('A IA não devolveu texto. Tente de novo.');
  return { texto, evento_id: eventos.some((e) => e.id === j.evento_id) ? j.evento_id : null };
}
