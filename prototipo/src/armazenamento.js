const CHAVE_ESTADO = 'condofacil-demo-v1';

export function carregarEstado() {
  try {
    const texto = localStorage.getItem(CHAVE_ESTADO);
    if (!texto) return null;
    const estado = JSON.parse(texto);
    return estado && estado.versao === 10 ? estado : null;
  } catch {
    return null;
  }
}

export function salvarEstado(estado) {
  try {
    localStorage.setItem(CHAVE_ESTADO, JSON.stringify(estado));
  } catch {
    // Sem armazenamento (aba privada, bloqueio): a demonstração segue só em memória.
  }
}

export function limparEstado() {
  try {
    localStorage.removeItem(CHAVE_ESTADO);
  } catch {
    // Idem.
  }
}
