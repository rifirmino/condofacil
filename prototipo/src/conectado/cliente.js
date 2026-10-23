// Conversa com o servidor do CondoFácil (app.condofacil.cloud). No claude.ai e em arquivo local nada disso roda: tudo fica simulado.
export const CONEXAO = { ativa: false, codigo: null };
const CHAVE_PILOTO = 'condofacil-piloto-v1';
const HOSTS_CONECTADOS = ['app.condofacil.cloud', 'localhost', '127.0.0.1'];

export function hostPermitido(hostname) {
  return HOSTS_CONECTADOS.includes(hostname);
}

export async function detectarServidor() {
  if (typeof location === 'undefined' || !hostPermitido(location.hostname)) return false;
  try {
    const r = await fetch('/api/saude', { signal: AbortSignal.timeout(3000) });
    return r.ok && (await r.json()).ok === true;
  } catch {
    return false;
  }
}

export function lerCodigoPiloto() {
  try {
    return localStorage.getItem(CHAVE_PILOTO);
  } catch {
    return null;
  }
}

export function guardarCodigoPiloto(codigo) {
  try {
    if (codigo) localStorage.setItem(CHAVE_PILOTO, codigo);
    else localStorage.removeItem(CHAVE_PILOTO);
  } catch {
    // Sem armazenamento, o código vale só até recarregar a página.
  }
}

export async function chamarApi(metodo, caminho, corpo, codigo = CONEXAO.codigo) {
  let r;
  try {
    r = await fetch(caminho, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', 'x-codigo-piloto': codigo || '' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error('Sem conexão com o servidor do CondoFácil. Confira a internet e tente de novo');
  }
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(dados.erro || `O servidor respondeu ${r.status}`);
  return dados;
}

export function usaAsaasReal(estado) {
  return CONEXAO.ativa && !!CONEXAO.codigo && estado.origem === 'novo' && !!(estado.condominio.asaas && estado.condominio.asaas.real);
}
