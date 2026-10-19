import { html, render, useState, useEffect } from '../vendor.js';
import { dadosIniciais } from '../dados.js';
import { isoDia } from '../datas.js';
import { carregarEstado, salvarEstado, limparEstado } from '../armazenamento.js';
import { trocarPlano } from '../cobranca/acoes.js';
import { fmtReais } from '../cobranca/regras.js';
import { PLANOS, PRECO_BASE, mensalidade } from '../planos.js';
import { CASOS_DADOS } from '../casos/dados.js';
import { CASOS_REGRAS } from '../casos/regras.js';
import { CASOS_ACOES } from '../casos/acoes.js';
import { CASOS_VENDAS } from '../casos/vendas.js';
import { CASOS_COBRANCA_DADOS } from '../casos/cobranca-dados.js';
import { CASOS_COBRANCA_REGRAS } from '../casos/cobranca-regras.js';
import { CASOS_COBRANCA_ACOES } from '../casos/cobranca-acoes.js';
import { CASOS_ACORDOS } from '../casos/acordos.js';
import { CASOS_NOTIFICACOES } from '../casos/notificacoes.js';
import { CASOS_MANUTENCAO } from '../casos/manutencao.js';
import { PERFIS, lerRota, ir, Selo, Icone } from './comum.js';
import { TelaPortaria } from './portaria.js';
import { TelaMorador } from './morador.js';
import { TelaSindico } from './sindico.js';
import { TelaZelador } from './zelador.js';

const TELAS_PERFIL = { sindico: TelaSindico, morador: TelaMorador, portaria: TelaPortaria, zelador: TelaZelador };
const ultimaRota = {};

function estadoDeHoje() {
  const salvo = carregarEstado();
  return salvo && salvo.geradoEm === isoDia(new Date()) ? salvo : dadosIniciais(new Date());
}

function App() {
  const [estado, setEstado] = useState(estadoDeHoje);
  const [rota, setRota] = useState(lerRota);
  const [selo, setSelo] = useState(null);
  const [geracao, setGeracao] = useState(0);
  const [mostrarPrecos, setMostrarPrecos] = useState(false);

  useEffect(() => {
    const mudou = () => setRota(lerRota());
    window.addEventListener('hashchange', mudou);
    return () => window.removeEventListener('hashchange', mudou);
  }, []);

  useEffect(() => {
    salvarEstado(estado);
  }, [estado]);

  useEffect(() => {
    if (!selo) return undefined;
    const t = setTimeout(() => setSelo(null), 4500);
    return () => clearTimeout(t);
  }, [selo]);

  ultimaRota[rota.perfil] = rota;

  function executar(acao) {
    const resultado = acao(estado);
    if (!resultado.erro) {
      setEstado(resultado.estado);
      if (resultado.notificacao) setSelo({ ...resultado.notificacao, chave: Date.now() });
    }
    return resultado;
  }

  function trocarPerfil(id) {
    const anterior = ultimaRota[id];
    const perfil = PERFIS.find((p) => p.id === id);
    ir(id, anterior ? anterior.tela : perfil.inicial, anterior ? anterior.id : null);
  }

  function reiniciar() {
    limparEstado();
    setEstado(dadosIniciais(new Date()));
    setSelo(null);
    setGeracao(geracao + 1);
  }

  const Tela = TELAS_PERFIL[rota.perfil];
  return html`
    <header class="barra-demo">
      <div class="marca"><span class="logo"><${Icone} nome="predio" tamanho=${20} /></span><strong class="marca-nome">CondoFácil</strong><span class="sub">Residencial Ipê Amarelo · 32 unidades</span></div>
      <div class="ver-como" role="group" aria-label="Ver como">
        <span>Ver como</span>
        ${PERFIS.map((p) => html`<button type="button" key=${p.id} aria-pressed=${rota.perfil === p.id} onClick=${() => trocarPerfil(p.id)}>${p.nome}</button>`)}
      </div>
      <div class="ver-como plano" role="group" aria-label="Plano">
        <span>Plano</span>
        ${PLANOS.map((p) => html`<button type="button" key=${p.id} aria-pressed=${estado.plano === p.id} onClick=${() => executar((e) => trocarPlano(e, p.id))}>${p.nome}</button>`)}
        <button type="button" class="precos" aria-expanded=${mostrarPrecos} onClick=${() => setMostrarPrecos(!mostrarPrecos)}>Preços</button>
      </div>
      <button type="button" class="reiniciar" onClick=${reiniciar}>Reiniciar demonstração</button>
    </header>
    ${mostrarPrecos && html`<${PainelPrecos} plano=${estado.plano} unidades=${estado.condominio.unidades.length} aoFechar=${() => setMostrarPrecos(false)} />`}
    <main class=${`palco palco-${rota.perfil}`}>
      <${Tela} key=${`${rota.perfil}-${geracao}`} estado=${estado} rota=${rota} executar=${executar} agora=${new Date()} />
    </main>
    ${selo && html`<${Selo} key=${selo.chave} canal=${selo.canal} para=${selo.para} texto=${selo.texto} />`}
  `;
}

function PainelPrecos({ plano, unidades, aoFechar }) {
  return html`<div class="painel-precos" role="dialog" aria-label="Preços por plano">
    <div class="linha-entre"><strong>Preços para ${unidades} unidades · faixa de ${PRECO_BASE.faixa}</strong><button type="button" class="btn-link" onClick=${aoFechar}>Fechar</button></div>
    <ul class="itens-sacola">${PLANOS.map((p) => html`<li key=${p.id} class=${p.id === plano ? 'plano-atual' : ''}><span>${p.nome} · ${p.multiplicador.toFixed(1).replace('.', ',')}x</span><strong>${fmtReais(mensalidade(p.id, unidades))}/mês</strong></li>`)}</ul>
    <small class="sub">Implantação ${fmtReais(PRECO_BASE.implantacao)} · base de ${fmtReais(PRECO_BASE.porUnidade)} por unidade. As tarifas do Asaas por boleto ou Pix são do condomínio e aparecem à parte.</small>
  </div>`;
}

function PainelTestes() {
  const resultados = [...CASOS_DADOS, ...CASOS_REGRAS, ...CASOS_ACOES, ...CASOS_VENDAS, ...CASOS_COBRANCA_DADOS, ...CASOS_COBRANCA_REGRAS, ...CASOS_COBRANCA_ACOES, ...CASOS_ACORDOS, ...CASOS_NOTIFICACOES, ...CASOS_MANUTENCAO].map((caso) => {
    try {
      caso.rodar();
      return { nome: caso.nome, ok: true };
    } catch (e) {
      return { nome: caso.nome, ok: false, erro: e.message };
    }
  });
  const falhas = resultados.filter((r) => !r.ok);
  console.log(`Autoteste CondoFácil: ${resultados.length - falhas.length} de ${resultados.length} passaram`, falhas);
  return html`<main class="painel-testes">
    <h1>Autoteste das regras</h1>
    <p><strong>${resultados.length - falhas.length} de ${resultados.length} passaram · falhas: ${falhas.length}</strong></p>
    <ul>${resultados.map((r) => html`<li key=${r.nome} class=${r.ok ? 'ok' : 'falha'}>${r.ok ? '✓' : '✗'} ${r.nome}${r.erro ? html`<br /><small>${r.erro}</small>` : ''}</li>`)}</ul>
  </main>`;
}

const modoTeste = new URLSearchParams(location.search).get('teste') === '1';
render(modoTeste ? html`<${PainelTestes} />` : html`<${App} />`, document.getElementById('app'));
