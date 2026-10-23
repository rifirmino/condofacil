import { html, useState } from '../vendor.js';
import { ordinariaDe, fundoDe, parcelaDe, fimExtra } from '../cobranca/dados.js';
import { fmtReais } from '../cobranca/regras.js';
import { NOMES_TIPO_UNIDADE, NOMES_MODO, NOMES_RATEIO, primeiraNaoEmitida, versaoVigente, versoesAgendadas, montarVersao, simularComposicao, resumoVersao, valorPorTipoExtra, fmtFracao, fmtVariacao, mudancasDaUnidade, tiposPresentes } from '../cobranca/composicao.js';
import { novaComposicao, cancelarComposicao, montarTaxaExtra, criarTaxaExtra, encerrarTaxaExtra } from '../cobranca/acoes-composicao.js';
import { lerPreco } from '../vendas/regras.js';
import { liberado } from '../planos.js';
import { somarMes, nomeMes, fmtDataCurta } from '../datas.js';
import { Campo, Erro, Sucesso, Vazio, Etiqueta } from './comum.js';
import { Bloqueado } from './financeiro-sindico.js';

// Aba "Taxa e reajustes" do síndico e o cartão "Mudanças na sua taxa" do morador.
function mesesAFrente(fin) {
  const p = primeiraNaoEmitida(fin);
  return Array.from({ length: 12 }, (_, n) => somarMes(p, n));
}

function lerNumero(texto) {
  const limpo = String(texto ?? '').trim().replace(',', '.');
  return limpo === '' ? '' : Number(limpo);
}

function textoDesfeitos(n) {
  return n ? ` ${n} ${n === 1 ? 'ajuste manual da prévia foi desfeito' : 'ajustes manuais da prévia foram desfeitos'}.` : '';
}

function unidadeDoTipo(fin, tipo) {
  return Object.keys(fin.unidades).find((u) => fin.unidades[u].tipo === tipo);
}

function ResumoEmVigor({ estado }) {
  const fin = estado.financeiro;
  const v = versaoVigente(fin);
  const competencia = somarMes(primeiraNaoEmitida(fin), -1);
  const ativas = fin.composicao.extras.filter((x) => parcelaDe(x, competencia));
  return html`<dl class="resumo">
    <dt>Modo</dt><dd>${NOMES_MODO[v.modo]}</dd>
    ${v.modo === 'fracao' && html`<dt>Orçamento mensal</dt><dd>${fmtReais(v.orcamento)}</dd>`}
    ${tiposPresentes(fin).map((tipo) => {
      const u = unidadeDoTipo(fin, tipo);
      return html`<dt key=${`t-${tipo}`}>${NOMES_TIPO_UNIDADE[tipo]}</dt><dd key=${`v-${tipo}`}>${fmtReais(ordinariaDe(fin, v, u))} + fundo ${fmtReais(fundoDe(fin, v, u))}</dd>`;
    })}
    <dt>Fundo de reserva</dt><dd>${v.fundoPct}% da ordinária</dd>
    ${ativas.map((x) => html`<dt key=${`x-${x.id}`}>Taxa extra</dt><dd key=${`d-${x.id}`}>${x.descricao} · parcela ${parcelaDe(x, competencia)}/${x.parcelas}</dd>`)}
    <dt>Aprovado em</dt><dd>${v.aprovadoEm}</dd>
  </dl>`;
}

export function TabelaSimulacao({ simulacao }) {
  return html`<div class="cartao simulacao">
    <strong>Simulação</strong>
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Tipo</th><th>Hoje</th><th>Passa a pagar</th><th>Diferença</th></tr></thead>
      <tbody>${simulacao.tipos.map((t) => html`<tr key=${t.tipo}><td>${NOMES_TIPO_UNIDADE[t.tipo]}</td><td>${fmtReais(t.antes)}</td><td><strong>${fmtReais(t.depois)}</strong></td><td>${fmtReais(t.diferenca)} (${fmtVariacao(t.pct)})</td></tr>`)}</tbody>
    </table></div>
    <dl class="resumo">
      <dt>Arrecadação mensal hoje</dt><dd>${fmtReais(simulacao.arrecadacaoAntes)}</dd>
      <dt>Arrecadação mensal depois</dt><dd>${fmtReais(simulacao.arrecadacaoDepois)}</dd>
    </dl>
    <small class="sub">Ordinária mais fundo de reserva, das 32 unidades. Taxas extras não entram.</small>
  </div>`;
}

