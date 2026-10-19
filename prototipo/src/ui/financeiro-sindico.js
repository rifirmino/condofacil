import { html, useState } from '../vendor.js';
import { ETAPAS_REGUA, CATEGORIAS_DESPESA, NOMES_FORMA, NOMES_RELACAO } from '../cobranca/dados.js';
import { fmtReais, fmtReaisCurto, mesCurto, mesExtenso, situacaoCobranca, valorAtualizado, previaCompetencia, proximaCompetencia, etapasNoPlano, devedores, indicadoresFinanceiros, serieReceitasDespesas, tituloSerie } from '../cobranca/regras.js';
import { emitirCompetencia, editarItemPrevia, baixaManual, cancelarEReemitir, enviarSegundaVia, executarRegua, salvarParametros } from '../cobranca/acoes.js';
import { lerPreco } from '../vendas/regras.js';
import { PLANOS, liberado, planoMinimo, mensalidade } from '../planos.js';
import { isoDia, nomeMes, fmtDataCurta, fmtDataHora } from '../datas.js';
import { Campo, Erro, Sucesso, Vazio, Etiqueta, QuadroIcone } from './comum.js';

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
          <thead><tr><th>Unidade</th><th>Responsável</th><th>Cobranças</th><th>Valor atualizado</th><th>Atraso</th><th>Etapa da régua</th></tr></thead>
          <tbody>${lista.map((d) => html`<tr key=${d.unidade}><td>${d.unidade}</td><td>${d.responsavel ? d.responsavel.nome : '—'}</td><td>${d.cobrancas}</td><td>${fmtReais(d.valor)}</td><td>${d.dias} dias</td><td>${d.etapa ? d.etapa.nome : '—'}</td></tr>`)}</tbody>
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
      ${numeros.map(([rotulo, valor, detalhe, alerta, icone]) => html`<div key=${rotulo} class=${`indicador ${alerta ? 'ind-perigo' : 'ind-ok'}`}><${QuadroIcone} nome=${icone} cheio=${alerta} /><span class="ind-rotulo">${rotulo}</span><strong>${valor}</strong><small>${detalhe}</small></div>`)}
    </div>
    ${completo
      ? html`<div class="graficos-fin"><${GraficoReceitas} estado=${estado} hoje=${hoje} /><${Categorias} estado=${estado} /></div><${ListaDevedores} estado=${estado} hoje=${hoje} />`
      : html`<${Bloqueado} estado=${estado} recurso="dashboardCompleto" titulo="Despesas do mês, receitas × despesas em 12 meses, para onde foi o dinheiro e lista de devedores" />`}
    ${liberado(estado.plano, 'orcadoRealizado')
      ? html`<${OrcadoRealizado} estado=${estado} />`
      : completo && html`<${Bloqueado} estado=${estado} recurso="orcadoRealizado" titulo="Orçado × realizado por categoria" />`}
  </div>`;
}
