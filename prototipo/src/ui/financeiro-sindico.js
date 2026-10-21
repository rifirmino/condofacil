import { html, useState } from '../vendor.js';
import { ETAPAS_REGUA, CATEGORIAS_DESPESA, NOMES_FORMA, NOMES_RELACAO } from '../cobranca/dados.js';
import { fmtReais, fmtReaisCurto, mesCurto, mesExtenso, situacaoCobranca, valorAtualizado, previaCompetencia, proximaCompetencia, etapasNoPlano, devedores, indicadoresFinanceiros, serieReceitasDespesas, tituloSerie, rotuloCobranca } from '../cobranca/regras.js';
import { alertasAcordos } from '../cobranca/acordos.js';
import { alertasComposicao } from '../cobranca/composicao.js';
import { emitirCompetencia, editarItemPrevia, baixaManual, cancelarEReemitir, enviarSegundaVia, executarRegua, salvarParametros } from '../cobranca/acoes.js';
import { lerPreco } from '../vendas/regras.js';
import { PLANOS, liberado, planoMinimo, mensalidade } from '../planos.js';
import { isoDia, nomeMes, fmtDataCurta, fmtDataHora } from '../datas.js';
import { Campo, Erro, Sucesso, Vazio, Etiqueta, QuadroIcone } from './comum.js';
import { CAcordos } from './acordos.js';
import { CTaxas } from './composicao.js';
import { COrcamento } from './orcamento.js';

const ETQ_COBRANCA = { aberta: 'info', vencida: 'perigo', paga: 'ok', cancelada: 'neutro' };
const NOMES_SITUACAO_COBRANCA = { aberta: 'Em aberto', vencida: 'Vencida', paga: 'Paga', cancelada: 'Cancelada' };

function decimal(n) {
  return String(n).replace('.', ',');
}

export function EtqCobranca({ situacao }) {
  return html`<${Etiqueta} tipo=${ETQ_COBRANCA[situacao]}>${NOMES_SITUACAO_COBRANCA[situacao]}<//>`;
}

export function Bloqueado({ estado, recurso, titulo }) {
  const minimo = planoMinimo(recurso);
  const unidades = estado.condominio.unidades.length;
  const diferenca = mensalidade(minimo.id, unidades) - mensalidade(estado.plano, unidades);
  return html`<div class="bloqueado"><strong>${titulo}</strong><span>Disponível no plano ${minimo.nome} (+${fmtReais(diferenca)}/mês)</span></div>`;
}

export function pendenciasCobranca(estado, hoje) {
  const fin = estado.financeiro;
  const proxima = proximaCompetencia(fin);
  const itens = [];
  if (!fin.emitidas.includes(proxima)) itens.push({ chave: 'emitir', texto: `Emitir cobranças de ${mesExtenso(proxima)} (fechamento dia ${fin.parametros.diaFechamento})`, href: '#sindico.cobranca.previa' });
  for (const d of devedores(estado, hoje).filter((x) => x.dias >= 60)) itens.push({ chave: `juridico-${d.unidade}`, texto: `${d.unidade}: débito há mais de 60 dias, avaliar cobrança jurídica`, href: '#sindico.cobranca.emitidas' });
  itens.push(...alertasAcordos(estado, hoje), ...alertasComposicao(estado));
  return itens;
}

