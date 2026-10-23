import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoEmMemoria } from '../banco.mjs';

test('banco em memória guarda condomínio, cliente, cobrança e eventos únicos', async () => {
  const b = bancoEmMemoria();
  await b.preparar();
  assert.equal(await b.obterCondominio('c1'), null);
  await b.salvarCondominio({ id: 'c1', nome: 'Teste', cnpj: '123', walletId: 'w1', apiKeyCifrada: 'x', situacao: 'ativa' });
  assert.equal((await b.obterCondominio('c1')).walletId, 'w1');
  await b.salvarCliente({ condominioId: 'c1', unidade: 'A101', cpf: '52998224725', asaasId: 'cus_1' });
  assert.equal((await b.obterCliente('c1', 'A101', '52998224725')).asaasId, 'cus_1');
  assert.equal(await b.obterCliente('c1', 'A101', '00000000000'), null);
  const cob = { referencia: 'c1:2026-11:A101', condominioId: 'c1', competencia: '2026-11', unidade: 'A101', asaasId: 'pay_1', valor: 55000, vencimento: '2026-11-10', situacao: 'pendente', pagoEm: null, forma: null, faturaUrl: 'f', boletoUrl: 'b', pixCopiaCola: 'p', pixImagem: 'i' };
  await b.salvarCobranca(cob);
  await b.atualizarCobranca(cob.referencia, { situacao: 'paga', pagoEm: '2026-10-23', forma: 'pix' });
  assert.equal((await b.obterCobranca(cob.referencia)).situacao, 'paga');
  assert.equal((await b.listarCobrancas('c1')).length, 1);
  assert.equal((await b.listarCobrancas('c1', '2026-12')).length, 0);
  assert.equal(await b.registrarEvento({ id: 'evt_1', tipo: 'PAYMENT_RECEIVED', asaasPagamento: 'pay_1' }), true);
  assert.equal(await b.registrarEvento({ id: 'evt_1', tipo: 'PAYMENT_RECEIVED', asaasPagamento: 'pay_1' }), false);
});
