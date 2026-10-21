import { CATEGORIAS_DESPESA, ordinariaDe } from './dados.js';
import { indicadoresFinanceiros } from './regras.js';
import { primeiraNaoEmitida, versaoVigente, simularComposicao } from './composicao.js';

// Previsão orçamentária do ano: despesa por categoria, margem de inadimplência e a taxa que fecha a conta.
export function despesaAnual(linhas) {
  return linhas.reduce((soma, l) => soma + l.valor, 0);
}

export function ordinariaNecessaria(linhas, margemPct) {
  return Math.round(despesaAnual(linhas) / 12 / (1 - margemPct / 100));
}

export function ordinariaTotal(fin, versao) {
  return Object.keys(fin.unidades).reduce((soma, u) => soma + ordinariaDe(fin, versao, u), 0);
}

export function candidataDaPrevisao(fin, previsao) {
  const base = versaoVigente(fin);
  const necessaria = ordinariaNecessaria(previsao.linhas, previsao.margemPct);
  const comum = { vigencia: primeiraNaoEmitida(fin), modo: base.modo, fundoPct: base.fundoPct };
  if (base.modo === 'fracao') return { ...comum, ordinaria: null, orcamento: necessaria };
  const fator = necessaria / ordinariaTotal(fin, base);
  return { ...comum, ordinaria: { A: Math.round(base.ordinaria.A * fator), cobertura: Math.round(base.ordinaria.cobertura * fator) }, orcamento: null };
}

export function simularPrevisao(fin, previsao) {
  return simularComposicao(fin, candidataDaPrevisao(fin, previsao));
}

export function resultadoComTaxaAtual(fin, previsao) {
  return Math.round(ordinariaTotal(fin, versaoVigente(fin)) * 12 * (1 - previsao.margemPct / 100)) - despesaAnual(previsao.linhas);
}

export function margemAtual(estado, hoje) {
  return indicadoresFinanceiros(estado, hoje).inadimplencia.pct;
}

export function nomeDaLinha(linha) {
  return linha.categoria ? CATEGORIAS_DESPESA[linha.categoria] : linha.nome;
}

export function compararPrevisoes(fin, a, b) {
  const nomes = [...new Set([...a.linhas, ...b.linhas].map(nomeDaLinha))];
  const valorDe = (p, nome) => (p.linhas.find((l) => nomeDaLinha(l) === nome) || { valor: 0 }).valor;
  const sa = simularPrevisao(fin, a);
  const sb = simularPrevisao(fin, b);
  return {
    linhas: nomes.map((nome) => ({ nome, a: valorDe(a, nome), b: valorDe(b, nome) })),
    total: { a: despesaAnual(a.linhas), b: despesaAnual(b.linhas) },
    ordinaria: { a: ordinariaNecessaria(a.linhas, a.margemPct), b: ordinariaNecessaria(b.linhas, b.margemPct) },
    tipos: sa.tipos.map((t, i) => ({ tipo: t.tipo, a: t.depois, b: sb.tipos[i].depois })),
  };
}
