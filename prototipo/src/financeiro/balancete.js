import { CATEGORIAS_DESPESA } from '../cobranca/dados.js';
import { indicadoresFinanceiros } from '../cobranca/regras.js';
import { somarMes, nomeMes, isoDia } from '../datas.js';
import { mesDoInstante } from './dados.js';

// Balancete mensal: meses passados ficam guardados (e travam ao fechar); o mês corrente é calculado na hora.
export const NOMES_SITUACAO_BALANCETE = { aberto: 'Aberto', fechado: 'Fechado', aguardando: 'Aguardando conselho', correcao: 'Correção pedida', aprovado: 'Aprovado' };
export const SITUACOES_TRAVADAS = ['fechado', 'aprovado'];

export function totalReceitas(b) {
  return b.receitas.reduce((s, r) => s + r.valor, 0);
}

export function totalDespesas(b) {
  return b.despesas.reduce((s, d) => s + d.itens.reduce((t, i) => t + i.valor, 0), 0);
}

export function totalCategoria(d) {
  return d.itens.reduce((s, i) => s + i.valor, 0);
}

export function saldoFinal(b) {
  return b.saldoInicial + totalReceitas(b) - totalDespesas(b);
}

export function mesCorrente(hoje) {
  return hoje.slice(0, 7);
}

export function balanceteVivo(estado, hoje) {
  const fin = estado.financeiro;
  const mes = mesCorrente(hoje);
  const anterior = fin.balancetes[somarMes(mes, -1)];
  const noMes = (iso) => iso && mesDoInstante(iso) === mes;
  const pagas = fin.cobrancas.filter((c) => c.status === 'paga' && noMes(c.pagaEm));
  const acordos = pagas.filter((c) => c.acordo).reduce((s, c) => s + c.valorPago, 0);
  const taxas = pagas.filter((c) => !c.acordo).reduce((s, c) => s + c.valorPago, 0);
  const receitas = [{ nome: 'Taxas condominiais', valor: taxas }, ...(acordos ? [{ nome: 'Parcelas de acordos', valor: acordos }] : [])];
  const despesas = Object.keys(CATEGORIAS_DESPESA).map((categoria) => {
    const itens = [
      ...fin.contas.filter((c) => c.categoria === categoria && c.situacao === 'paga' && noMes(c.pagaEm)).map((c) => ({ id: c.id, descricao: `${c.descricao} · ${c.fornecedor}`, valor: c.valor, nota: true })),
      ...estado.manutencao.compras.filter((c) => c.categoria === categoria && c.status === 'recebida' && !c.viaCaixa && noMes(c.recebidaEm)).map((c) => ({ id: c.id, descricao: `Compra ${c.id}: ${c.item}`, valor: c.valorFinal, nota: !!c.nota })),
      ...(categoria === 'manutencao' ? estado.manutencao.caixa.reposicoes.filter((r) => noMes(r.em)).map((r, n) => ({ id: `caixa-${n + 1}`, descricao: 'Reposição do caixa pequeno (cupons anexos)', valor: r.valor, nota: true })) : []),
      ...fin.ajustesMes.filter((a) => a.categoria === categoria).map((a) => ({ id: a.id, descricao: `Ajuste referente a ${nomeMes(a.referente)}: ${a.descricao}`, valor: a.valor, nota: true })),
    ];
    const resto = fin.despesasMes[categoria] - itens.reduce((s, i) => s + i.valor, 0);
    if (resto > 0) itens.push({ id: `outros-${categoria}`, descricao: 'Outros lançamentos do mês', valor: resto, nota: null });
    return { categoria, itens };
  });
  const inad = indicadoresFinanceiros(estado, hoje).inadimplencia;
  return {
    situacao: 'aberto', parcial: true, saldoInicial: anterior ? saldoFinal(anterior) : fin.saldo - taxas - acordos + Object.values(fin.despesasMes).reduce((s, v) => s + v, 0),
    receitas, despesas, inadimplencia: { unidades: inad.unidades, valor: inad.valor }, comentarios: [], correcao: null, fechadoEm: null, aprovadoEm: null, aprovadoPor: null, documento: null, resumo: null,
  };
}

export function balanceteDe(estado, mes, hoje) {
  return mes === mesCorrente(hoje) ? balanceteVivo(estado, hoje) : estado.financeiro.balancetes[mes] || null;
}

export function mesesDaPrestacao(estado, hoje) {
  return [mesCorrente(hoje), ...Object.keys(estado.financeiro.balancetes).sort().reverse()];
}

export function itemDoBalancete(b, itemId) {
  for (const d of b.despesas) {
    const item = d.itens.find((i) => i.id === itemId);
    if (item) return { ...item, categoria: d.categoria };
  }
  return null;
}

export function itensSemNota(b) {
  return b.despesas.flatMap((d) => d.itens.filter((i) => i.nota === false));
}

export function resumoDoBalancete(estado, b) {
  const unidades = estado.condominio.unidades.length;
  return {
    saldoInicial: b.saldoInicial,
    receitas: totalReceitas(b),
    despesas: b.despesas.map((d) => ({ nome: CATEGORIAS_DESPESA[d.categoria], valor: totalCategoria(d) })),
    totalDespesas: totalDespesas(b),
    saldoFinal: saldoFinal(b),
    inadimplenciaPct: Math.round((b.inadimplencia.unidades / unidades) * 1000) / 10,
  };
}

export function resumosPublicados(estado) {
  return Object.entries(estado.financeiro.balancetes).filter(([, b]) => b.resumo).sort(([a], [b]) => b.localeCompare(a)).map(([mes, b]) => ({ mes, b }));
}

export function alertasPrestacao(estado, hoje) {
  const atual = mesCorrente(hoje);
  return Object.entries(estado.financeiro.balancetes)
    .filter(([mes, b]) => mes < atual && ['aberto', 'correcao'].includes(b.situacao))
    .map(([mes, b]) => ({ chave: `balancete-${mes}`, href: `#sindico.financeiro.prestacao-${mes}`, texto: b.situacao === 'aberto' ? `Feche o balancete de ${nomeMes(mes)}` : `Balancete de ${nomeMes(mes)}: o conselho pediu correção` }));
}

export function mesesParaOConselho(estado) {
  return Object.entries(estado.financeiro.balancetes).filter(([, b]) => b.situacao === 'aguardando').map(([mes]) => mes);
}

export function dataDoInstante(iso) {
  return isoDia(new Date(iso));
}
