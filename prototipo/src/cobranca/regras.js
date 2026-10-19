import { ETAPAS_REGUA, itensBase, mesmoDiaDoMes, diferencaMeses } from './dados.js';
import { diferencaDias, somarMes, nomeMes } from '../datas.js';

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ETAPAS_POR_PLANO = {
  basico: ['antes5', 'vencimento'],
  intermediario: ['antes5', 'vencimento', 'atraso1', 'atraso15', 'atraso60'],
  avancado: ETAPAS_REGUA.map((e) => e.id),
};

function milhar(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function fmtReais(centavos) {
  const abs = Math.abs(centavos);
  return `${centavos < 0 ? '−' : ''}R$ ${milhar(Math.floor(abs / 100))},${String(abs % 100).padStart(2, '0')}`;
}

export function fmtReaisCurto(centavos) {
  return `${centavos < 0 ? '−' : ''}R$ ${milhar(Math.round(Math.abs(centavos) / 100))}`;
}

export function mesCurto(anoMes) {
  return MESES_ABREV[Number(anoMes.slice(5, 7)) - 1];
}

export function mesExtenso(anoMes) {
  return nomeMes(anoMes).split(' de ')[0];
}

export function situacaoCobranca(cobranca, hoje) {
  if (cobranca.status !== 'aberta') return cobranca.status;
  return cobranca.vencimento < hoje ? 'vencida' : 'aberta';
}

export function valorAtualizado(cobranca, parametros, hoje) {
  const dias = situacaoCobranca(cobranca, hoje) === 'vencida' ? diferencaDias(hoje, cobranca.vencimento) : 0;
  if (!dias) return { total: cobranca.valor, multa: 0, juros: 0, dias: 0 };
  const multa = Math.round((cobranca.valor * parametros.multaPct) / 100);
  const juros = Math.round((cobranca.valor * parametros.jurosPct * dias) / 3000);
  return { total: cobranca.valor + multa + juros, multa, juros, dias };
}

export function validarParametros(p) {
  const falha = (motivo) => ({ ok: false, motivo });
  for (const dia of [p.diaVencimento, p.diaFechamento]) {
    if (!Number.isInteger(dia) || dia < 1 || dia > 28) return falha('Use um dia entre 1 e 28');
  }
  if (!(p.multaPct >= 0) || p.multaPct > 2) return falha('A multa por atraso é limitada a 2% (Código Civil, art. 1.336)');
  if (!(p.jurosPct >= 0)) return falha('Informe os juros ao mês');
  if (p.descontoPct > 0 && !String(p.descontoAprovadoEm || '').trim()) return falha('Informe a ata ou cláusula que aprova o desconto');
  if (!p.formas || !p.formas.length) return falha('Escolha ao menos uma forma de pagamento');
  return { ok: true };
}

export function proximaCompetencia(financeiro) {
  return somarMes(financeiro.vigente, 1);
}

export function vencimentoDa(financeiro, competencia) {
  return mesmoDiaDoMes(financeiro.vencimentoVigente, diferencaMeses(competencia, financeiro.vigente));
}

export function previaCompetencia(estado, competencia) {
  const fin = estado.financeiro;
  const ajustes = fin.ajustesPrevia[competencia] || {};
  const linhas = estado.condominio.unidades.map((unidade) => {
    const { tipo, responsavel } = fin.unidades[unidade];
    const avulsos = fin.avulsos.filter((a) => a.unidade === unidade && a.competencia === competencia).map(({ tipo: t, descricao, valor }) => ({ tipo: t, descricao, valor }));
    const itens = ajustes[unidade] || [...itensBase(fin.composicao, tipo, competencia), ...avulsos];
    const bloqueada = !responsavel || !responsavel.documento;
    return { unidade, tipo, responsavel, itens, total: itens.reduce((soma, i) => soma + i.valor, 0), bloqueada, motivo: bloqueada ? 'Sem responsável financeiro' : null };
  });
  return { competencia, vencimento: vencimentoDa(fin, competencia), linhas };
}

export function etapasNoPlano(plano) {
  return ETAPAS_POR_PLANO[plano];
}

export function etapaRegua(cobranca, hoje) {
  if (cobranca.status !== 'aberta') return null;
  const dias = diferencaDias(hoje, cobranca.vencimento);
  const alcancadas = ETAPAS_REGUA.filter((e) => e.dias <= dias);
  return alcancadas.length ? alcancadas[alcancadas.length - 1] : null;
}

export function pendentesDaRegua(estado, hoje, plano) {
  const permitidas = etapasNoPlano(plano);
  return estado.financeiro.cobrancas.flatMap((c) => {
    if (c.status !== 'aberta') return [];
    const dias = diferencaDias(hoje, c.vencimento);
    const candidatas = ETAPAS_REGUA.filter((e) => e.dias <= dias && permitidas.includes(e.id));
    const etapa = candidatas[candidatas.length - 1];
    return etapa && !c.regua.some((r) => r.etapa === etapa.id) ? [{ cobranca: c, etapa }] : [];
  });
}

export function devedores(estado, hoje) {
  const fin = estado.financeiro;
  const grupos = {};
  for (const c of fin.cobrancas) {
    if (situacaoCobranca(c, hoje) !== 'vencida') continue;
    const v = valorAtualizado(c, fin.parametros, hoje);
    if (!grupos[c.unidade]) grupos[c.unidade] = { unidade: c.unidade, responsavel: fin.unidades[c.unidade].responsavel, cobrancas: 0, valor: 0, dias: 0, etapa: null };
    const g = grupos[c.unidade];
    g.cobrancas += 1;
    g.valor += v.total;
    if (v.dias > g.dias) {
      g.dias = v.dias;
      g.etapa = etapaRegua(c, hoje);
    }
  }
  return Object.values(grupos).sort((a, b) => b.dias - a.dias);
}

export function indicadoresFinanceiros(estado, hoje) {
  const fin = estado.financeiro;
  const daCompetencia = (competencia) => fin.cobrancas.filter((c) => c.competencia === competencia && c.status !== 'cancelada');
  const vigentes = daCompetencia(fin.vigente);
  const previsto = vigentes.reduce((soma, c) => soma + c.valor, 0);
  const recebido = vigentes.filter((c) => c.status === 'paga').reduce((soma, c) => soma + c.valor, 0);
  const proxima = proximaCompetencia(fin);
  const daProxima = daCompetencia(proxima);
  const lista = devedores(estado, hoje);
  const totalUnidades = estado.condominio.unidades.length;
  const despesaMedia = Math.round(fin.historico.reduce((soma, m) => soma + m.despesas, 0) / fin.historico.length);
  const despesas = Object.values(fin.despesasMes).reduce((soma, v) => soma + v, 0);
  const orcado = Object.values(fin.orcamento).reduce((soma, v) => soma + v, 0);
  const desvio = Math.round(((despesas - orcado) / orcado) * 1000) / 10;
  const pct = previsto ? Math.round((recebido / previsto) * 100) : 0;
  const inadimplenciaPct = Math.round((lista.length / totalUnidades) * 1000) / 10;
  return {
    saldo: { valor: fin.saldo, despesaMedia, alerta: fin.saldo < despesaMedia },
    arrecadado: { competencia: fin.vigente, recebido, previsto, pct, alerta: pct < 85, proxima: fin.emitidas.includes(proxima) ? { competencia: proxima, pagas: daProxima.filter((c) => c.status === 'paga').length, total: daProxima.length } : null },
    inadimplencia: { unidades: lista.length, total: totalUnidades, pct: inadimplenciaPct, valor: lista.reduce((soma, d) => soma + d.valor, 0), alerta: inadimplenciaPct > 10 },
    despesas: { valor: despesas, orcado, desvio, alerta: desvio > 10 },
  };
}

export function serieReceitasDespesas(estado, hoje) {
  const ind = indicadoresFinanceiros(estado, hoje);
  return [...estado.financeiro.historico, { mes: estado.financeiro.vigente, receitas: ind.arrecadado.recebido, despesas: ind.despesas.valor }];
}

export function tituloSerie(serie) {
  const acima = serie.filter((m) => m.despesas > m.receitas);
  if (!acima.length) return 'Receita cobriu a despesa em todos os meses';
  if (acima.length === 1) return `Despesa superou a receita só em ${mesExtenso(acima[0].mes)}`;
  return `Despesa superou a receita em ${acima.length} meses`;
}

export function podeOperar(perfil) {
  return perfil === 'sindico';
}