// Duas séries (receitas e despesas): legenda sempre presente, rótulo direto só no mês em destaque, tabela para leitores de tela.
function GraficoReceitas({ estado, hoje }) {
  const serie = serieReceitasDespesas(estado, hoje);
  const maximo = Math.max(...serie.flatMap((m) => [m.receitas, m.despesas]));
  const altura = (valor) => `${Math.round((valor / maximo) * 140)}px`;
  return html`<section class="cartao">
    <p class="titulo-grafico">${tituloSerie(serie)}</p>
    <div class="legenda-serie" aria-hidden="true"><span class="leg-receita">Receitas</span><span class="leg-despesa">Despesas</span></div>
    <div class="barras-duplas" aria-hidden="true">
      ${serie.map((m) => {
        const destaque = m.despesas > m.receitas;
        return html`<div key=${m.mes} class=${`mes${destaque ? ' destaque' : ''}`} title=${`${mesExtenso(m.mes)}: receitas ${fmtReaisCurto(m.receitas)}, despesas ${fmtReaisCurto(m.despesas)}`}>
          <span class="valor-destaque">${destaque ? fmtReaisCurto(m.despesas) : ''}</span>
          <div class="par"><span class="b-receita" style=${`height:${altura(m.receitas)}`}></span><span class="b-despesa" style=${`height:${altura(m.despesas)}`}></span></div>
          <span class="rotulo-x">${mesCurto(m.mes)}</span>
        </div>`;
      })}
    </div>
    <table class="so-leitor">
      <caption>Receitas e despesas dos últimos 12 meses</caption>
      <thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th></tr></thead>
      <tbody>${serie.map((m) => html`<tr key=${m.mes}><td>${nomeMes(m.mes)}</td><td>${fmtReais(m.receitas)}</td><td>${fmtReais(m.despesas)}</td></tr>`)}</tbody>
    </table>
  </section>`;
}

function Categorias({ estado }) {
  const fin = estado.financeiro;
  const linhas = Object.entries(CATEGORIAS_DESPESA).map(([id, nome]) => [nome, fin.despesasMes[id]]).sort((a, b) => b[1] - a[1]);
  const maximo = linhas[0][1];
  return html`<section class="cartao">
    <p class="titulo-grafico">Para onde foi o dinheiro em ${mesExtenso(fin.vigente)}</p>
    <ul class="barras-h">${linhas.map(([nome, valor]) => html`<li key=${nome}><span>${nome}</span><span class="trilho"><span class="b-despesa" style=${`width:${Math.round((valor / maximo) * 100)}%`}></span></span><strong>${fmtReaisCurto(valor)}</strong></li>`)}</ul>
  </section>`;
}

