// Cliente mínimo da API v3 do Asaas. A URL vem do ambiente (sandbox na Hostinger, Asaas falso nos testes).
export const MSG_ASAAS_FORA = 'Não foi possível falar com o Asaas agora. Nada foi emitido; tente de novo';

// No .env da Hostinger um valor começando com "$" pode virar nome de variável: a chave pode ser cadastrada sem o "$".
export function normalizarChaveAsaas(valor) {
  const v = String(valor || '').trim().replace(/^['"]|['"]$/g, '');
  return v.startsWith('aact_') ? `$${v}` : v;
}

export class ErroAsaas extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
    this.mensagem = mensagem;
  }
}

export function clienteAsaas({ url, chave, tempoMs = 10000 }) {
  async function chamar(metodo, caminho, corpo) {
    let resp;
    try {
      resp = await fetch(url + caminho, {
        method: metodo,
        headers: { access_token: chave, 'Content-Type': 'application/json', 'User-Agent': 'CondoFacil/1.0' },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        signal: AbortSignal.timeout(tempoMs),
      });
    } catch (e) {
      throw new ErroAsaas(e.name === 'TimeoutError' ? 504 : 502, MSG_ASAAS_FORA);
    }
    const texto = await resp.text();
    let dados = {};
    try { dados = texto ? JSON.parse(texto) : {}; } catch { dados = {}; }
    if (!resp.ok) {
      // O corpo de erro do Asaas não traz segredos; vai ao log (privado, no hPanel) para diagnóstico.
      console.warn(`Asaas ${resp.status} em ${metodo} ${caminho.split('?')[0]}: ${texto.slice(0, 300) || '(sem corpo)'}`);
      throw new ErroAsaas(resp.status, (dados.errors && dados.errors[0] && dados.errors[0].description) || dados.message || `Asaas respondeu ${resp.status}`);
    }
    return dados;
  }
  return { get: (c) => chamar('GET', c), post: (c, corpo) => chamar('POST', c, corpo ?? {}) };
}
