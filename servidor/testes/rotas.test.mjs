import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarRotas } from '../rotas.mjs';
import { bancoEmMemoria } from '../banco.mjs';
import { clienteAsaas, MSG_ASAAS_FORA } from '../asaas.mjs';
import { decifrar } from '../cifra.mjs';
import { asaasFalso, CHAVE_RAIZ_FALSA } from './asaas-falso.mjs';

const CHAVE_CRIPTO = Buffer.alloc(32, 9).toString('base64');
const CPF_OK = '52998224725';
const CPF_RUIM = '00000000000';

async function montar({ urlAsaas, tempoMs } = {}) {
  const falso = urlAsaas ? null : await asaasFalso();
  const banco = bancoEmMemoria();
  const config = { chaveRaiz: CHAVE_RAIZ_FALSA, tokenWebhook: 'tok', chaveCripto: CHAVE_CRIPTO, codigoPiloto: 'piloto', urlPublica: 'https://app.teste' };
  const rotas = criarRotas({ banco, asaas: (chave) => clienteAsaas({ url: urlAsaas || falso.url, chave, tempoMs }), config });
  let ip = 0;
  const chamar = (metodo, caminho, corpo, extras = {}) => {
    const [base, qs] = caminho.split('?');
    return rotas.tratar({ metodo, caminho: base, consulta: Object.fromEntries(new URLSearchParams(qs || '')), cabecalhos: { 'x-codigo-piloto': 'piloto', ...extras.cabecalhos }, corpo, ip: extras.ip || `ip${(ip += 1)}`, agora: extras.agora || new Date(2026, 9, 23, 10) });
  };
  return { falso, banco, rotas, chamar, fechar: () => falso && falso.fechar() };
}

const DADOS_CONDOMINIO = { id: 'cond-teste', nome: 'Residencial Teste', cnpj: '11222333000181', email: 'sindico@teste.com', celular: '11999998888', cep: '01310100', endereco: 'Av. Paulista', numero: '1000', bairro: 'Bela Vista', rendaMensal: 990000 };
const linha = (unidade, cpf) => ({ unidade, responsavel: { nome: `Morador ${unidade}`, cpf, email: '', celular: '' }, valor: 55000, vencimento: '2026-11-10', descricao: `Taxa condominial · apto ${unidade}`, multaPct: 2, jurosPct: 1 });

test('saúde é aberta; o resto exige o código do piloto', async () => {
  const t = await montar();
  try {
    assert.deepEqual((await t.chamar('GET', '/api/saude', null, { cabecalhos: { 'x-codigo-piloto': '' } })).corpo, { ok: true, ambiente: 'sandbox' });
    const r = await t.chamar('POST', '/api/condominios', DADOS_CONDOMINIO, { cabecalhos: { 'x-codigo-piloto': 'errado' } });
    assert.deepEqual([r.status, r.corpo.erro], [401, 'Código do piloto inválido']);
    assert.equal((await t.chamar('GET', '/api/nada')).status, 404);
  } finally { await t.fechar(); }
});

test('subconta é criada uma vez, com chave cifrada e webhook com token', async () => {
  const t = await montar();
  try {
    const r1 = await t.chamar('POST', '/api/condominios', DADOS_CONDOMINIO);
    const r2 = await t.chamar('POST', '/api/condominios', DADOS_CONDOMINIO);
    assert.deepEqual([r1.status, r1.corpo.situacao, r2.corpo.walletId], [200, 'ativa', r1.corpo.walletId]);
    assert.equal(t.falso.contas.length, 1);
    assert.equal(t.falso.contas[0].companyType, 'ASSOCIATION');
    assert.equal(t.falso.contas[0].incomeValue, 9900);
    const salvo = await t.banco.obterCondominio('cond-teste');
    assert.notEqual(salvo.apiKeyCifrada, t.falso.contas[0].apiKey);
    assert.equal(decifrar(salvo.apiKeyCifrada, CHAVE_CRIPTO), t.falso.contas[0].apiKey);
    const wh = t.falso.webhooks.get(t.falso.contas[0].apiKey);
    assert.deepEqual([wh.url, wh.authToken], ['https://app.teste/api/webhook/asaas', 'tok']);
    assert.equal((await t.chamar('POST', '/api/condominios', { id: 'x' })).status, 400);
  } finally { await t.fechar(); }
});

