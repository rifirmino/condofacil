import { html, useState } from '../vendor.js';
import { linhasDoOrcado } from '../cobranca/dados.js';
import { fmtReais } from '../cobranca/regras.js';
import { NOMES_TIPO_UNIDADE } from '../cobranca/composicao.js';
import { despesaAnual, ordinariaNecessaria, candidataDaPrevisao, simularPrevisao, resultadoComTaxaAtual, margemAtual, compararPrevisoes, nomeDaLinha } from '../cobranca/orcamento.js';
import { salvarPrevisao, excluirPrevisao, gerarDocumentoPrevisao } from '../cobranca/acoes-orcamento.js';
import { lerPreco } from '../vendas/regras.js';
import { liberado } from '../planos.js';
import { isoDia, fmtDataCurta } from '../datas.js';
import { Campo, Erro, Sucesso, Vazio } from './comum.js';
import { Bloqueado } from './financeiro-sindico.js';
import { FormReajuste, TabelaSimulacao } from './composicao.js';

// Aba Orçamento: previsão do ano por categoria, a taxa que fecha a conta e o documento levado à AGO.
const REAJUSTE_PADRAO_ORCAMENTO = 8;

function linhasParaForm(linhas) {
  return linhas.map((l) => ({ categoria: l.categoria, nome: l.categoria ? '' : l.nome, texto: fmtReais(l.valor) }));
}

function formDaPrevisao(p) {
  return { id: p.id, ano: p.ano, nome: p.nome, linhas: linhasParaForm(p.linhas), margem: String(p.margemPct).replace('.', ',') };
}

function lerPercentual(texto) {
  const limpo = String(texto ?? '').trim().replace(',', '.');
  return limpo === '' ? NaN : Number(limpo);
}

function valoresIniciaisReajuste(versao) {
  if (versao.modo === 'fracao') return { modo: 'fracao', forma: 'valores', orcamento: fmtReais(versao.orcamento) };
  return { modo: 'fixo', forma: 'valores', A: fmtReais(versao.ordinaria.A), cobertura: fmtReais(versao.ordinaria.cobertura) };
}

function ComparacaoPrevisoes({ fin }) {
  const previsoes = fin.previsoes;
  const [a, setA] = useState(previsoes[0] ? previsoes[0].id : '');
  const [b, setB] = useState(previsoes[1] ? previsoes[1].id : '');
  const pa = previsoes.find((p) => p.id === a);
  const pb = previsoes.find((p) => p.id === b);
  if (previsoes.length < 2) return html`<${Vazio} texto="Salve duas previsões para comparar." />`;
  const c = pa && pb ? compararPrevisoes(fin, pa, pb) : null;
  const opcoes = previsoes.map((p) => html`<option key=${p.id} value=${p.id}>${p.id} · ${p.nome}</option>`);
  const linha = (rotulo, va, vb, forte) => html`<tr key=${rotulo}><td>${forte ? html`<strong>${rotulo}</strong>` : rotulo}</td><td>${fmtReais(va)}</td><td>${fmtReais(vb)}</td><td>${vb - va === 0 ? '—' : `${vb > va ? '+' : '−'}${fmtReais(Math.abs(vb - va))}`}</td></tr>`;
  return html`<div class="pilha">
    <div class="edicao-anuncio">
      <${Campo} rotulo="Previsão A"><select id="comparar-a" value=${a} onChange=${(ev) => setA(ev.target.value)}>${opcoes}</select><//>
      <${Campo} rotulo="Previsão B"><select id="comparar-b" value=${b} onChange=${(ev) => setB(ev.target.value)}>${opcoes}</select><//>
    </div>
    ${c && html`<div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Item (por ano)</th><th>${pa.id}</th><th>${pb.id}</th><th>B − A</th></tr></thead>
      <tbody>
        ${c.linhas.map((l) => linha(l.nome, l.a, l.b, false))}
        ${linha('Despesa anual', c.total.a, c.total.b, true)}
        ${linha('Ordinária necessária por mês', c.ordinaria.a, c.ordinaria.b, true)}
        ${c.tipos.map((t) => linha(`${NOMES_TIPO_UNIDADE[t.tipo]} por mês (com fundo)`, t.a, t.b, true))}
      </tbody>
    </table></div>`}
  </div>`;
}

