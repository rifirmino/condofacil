// Percorre os 4 roteiros da especificação num Chrome headless via DevTools Protocol (sem dependências).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acharChrome, urlPagina } from './navegador.mjs';

const AJUDANTES = `window.__e2e = {
  visivel(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); },
  clicar(texto) {
    for (const seletor of ['button', 'a']) {
      const els = [...document.querySelectorAll(seletor)].filter((el) => this.visivel(el) && !el.disabled);
      const el = els.find((e) => e.textContent.trim() === texto) || els.find((e) => e.textContent.includes(texto));
      if (el) { el.click(); return true; }
    }
    throw new Error('Nada clicável com o texto: ' + texto);
  },
  clicarSeletor(seletor) {
    const el = document.querySelector(seletor);
    if (!el) throw new Error('Seletor não encontrado: ' + seletor);
    if (el.disabled) throw new Error('Elemento desabilitado: ' + seletor);
    el.click();
    return true;
  },
  campo(rotulo) {
    const label = [...document.querySelectorAll('label')].find((l) => { const s = l.querySelector(':scope > span'); return s && s.textContent.trim() === rotulo; });
    if (!label || !label.control) throw new Error('Campo não encontrado: ' + rotulo);
    return label.control;
  },
  preencher(rotulo, valor) {
    const el = this.campo(rotulo);
    el.value = valor;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  },
  marcar(rotulo) { const el = this.campo(rotulo); if (!el.checked) el.click(); return true; },
};`;

