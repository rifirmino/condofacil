import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clienteAsaas, ErroAsaas, MSG_ASAAS_FORA, normalizarChaveAsaas } from '../asaas.mjs';
import { asaasFalso, CHAVE_RAIZ_FALSA } from './asaas-falso.mjs';

test('cliente fala com o Asaas falso e traduz erros', async () => {
  const f = await asaasFalso();
  try {
    const raiz = clienteAsaas({ url: f.url, chave: CHAVE_RAIZ_FALSA });
    const conta = await raiz.post('/accounts', { name: 'Cond', cpfCnpj: '11222333000181' });
    assert.match(conta.apiKey, /^sub_/);
    f.falharCpf.add('00000000000');
    const sub = clienteAsaas({ url: f.url, chave: conta.apiKey });
    await assert.rejects(sub.post('/customers', { name: 'X', cpfCnpj: '00000000000' }), (e) => e instanceof ErroAsaas && e.status === 400 && /CPF/.test(e.mensagem));
    await assert.rejects(clienteAsaas({ url: f.url, chave: 'errada' }).get('/customers'), (e) => e.status === 401);
  } finally {
    await f.fechar();
  }
});

test('Asaas fora do ar vira erro com a mensagem padrão', async () => {
  const fora = clienteAsaas({ url: 'http://127.0.0.1:1', chave: 'x', tempoMs: 500 });
  await assert.rejects(fora.get('/customers'), (e) => e.status === 502 && e.mensagem === MSG_ASAAS_FORA);
});

test('chave do Asaas vale com ou sem o cifrão do começo, e sem aspas', () => {
  const chave = '$aact_hmlg_abc123';
  assert.deepEqual([normalizarChaveAsaas(chave), normalizarChaveAsaas('aact_hmlg_abc123'), normalizarChaveAsaas(` '${chave}' `), normalizarChaveAsaas('raiz_teste')], [chave, chave, chave, 'raiz_teste']);
});
