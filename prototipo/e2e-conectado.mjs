// Modo conectado de ponta a ponta: servidor real com o Asaas falso, o app aberto nele e o ciclo subconta → emissão → Pix → webhook → baixa.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarServidor } from '../servidor/http.mjs';
import { criarRotas } from '../servidor/rotas.mjs';
import { bancoEmMemoria } from '../servidor/banco.mjs';
import { clienteAsaas } from '../servidor/asaas.mjs';
import { asaasFalso, CHAVE_RAIZ_FALSA } from '../servidor/testes/asaas-falso.mjs';
import { AJUDANTES, pausa, cdp, js, esperar, esperarTexto, paginaPronta, clicarSeletor, clicar, porId, irPara, fecharChrome } from './cdp.mjs';

const raiz = dirname(fileURLToPath(import.meta.url));
const CODIGO = 'piloto-e2e';
const falso = await asaasFalso();
const banco = bancoEmMemoria();
let rotas = null;
const servidor = criarServidor({ rotas: { tratar: (p) => rotas.tratar(p) }, paginas: { site: () => readFileSync(join(raiz, '../servidor/publico/site.html')), app: () => readFileSync(join(raiz, '../servidor/publico/index.html')) } });
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${servidor.address().port}`;
rotas = criarRotas({ banco, asaas: (chave) => clienteAsaas({ url: falso.url, chave }), config: { chaveRaiz: CHAVE_RAIZ_FALSA, tokenWebhook: 'token-do-webhook-e2e', chaveCripto: Buffer.alloc(32, 5).toString('base64'), codigoPiloto: CODIGO, urlPublica: base } });

const avancar = () => clicarSeletor('[data-acao="avancar-implantacao"]');
const escolherCondominio = (valor) => js(`document.getElementById('seletor-condominio').value = ${JSON.stringify(valor)}; document.getElementById('seletor-condominio').dispatchEvent(new Event('change', { bubbles: true })); true`);

async function asaasConectado() {
  await esperar(`!!document.getElementById('codigo-piloto')`, 'o campo do código do piloto');
  await porId('codigo-piloto', 'errado');
  await clicarSeletor('[data-acao="conectar-piloto"]');
  await esperarTexto('Código do piloto inválido');
  await porId('codigo-piloto', CODIGO);
  await clicarSeletor('[data-acao="conectar-piloto"]');
  await esperarTexto('Asaas sandbox conectado');

  await escolherCondominio('novo');
  await esperarTexto('passo 1 de 7');
  await porId('impl-nome', 'Residencial Conectado');
  await porId('impl-cep', '01310-100');
  await porId('impl-endereco', 'Av. Paulista');
  await porId('impl-sindico', 'Helena Prado');
  await porId('impl-sindico-apto', '402B');
  await porId('impl-sindico-email', 'helena@email.com');
  await porId('impl-sindico-celular', '11999998888');
  await avancar();
  await porId('impl-blocos', 'A, B');
  await porId('impl-andares', '4');
  await porId('impl-por-andar', '2');
  await clicarSeletor('#impl-cobertura');
  await clicarSeletor('[data-acao="gerar-unidades"]');
  await esperarTexto('16 unidades');
  await avancar();
  await porId('impl-csv-moradores', '101A;Maria Silva;maria@email.com;11987654321;titular;sim;529.982.247-25\n201B;Rui Costa;rui@email.com;11944443333;proprietario;sim');
  await esperarTexto('529.982.247-25');
  await avancar();
  await porId('impl-taxa-a', '500,00');
  await porId('impl-taxa-cobertura', '750,00');
  await avancar();
  await esperarTexto('Asaas sandbox conectado: a subconta');
  await porId('impl-asaas-cnpj', '11.222.333/0001-81');
  await clicarSeletor('[data-acao="criar-subconta"]');
  await esperarTexto('Preencha CEP e endereço');
  await porId('impl-numero', '1000');
  await porId('impl-bairro', 'Bela Vista');
  await clicarSeletor('[data-acao="criar-subconta"]');
  await esperarTexto('Subconta aprovada no Asaas sandbox');
  if (falso.contas.length !== 1 || falso.contas[0].cpfCnpj !== '11222333000181') throw new Error('a subconta não chegou ao Asaas');
  await avancar();
  await avancar();
  await esperar(`!!document.querySelector('#cartaz-implantacao')`, 'o cartaz');
  await avancar();
  await esperarTexto('Olá, Helena');

  await irPara('#sindico.cobranca.previa');
  await esperarTexto('Sem CPF: não será emitida');
  await js(`(() => { const i = document.getElementById('emissao-vencimento'); if (!i) return; const d = new Date(Date.now() + 5 * 864e5); __e2e.porId('emissao-vencimento', d.toISOString().slice(0, 10)); })()`);
  await clicarSeletor('[data-acao="emitir"]');
  await esperarTexto('1 cobrança emitida no Asaas sandbox');
  if (falso.pagamentos.size !== 1) throw new Error(`esperava 1 pagamento no Asaas, veio ${falso.pagamentos.size}`);

  // A Maria entra pelo convite e paga pelo Pix real.
  await irPara('#morador.convite');
  await porId('convite-unidade', '101A');
  await porId('convite-nome', 'Maria Silva');
  await porId('convite-celular', '11987654321');
  await clicarSeletor('[data-acao="pedir-codigo"]');
  await porId('convite-codigo', await js(`document.querySelector('[data-codigo]').dataset.codigo`));
  await clicarSeletor('[data-acao="confirmar-convite"]');
  await esperarTexto('Tudo certo!');
  await irPara('#morador.financeiro');
  await clicar('Pagar com Pix');
  await esperar(`!!document.querySelector('img.pix-real')`, 'o QR Code Pix real');
  await esperar(`[...document.querySelectorAll('input[readonly]')].some((i) => i.value.startsWith('00020126580014br.gov.bcb.pix'))`, 'o Pix copia e cola real');
  await clicarSeletor('[data-acao="simular-sandbox"]');
  await esperarTexto('A baixa chega pelo webhook');
  for (let i = 0; i < 30 && !falso.eventosEnviados.length; i += 1) await pausa(100);
  if (!falso.eventosEnviados.length) throw new Error('o Asaas falso não disparou o webhook');
  await pausa(300);
  await irPara('#morador.inicio');
  await irPara('#morador.financeiro');
  await esperarTexto('Nenhuma cobrança em aberto');
  const erros = await js('window.__erros.splice(0)');
  if (erros.length) throw new Error(erros.join(' | '));
}

let falhou = false;
try {
  await cdp('Page.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: AJUDANTES });
  await cdp('Page.navigate', { url: `${base}/app#sindico.inicio` });
  await paginaPronta();
  try {
    await asaasConectado();
    console.log('ok    asaasConectado');
  } catch (e) {
    falhou = true;
    console.log(`FALHA asaasConectado: ${e.message}`);
  }
} finally {
  await fecharChrome();
  servidor.closeAllConnections();
  servidor.close();
  await falso.fechar();
}
process.exit(falhou ? 1 : 0);
