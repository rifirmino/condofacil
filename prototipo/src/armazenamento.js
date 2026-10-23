const CHAVE_ESTADO = 'condofacil-demo-v1';

export function carregarEstado() {
  try {
    const texto = localStorage.getItem(CHAVE_ESTADO);
    if (!texto) return null;
    const estado = JSON.parse(texto);
    return estado && estado.versao === 11 ? estado : null;
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

// Condomínios criados pela implantação: ficam salvos (não se refazem a cada dia como a demonstração).
const CHAVE_CONDOMINIOS = 'condofacil-condominios-v1';
const CONDOMINIOS_VAZIO = { ativo: 'demo', lista: {}, rascunho: null };

export function carregarCondominios() {
  try {
    const texto = localStorage.getItem(CHAVE_CONDOMINIOS);
    const dados = texto ? JSON.parse(texto) : null;
    return dados && dados.lista ? { ...CONDOMINIOS_VAZIO, ...dados } : { ...CONDOMINIOS_VAZIO };
  } catch {
    return { ...CONDOMINIOS_VAZIO };
  }
}

export function salvarCondominios(dados) {
  try {
    localStorage.setItem(CHAVE_CONDOMINIOS, JSON.stringify(dados));
  } catch {
    // Sem armazenamento: os condomínios criados valem só nesta aba.
  }
}
