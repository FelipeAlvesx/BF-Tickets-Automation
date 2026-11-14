// Validação de CPF e e-mail, máscara para logs (LGPD).

export function soDigitos(s) {
  return String(s ?? '').replace(/\D/g, '');
}

export function validarCpf(entrada) {
  const c = soDigitos(entrada);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(c[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

export function formatarCpf(entrada) {
  const c = soDigitos(entrada);
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}

// 123.456.789-09 -> ***.456.789-**
export function mascararCpf(entrada) {
  const c = soDigitos(entrada);
  return `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**`;
}

// Mascara qualquer CPF (com ou sem pontuação) dentro de um texto livre.
export function mascararCpfsNoTexto(texto) {
  return String(texto ?? '').replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, (m) => mascararCpf(m));
}

export function validarEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(s ?? '').trim());
}

// Palavras que não são nome (evita "já paguei" virar o nome do cliente).
const NAO_NOME = new Set(['ja', 'já', 'paguei', 'pago', 'ok', 'oi', 'ola', 'olá', 'segue', 'seguem', 'aqui', 'pronto', 'obrigado',
  'obrigada', 'valeu', 'bom', 'boa', 'dia', 'tarde', 'noite', 'meu', 'minha', 'meus', 'dados', 'sim', 'nao', 'não', 'comprovante',
  'pix', 'enviei', 'mandei', 'certo', 'beleza', 'blz', 'tudo', 'bem', 'tá', 'ta', 'esta', 'está']);
const NUM = /[+(]?\d[\d().-]*/g;

// Lê nome, CPF, e-mail e telefone de uma mensagem livre (uma linha por dado, vírgulas ou tudo junto).
// CPF só vale com dígito verificador certo; com telefone=false, 11 dígitos inválidos contam como CPF errado.
// -> { nome?, cpf? (só dígitos), email?, telefone? (DDD+número), cpfInvalido? }
export function extrairDados(texto, { telefone: querTelefone = true } = {}) {
  const out = {};
  let t = String(texto ?? '');
  const em = t.match(/[^\s@,;:<>()]+@[^\s@,;:<>()]+\.[a-z]{2,}/i);
  if (em) { out.email = em[0].toLowerCase(); t = t.replace(em[0], ' '); }
  t = t.replace(/\b(meu nome (é|e)|me chamo|nome completo|nome|cpf|e-?mail|telefone|celular|whatsapp|whats|tel|cel|fone)\b\s*[:=-]?/gi, ' ');
  for (const linha of t.split(/[\n,;|]+/)) {
    const nums = linha.match(NUM) ?? [];
    for (let i = 0; i < nums.length; i++) {
      const d = soDigitos(nums[i]);
      if (d.length === 11 && validarCpf(d)) { out.cpf ??= d; continue; }
      if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(nums[i]) || (d.length === 11 && !querTelefone)) { out.cpfInvalido = true; continue; }
      // Telefone pode vir quebrado: "(71) 99999-8888", "+55 71 99999-8888".
      let acc = d;
      let j = i;
      while (acc.length < 10 && j + 1 < nums.length) acc += soDigitos(nums[++j]);
      if (querTelefone && acc.length >= 10 && acc.length <= 13) { out.telefone ??= acc.replace(/^55(?=\d{10,11}$)/, ''); i = j; }
    }
    const palavras = linha.replace(NUM, ' ').replace(/[^\p{L}'’.\s-]/gu, ' ').trim().split(/\s+/).filter((p) => /\p{L}/u.test(p));
    if (!out.nome && palavras.length >= 2 && !palavras.some((p) => NAO_NOME.has(p.toLowerCase()))) {
      const nome = palavras.join(' ');
      if (nome.length <= 100) out.nome = nome;
    }
  }
  return out;
}
