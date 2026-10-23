import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarServidor } from '../http.mjs';
import { criarRotas } from '../rotas.mjs';
import { bancoEmMemoria } from '../banco.mjs';
import { clienteAsaas } from '../asaas.mjs';
import { asaasFalso, CHAVE_RAIZ_FALSA } from './asaas-falso.mjs';

const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));

test('ciclo completo por HTTP: página, subconta, emissão, pagamento simulado e webhook', async () => {
  const falso = await asaasFalso();
  // As rotas precisam da URL do próprio servidor (para o webhook), que só existe depois do listen.
  let rotas = null;
  const servidor = criarServidor({ rotas: { tratar: (p) => rotas.tratar(p) }, pagina: () => '<!doctype html><html><body>CondoFácil</body></html>' });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  rotas = criarRotas({ banco: bancoEmMemoria(), asaas: (chave) => clienteAsaas({ url: falso.url, chave }), config: { chaveRaiz: CHAVE_RAIZ_FALSA, tokenWebhook: 'token-do-webhook', chaveCripto: Buffer.alloc(32, 3).toString('base64'), codigoPiloto: 'piloto', urlPublica: base } });
  const api = async (metodo, caminho, corpo) => {
    const r = await fetch(base + caminho, { method: metodo, headers: { 'Content-Type': 'application/json', 'x-codigo-piloto': 'piloto' }, body: corpo === undefined ? undefined : typeof corpo === 'string' ? corpo : JSON.stringify(corpo) });
    return { status: r.status, corpo: await r.json() };
  };
  try {
    const pagina = await fetch(base + '/');
    assert.match(await pagina.text(), /<html/);
    assert.equal(pagina.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual((await api('GET', '/api/saude')).corpo, { ok: true, ambiente: 'sandbox' });
    assert.equal((await api('POST', '/api/emissoes', '{nao e json')).status, 400);
    await api('POST', '/api/condominios', { id: 'c1', nome: 'Teste', cnpj: '11222333000181', email: 's@t.com', celular: '11999998888', cep: '01310100', endereco: 'Av. Paulista', numero: '1', bairro: 'Centro', rendaMensal: 100000 });
    const emissao = await api('POST', '/api/emissoes', { condominio: 'c1', competencia: '2026-11', linhas: [{ unidade: 'A101', responsavel: { nome: 'Maria', cpf: '52998224725' }, valor: 55000, vencimento: '2026-11-10', descricao: 'Taxa', multaPct: 2, jurosPct: 1 }] });
    assert.equal(emissao.corpo.resultados[0].ok, true);
    await api('POST', '/api/simular-pagamento', { referencia: 'c1:2026-11:A101' });
    let situacao = null;
    for (let i = 0; i < 20 && situacao !== 'paga'; i += 1) {
      await pausa(100);
      situacao = (await api('GET', '/api/cobrancas?condominio=c1')).corpo.cobrancas[0].situacao;
    }
    assert.equal(situacao, 'paga');
  } finally {
    servidor.closeAllConnections();
    await new Promise((ok) => servidor.close(ok));
    await falso.fechar();
  }
});