const chrome = acharChrome();
const perfil = mkdtempSync(join(tmpdir(), 'condofacil-e2e-'));
const porta = 9300 + Math.floor(Math.random() * 500);
const processo = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${perfil}`, `--remote-debugging-port=${porta}`, '--window-size=1366,900', 'about:blank'], { stdio: 'ignore' });

const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function enderecoDaPagina() {
  for (let i = 0; i < 75; i++) {
    try {
      const alvos = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json();
      const pagina = alvos.find((a) => a.type === 'page');
      if (pagina) return pagina.webSocketDebuggerUrl;
    } catch {
      // Chrome ainda subindo.
    }
    await pausa(200);
  }
  throw new Error('Não foi possível conectar ao Chrome');
}

const ws = new WebSocket(await enderecoDaPagina());
await new Promise((ok, falha) => { ws.onopen = ok; ws.onerror = falha; });
let sequencia = 0;
const pendentes = new Map();
ws.onmessage = (m) => {
  const dados = JSON.parse(m.data);
  if (dados.id && pendentes.has(dados.id)) {
    pendentes.get(dados.id)(dados);
    pendentes.delete(dados.id);
  }
};

function cdp(method, params = {}) {
  return new Promise((ok) => {
    sequencia += 1;
    pendentes.set(sequencia, ok);
    ws.send(JSON.stringify({ id: sequencia, method, params }));
  });
}

async function js(expressao) {
  const r = await cdp('Runtime.evaluate', { expression: expressao, awaitPromise: true, returnByValue: true });
  if (r.error) throw new Error(r.error.message);
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  return r.result.result.value;
}

async function esperar(condicao, descricao, ms = 5000) {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    if (await js(condicao)) return;
    await pausa(100);
  }
  throw new Error(`tempo esgotado esperando ${descricao}`);
}

// Ignora maiúsculas: o CSS aplica caixa alta em títulos e selos, e o innerText reflete isso.
const esperarTexto = (texto) => esperar(`document.body.innerText.toLowerCase().includes(${JSON.stringify(texto.toLowerCase())})`, `o texto "${texto}"`);
const paginaPronta = () => esperar(`document.readyState === 'complete' && !!document.querySelector('.barra-demo')`, 'a página carregar', 20000);
const clicar = async (texto) => { await js(`__e2e.clicar(${JSON.stringify(texto)})`); await pausa(120); };
const clicarSeletor = async (seletor) => { await js(`__e2e.clicarSeletor(${JSON.stringify(seletor)})`); await pausa(120); };
const preencher = async (rotulo, valor) => { await js(`__e2e.preencher(${JSON.stringify(rotulo)}, ${JSON.stringify(valor)})`); await pausa(80); };
const marcar = async (rotulo) => { await js(`__e2e.marcar(${JSON.stringify(rotulo)})`); await pausa(80); };
const irPara = async (hash) => { await js(`location.hash = ${JSON.stringify(hash)}`); await pausa(200); };

const ROTEIROS = {
  async encomenda() {
    await irPara('#portaria.registrar');
    await clicar('Ler etiqueta');
    await clicar('Registrar encomenda');
    await esperarTexto('Morador avisado por WhatsApp');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Ana Souza')`, 'o selo de WhatsApp para a Ana');
    const codigo = await js(`document.querySelector('.confirmacao').dataset.codigo`);
    await irPara('#morador.inicio');
    await esperarTexto(codigo);
    await irPara('#portaria.entregar');
    await preencher('Buscar por código ou unidade', codigo);
    await clicar('Apto 302');
    await preencher('Código de retirada', '000000');
    await preencher('Quem retirou', 'Ana Souza');
    await clicar('Confirmar entrega');
    await esperarTexto('Código inválido');
    await clicar('Escanear QR do morador');
    await clicar('Confirmar entrega');
    await esperarTexto('Entrega registrada');
    await irPara('#morador.encomendas');
    await esperar(`document.body.innerText.split('Retirada por Ana Souza').length > 2`, 'duas retiradas da Ana no histórico');
  },

  async reserva() {
    const alvo = await js(`(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })()`);
    await irPara('#morador.reservas');
    await clicar('Salão de festas');
    if (!(await js(`!!document.querySelector('[data-dia="${alvo}"]')`))) await clicarSeletor('[aria-label="Próximo mês"]');
    await clicarSeletor(`[data-dia="${alvo}"]`);
    await clicar('Tarde (13h–18h)');
    await marcar('Li e aceito o termo de responsabilidade');
    await clicar('Solicitar reserva');
    await esperarTexto('Aguardando aprovação');
    await irPara('#sindico.reservas');
    await clicarSeletor('[data-acao="aprovar-r5"]');
    await esperar(`!document.querySelector('[data-acao="aprovar-r5"]')`, 'a reserva sair da fila de aprovação');
    await irPara('#morador.reservas');
    await esperar(`[...document.querySelectorAll('.m-lista li')].some((li) => li.innerText.includes('Salão de festas') && li.innerText.includes('Confirmada'))`, 'a reserva do salão confirmada para a Ana');
  },

  async ocorrencia() {
    await irPara('#morador.ocorrencias.nova');
    await preencher('Categoria', 'vazamento');
    await preencher('Descrição', 'Infiltração no teto do banheiro');
    await clicar('Enviar ocorrência');
    await esperarTexto('Protocolo OC-0043');
    await irPara('#sindico.ocorrencias.OC-0043');
    for (const status of ['Em análise', 'Em andamento', 'Resolvida']) {
      await clicar(`Mover para "${status}"`);
      await esperarTexto(`Status alterado para ${status}`);
    }
    await irPara('#morador.ocorrencias.OC-0043');
    await clicarSeletor('[data-estrela="5"]');
    await clicar('Enviar avaliação');
    await esperarTexto('Sua avaliação');
  },

  async comunicado() {
    await irPara('#sindico.comunicados.novo');
    await preencher('Tipo', 'evento');
    await preencher('Título', 'Bazar de Natal');
    await clicar('Publicar comunicado');
    await esperarTexto('0 de 32 unidades leram');
    const id = await js(`location.hash.split('.').pop()`);
    await irPara('#morador.avisos');
    await clicar('Bazar de Natal');
    await clicar('Li e estou ciente');
    await esperarTexto('Você confirmou a leitura');
    await irPara(`#sindico.comunicados.${id}`);
    await esperarTexto('1 de 32 unidades leram');
  },

  async vendaCompra() {
    await irPara('#morador.vendas.a1');
    await esperarTexto('Restam 10');
    await preencher('Quantidade', '2');
    await clicar('Adicionar à sacola');
    await esperarTexto('Adicionado à sacola');
    await irPara('#morador.vendas.a2');
    await clicar('Adicionar à sacola');
    await esperarTexto('Adicionado à sacola');
    await irPara('#morador.vendas.sacola');
    await esperarTexto('R$ 48,00');
    await clicar('Fechar pedido');
    await esperarTexto('Pedido PD-011');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Juliana Costa')`, 'o aviso de pedido para a Juliana');
    await irPara('#morador.vendas.a1');
    await esperarTexto('Restam 8');
  },

  async vendaAtendimento() {
    await clicar('Juliana · 104');
    await irPara('#morador.vendas.PD-011');
    await clicar('Aceitar pedido');
    await esperarTexto('Pedido aceito pelo vendedor');
    await preencher('Mensagem', 'Pode passar às 18h');
    await clicar('Enviar');
    await esperarTexto('Pode passar às 18h');
    await clicar('Ana · 302');
    await irPara('#morador.vendas.PD-011');
    await esperarTexto('Pode passar às 18h');
    await clicar('Juliana · 104');
    await irPara('#morador.vendas.PD-011');
    await clicar('Marcar como entregue');
    await clicar('Marcar como pago');
    await esperarTexto('Pagamento confirmado pelo vendedor');
    await irPara('#morador.vendas.loja');
    await clicar('Painel');
    await esperarTexto('R$ 102,00');
    await clicar('Ana · 302');
  },

  async vendaVirarVendedora() {
    await irPara('#morador.vendas.loja');
    await preencher('O que você pretende vender?', 'Bolos caseiros por encomenda');
    await clicar('Pedir para vender');
    await esperarTexto('Aguardando aprovação do síndico');
    await irPara('#sindico.vendas');
    await clicarSeletor('[data-acao="aprovar-vendedor-302"]');
    await esperar(`!document.querySelector('[data-acao="aprovar-vendedor-302"]')`, 'a solicitação sair da lista');
    await irPara('#morador.vendas.novo-anuncio');
    await preencher('Título', 'Bolo de cenoura com chocolate');
    await preencher('Preço (R$)', '35,00');
    await preencher('Quantidade', '4');
    await marcar('Pix');
    await marcar('Retirar no apto');
    await clicar('Publicar anúncio');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('9 moradores')`, 'o aviso para quem aceita ofertas');
    await irPara('#morador.vendas');
    await esperarTexto('Bolo de cenoura com chocolate');
  },

  async cobrancaEmissao() {
    await irPara('#sindico.cobranca.previa');
    await esperarTexto('Sem responsável financeiro: não será emitida');
    await clicarSeletor('[data-acao="emitir"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('31 responsáveis')`, 'o aviso de emissão');
    await irPara('#sindico.inicio');
    await esperarTexto('0 de 31 pagas');
  },

  async cobrancaPagamento() {
    await irPara('#morador.inicio');
    await esperarTexto('Sua cobrança de');
    await esperarTexto('R$ 865,00');
    await irPara('#morador.financeiro');
    await clicar('Pagar com Pix');
    await esperarTexto('Pix copia e cola');
    await clicar('Simular confirmação do Asaas');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Pagamento recebido')`, 'o aviso do Asaas');
    await esperarTexto('Nenhuma cobrança em aberto');
    await clicar('Juliana · 104');
    await irPara('#morador.financeiro');
    await esperarTexto('vão para o responsável financeiro');
    await esperarTexto('Carlos A. (proprietário)');
    await clicar('Ana · 302');
    await irPara('#sindico.inicio');
    await esperarTexto('1 de 31 pagas');
    await esperarTexto('R$ 49.215');
  },

  async cobrancaReguaBaixa() {
    await irPara('#sindico.cobranca.regua');
    await clicarSeletor('[data-acao="executar-regua"]');
    await esperarTexto('7 avisos enviados');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('4 responsáveis')`, 'o aviso da régua');
    await irPara('#sindico.cobranca.emitidas');
    const vigente = await js(`[...document.getElementById('emitidas-competencia').options].map((o) => o.value)[1]`);
    await preencher('Competência', vigente);
    await clicarSeletor(`[data-cobranca="CB-${vigente}-503"]`);
    await clicar('Baixa manual');
    await clicar('Anexar comprovante');
    await clicar('Confirmar baixa');
    await esperarTexto('Baixa registrada');
    await irPara('#sindico.inicio');
    await esperarTexto('3 de 32');
  },

  async cobrancaPlanos() {
    await clicar('Básico');
    await irPara('#sindico.inicio');
    await esperarTexto('Disponível no plano Intermediário (+R$ 158,40/mês)');
    await clicar('Avançado');
    await esperarTexto('Orçado × realizado');
    await clicar('Intermediário');
  },

  async persistencia() {
    await irPara('#sindico.comunicados');
    await esperarTexto('Bazar de Natal');
    await cdp('Page.reload');
    await pausa(300);
    await paginaPronta();
    await esperarTexto('Bazar de Natal');
    await clicar('Reiniciar demonstração');
    await esperar(`!document.body.innerText.includes('Bazar de Natal')`, 'o reinício apagar o comunicado novo');
  },

  async acordoProposta() {
    await irPara('#sindico.inicio');
    await esperarTexto('Acordo AC-001 (304): parcela 2 vencida');
    await clicarSeletor('[data-propor="704"]');
    await esperarTexto('Enviar proposta');
    await marcar('Perdoar a multa');
    await preencher('Entrada (R$)', '300,00');
    await preencher('Parcelas', '3');
    await esperarTexto('Total do acordo');
    await clicarSeletor('[data-acao="enviar-proposta"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Proposta AC-002 enviada a Vicente Moraes')`, 'o aviso da proposta');
    await esperarTexto('Aguardando aceite');
    await irPara('#morador.inicio');
    await clicar('Vicente · 704');
    await esperarTexto('Proposta de acordo do síndico');
    await irPara('#morador.financeiro');
    await esperarTexto('proprietário não residente');
    await clicar('Aceitar acordo');
    await esperarTexto('Marque que leu e aceita as condições');
    await marcar('Li e aceito as condições do acordo');
    await clicar('Aceitar acordo');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Acordo AC-002 aceito')`, 'o aviso do aceite');
    await esperarTexto('Meu acordo AC-002');
    await esperarTexto('Substituída pelo acordo AC-002');
    await clicar('Pagar com Pix');
    await clicar('Simular confirmação do Asaas');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Pagamento recebido')`, 'o pagamento da entrada');
    await clicar('Ana · 302');
    await irPara('#sindico.cobranca.acordos');
    await esperar(`[...document.querySelectorAll('tr')].some((tr) => tr.innerText.includes('AC-002') && tr.innerText.toLowerCase().includes('ativo'))`, 'o AC-002 ativo na lista');
  },

  async acordoPlanos() {
    await clicar('Reiniciar demonstração');
    await clicar('Básico');
    await irPara('#sindico.cobranca.acordos');
    await esperarTexto('Disponível no plano Intermediário');
    await clicar('Avançado');
    await irPara('#sindico.cobranca.novoacordo-704');
    await esperarTexto('Total do acordo');
    await clicarSeletor('[data-acao="enviar-proposta"]');
    await esperarTexto('Aguardando aceite');
    await irPara('#morador.financeiro');
    await clicar('Vicente · 704');
    await marcar('Li e aceito as condições do acordo');
    await clicar('Aceitar acordo');
    await esperarTexto('Leia o termo de confissão antes de aceitar');
    await clicar('Ler o termo de confissão de dívida');
    await esperarTexto('Termo de confissão de dívida · AC-002');
    await clicar('Fechar');
    await marcar('Li e aceito as condições do acordo');
    await clicar('Aceitar acordo');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Acordo AC-002 aceito')`, 'o aceite com termo');
    await clicar('Ana · 302');
    await clicar('Intermediário');
  },

  async larguraCelular() {
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await pausa(300);
    for (const hash of ['#sindico.inicio', '#sindico.reservas', '#sindico.comunicados.novo', '#sindico.ocorrencias', '#sindico.encomendas', '#sindico.vendas', '#morador.inicio', '#morador.reservas', '#morador.vendas', '#morador.vendas.a1', '#morador.vendas.loja', '#portaria.registrar', '#portaria.entregar', '#sindico.cobranca', '#morador.financeiro', '#sindico.cobranca.acordos', '#sindico.cobranca.AC-001', '#sindico.cobranca.novoacordo']) {
      await irPara(hash);
      const largura = await js('document.documentElement.scrollWidth');
      if (largura > 390) throw new Error(`${hash} rola na horizontal (${largura}px)`);
    }
    await cdp('Emulation.clearDeviceMetricsOverride');
  },
};

let falhou = false;
try {
  await cdp('Page.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: AJUDANTES });
  await cdp('Page.navigate', { url: `${urlPagina}#sindico.inicio` });
  await paginaPronta();
  await clicar('Reiniciar demonstração');
  for (const [nome, roteiro] of Object.entries(ROTEIROS)) {
    try {
      await roteiro();
      console.log(`ok    ${nome}`);
    } catch (e) {
      falhou = true;
      console.log(`FALHA ${nome}: ${e.message}`);
    }
  }
} finally {
  ws.close();
  processo.kill();
  await pausa(500);
  try { rmSync(perfil, { recursive: true, force: true }); } catch { /* o Windows pode segurar o perfil por um instante */ }
}
process.exit(falhou ? 1 : 0);