test('emissão: falha por linha, sem duplicar, e reenvio da que falhou', async () => {
  const t = await montar();
  try {
    await t.chamar('POST', '/api/condominios', DADOS_CONDOMINIO);
    t.falso.falharCpf.add(CPF_RUIM);
    const corpo = { condominio: 'cond-teste', competencia: '2026-11', linhas: [linha('A101', CPF_OK), linha('A102', CPF_OK), linha('A201', CPF_RUIM)] };
    const r = await t.chamar('POST', '/api/emissoes', corpo);
    assert.deepEqual(r.corpo.resultados.map((x) => [x.unidade, x.ok, x.erro || null]), [['A101', true, null], ['A102', true, null], ['A201', false, 'O CPF informado é inválido.']]);
    const c = r.corpo.resultados[0].cobranca;
    assert.equal(c.referencia, 'cond-teste:2026-11:A101');
    assert.match(c.faturaUrl, /pay_/);
    assert.ok(c.pixCopiaCola && c.pixImagem);
    const pagamento = [...t.falso.pagamentos.values()][0];
    assert.deepEqual([pagamento.value, pagamento.billingType, pagamento.fine.value, pagamento.interest.value, pagamento.externalReference], [550, 'UNDEFINED', 2, 1, 'cond-teste:2026-11:A101']);
    assert.equal(t.falso.clientes[0].notificationDisabled, true);
    await t.chamar('POST', '/api/emissoes', corpo);
    assert.equal(t.falso.pagamentos.size, 2);
    t.falso.falharCpf.clear();
    const reenvio = await t.chamar('POST', '/api/emissoes', { ...corpo, linhas: [linha('A201', CPF_RUIM)] });
    assert.equal(reenvio.corpo.resultados[0].ok, true);
    assert.equal(t.falso.pagamentos.size, 3);
    const lista = await t.chamar('GET', '/api/cobrancas?condominio=cond-teste&competencia=2026-11');
    assert.equal(lista.corpo.cobrancas.length, 3);
    assert.equal(lista.corpo.cobrancas[0].pixImagem, undefined);
    assert.equal((await t.chamar('POST', '/api/emissoes', { ...corpo, condominio: 'outro' })).status, 404);
  } finally { await t.fechar(); }
});

test('webhook: token, baixa e evento repetido', async () => {
  const t = await montar();
  try {
    await t.chamar('POST', '/api/condominios', DADOS_CONDOMINIO);
    const r = await t.chamar('POST', '/api/emissoes', { condominio: 'cond-teste', competencia: '2026-11', linhas: [linha('A101', CPF_OK)] });
    const asaasId = r.corpo.resultados[0].cobranca.asaasId;
    const evento = { id: 'evt_9', event: 'PAYMENT_RECEIVED', payment: { id: asaasId, externalReference: 'cond-teste:2026-11:A101', status: 'RECEIVED', billingType: 'PIX', paymentDate: '2026-10-23' } };
    assert.equal((await t.chamar('POST', '/api/webhook/asaas', evento, { cabecalhos: { 'asaas-access-token': 'errado', 'x-codigo-piloto': '' } })).status, 401);
    const ok = await t.chamar('POST', '/api/webhook/asaas', evento, { cabecalhos: { 'asaas-access-token': 'tok', 'x-codigo-piloto': '' } });
    assert.deepEqual([ok.status, ok.corpo.ok], [200, true]);
    const cob = await t.banco.obterCobranca('cond-teste:2026-11:A101');
    assert.deepEqual([cob.situacao, cob.forma, cob.pagoEm], ['paga', 'pix', '2026-10-23']);
    const de_novo = await t.chamar('POST', '/api/webhook/asaas', evento, { cabecalhos: { 'asaas-access-token': 'tok' } });
    assert.equal(de_novo.corpo.ignorado, true);
    await t.chamar('POST', '/api/webhook/asaas', { ...evento, id: 'evt_10', event: 'PAYMENT_OVERDUE', payment: { ...evento.payment, externalReference: 'nao-existe', status: 'OVERDUE' } }, { cabecalhos: { 'asaas-access-token': 'tok' } });
  } finally { await t.fechar(); }
});

test('simular pagamento chama o receiveInCash da subconta', async () => {
  const t = await montar();
  try {
    await t.chamar('POST', '/api/condominios', DADOS_CONDOMINIO);
    await t.chamar('POST', '/api/emissoes', { condominio: 'cond-teste', competencia: '2026-11', linhas: [linha('A101', CPF_OK)] });
    const r = await t.chamar('POST', '/api/simular-pagamento', { referencia: 'cond-teste:2026-11:A101' });
    assert.deepEqual([r.status, r.corpo.ok], [200, true]);
    assert.equal([...t.falso.pagamentos.values()][0].status, 'RECEIVED_IN_CASH');
    assert.equal((await t.chamar('POST', '/api/simular-pagamento', { referencia: 'x' })).status, 404);
  } finally { await t.fechar(); }
});

test('limite de 60 chamadas por minuto por IP', async () => {
  const t = await montar();
  try {
    const agora = new Date(2026, 9, 23, 10, 0, 0);
    for (let i = 0; i < 60; i += 1) assert.equal((await t.chamar('GET', '/api/saude', null, { ip: 'mesmo', agora })).status, 200);
    const r = await t.chamar('GET', '/api/saude', null, { ip: 'mesmo', agora });
    assert.deepEqual([r.status, r.corpo.erro], [429, 'Muitas chamadas; aguarde um minuto']);
    assert.equal((await t.chamar('GET', '/api/saude', null, { ip: 'mesmo', agora: new Date(agora.getTime() + 61000) })).status, 200);
  } finally { await t.fechar(); }
});

test('Asaas fora do ar: emissão devolve 502 com a mensagem padrão', async () => {
  const t = await montar({ urlAsaas: 'http://127.0.0.1:1', tempoMs: 500 });
  await t.banco.salvarCondominio({ id: 'cond-teste', nome: 'T', cnpj: '1', walletId: 'w', apiKeyCifrada: (await import('../cifra.mjs')).cifrar('sub_1', CHAVE_CRIPTO), situacao: 'ativa' });
  const r = await t.chamar('POST', '/api/emissoes', { condominio: 'cond-teste', competencia: '2026-11', linhas: [linha('A101', CPF_OK)] });
  assert.deepEqual([r.status, r.corpo.erro], [502, MSG_ASAAS_FORA]);
  assert.equal((await t.banco.listarCobrancas('cond-teste')).length, 0);
});
