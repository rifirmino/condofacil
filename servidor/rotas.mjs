import { createHash, timingSafeEqual } from 'node:crypto';
import { cifrar, decifrar } from './cifra.mjs';
import { ErroAsaas, MSG_ASAAS_FORA } from './asaas.mjs';

// Handlers da API: funções de (pedido, dependências) que devolvem { status, corpo }, testáveis sem rede.
const LIMITE_POR_MINUTO = 60;
export const MSG_CHAVE_RECUSADA = 'O Asaas recusou a chave da API do servidor. Confira a variável ASAAS_API_KEY no hPanel (pode ser cadastrada sem o $ do começo)';
const PAGO = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);
const FORMAS = { PIX: 'pix', CREDIT_CARD: 'cartao' };
const ABERTAS = new Set(['GET /api/saude', 'POST /api/webhook/asaas']);

const ok = (corpo) => ({ status: 200, corpo });
const falha = (status, erro) => ({ status, corpo: { erro } });
const hojeDe = (agora) => agora.toISOString().slice(0, 10);
const reais = (centavos) => Math.round(centavos) / 100;

function faltando(corpo, campos) {
  return campos.find((c) => corpo == null || corpo[c] === undefined || corpo[c] === null || corpo[c] === '');
}

// Compara segredos em tempo constante (o hash iguala os tamanhos).
function mesmoSegredo(recebido, esperado) {
  if (!esperado) return false;
  const h = (v) => createHash('sha256').update(String(v || '')).digest();
  return timingSafeEqual(h(recebido), h(esperado));
}

function semImagem({ pixImagem, ...resto }) {
  return resto;
}

