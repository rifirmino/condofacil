// Chrome headless via DevTools Protocol (sem dependências) e os ajudantes dos roteiros e2e. Importar já abre o navegador.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acharChrome, urlPagina } from './navegador.mjs';

const AJUDANTES = `window.__erros = [];
window.addEventListener('error', (e) => window.__erros.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__erros.push(String(e.reason && e.reason.message || e.reason)));
window.__e2e = {
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
  porId(id, valor) {
    const el = document.getElementById(id);
    if (!el) throw new Error('Campo não encontrado: #' + id);
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
const porId = async (id, valor) => { await js(`__e2e.porId(${JSON.stringify(id)}, ${JSON.stringify(valor)})`); await pausa(80); };
const irPara = async (hash) => { await js(`location.hash = ${JSON.stringify(hash)}`); await pausa(200); };


export async function fecharChrome() {
  ws.close();
  processo.kill();
  await pausa(500);
  try { rmSync(perfil, { recursive: true, force: true }); } catch { /* o Windows pode segurar o perfil por um instante */ }
}

export { AJUDANTES, urlPagina, pausa, cdp, js, esperar, esperarTexto, paginaPronta, clicar, clicarSeletor, preencher, porId, marcar, irPara };
