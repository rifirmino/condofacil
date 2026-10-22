import { mesmoDiaDoMes } from '../cobranca/dados.js';
import { previaCompetencia, vencimentoDa, indicadoresFinanceiros, fmtReais } from '../cobranca/regras.js';
import { primeiraNaoEmitida } from '../cobranca/composicao.js';
import { somarDias, somarMes, nomeMes, fmtDataCurta } from '../datas.js';
import { serieDaConta } from './contas.js';

// Fluxo de caixa projetado (Avançado): entradas previstas descontadas da inadimplência e saídas das contas, dia a dia.
export const DIAS_FLUXO = 90;

function entradasDeCobrancas(fin, hoje, fim, fator) {
  const grupos = {};
  for (const c of fin.cobrancas) {
    if (c.status !== 'aberta' || c.vencimento < hoje || c.vencimento > fim) continue;
    const descricao = c.acordo ? 'Parcelas de acordo' : `Taxas de ${nomeMes(c.competencia)}`;
    const chave = `${c.vencimento}|${descricao}`;
    grupos[chave] = { dia: c.vencimento, descricao, valor: (grupos[chave] ? grupos[chave].valor : 0) + c.valor };
  }
  return Object.values(grupos).map((g) => ({ ...g, valor: Math.round(g.valor * fator) }));
}

function entradasPrevistas(estado, hoje, fim, fator) {
  const fin = estado.financeiro;
  const lista = [];
  for (let c = primeiraNaoEmitida(fin); vencimentoDa(fin, c) <= fim; c = somarMes(c, 1)) {
    const dia = vencimentoDa(fin, c);
    if (dia < hoje) continue;
    const total = previaCompetencia(estado, c).linhas.filter((l) => !l.bloqueada).reduce((s, l) => s + l.total, 0);
    lista.push({ dia, descricao: `Taxas de ${nomeMes(c)} (previsão)`, valor: Math.round(total * fator) });
  }
  return lista;
}

function saidasDeContas(fin, hoje, fim) {
  const abertas = fin.contas.filter((c) => c.situacao === 'aberta').map((c) => ({ dia: c.vencimento < hoje ? hoje : c.vencimento, descricao: c.descricao, valor: -c.valor })).filter((s) => s.dia <= fim);
  const series = {};
  for (const c of fin.contas.filter((x) => x.recorrente)) (series[serieDaConta(c)] = series[serieDaConta(c)] || []).push(c);
  const projetadas = [];
  for (const contas of Object.values(series)) {
    const meses = new Set(contas.map((c) => c.vencimento.slice(0, 7)));
    const ultima = contas.reduce((a, b) => (a.vencimento > b.vencimento ? a : b));
    for (let n = 1; ; n++) {
      const dia = mesmoDiaDoMes(ultima.vencimento, n);
      if (dia > fim) break;
      if (dia >= hoje && !meses.has(dia.slice(0, 7))) projetadas.push({ dia, descricao: `${ultima.descricao} (previsão)`, valor: -ultima.valor });
    }
  }
  return [...abertas, ...projetadas];
}

export function eventosDoFluxo(estado, hoje, margemPct, dias = DIAS_FLUXO) {
  const fin = estado.financeiro;
  const fim = somarDias(hoje, dias);
  const fator = 1 - margemPct / 100;
  return [...entradasDeCobrancas(fin, hoje, fim, fator), ...entradasPrevistas(estado, hoje, fim, fator), ...saidasDeContas(fin, hoje, fim)]
    .sort((a, b) => a.dia.localeCompare(b.dia) || b.valor - a.valor);
}

export function fluxoProjetado(estado, hoje, margemPct, dias = DIAS_FLUXO) {
  const eventos = eventosDoFluxo(estado, hoje, margemPct, dias);
  const reserva = indicadoresFinanceiros(estado, hoje).saldo.despesaMedia;
  let saldo = estado.financeiro.saldo;
  const serie = Array.from({ length: dias + 1 }, (_, i) => {
    const dia = somarDias(hoje, i);
    const doDia = eventos.filter((e) => e.dia === dia);
    saldo += doDia.reduce((s, e) => s + e.valor, 0);
    return { dia, saldo, eventos: doDia };
  });
  const minimo = serie.reduce((m, p) => (p.saldo < m.saldo ? p : m), serie[0]);
  const abaixo = serie.find((p) => p.saldo < reserva) || null;
  return { serie, eventos, reserva, minimo, abaixo, final: serie.at(-1).saldo };
}

export function fraseDoFluxo(f) {
  if (f.abaixo) return `Em ${fmtDataCurta(f.abaixo.dia)} o saldo fica abaixo da reserva de ${fmtReais(f.reserva)}`;
  return `O saldo fica acima da reserva nos próximos ${f.serie.length - 1} dias; o ponto mais baixo é ${fmtReais(f.minimo.saldo)} em ${fmtDataCurta(f.minimo.dia)}`;
}
