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
