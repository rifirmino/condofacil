import { createServer } from 'node:http';

// Imita as rotas da API v3 do Asaas que o CondoFácil usa, para os testes rodarem sem internet e sem chave.
export const CHAVE_RAIZ_FALSA = 'raiz_teste';
const PNG_FALSO = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export async function asaasFalso({ urlWebhookPadrao } = {}) {
  const opcoes = { negarSubconta: false };
  const webhooksCriados = [];
  let n = 0;
  const proximo = (prefixo) => `${prefixo}_${(n += 1)}`;
  const contas = [];
  const chaves = new Set([CHAVE_RAIZ_FALSA]);
  const webhooks = new Map();
  const clientes = [];
  const pagamentos = new Map();
  const falharCpf = new Set();
  const eventosEnviados = [];

  const erro = (res, status, descricao) => responder(res, status, { errors: [{ code: 'invalid', description: descricao }] });
  function responder(res, status, corpo) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(corpo));
  }

  async function dispararWebhook(chave, pagamento) {
    const w = webhooks.get(chave) || (urlWebhookPadrao && { url: urlWebhookPadrao, authToken: null });
    if (!w) return;
    const evento = { id: proximo('evt'), event: 'PAYMENT_RECEIVED', dateCreated: new Date().toISOString(), payment: { id: pagamento.id, externalReference: pagamento.externalReference, status: pagamento.status, billingType: pagamento.billingType, value: pagamento.value, paymentDate: pagamento.paymentDate } };
    eventosEnviados.push(evento);
    try {
      await fetch(w.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'asaas-access-token': w.authToken || '' }, body: JSON.stringify(evento) });
    } catch {
      // O servidor de teste pode já ter fechado.
    }
  }

  const servidor = createServer(async (req, res) => {
    let texto = '';
    for await (const parte of req) texto += parte;
    const corpo = texto ? JSON.parse(texto) : {};
    const url = new URL(req.url, 'http://x');
    const chave = req.headers.access_token;
    if (!chaves.has(chave)) return erro(res, 401, 'Chave de API inválida');
    const rota = `${req.method} ${url.pathname.replace(/\/(pay|cus)_\d+/, '/:id')}`;
    const id = (url.pathname.match(/\/(pay_\d+)/) || [])[1];

    if (rota === 'POST /accounts') {
      // Como o Asaas real responde a uma conta de pessoa física: 403 com "message", sem "errors".
      if (opcoes.negarSubconta) return responder(res, 403, { message: 'Contas de pessoa física (CPF) não podem criar subcontas no Asaas.' });
      if (!corpo.cpfCnpj) return erro(res, 400, 'Informe o CPF ou CNPJ');
      const conta = { id: proximo('acc'), apiKey: proximo('sub'), walletId: proximo('wal'), ...corpo };
      contas.push(conta);
      chaves.add(conta.apiKey);
      return responder(res, 200, { id: conta.id, apiKey: conta.apiKey, walletId: conta.walletId, name: conta.name });
    }
    if (rota === 'POST /webhooks') {
      webhooks.set(chave, { url: corpo.url, authToken: corpo.authToken, events: corpo.events });
      webhooksCriados.push(chave);
      return responder(res, 200, { id: proximo('wh'), ...corpo });
    }
    if (rota === 'GET /webhooks') {
      const w = webhooks.get(chave);
      return responder(res, 200, { data: w ? [{ id: 'wh', url: w.url, enabled: true }] : [] });
    }
    if (rota === 'GET /customers') {
      return responder(res, 200, { data: clientes.filter((c) => c.dono === chave && (!url.searchParams.get('cpfCnpj') || c.cpfCnpj === url.searchParams.get('cpfCnpj'))) });
    }
    if (rota === 'POST /customers') {
      if (falharCpf.has(corpo.cpfCnpj)) return erro(res, 400, 'O CPF informado é inválido.');
      const c = { id: proximo('cus'), dono: chave, ...corpo };
      clientes.push(c);
      return responder(res, 200, c);
    }
    if (rota === 'GET /payments') {
      return responder(res, 200, { data: [...pagamentos.values()].filter((p) => p.dono === chave && p.externalReference === url.searchParams.get('externalReference')) });
    }
    if (rota === 'POST /payments') {
      if (!clientes.some((c) => c.id === corpo.customer && c.dono === chave)) return erro(res, 400, 'Cliente inexistente');
      if (!(corpo.value > 0)) return erro(res, 400, 'Informe o valor');
      const p = { id: proximo('pay'), dono: chave, status: 'PENDING', ...corpo };
      p.invoiceUrl = `https://sandbox.asaas.com/i/${p.id}`;
      p.bankSlipUrl = `https://sandbox.asaas.com/b/pdf/${p.id}`;
      pagamentos.set(p.id, p);
      return responder(res, 200, p);
    }
    if (rota === 'GET /payments/:id/pixQrCode') {
      if (!pagamentos.has(id)) return erro(res, 404, 'Cobrança não encontrada');
      return responder(res, 200, { encodedImage: PNG_FALSO, payload: `00020126580014br.gov.bcb.pix0136${id}5204000053039865802BR`, expirationDate: '2026-12-31 23:59:59' });
    }
    if (rota === 'POST /payments/:id/receiveInCash') {
      const p = pagamentos.get(id);
      if (!p || p.dono !== chave) return erro(res, 404, 'Cobrança não encontrada');
      Object.assign(p, { status: 'RECEIVED_IN_CASH', paymentDate: corpo.paymentDate });
      responder(res, 200, p);
      setImmediate(() => dispararWebhook(chave, p));
      return undefined;
    }
    return erro(res, 404, `Rota desconhecida: ${rota}`);
  });

  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  return {
    url: `http://127.0.0.1:${servidor.address().port}`,
    contas,
    clientes,
    pagamentos,
    webhooks,
    falharCpf,
    opcoes,
    webhooksCriados,
    eventosEnviados,
    fechar: () => new Promise((ok) => { servidor.closeAllConnections(); servidor.close(ok); }),
  };
}