export function FormReajuste({ estado, executar, aoConcluir, inicial = {} }) {
  const fin = estado.financeiro;
  const base = versaoVigente(fin);
  const comFracao = liberado(estado.plano, 'fracaoIdeal');
  const comFundo = liberado(estado.plano, 'composicaoCompleta');
  const [form, setForm] = useState({ vigencia: primeiraNaoEmitida(fin), modo: base.modo, forma: 'percentual', pct: '', A: '', cobertura: '', orcamento: '', fundoPct: String(base.fundoPct), aprovadoEm: '', publicar: true, ...inicial });
  const [erro, setErro] = useState(null);
  const campo = (chave) => (ev) => setForm({ ...form, [chave]: ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value });
  const dados = {
    vigencia: form.vigencia, modo: form.modo, forma: form.forma, pct: lerNumero(form.pct),
    ordinaria: { A: lerPreco(form.A), cobertura: lerPreco(form.cobertura) }, orcamento: lerPreco(form.orcamento),
    fundoPct: comFundo ? lerNumero(form.fundoPct) : undefined, aprovadoEm: form.aprovadoEm, publicar: form.publicar,
  };
  const montada = montarVersao(fin, dados);
  const simulacao = montada.versao ? simularComposicao(fin, montada.versao) : null;
  const agendada = versoesAgendadas(fin).find((v) => v.vigencia === form.vigencia);

  function confirmar() {
    const r = executar((e) => novaComposicao(e, dados, 'sindico', new Date()));
    setErro(r.erro || null);
    if (!r.erro) aoConcluir(`Reajuste agendado para ${nomeMes(form.vigencia)}.${textoDesfeitos(r.desfeitos)}`);
  }

  return html`<div class="cartao pilha formulario">
    <strong>Nova composição</strong>
    <div class="edicao-anuncio">
      <${Campo} rotulo="Vigência" dica="Meses já emitidos não mudam"><select id="taxa-vigencia" value=${form.vigencia} onChange=${campo('vigencia')}>${mesesAFrente(fin).map((m) => html`<option key=${m} value=${m}>A partir de ${nomeMes(m)}</option>`)}</select><//>
      ${comFracao && html`<${Campo} rotulo="Modo da ordinária"><select id="taxa-modo" value=${form.modo} onChange=${campo('modo')}>${Object.entries(NOMES_MODO).map(([k, nome]) => html`<option key=${k} value=${k}>${nome}</option>`)}</select><//>`}
      <${Campo} rotulo="Como reajustar"><select id="taxa-forma" value=${form.forma} onChange=${campo('forma')}><option value="percentual">Percentual sobre o valor atual</option><option value="valores">${form.modo === 'fracao' ? 'Novo orçamento mensal' : 'Novos valores por tipo'}</option></select><//>
      ${form.forma === 'percentual' && html`<${Campo} rotulo="Percentual (%)" dica="Use negativo para redução"><input id="taxa-pct" inputmode="decimal" value=${form.pct} onInput=${campo('pct')} placeholder="Ex.: 6" /><//>`}
      ${form.forma === 'valores' && form.modo === 'fixo' && html`
        <${Campo} rotulo="Apto tipo A (R$)"><input id="taxa-a" inputmode="decimal" value=${form.A} onInput=${campo('A')} placeholder=${fmtReais(base.ordinaria ? base.ordinaria.A : 0)} /><//>
        ${tiposPresentes(fin).includes('cobertura') && html`<${Campo} rotulo="Cobertura (R$)"><input id="taxa-cobertura" inputmode="decimal" value=${form.cobertura} onInput=${campo('cobertura')} placeholder=${fmtReais(base.ordinaria ? base.ordinaria.cobertura : 0)} /><//>`}`}
      ${form.forma === 'valores' && form.modo === 'fracao' && html`<${Campo} rotulo="Orçamento mensal (R$)" dica="Rateado pela fração ideal de cada unidade"><input id="taxa-orcamento" inputmode="decimal" value=${form.orcamento} onInput=${campo('orcamento')} placeholder="Ex.: 22.120,00" /><//>`}
      ${comFundo && html`<${Campo} rotulo="Fundo de reserva (%)"><input id="taxa-fundo" inputmode="decimal" value=${form.fundoPct} onInput=${campo('fundoPct')} /><//>`}
      <${Campo} rotulo="Aprovado em" dica="Ata ou data da assembleia"><input id="taxa-ata" value=${form.aprovadoEm} onInput=${campo('aprovadoEm')} placeholder="Ex.: AGE de 15/10/2026, item 2" /><//>
    </div>
    <label class="check"><input id="taxa-publicar" type="checkbox" checked=${form.publicar} onChange=${campo('publicar')} /><span>Publicar comunicado</span></label>
    ${!comFracao && html`<${Bloqueado} estado=${estado} recurso="fracaoIdeal" titulo="Rateio por fração ideal e fundo de reserva" />`}
    ${agendada && html`<small class="sub">Substitui o reajuste já agendado para ${nomeMes(form.vigencia)} (${agendada.id}).</small>`}
    ${simulacao ? html`<${TabelaSimulacao} simulacao=${simulacao} />` : html`<small class="sub">${montada.erro}</small>`}
    <${Erro} texto=${erro} />
    <button type="button" class="btn primario" data-acao="confirmar-reajuste" onClick=${confirmar}>Confirmar reajuste</button>
  </div>`;
}

function FormTaxaExtra({ estado, executar, aoConcluir }) {
  const fin = estado.financeiro;
  const comFracao = liberado(estado.plano, 'fracaoIdeal');
  const [form, setForm] = useState({ descricao: '', total: '', parcelas: '10', inicio: primeiraNaoEmitida(fin), rateio: 'igual', aprovadoEm: '', publicar: true });
  const [erro, setErro] = useState(null);
  const campo = (chave) => (ev) => setForm({ ...form, [chave]: ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value });
  const dados = { ...form, total: lerPreco(form.total), parcelas: Number(form.parcelas) };
  const montada = montarTaxaExtra(fin, { ...dados, descricao: form.descricao || 'prévia' });

  function criar() {
    const r = executar((e) => criarTaxaExtra(e, dados, 'sindico', new Date()));
    setErro(r.erro || null);
    if (!r.erro) aoConcluir(`Taxa extra ${r.id} criada.${textoDesfeitos(r.desfeitos)}`);
  }

  return html`<div class="cartao pilha formulario">
    <strong>Nova taxa extra</strong>
    <div class="edicao-anuncio">
      <${Campo} rotulo="Descrição"><input id="extra-descricao" value=${form.descricao} onInput=${campo('descricao')} placeholder="Ex.: Troca dos elevadores" /><//>
      <${Campo} rotulo="Valor total (R$)"><input id="extra-total" inputmode="decimal" value=${form.total} onInput=${campo('total')} placeholder="Ex.: 30.000,00" /><//>
      <${Campo} rotulo="Parcelas" dica="De 1 a 60"><input id="extra-parcelas" type="number" min="1" max="60" value=${form.parcelas} onInput=${campo('parcelas')} /><//>
      <${Campo} rotulo="Início"><select id="extra-inicio" value=${form.inicio} onChange=${campo('inicio')}>${mesesAFrente(fin).map((m) => html`<option key=${m} value=${m}>${nomeMes(m)}</option>`)}</select><//>
      <${Campo} rotulo="Rateio"><select id="extra-rateio" value=${form.rateio} onChange=${campo('rateio')}>${Object.entries(NOMES_RATEIO).filter(([k]) => k === 'igual' || comFracao).map(([k, nome]) => html`<option key=${k} value=${k}>${nome}</option>`)}</select><//>
      <${Campo} rotulo="Aprovado em" dica="Ata ou data da assembleia"><input id="extra-ata" value=${form.aprovadoEm} onInput=${campo('aprovadoEm')} placeholder="Ex.: AGE de 15/10/2026, item 3" /><//>
    </div>
    <label class="check"><input id="extra-publicar" type="checkbox" checked=${form.publicar} onChange=${campo('publicar')} /><span>Publicar comunicado</span></label>
    ${montada.extra
      ? html`<div class="cartao simulacao"><strong>Valor por parcela</strong><dl class="resumo">${valorPorTipoExtra(fin, montada.extra).map((v) => html`<dt key=${`t-${v.tipo}`}>${NOMES_TIPO_UNIDADE[v.tipo]}</dt><dd key=${`v-${v.tipo}`}>${fmtReais(v.valor)} por mês</dd>`)}</dl><small class="sub">De ${nomeMes(montada.extra.inicio)} a ${nomeMes(fimExtra(montada.extra))}.</small></div>`
      : html`<small class="sub">${montada.erro}</small>`}
    <${Erro} texto=${erro} />
    <button type="button" class="btn primario" data-acao="criar-taxa-extra" onClick=${criar}>Criar taxa extra</button>
  </div>`;
}

function ItemTaxaExtra({ estado, extra, executar, aoConcluir }) {
  const fin = estado.financeiro;
  const [encerrando, setEncerrando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState(null);
  const competencia = somarMes(primeiraNaoEmitida(fin), -1);
  const parcela = parcelaDe(extra, competencia);
  const situacao = extra.inicio > competencia ? `começa em ${nomeMes(extra.inicio)}` : parcela ? `parcela ${parcela}/${extra.parcelas} em ${nomeMes(competencia)}` : 'parcelas concluídas';

  function encerrar() {
    const r = executar((e) => encerrarTaxaExtra(e, extra.id, motivo, 'sindico', new Date()));
    setErro(r.erro || null);
    if (!r.erro) aoConcluir(`Taxa extra ${extra.id} encerrada.${textoDesfeitos(r.desfeitos)}`);
  }

  return html`<li class="cartao">
    <div class="linha-entre"><strong>${extra.id} · ${extra.descricao}</strong><${Etiqueta} tipo="ok">Ativa<//></div>
    <span>${fmtReais(extra.total)} em ${extra.parcelas}x · ${NOMES_RATEIO[extra.rateio].toLowerCase()} · ${situacao}</span>
    <small class="sub">${valorPorTipoExtra(fin, extra).map((v) => `${NOMES_TIPO_UNIDADE[v.tipo]} ${fmtReais(v.valor)}`).join(' · ')} por mês · aprovado em: ${extra.aprovadoEm}</small>
    ${!encerrando
      ? html`<div class="acoes"><button type="button" class="btn secundario" data-encerrar=${extra.id} onClick=${() => setEncerrando(true)}>Encerrar</button></div>`
      : html`<div class="pilha">
          <${Campo} rotulo="Motivo ou ata" dica="As parcelas ainda não emitidas deixam de existir"><input id=${`encerrar-${extra.id}`} value=${motivo} onInput=${(ev) => setMotivo(ev.target.value)} /><//>
          <${Erro} texto=${erro} />
          <div class="acoes"><button type="button" class="btn primario" onClick=${encerrar}>Confirmar encerramento</button><button type="button" class="btn secundario" onClick=${() => setEncerrando(false)}>Voltar</button></div>
        </div>`}
  </li>`;
}

export function CTaxas({ estado, executar }) {
  const fin = estado.financeiro;
  const [abrindo, setAbrindo] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const [erro, setErro] = useState(null);
  const comExtra = liberado(estado.plano, 'taxaExtra');
  const agendadas = versoesAgendadas(fin);
  const vigente = versaoVigente(fin);
  const passadas = fin.composicao.versoes.filter((v) => v.vigencia <= vigente.vigencia).sort((a, b) => b.vigencia.localeCompare(a.vigencia));
  const ativas = fin.composicao.extras.filter((x) => x.situacao === 'ativa' && fimExtra(x) >= primeiraNaoEmitida(fin));
  const encerradas = fin.composicao.extras.filter((x) => x.situacao === 'encerrada' || fimExtra(x) < primeiraNaoEmitida(fin));
  const concluir = (texto) => { setAbrindo(null); setErro(null); setMensagem(texto); };
  const abrir = (qual) => { setAbrindo(abrindo === qual ? null : qual); setMensagem(null); setErro(null); };

  function cancelar(id) {
    const r = executar((e) => cancelarComposicao(e, id, 'sindico', new Date()));
    setErro(r.erro || null);
    setMensagem(r.erro ? null : `Reajuste ${id} cancelado.`);
  }

  return html`<div class="pilha">
    <h2>Em vigor</h2>
    <${ResumoEmVigor} estado=${estado} />
    <${Sucesso} texto=${mensagem} />
    <${Erro} texto=${erro} />
    ${agendadas.length > 0 && html`<h2>Agendado</h2>
      <ul class="m-lista">${agendadas.map((v) => html`<li key=${v.id} class="cartao">
        <div class="linha-entre"><strong>${v.id} · a partir de ${nomeMes(v.vigencia)}</strong><${Etiqueta} tipo="info">Agendado<//></div>
        <span>${resumoVersao(fin, v)}</span>
        <small class="sub">Aprovado em: ${v.aprovadoEm}</small>
        <div class="acoes"><button type="button" class="btn secundario" data-cancelar=${v.id} onClick=${() => cancelar(v.id)}>Cancelar reajuste</button></div>
      </li>`)}</ul>`}
    <div class="acoes">
      <button type="button" class="btn primario" aria-expanded=${abrindo === 'reajuste'} onClick=${() => abrir('reajuste')}>Nova composição</button>
      ${comExtra && html`<button type="button" class="btn secundario" aria-expanded=${abrindo === 'extra'} onClick=${() => abrir('extra')}>Nova taxa extra</button>`}
    </div>
    ${abrindo === 'reajuste' && html`<${FormReajuste} estado=${estado} executar=${executar} aoConcluir=${concluir} />`}
    ${abrindo === 'extra' && html`<${FormTaxaExtra} estado=${estado} executar=${executar} aoConcluir=${concluir} />`}
    <h2>Taxas extras</h2>
    ${comExtra
      ? ativas.length
        ? html`<ul class="m-lista">${ativas.map((x) => html`<${ItemTaxaExtra} key=${x.id} estado=${estado} extra=${x} executar=${executar} aoConcluir=${concluir} />`)}</ul>`
        : html`<${Vazio} texto="Nenhuma taxa extra ativa." />`
      : html`<${Bloqueado} estado=${estado} recurso="taxaExtra" titulo="Taxas extras parceladas, com rateio e encerramento" />`}
    <h2>Histórico</h2>
    <ul class="auditoria">
      ${passadas.map((v) => html`<li key=${v.id}><span class="lt-quando">${nomeMes(v.vigencia)}</span> <strong>${v.id}${v.id === vigente.id ? ' · em vigor' : ''}</strong> · ${resumoVersao(fin, v)} · aprovado em: ${v.aprovadoEm}</li>`)}
      ${encerradas.map((x) => html`<li key=${x.id}><span class="lt-quando">${x.encerradaEm ? fmtDataCurta(x.encerradaEm.slice(0, 10)) : nomeMes(fimExtra(x))}</span> <strong>${x.id} · ${x.descricao}</strong> · ${x.situacao === 'encerrada' ? `encerrada${x.ultimaCompetencia ? `, última parcela em ${nomeMes(x.ultimaCompetencia)}` : ' antes da primeira parcela'} · ${x.motivoEncerramento}` : 'parcelas concluídas'}</li>`)}
    </ul>
    <details class="composicao"><summary>Frações ideais</summary>
      <div class="tabela-rolagem"><table class="tabela">
        <thead><tr><th>Unidade</th><th>Tipo</th><th>Fração ideal</th></tr></thead>
        <tbody>${Object.entries(fin.unidades).map(([u, d]) => html`<tr key=${u}><td>${u}</td><td>${NOMES_TIPO_UNIDADE[d.tipo]}</td><td>${fmtFracao(d.fracao)}</td></tr>`)}</tbody>
        <tfoot><tr><td colspan="2">Total</td><td>${(Object.values(fin.unidades).reduce((s, d) => s + d.fracao, 0) * 100).toFixed(2).replace('.', ',')}%</td></tr></tfoot>
      </table></div>
      <small class="sub">Conforme a convenção. Usada no rateio por fração ideal.</small>
    </details>
  </div>`;
}

export function MudancasTaxa({ estado, eu, hoje }) {
  const linhas = mudancasDaUnidade(estado, eu, hoje);
  if (!linhas.length) return null;
  return html`<div class="cartao mudancas-taxa">
    <strong>Mudanças na sua taxa</strong>
    <ul class="m-lista">${linhas.map((l) => html`<li key=${l.chave}><span class="sub">${l.titulo}</span><div>${l.texto}</div>${l.detalhe && html`<small class="sub">${l.detalhe}</small>`}</li>`)}</ul>
  </div>`;
}
