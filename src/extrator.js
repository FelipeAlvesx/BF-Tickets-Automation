// Atalhos sem LLM (regex/keywords) e o contrato do LLM extrator.
// O LLM só classifica/extrai; preço, link e textos vêm sempre do banco.

export const INTENCOES = ['comprar', 'vender', 'duvida_evento', 'duvida_outra', 'humano', 'cancelar', 'listar_eventos', 'saudacao', 'outro'];

export function normalizar(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const NUMEROS = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10 };

// "2", "2 ingressos", "dois", "quero 3 ingressos" -> número
export function extrairQuantidade(texto) {
  const t = normalizar(texto);
  let m = t.match(/^(\d{1,3})(\s*(ingressos?|unidades?|x))?[.!]?$/);
  if (m) return Number(m[1]);
  m = t.match(/\b(\d{1,3})\s*(ingressos?|entradas?)\b/);
  if (m) return Number(m[1]);
  m = t.match(/^(?:quero\s+)?(um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)(\s+ingressos?)?[.!]?$/);
  if (m) return NUMEROS[m[1]];
  m = t.match(/\b(um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\s+(ingressos?|entradas?)\b/);
  if (m) return NUMEROS[m[1]];
  return null;
}

// Resposta de menu "1", "2)", "opção 2"
export function opcaoMenu(texto) {
  const m = normalizar(texto).match(/^(?:opcao\s*)?(\d{1,2})\s*[).-]?$/);
  return m ? Number(m[1]) : null;
}

const PALAVRAS_VAZIAS = new Set(['show', 'festa', 'evento', 'com', 'para', 'pra', 'dos', 'das', 'the', 'and', 'tour', 'ingresso']);

// Evento citado pelo nome (inteiro ou palavra distintiva de >=4 letras que só um evento tem).
export function acharEvento(texto, eventos) {
  const t = normalizar(texto);
  const inteiro = eventos.filter((e) => t.includes(normalizar(e.nome)));
  if (inteiro.length === 1) return inteiro[0];
  const palavras = (e) => normalizar(e.nome).split(/[^a-z0-9]+/).filter((p) => p.length >= 4 && !PALAVRAS_VAZIAS.has(p));
  const achados = eventos.filter((e) => palavras(e).some((p) => new RegExp(`\\b${p}\\b`).test(t)));
  return achados.length === 1 ? achados[0] : null;
}

const KW = {
  cancelar: /^(cancelar|cancela|recomecar|reiniciar|menu|sair|voltar ao inicio|comecar de novo)[.!]?$/,
  humano: /\b(atendente|humano|pessoa real|falar com (alguem|uma pessoa|voce)|suporte)\b/,
  listar_eventos: /^(eventos|ver eventos|quais (sao os )?eventos.*|lista de eventos|agenda)\??$/,
  vender: /\b(vender|revender|vendo (meu|minha|um|uma|\d)|repassar)\b/,
  duvida_evento: /\b(quando|que dia|que horas|horario|data|onde|local|endereco|quanto (custa|e|ta|esta)|preco|valor)\b/,
  comprar: /\b(comprar|compra|quero (ingresso|ir)|tem ingresso|ingressos?|garantir)\b/,
  saudacao: /^(oi+|ola|opa|e ai|eai|bom dia|boa tarde|boa noite|hey|hello|salve)[!.,\s]*$/,
};

// Tenta resolver sem LLM. Retorna {intencao?, evento_id?, quantidade?, confianca} ou null.
export function atalhos(texto, eventos = []) {
  const t = normalizar(texto);
  if (!t) return null;
  const evento = acharEvento(t, eventos);
  const quantidade = extrairQuantidade(t);
  const base = { evento_id: evento?.id ?? null, quantidade, confianca: 1 };
  if (KW.cancelar.test(t)) return { ...base, intencao: 'cancelar' };
  if (KW.humano.test(t)) return { ...base, intencao: 'humano' };
  if (KW.listar_eventos.test(t)) return { ...base, intencao: 'listar_eventos' };
  if (KW.saudacao.test(t)) return { ...base, intencao: 'saudacao' };
  if (KW.vender.test(t)) return { ...base, intencao: 'vender' };
  if (KW.duvida_evento.test(t) && !/^\d/.test(t)) return { ...base, intencao: 'duvida_evento' };
  if (KW.comprar.test(t) || evento || quantidade) return { ...base, intencao: 'comprar' };
  return null;
}

// Só intenções globais (estados de coleta: nome/cpf/e-mail/venda não passam pelo LLM).
export function intencaoGlobal(texto) {
  const t = normalizar(texto);
  if (KW.cancelar.test(t)) return 'cancelar';
  if (KW.humano.test(t)) return 'humano';
  if (KW.listar_eventos.test(t)) return 'listar_eventos';
  return null;
}

// Corpo da chamada OpenAI-compatible. `prompt` vem de prompts/extrator.md.
export function pedidoLLM({ prompt, modelo, texto, estado, eventos }) {
  const lista = eventos.map((e) => `${e.id}: ${e.nome}`).join('\n') || '(nenhum)';
  return {
    model: modelo,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: `Estado: ${estado}\nEventos ativos:\n${lista}\n\nMensagem: ${texto}` },
    ],
  };
}

// Lê a resposta do LLM e devolve um objeto seguro (valores fora do contrato viram null).
export function lerRespostaLLM(resp, eventos = []) {
  const vazio = { intencao: 'outro', evento_id: null, quantidade: null, nome: null, cpf: null, email: null, confianca: 0 };
  try {
    const conteudo = resp?.choices?.[0]?.message?.content ?? '';
    const json = JSON.parse(conteudo.slice(conteudo.indexOf('{'), conteudo.lastIndexOf('}') + 1));
    const ids = new Set(eventos.map((e) => Number(e.id)));
    const q = Number(json.quantidade);
    return {
      intencao: INTENCOES.includes(json.intencao) ? json.intencao : 'outro',
      evento_id: ids.has(Number(json.evento_id)) ? Number(json.evento_id) : null,
      quantidade: Number.isInteger(q) && q > 0 ? q : null,
      nome: typeof json.nome === 'string' && json.nome.trim() ? json.nome.trim() : null,
      cpf: typeof json.cpf === 'string' ? json.cpf : null,
      email: typeof json.email === 'string' ? json.email : null,
      confianca: Math.max(0, Math.min(1, Number(json.confianca) || 0)),
    };
  } catch {
    return vazio;
  }
}
