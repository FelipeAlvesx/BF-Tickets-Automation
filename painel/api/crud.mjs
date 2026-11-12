// Edição de tabelas pelo painel: só tabelas e colunas desta lista; valores sempre por parâmetro ($1...).

export const TABELAS = {
  eventos: { pk: 'id', cols: ['nome', 'data_evento', 'local', 'link_compra', 'preco', 'imagem_url', 'ativo'], apagar: true,
    listar: 'select * from app.eventos order by ativo desc, data_evento' },
  agenda: { pk: 'id', cols: ['horario', 'dias_semana', 'texto', 'imagem_url', 'evento_id', 'enviar_grupo', 'lembrete_story', 'ativo'], apagar: true,
    listar: `select a.*, e.nome as evento,
      exists(select 1 from app.envios_agenda ea where ea.agenda_id = a.id and ea.data = (now() at time zone 'America/Bahia')::date) as enviado_hoje
      from app.agenda a left join app.eventos e on e.id = a.evento_id order by a.horario` },
  mensagens: { pk: 'chave', cols: ['texto'], listar: 'select * from app.mensagens order by chave' },
  config: { pk: 'chave', cols: ['valor'], listar: 'select * from app.config order by chave' },
  ofertas_venda: { pk: 'id', cols: ['status'], listar: 'select * from app.ofertas_venda order by id desc limit 300' },
};

export function tabela(nome) {
  const t = TABELAS[nome];
  if (!t) throw Object.assign(new Error('Tabela não existe no painel.'), { status: 404 });
  return t;
}

const filtrar = (t, dados) => Object.entries(dados ?? {}).filter(([k]) => t.cols.includes(k));

export function sqlInserir(nome, dados) {
  const t = tabela(nome);
  const campos = filtrar(t, dados);
  if (!campos.length) throw Object.assign(new Error('Nada para salvar.'), { status: 400 });
  return {
    text: `insert into app.${nome} (${campos.map(([k]) => k).join(', ')}) values (${campos.map((_, i) => `$${i + 1}`).join(', ')}) returning *`,
    values: campos.map(([, v]) => v),
  };
}

export function sqlAtualizar(nome, pk, dados) {
  const t = tabela(nome);
  const campos = filtrar(t, dados);
  if (!campos.length) throw Object.assign(new Error('Nada para salvar.'), { status: 400 });
  return {
    text: `update app.${nome} set ${campos.map(([k], i) => `${k} = $${i + 1}`).join(', ')} where ${t.pk} = $${campos.length + 1} returning *`,
    values: [...campos.map(([, v]) => v), pk],
  };
}

export function sqlApagar(nome, pk) {
  const t = tabela(nome);
  if (!t.apagar) throw Object.assign(new Error('Essa tabela não deixa apagar pelo painel.'), { status: 400 });
  return { text: `delete from app.${nome} where ${t.pk} = $1`, values: [pk] };
}

// Basic auth do painel. Senha vazia nunca autoriza; comparação em tempo constante.
import { timingSafeEqual, createHash } from 'node:crypto';
const igual = (a, b) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
export function autorizado(header, usuario, senha) {
  if (!senha || !header?.startsWith('Basic ')) return false;
  const [u, ...p] = Buffer.from(header.slice(6), 'base64').toString().split(':');
  return igual(u, usuario) & igual(p.join(':'), senha) ? true : false;
}