function ListaDevedores({ estado, hoje }) {
  const lista = devedores(estado, hoje);
  return html`<section class="pilha">
    <h2>Devedores</h2>
    ${lista.length
      ? html`<div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th>Unidade</th><th>Responsável</th><th>Cobranças</th><th>Valor atualizado</th><th>Atraso</th><th>Etapa da régua</th><th>Acordo</th></tr></thead>
          <tbody>${lista.map((d) => html`<tr key=${d.unidade}><td>${d.unidade}</td><td>${d.responsavel ? d.responsavel.nome : '—'}</td><td>${d.cobrancas}</td><td>${fmtReais(d.valor)}</td><td>${d.dias} dias</td><td>${d.etapa ? d.etapa.nome : '—'}</td><td>${d.acordo ? html`<${Etiqueta} tipo=${d.acordo === 'ativo' ? 'info' : 'alerta'}>${d.acordo === 'ativo' ? 'acordo ativo' : 'proposta enviada'}<//>` : liberado(estado.plano, 'acordos') ? html`<a class="btn-link" data-propor=${d.unidade} href=${`#sindico.cobranca.novoacordo-${d.unidade}`}>Propor acordo</a>` : '—'}</td></tr>`)}</tbody>
        </table></div>`
      : html`<${Vazio} texto="Nenhuma unidade em atraso." />`}
    <small class="sub">Lista visível só para quem tem acesso financeiro. Nunca aparece para os moradores.</small>
  </section>`;
}

function OrcadoRealizado({ estado }) {
  const fin = estado.financeiro;
  return html`<section class="pilha">
    <h2>Orçado × realizado em ${mesExtenso(fin.vigente)}</h2>
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Categoria</th><th>Orçado</th><th>Realizado</th><th>Desvio</th><th>%</th></tr></thead>
      <tbody>${Object.entries(CATEGORIAS_DESPESA).map(([id, nome]) => {
        const orcado = fin.orcamento[id];
        const realizado = fin.despesasMes[id];
        const desvio = realizado - orcado;
        const pct = Math.round((desvio / orcado) * 1000) / 10;
        const sinal = desvio > 0 ? '+' : '';
        return html`<tr key=${id}><td>${nome}</td><td>${fmtReais(orcado)}</td><td>${fmtReais(realizado)}</td><td class=${desvio > 0 ? 'desvio-ruim' : ''}>${sinal}${fmtReais(desvio)}</td><td>${sinal}${decimal(pct)}%</td></tr>`;
      })}</tbody>
    </table></div>
  </section>`;
}

export function PainelFinanceiro({ estado, agora }) {
  const hoje = isoDia(agora);
  const ind = indicadoresFinanceiros(estado, hoje);
  const completo = liberado(estado.plano, 'dashboardCompleto');
  const a = ind.arrecadado;
  const numeros = [
    ['Saldo em caixa', fmtReaisCurto(ind.saldo.valor), 'Conta Asaas + banco', ind.saldo.alerta, 'cifrao'],
    [`Arrecadado em ${mesExtenso(a.competencia)}`, `${a.pct}%`, `${fmtReaisCurto(a.recebido)} de ${fmtReaisCurto(a.previsto)}${a.proxima ? ` · ${mesExtenso(a.proxima.competencia)}: ${a.proxima.pagas} de ${a.proxima.total} pagas` : ''}`, a.alerta, 'grafico'],
    ['Inadimplência', `${ind.inadimplencia.unidades} de ${ind.inadimplencia.total}`, `${decimal(ind.inadimplencia.pct)}% das unidades · ${fmtReaisCurto(ind.inadimplencia.valor)}`, ind.inadimplencia.alerta, 'pessoa'],
  ];
  if (completo) numeros.push(['Despesas do mês', fmtReaisCurto(ind.despesas.valor), `${ind.despesas.desvio > 0 ? '+' : ''}${decimal(ind.despesas.desvio)}% em relação ao orçado`, ind.despesas.alerta, 'documento']);
  return html`<div class="pilha">
    <div class="indicadores">
      ${numeros.map(([rotulo, valor, detalhe, alerta, icone]) => html`<div key=${rotulo} class=${`indicador fin ${alerta ? 'ind-perigo' : 'ind-ok'}`}><${QuadroIcone} nome=${icone} cheio=${alerta} /><span class="ind-rotulo">${rotulo}</span><strong>${valor}</strong><small>${detalhe}</small></div>`)}
    </div>
    ${completo
      ? html`<div class="graficos-fin"><${GraficoReceitas} estado=${estado} hoje=${hoje} /><${Categorias} estado=${estado} /></div><${ListaDevedores} estado=${estado} hoje=${hoje} />`
      : html`<${Bloqueado} estado=${estado} recurso="dashboardCompleto" titulo="Despesas do mês, receitas × despesas em 12 meses, para onde foi o dinheiro e lista de devedores" />`}
    ${liberado(estado.plano, 'orcadoRealizado')
      ? html`<${OrcadoRealizado} estado=${estado} />`
      : completo && html`<${Bloqueado} estado=${estado} recurso="orcadoRealizado" titulo="Orçado × realizado por categoria" />`}
  </div>`;
}

const ABAS_COBRANCA = [['previa', 'Prévia e emissão'], ['emitidas', 'Cobranças emitidas'], ['acordos', 'Acordos'], ['regua', 'Régua'], ['taxas', 'Taxa e reajustes'], ['orcamento', 'Orçamento'], ['parametros', 'Parâmetros']];
const FILTROS_COBRANCA = [['todas', 'Todas'], ['aberta', 'Em aberto'], ['vencida', 'Vencidas'], ['paga', 'Pagas'], ['cancelada', 'Canceladas']];

export function SCobranca(props) {
  const idRota = props.rota.id || '';
  const deAcordo = idRota.startsWith('novoacordo') || idRota.startsWith('AC-');
  const aba = deAcordo ? 'acordos' : ABAS_COBRANCA.some(([id]) => id === idRota) ? idRota : 'previa';
  const Conteudo = { previa: CPrevia, emitidas: CEmitidas, acordos: CAcordos, regua: CRegua, taxas: CTaxas, orcamento: COrcamento, parametros: CParametros }[aba];
  return html`<section>
    <h1>Cobrança</h1>
    <p class="faixa-asaas">Conta Asaas ativa · subconta do condomínio. O dinheiro cai direto na conta do condomínio; o CondoFácil só organiza emissão, baixa e relatórios.</p>
    <nav class="chips" aria-label="Cobrança">${ABAS_COBRANCA.map(([id, nome]) => html`<a key=${id} class="chip" href=${`#sindico.cobranca.${id}`} aria-current=${aba === id ? 'page' : undefined}>${nome}</a>`)}</nav>
    <${Conteudo} ...${props} />
  </section>`;
}

function EditorComposicao({ linha, competencia, executar }) {
  const [itens, setItens] = useState(linha.itens.map((i) => ({ ...i, texto: (i.valor / 100).toFixed(2).replace('.', ',') })));
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [mensagem, setMensagem] = useState(null);
  const [erro, setErro] = useState(null);

  function salvar(lista) {
    const r = executar((e) => editarItemPrevia(e, competencia, linha.unidade, lista.map((i) => ({ tipo: i.tipo, descricao: i.descricao, valor: lerPreco(i.texto) }))));
    setErro(r.erro || null);
    setMensagem(r.erro ? null : 'Composição atualizada.');
    if (!r.erro) setItens(lista);
  }

  function incluir() {
    salvar([...itens, { tipo: 'avulso', descricao, texto: valor }]);
    setDescricao('');
    setValor('');
  }

  return html`<div class="pilha">
    <ul class="itens-sacola">${itens.map((i, n) => html`<li key=${`${n}-${i.descricao}`}>
      <span>${i.descricao}</span>
      <input id=${`valor-${linha.unidade}-${n}`} class="valor-item" aria-label=${`Valor de ${i.descricao}`} inputmode="decimal" value=${i.texto} onInput=${(ev) => setItens(itens.map((x, k) => (k === n ? { ...x, texto: ev.target.value } : x)))} />
      ${i.tipo !== 'ordinaria' && html`<button type="button" class="btn-link" onClick=${() => salvar(itens.filter((_, k) => k !== n))}>Remover</button>`}
    </li>`)}</ul>
    <div class="edicao-anuncio">
      <${Campo} rotulo="Novo item"><input id=${`novo-item-${linha.unidade}`} value=${descricao} onInput=${(ev) => setDescricao(ev.target.value)} placeholder="Ex.: Multa por infração" /><//>
      <${Campo} rotulo="Valor (R$)"><input id=${`novo-valor-${linha.unidade}`} inputmode="decimal" value=${valor} onInput=${(ev) => setValor(ev.target.value)} placeholder="Ex.: 120,00" /><//>
    </div>
    <div class="acoes">
      <button type="button" class="btn secundario" onClick=${incluir}>Incluir item</button>
      <button type="button" class="btn primario" onClick=${() => salvar(itens)}>Salvar composição</button>
    </div>
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
  </div>`;
}

function CPrevia({ estado, executar }) {
  const fin = estado.financeiro;
  const competencia = proximaCompetencia(fin);
  const previa = previaCompetencia(estado, competencia);
  const emitida = fin.emitidas.includes(competencia);
  const [aberta, setAberta] = useState(null);
  const [erro, setErro] = useState(null);
  const emitiveis = previa.linhas.filter((l) => !l.bloqueada);
  const total = emitiveis.reduce((soma, l) => soma + l.total, 0);

  function emitir() {
    const r = executar((e) => emitirCompetencia(e, competencia, 'sindico', new Date()));
    setErro(r.erro || null);
  }

  return html`<div class="pilha">
    <h2>Competência de ${mesExtenso(competencia)} · vencimento ${fmtDataCurta(previa.vencimento)}</h2>
    ${emitida
      ? html`<p class="sucesso">Cobranças de ${mesExtenso(competencia)} emitidas. Acompanhe em Cobranças emitidas.</p>`
      : html`<p class="sub">Revise a composição antes de emitir. Cobrança emitida não é editada: alterações viram cancelamento e reemissão.</p>`}
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Unidade</th><th>Responsável financeiro</th><th>Total</th><th>Composição</th></tr></thead>
      <tbody>${previa.linhas.map((l) => [
        html`<tr key=${l.unidade} class=${l.bloqueada ? 'linha-bloqueada' : ''}>
          <td>${l.unidade}</td>
          <td>${l.bloqueada ? html`<strong class="texto-perigo">Sem responsável financeiro: não será emitida</strong>` : `${l.responsavel.nome} (${NOMES_RELACAO[l.responsavel.relacao]})`}</td>
          <td>${fmtReais(l.total)}</td>
          <td><button type="button" class="btn-link" onClick=${() => setAberta(aberta === l.unidade ? null : l.unidade)}>${aberta === l.unidade ? 'Fechar' : 'Ver composição'}</button></td>
        </tr>`,
        aberta === l.unidade && html`<tr key=${`${l.unidade}-composicao`}><td colspan="4">${emitida
          ? html`<ul class="itens-sacola">${l.itens.map((i, n) => html`<li key=${n}><span>${i.descricao}</span><span>${fmtReais(i.valor)}</span></li>`)}</ul>`
          : html`<${EditorComposicao} key=${l.unidade} linha=${l} competencia=${competencia} executar=${executar} />`}</td></tr>`,
      ])}</tbody>
    </table></div>
    <div class="linha-entre total"><span>${emitiveis.length} cobranças · ${previa.linhas.length - emitiveis.length} não emitida(s)</span><strong>${fmtReais(total)}</strong></div>
    <${Erro} texto=${erro} />
    ${!emitida && html`<button type="button" class="btn primario" data-acao="emitir" onClick=${emitir}>Emitir ${emitiveis.length} cobranças</button>`}
  </div>`;
}

export function DetalheCobranca({ estado, cobranca, executar, hoje, aoFechar }) {
  const fin = estado.financeiro;
  const [comprovante, setComprovante] = useState('');
  const [data, setData] = useState(hoje);
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const situacao = situacaoCobranca(cobranca, hoje);
  const v = valorAtualizado(cobranca, fin.parametros, hoje);
  const responsavel = fin.unidades[cobranca.unidade].responsavel;

  function rodar(acao, sucesso) {
    const r = executar(acao);
    setErro(r.erro || null);
    if (!r.erro) {
      setMensagem(sucesso);
      setBaixando(false);
    }
  }

  return html`<article class="cartao">
    <div class="linha-entre"><strong>Apto ${cobranca.unidade} · ${rotuloCobranca(cobranca)}</strong><${EtqCobranca} situacao=${situacao} /></div>
    <small class="sub">${responsavel ? `${responsavel.nome} · ${responsavel.documento}` : 'Sem responsável'} · vencimento ${fmtDataCurta(cobranca.vencimento)}${cobranca.substituiu ? ` · substitui ${cobranca.substituiu}` : ''}</small>
    <ul class="itens-sacola">
      ${cobranca.itens.map((i, n) => html`<li key=${n}><span>${i.descricao}</span><span>${fmtReais(i.valor)}</span></li>`)}
      ${v.dias > 0 && html`<li><span>Multa (${decimal(fin.parametros.multaPct)}%) e juros (${v.dias} dias)</span><span>${fmtReais(v.multa + v.juros)}</span></li>`}
    </ul>
    <div class="linha-entre total"><span>${situacao === 'paga' ? `Pago em ${fmtDataHora(cobranca.pagaEm)} · ${NOMES_FORMA[cobranca.forma]}` : 'Valor atualizado'}</span><strong>${fmtReais(situacao === 'paga' ? cobranca.valorPago : v.total)}</strong></div>
    ${cobranca.baixaManual && html`<small class="sub">Baixa manual por ${cobranca.baixaManual.por} · ${cobranca.baixaManual.comprovante}</small>`}
    ${cobranca.regua.length > 0 && html`<small class="sub">Régua enviada: ${cobranca.regua.map((r) => ETAPAS_REGUA.find((e) => e.id === r.etapa).nome).join(' · ')}</small>`}
    ${['aberta', 'vencida'].includes(situacao) && html`<div class="acoes">
      <button type="button" class="btn secundario" onClick=${() => setBaixando(!baixando)}>Baixa manual</button>
      <button type="button" class="btn secundario" onClick=${() => rodar((e) => cancelarEReemitir(e, cobranca.id, 'sindico', new Date()), 'Cobrança cancelada e reemitida.')}>Cancelar e reemitir</button>
      <button type="button" class="btn secundario" onClick=${() => rodar((e) => enviarSegundaVia(e, cobranca.id, new Date()), '2ª via enviada com valor atualizado.')}>Enviar 2ª via</button>
    </div>`}
    ${baixando && html`<div class="recusa">
      <${Campo} rotulo="Data do pagamento"><input id="baixa-data" type="date" value=${data} onInput=${(ev) => setData(ev.target.value)} /><//>
      <button type="button" class="btn secundario" onClick=${() => setComprovante(`comprovante-${cobranca.unidade}.pdf`)}>${comprovante ? `Anexado: ${comprovante}` : 'Anexar comprovante'}</button>
      <button type="button" class="btn primario" onClick=${() => rodar((e) => baixaManual(e, cobranca.id, { data, comprovante }, 'sindico', new Date()), 'Baixa registrada.')}>Confirmar baixa</button>
    </div>`}
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
    <button type="button" class="btn-link" onClick=${aoFechar}>Fechar detalhes</button>
  </article>`;
}

function CEmitidas({ estado, executar, agora }) {
  const fin = estado.financeiro;
  const hoje = isoDia(agora);
  const competencias = [...new Set(fin.cobrancas.filter((c) => !c.acordo).map((c) => c.competencia))].sort().reverse();
  const [competencia, setCompetencia] = useState(competencias[0]);
  const [filtro, setFiltro] = useState('todas');
  const [aberta, setAberta] = useState(null);
  const lista = fin.cobrancas
    .filter((c) => !c.acordo && c.competencia === competencia && (filtro === 'todas' || situacaoCobranca(c, hoje) === filtro))
    .sort((a, b) => a.unidade.localeCompare(b.unidade) || a.id.localeCompare(b.id));
  const selecionada = aberta ? fin.cobrancas.find((c) => c.id === aberta) : null;
  return html`<div class="pilha">
    <div class="edicao-anuncio">
      <${Campo} rotulo="Competência"><select id="emitidas-competencia" value=${competencia} onChange=${(ev) => { setCompetencia(ev.target.value); setAberta(null); }}>${competencias.map((c) => html`<option key=${c} value=${c}>${nomeMes(c)}</option>`)}</select><//>
      <${Campo} rotulo="Situação"><select id="emitidas-situacao" value=${filtro} onChange=${(ev) => setFiltro(ev.target.value)}>${FILTROS_COBRANCA.map(([id, nome]) => html`<option key=${id} value=${id}>${nome}</option>`)}</select><//>
    </div>
    ${selecionada && html`<${DetalheCobranca} key=${selecionada.id} estado=${estado} cobranca=${selecionada} executar=${executar} hoje=${hoje} aoFechar=${() => setAberta(null)} />`}
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Unidade</th><th>Valor</th><th>Atualizado</th><th>Situação</th><th>Ação</th></tr></thead>
      <tbody>${lista.map((c) => html`<tr key=${c.id}>
        <td>${c.unidade}</td>
        <td>${fmtReais(c.valor)}</td>
        <td>${fmtReais(valorAtualizado(c, fin.parametros, hoje).total)}</td>
        <td><${EtqCobranca} situacao=${situacaoCobranca(c, hoje)} /></td>
        <td><button type="button" class="btn-link" data-cobranca=${c.id} onClick=${() => setAberta(c.id)}>Detalhes</button></td>
      </tr>`)}</tbody>
    </table></div>
    ${!lista.length && html`<${Vazio} texto="Nenhuma cobrança neste filtro." />`}
    <h2>Auditoria</h2>
    ${fin.auditoria.length
      ? html`<ul class="auditoria">${[...fin.auditoria].reverse().map((a, n) => html`<li key=${n}><span class="lt-quando">${fmtDataHora(a.em)}</span> <strong>${a.acao}</strong> · ${a.detalhe} · ${a.quem}</li>`)}</ul>`
      : html`<${Vazio} texto="Nenhuma ação registrada nesta demonstração." />`}
  </div>`;
}

function CRegua({ estado, executar }) {
  const permitidas = etapasNoPlano(estado.plano);
  const [resumo, setResumo] = useState(null);

  function executarHoje() {
    const r = executar((e) => executarRegua(e, new Date()));
    setResumo(r.resumo || []);
  }

  return html`<div class="pilha">
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Quando</th><th>Ação automática</th><th>Canais</th><th>No seu plano</th></tr></thead>
      <tbody>${ETAPAS_REGUA.map((e) => html`<tr key=${e.id}>
        <td>${e.nome}</td>
        <td>${e.acao}</td>
        <td>${e.canais.join(' + ')}</td>
        <td>${permitidas.includes(e.id) ? html`<${Etiqueta} tipo="ok">Ativa<//>` : html`<${Etiqueta}>Disponível no ${PLANOS.find((p) => etapasNoPlano(p.id).includes(e.id)).nome}<//>`}</td>
      </tr>`)}</tbody>
    </table></div>
    <small class="sub">A régua para sozinha quando a cobrança é paga.</small>
    <button type="button" class="btn primario" data-acao="executar-regua" onClick=${executarHoje}>Executar a régua de hoje</button>
    ${resumo && (resumo.length
      ? html`<div class="cartao"><strong>${resumo.length} avisos enviados</strong><ul class="itens-sacola">${resumo.map((r, n) => html`<li key=${n}><span>Apto ${r.unidade} · ${r.rotulo}</span><span>${r.etapa.nome}</span></li>`)}</ul></div>`
      : html`<p class="sucesso">Nenhum aviso pendente hoje.</p>`)}
  </div>`;
}

function CParametros({ estado, executar }) {
  const fin = estado.financeiro;
  const [form, setForm] = useState({ ...fin.parametros, formas: [...fin.parametros.formas] });
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const campo = (chave) => (ev) => setForm({ ...form, [chave]: ev.target.type === 'number' ? Number(ev.target.value) : ev.target.value });
  const alternarForma = (k) => setForm({ ...form, formas: form.formas.includes(k) ? form.formas.filter((x) => x !== k) : [...form.formas, k] });

  function salvar() {
    const r = executar((e) => salvarParametros(e, form, 'sindico', new Date()));
    setErro(r.erro || null);
    setMensagem(r.erro ? null : 'Parâmetros salvos.');
  }

  return html`<div class="pilha formulario">
    <h2>Parâmetros de cobrança</h2>
    <div class="edicao-anuncio">
      <${Campo} rotulo="Dia do vencimento"><input id="par-vencimento" type="number" min="1" max="28" value=${form.diaVencimento} onInput=${campo('diaVencimento')} /><//>
      <${Campo} rotulo="Dia do fechamento"><input id="par-fechamento" type="number" min="1" max="28" value=${form.diaFechamento} onInput=${campo('diaFechamento')} /><//>
      <${Campo} rotulo="Multa por atraso (%)" dica="Máximo de 2%"><input id="par-multa" type="number" step="0.1" min="0" value=${form.multaPct} onInput=${campo('multaPct')} /><//>
      <${Campo} rotulo="Juros ao mês (%)"><input id="par-juros" type="number" step="0.1" min="0" value=${form.jurosPct} onInput=${campo('jurosPct')} /><//>
      <${Campo} rotulo="Desconto de pontualidade (%)"><input id="par-desconto" type="number" step="0.5" min="0" value=${form.descontoPct} onInput=${campo('descontoPct')} /><//>
      <${Campo} rotulo="Desconto aprovado em" dica="Ata ou cláusula da convenção"><input id="par-desconto-ata" value=${form.descontoAprovadoEm} onInput=${campo('descontoAprovadoEm')} placeholder="Ex.: AGO de 28/03/2026, item 4" /><//>
    </div>
    <fieldset><legend>Formas aceitas</legend>
      ${[['boleto', 'Boleto'], ['pix', 'Pix'], ['cartao', 'Cartão']].map(([k, nome]) => html`<label key=${k} class="check"><input id=${`par-forma-${k}`} type="checkbox" checked=${form.formas.includes(k)} onChange=${() => alternarForma(k)} /><span>${nome}</span></label>`)}
    </fieldset>
    <${Campo} rotulo="Tarifa do Asaas"><select id="par-tarifa" value=${form.tarifa} onChange=${campo('tarifa')}><option value="condominio">Absorvida pelo condomínio</option><option value="despesa">Registrada como despesa bancária</option></select><//>
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
    <button type="button" class="btn primario" onClick=${salvar}>Salvar parâmetros</button>
    <small class="sub">Valores da taxa, reajustes e taxas extras ficam na aba <a href="#sindico.cobranca.taxas">Taxa e reajustes</a>.</small>
  </div>`;
}