export function COrcamento({ estado, executar, agora }) {
  const fin = estado.financeiro;
  const hoje = isoDia(agora);
  const anoBase = Number(fin.vigente.slice(0, 4)) + 1;
  const novoForm = () => ({ id: null, ano: anoBase, nome: '', linhas: linhasParaForm(linhasDoOrcado(fin.orcamento, REAJUSTE_PADRAO_ORCAMENTO)), margem: String(margemAtual(estado, hoje)).replace('.', ',') });
  const [form, setForm] = useState(novoForm);
  const [pct, setPct] = useState(String(REAJUSTE_PADRAO_ORCAMENTO));
  const [reajustando, setReajustando] = useState(false);
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  if (!liberado(estado.plano, 'simuladorTaxa')) return html`<${Bloqueado} estado=${estado} recurso="simuladorTaxa" titulo="Previsão orçamentária e simulador de taxa" />`;

  const linhas = form.linhas.map((l) => ({ categoria: l.categoria, nome: l.categoria ? '' : l.nome, valor: lerPreco(l.texto) }));
  const margemPct = lerPercentual(form.margem);
  const previsao = { ano: Number(form.ano), linhas, margemPct };
  const valida = linhas.every((l) => Number.isFinite(l.valor) && l.valor >= 0) && Number.isFinite(margemPct) && margemPct >= 0 && margemPct < 100;
  const simulacao = valida ? simularPrevisao(fin, previsao) : null;
  const resultado = valida ? resultadoComTaxaAtual(fin, previsao) : 0;
  const salva = form.id && fin.previsoes.find((p) => p.id === form.id);

  function mudarLinha(n, chave, valor) {
    setForm({ ...form, linhas: form.linhas.map((l, i) => (i === n ? { ...l, [chave]: valor } : l)) });
  }

  function aplicarReajuste() {
    const p = lerPercentual(pct);
    if (!Number.isFinite(p)) { setErro('Informe o percentual de reajuste'); return; }
    const porCategoria = Object.fromEntries(linhasDoOrcado(fin.orcamento, p).map((l) => [l.categoria, fmtReais(l.valor)]));
    setForm({ ...form, linhas: form.linhas.map((l) => (l.categoria ? { ...l, texto: porCategoria[l.categoria] } : l)) });
    setErro(null);
  }

  function salvar(comoNova) {
    const r = executar((e) => salvarPrevisao(e, { id: comoNova ? null : form.id, ano: Number(form.ano), nome: form.nome, linhas, margemPct }, 'sindico', new Date()));
    setErro(r.erro || null);
    if (!r.erro) {
      setForm({ ...form, id: r.id });
      setMensagem(`Previsão ${r.id} salva.`);
    }
  }

  function abrir(p) {
    setForm(formDaPrevisao(p));
    setReajustando(false);
    setErro(null);
    setMensagem(`Previsão ${p.id} aberta.`);
  }

  function rodar(acao, sucesso) {
    const r = executar(acao);
    setErro(r.erro || null);
    setMensagem(r.erro ? null : sucesso(r));
    return r;
  }

  return html`<div class="pilha">
    <p class="sub">Monte a despesa do ano por categoria e veja a taxa que fecha a conta, já com a margem de inadimplência.</p>
    <div class="cartao pilha formulario">
      <strong>${salva ? `${salva.id} · ${salva.nome}` : 'Nova previsão'}</strong>
      <div class="edicao-anuncio">
        <${Campo} rotulo="Ano"><select id="orcamento-ano" value=${form.ano} onChange=${(ev) => setForm({ ...form, ano: Number(ev.target.value) })}>${[anoBase - 1, anoBase, anoBase + 1].map((a) => html`<option key=${a} value=${a}>${a}</option>`)}</select><//>
        <${Campo} rotulo="Nome da previsão"><input id="orcamento-nome" value=${form.nome} onInput=${(ev) => setForm({ ...form, nome: ev.target.value })} placeholder="Ex.: Proposta do conselho" /><//>
        <${Campo} rotulo="Percentual de reajuste (%)" dica="Aplicado sobre o orçado atual de cada categoria"><input id="orcamento-reajuste" inputmode="decimal" value=${pct} onInput=${(ev) => setPct(ev.target.value)} /><//>
        <${Campo} rotulo="Margem de inadimplência (%)" dica="Começa com a inadimplência de hoje"><input id="orcamento-margem" inputmode="decimal" value=${form.margem} onInput=${(ev) => setForm({ ...form, margem: ev.target.value })} /><//>
      </div>
      <div class="acoes"><button type="button" class="btn secundario" data-acao="aplicar-reajuste" onClick=${aplicarReajuste}>Aplicar reajuste</button></div>
      <div class="tabela-rolagem"><table class="tabela">
        <thead><tr><th>Item</th><th>Orçado atual (12 meses)</th><th>Previsão (R$ por ano)</th><th></th></tr></thead>
        <tbody>${form.linhas.map((l, n) => html`<tr key=${n}>
          <td>${l.categoria ? nomeDaLinha(l) : html`<input aria-label="Nome da linha" value=${l.nome} onInput=${(ev) => mudarLinha(n, 'nome', ev.target.value)} placeholder="Ex.: Obra do telhado" />`}</td>
          <td>${l.categoria ? fmtReais(fin.orcamento[l.categoria] * 12) : '—'}</td>
          <td><input aria-label=${`Valor de ${l.categoria ? nomeDaLinha(l) : l.nome || 'linha livre'}`} inputmode="decimal" value=${l.texto} onInput=${(ev) => mudarLinha(n, 'texto', ev.target.value)} /></td>
          <td>${!l.categoria && html`<button type="button" class="btn-link" onClick=${() => setForm({ ...form, linhas: form.linhas.filter((_, i) => i !== n) })}>Remover</button>`}</td>
        </tr>`)}</tbody>
      </table></div>
      <div class="acoes"><button type="button" class="btn secundario" data-acao="adicionar-linha" onClick=${() => setForm({ ...form, linhas: [...form.linhas, { categoria: null, nome: '', texto: '' }] })}>Adicionar linha</button></div>
      ${valida
        ? html`<div class="cartao simulacao pilha">
            <dl class="resumo">
              <dt>Despesa anual</dt><dd>${fmtReais(despesaAnual(linhas))}</dd>
              <dt>Despesa mensal</dt><dd>${fmtReais(Math.round(despesaAnual(linhas) / 12))}</dd>
              <dt>Ordinária necessária</dt><dd>${fmtReais(ordinariaNecessaria(linhas, margemPct))} por mês, com ${String(margemPct).replace('.', ',')}% de margem</dd>
            </dl>
            <p class=${resultado >= 0 ? 'sucesso' : 'erro'}>Com a taxa atual, o ano fecha com ${resultado >= 0 ? 'sobra' : 'falta'} de ${fmtReais(Math.abs(resultado))}.</p>
          </div>
          <${TabelaSimulacao} simulacao=${simulacao} />`
        : html`<small class="sub">Preencha valores e margem válidos para ver o cálculo.</small>`}
      <${Erro} texto=${erro} />
      <${Sucesso} texto=${mensagem} />
      <div class="acoes">
        <button type="button" class="btn primario" data-acao="salvar-previsao" onClick=${() => salvar(false)}>${salva ? 'Salvar alterações' : 'Salvar previsão'}</button>
        ${salva && html`<button type="button" class="btn secundario" data-acao="salvar-como-nova" onClick=${() => salvar(true)}>Salvar como nova</button>`}
        ${valida && html`<button type="button" class="btn secundario" data-acao="usar-no-reajuste" aria-expanded=${reajustando} onClick=${() => setReajustando(!reajustando)}>Usar no reajuste</button>`}
        ${salva && html`<button type="button" class="btn secundario" data-acao="gerar-documento" onClick=${() => rodar((e) => gerarDocumentoPrevisao(e, salva.id, 'sindico', new Date()), (r) => `Documento publicado em Documentos › Previsão orçamentária (versão ${r.versao}).`)}>Gerar documento para a AGO</button>`}
        <button type="button" class="btn-link" onClick=${() => { setForm(novoForm()); setReajustando(false); setMensagem(null); setErro(null); }}>Nova previsão</button>
      </div>
    </div>
    ${reajustando && valida && html`<${FormReajuste} key=${JSON.stringify(candidataDaPrevisao(fin, previsao))} estado=${estado} executar=${executar} inicial=${valoresIniciaisReajuste(candidataDaPrevisao(fin, previsao))} aoConcluir=${(texto) => { setReajustando(false); setMensagem(`${texto} Confira em Taxa e reajustes.`); }} />`}
    <h2>Previsões salvas</h2>
    ${fin.previsoes.length
      ? html`<ul class="m-lista">${fin.previsoes.map((p) => {
          const s = simularPrevisao(fin, p);
          return html`<li key=${p.id} class="cartao">
            <div class="linha-entre"><strong>${p.id} · ${p.nome} · ${p.ano}</strong><small class="sub">atualizada em ${fmtDataCurta(isoDia(new Date(p.atualizadaEm)))}${p.documento ? ' · documento publicado' : ''}</small></div>
            <span>${fmtReais(despesaAnual(p.linhas))} por ano · apto tipo A ${fmtReais(s.tipos[0].depois)} por mês · margem ${String(p.margemPct).replace('.', ',')}%</span>
            <div class="acoes">
              <button type="button" class="btn secundario" data-abrir-previsao=${p.id} onClick=${() => abrir(p)}>Abrir</button>
              <button type="button" class="btn-link" onClick=${() => { rodar((e) => excluirPrevisao(e, p.id, 'sindico'), () => `Previsão ${p.id} excluída.`); if (form.id === p.id) setForm(novoForm()); }}>Excluir</button>
            </div>
          </li>`;
        })}</ul>`
      : html`<${Vazio} texto="Nenhuma previsão salva." />`}
    <h2>Comparar</h2>
    <${ComparacaoPrevisoes} key=${fin.previsoes.map((p) => p.id).join()} fin=${fin} />
  </div>`;
}