export function criarRotas({ banco, asaas, config }) {
  const chamadas = new Map();

  function excedeuLimite(ip, agora) {
    const t = agora.getTime();
    const atual = chamadas.get(ip);
    if (!atual || t - atual.inicio >= 60000) {
      chamadas.set(ip, { inicio: t, n: 1 });
      return false;
    }
    atual.n += 1;
    return atual.n > LIMITE_POR_MINUTO;
  }

  async function subconta(id) {
    const c = await banco.obterCondominio(id);
    return c ? { condominio: c, cliente: asaas(decifrar(c.apiKeyCifrada, config.chaveCripto)) } : null;
  }

  async function criarCondominio({ corpo }) {
    const campo = faltando(corpo, ['id', 'nome', 'cnpj', 'email', 'celular', 'cep', 'endereco', 'numero', 'bairro', 'rendaMensal']);
    if (campo) return falha(400, `Informe o campo ${campo}`);
    const existente = await banco.obterCondominio(corpo.id);
    if (existente) return ok({ walletId: existente.walletId, situacao: existente.situacao });
    const conta = await asaas(config.chaveRaiz).post('/accounts', {
      name: corpo.nome, email: corpo.email, cpfCnpj: corpo.cnpj, companyType: 'ASSOCIATION', mobilePhone: corpo.celular,
      incomeValue: reais(corpo.rendaMensal), postalCode: corpo.cep, address: corpo.endereco, addressNumber: corpo.numero, province: corpo.bairro,
    });
    await asaas(conta.apiKey).post('/webhooks', {
      name: 'CondoFácil', url: `${config.urlPublica}/api/webhook/asaas`, email: corpo.email, enabled: true, interrupted: false,
      authToken: config.tokenWebhook, sendType: 'SEQUENTIALLY', events: ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE'],
    });
    await banco.salvarCondominio({ id: corpo.id, nome: corpo.nome, cnpj: corpo.cnpj, walletId: conta.walletId, apiKeyCifrada: cifrar(conta.apiKey, config.chaveCripto), situacao: 'ativa' });
    return ok({ walletId: conta.walletId, situacao: 'ativa' });
  }

  async function clienteDaLinha(cliente, condominioId, l) {
    const cpf = String(l.responsavel.cpf || '').replace(/\D/g, '');
    const guardado = await banco.obterCliente(condominioId, l.unidade, cpf);
    if (guardado) return guardado.asaasId;
    const achados = await cliente.get(`/customers?cpfCnpj=${cpf}`);
    const novo = (achados.data && achados.data[0]) || await cliente.post('/customers', {
      name: l.responsavel.nome, cpfCnpj: cpf, email: l.responsavel.email || undefined, mobilePhone: l.responsavel.celular || undefined,
      externalReference: l.unidade, notificationDisabled: true,
    });
    await banco.salvarCliente({ condominioId, unidade: l.unidade, cpf, asaasId: novo.id });
    return novo.id;
  }

  async function emitirLinha(cliente, condominioId, competencia, l) {
    const referencia = `${condominioId}:${competencia}:${l.unidade}`;
    const salva = await banco.obterCobranca(referencia);
    if (salva) return salva;
    const customer = await clienteDaLinha(cliente, condominioId, l);
    const achados = await cliente.get(`/payments?externalReference=${encodeURIComponent(referencia)}`);
    const pagamento = (achados.data && achados.data[0]) || await cliente.post('/payments', {
      customer, billingType: 'UNDEFINED', value: reais(l.valor), dueDate: l.vencimento, description: l.descricao,
      externalReference: referencia, fine: { value: l.multaPct }, interest: { value: l.jurosPct },
    });
    let pix = null;
    try {
      pix = await cliente.get(`/payments/${pagamento.id}/pixQrCode`);
    } catch (e) {
      // Sem chave Pix na subconta o QR falha; a cobrança vale assim mesmo (boleto e fatura).
      if (!(e instanceof ErroAsaas)) throw e;
    }
    const cobranca = {
      referencia, condominioId, competencia, unidade: l.unidade, asaasId: pagamento.id, valor: l.valor, vencimento: l.vencimento,
      situacao: 'pendente', pagoEm: null, forma: null, faturaUrl: pagamento.invoiceUrl || null, boletoUrl: pagamento.bankSlipUrl || null,
      pixCopiaCola: pix ? pix.payload : null, pixImagem: pix ? pix.encodedImage : null,
    };
    await banco.salvarCobranca(cobranca);
    return cobranca;
  }

  async function emitir({ corpo }) {
    const campo = faltando(corpo, ['condominio', 'competencia', 'linhas']);
    if (campo) return falha(400, `Informe o campo ${campo}`);
    const s = await subconta(corpo.condominio);
    if (!s) return falha(404, 'Condomínio sem subconta no Asaas');
    const resultados = [];
    for (const l of corpo.linhas) {
      try {
        resultados.push({ unidade: l.unidade, ok: true, cobranca: await emitirLinha(s.cliente, corpo.condominio, corpo.competencia, l) });
      } catch (e) {
        if (!(e instanceof ErroAsaas) || e.status === 401) throw e;
        resultados.push({ unidade: l.unidade, ok: false, erro: e.mensagem, fora: e.status >= 502 });
      }
    }
    if (resultados.length && resultados.every((r) => r.fora)) return falha(502, MSG_ASAAS_FORA);
    return ok({ resultados: resultados.map(({ fora, ...r }) => r) });
  }

  async function listar({ consulta }) {
    if (!consulta.condominio) return falha(400, 'Informe o campo condominio');
    return ok({ cobrancas: (await banco.listarCobrancas(consulta.condominio, consulta.competencia)).map(semImagem) });
  }

  async function simularPagamento({ corpo, agora }) {
    const cobranca = corpo && corpo.referencia && await banco.obterCobranca(corpo.referencia);
    if (!cobranca) return falha(404, 'Cobrança não encontrada');
    const s = await subconta(cobranca.condominioId);
    await s.cliente.post(`/payments/${cobranca.asaasId}/receiveInCash`, { paymentDate: hojeDe(agora), value: reais(cobranca.valor) });
    return ok({ ok: true });
  }

  async function webhook({ cabecalhos, corpo, agora }) {
    if (!mesmoSegredo(cabecalhos['asaas-access-token'], config.tokenWebhook)) return falha(401, 'Token do webhook inválido');
    if (!corpo || !corpo.id || !corpo.payment) return falha(400, 'Evento inválido');
    const novo = await banco.registrarEvento({ id: corpo.id, tipo: corpo.event, asaasPagamento: corpo.payment.id });
    if (!novo) return ok({ ignorado: true });
    const p = corpo.payment;
    if (PAGO.has(p.status)) await banco.atualizarCobranca(p.externalReference, { situacao: 'paga', pagoEm: p.paymentDate || hojeDe(agora), forma: FORMAS[p.billingType] || 'boleto' });
    else if (p.status === 'OVERDUE') await banco.atualizarCobranca(p.externalReference, { situacao: 'vencida' });
    return ok({ ok: true });
  }

  const ROTAS = {
    'GET /api/saude': async () => ok({ ok: true, ambiente: 'sandbox' }),
    'POST /api/condominios': criarCondominio,
    'POST /api/emissoes': emitir,
    'GET /api/cobrancas': listar,
    'POST /api/simular-pagamento': simularPagamento,
    'POST /api/webhook/asaas': webhook,
  };

  async function tratar(pedido) {
    const chave = `${pedido.metodo} ${pedido.caminho}`;
    if (excedeuLimite(pedido.ip, pedido.agora)) return falha(429, 'Muitas chamadas; aguarde um minuto');
    const rota = ROTAS[chave];
    if (!rota) return falha(404, 'Rota desconhecida');
    if (!ABERTAS.has(chave) && !mesmoSegredo(pedido.cabecalhos['x-codigo-piloto'], config.codigoPiloto)) return falha(401, 'Código do piloto inválido');
    try {
      return await rota(pedido);
    } catch (e) {
      if (e instanceof ErroAsaas && e.status === 401) return falha(502, MSG_CHAVE_RECUSADA);
      if (e instanceof ErroAsaas) return falha(e.status >= 502 ? 502 : 400, e.status >= 502 ? MSG_ASAAS_FORA : e.mensagem);
      throw e;
    }
  }

  return { tratar };
}
