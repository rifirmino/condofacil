import { somarMes, nomeMes, diferencaDias } from '../datas.js';
import { versaoEm, mensalDe, ordinariaDe, fundoDe, fimExtra, valorExtraDe } from './dados.js';
import { fmtReais } from './regras.js';

// Reajustes e taxas extras: montagem de uma nova versão, simulação do impacto e o que muda para cada unidade.
export const NOMES_TIPO_UNIDADE = { A: 'Apto tipo A', cobertura: 'Cobertura' };
export const NOMES_MODO = { fixo: 'Valor fixo por tipo', fracao: 'Rateio por fração ideal' };
export const NOMES_RATEIO = { igual: 'Dividido igual entre as unidades', fracao: 'Por fração ideal' };
export const MSG_ATA = 'Informe a ata ou data da assembleia';
const MSG_VALORES = 'Informe um percentual ou valores válidos';
const DIAS_AVISO_ENCERRADA = 60;

export function primeiraNaoEmitida(fin) {
  // Sem nenhuma emissão (condomínio recém-implantado), a primeira competência é a seguinte à vigente.
  return somarMes([...fin.emitidas].sort().at(-1) || fin.vigente, 1);
}

export function versaoAnterior(fin, vigencia) {
  return fin.composicao.versoes.filter((v) => v.vigencia < vigencia).sort((a, b) => a.vigencia.localeCompare(b.vigencia)).at(-1) || null;
}

export function fmtFracao(fracao) {
  return `${(fracao * 100).toFixed(4).replace('.', ',')}%`;
}

export function fmtVariacao(pct) {
  return `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1).replace('.', ',')}%`;
}

function unidadeModelo(fin, tipo) {
  return Object.keys(fin.unidades).find((u) => fin.unidades[u].tipo === tipo);
}

// Só os tipos que existem no condomínio (um prédio sem coberturas não mostra a linha da cobertura).
export function tiposPresentes(fin) {
  return Object.keys(NOMES_TIPO_UNIDADE).filter((tipo) => unidadeModelo(fin, tipo));
}

// Versão que a nova substitui: a anterior, ou a própria vigente quando ainda não houve emissão (mesma competência).
function versaoBase(fin, vigencia) {
  return versaoAnterior(fin, vigencia) || versaoVigente(fin);
}

export function montarVersao(fin, dados) {
  const minimo = primeiraNaoEmitida(fin);
  if (!dados.vigencia || dados.vigencia < minimo) return { erro: `A vigência deve ser a partir de ${nomeMes(minimo)}` };
  const base = versaoBase(fin, dados.vigencia);
  const modo = dados.modo || base.modo;
  const fundoPct = dados.fundoPct === undefined || dados.fundoPct === '' ? base.fundoPct : Number(dados.fundoPct);
  if (!Number.isFinite(fundoPct) || fundoPct < 0 || fundoPct > 30) return { erro: 'O fundo de reserva deve ser de 0% a 30%' };
  let ordinaria = null;
  let orcamento = null;
  if (dados.forma === 'percentual') {
    if (modo !== base.modo) return { erro: 'Ao trocar o modo, informe os valores' };
    const pct = String(dados.pct ?? '').trim() === '' ? NaN : Number(dados.pct);
    if (!Number.isFinite(pct) || pct < -50) return { erro: MSG_VALORES };
    const aplicar = (v) => Math.round(v * (1 + pct / 100));
    if (modo === 'fixo') ordinaria = { A: aplicar(base.ordinaria.A), cobertura: aplicar(base.ordinaria.cobertura) };
    else orcamento = aplicar(base.orcamento);
  } else if (modo === 'fixo') {
    const o = dados.ordinaria || {};
    const temCobertura = tiposPresentes(fin).includes('cobertura');
    if (!(o.A > 0 && (o.cobertura > 0 || !temCobertura))) return { erro: MSG_VALORES };
    ordinaria = { A: Math.round(o.A), cobertura: Math.round(temCobertura ? o.cobertura : o.A) };
  } else {
    if (!(dados.orcamento > 0)) return { erro: MSG_VALORES };
    orcamento = Math.round(dados.orcamento);
  }
  return { versao: { vigencia: dados.vigencia, modo, ordinaria, orcamento, fundoPct } };
}

export function simularComposicao(fin, nova) {
  const antes = versaoBase(fin, nova.vigencia);
  const tipos = tiposPresentes(fin).map((tipo) => {
    const u = unidadeModelo(fin, tipo);
    const a = mensalDe(fin, antes, u);
    const d = mensalDe(fin, nova, u);
    return { tipo, antes: a, depois: d, diferenca: d - a, pct: a ? ((d - a) / a) * 100 : 0 };
  });
  const soma = (v) => Object.keys(fin.unidades).reduce((s, u) => s + mensalDe(fin, v, u), 0);
  return { tipos, arrecadacaoAntes: soma(antes), arrecadacaoDepois: soma(nova) };
}

export function resumoVersao(fin, v) {
  const valores = tiposPresentes(fin).map((tipo) => `${NOMES_TIPO_UNIDADE[tipo]} ${fmtReais(ordinariaDe(fin, v, unidadeModelo(fin, tipo)))}`).join(' · ');
  return `${v.modo === 'fracao' ? `Orçamento ${fmtReais(v.orcamento)}/mês · ` : ''}${valores} · fundo ${v.fundoPct}%`;
}

export function textoValoresVersao(fin, v) {
  return tiposPresentes(fin).map((tipo) => {
    const u = unidadeModelo(fin, tipo);
    return `${NOMES_TIPO_UNIDADE[tipo]}: ${fmtReais(mensalDe(fin, v, u))} por mês (taxa ordinária ${fmtReais(ordinariaDe(fin, v, u))} + fundo de reserva ${fmtReais(fundoDe(fin, v, u))})`;
  }).join('\n');
}

export function valorPorTipoExtra(fin, extra) {
  return tiposPresentes(fin).map((tipo) => ({ tipo, valor: valorExtraDe(fin, extra, unidadeModelo(fin, tipo)) }));
}

export function versoesAgendadas(fin) {
  const p = primeiraNaoEmitida(fin);
  // A primeira versão (implantação) não é reajuste: só conta a que tem uma versão anterior.
  return fin.composicao.versoes.filter((v) => v.vigencia >= p && versaoAnterior(fin, v.vigencia)).sort((a, b) => a.vigencia.localeCompare(b.vigencia));
}

export function versaoVigente(fin) {
  // Antes da primeira emissão vale a primeira versão cadastrada (condomínio recém-implantado).
  return versaoEm(fin, somarMes(primeiraNaoEmitida(fin), -1)) || [...fin.composicao.versoes].sort((x, y) => x.vigencia.localeCompare(y.vigencia))[0];
}

export function mudancasDaUnidade(estado, unidade, hoje) {
  const fin = estado.financeiro;
  const p = primeiraNaoEmitida(fin);
  const linhas = versoesAgendadas(fin).map((v) => {
    const antes = mensalDe(fin, versaoAnterior(fin, v.vigencia), unidade);
    const depois = mensalDe(fin, v, unidade);
    return { chave: v.id, titulo: 'Reajuste da taxa', texto: `A partir de ${nomeMes(v.vigencia)}: de ${fmtReais(antes)} para ${fmtReais(depois)} (${fmtVariacao(((depois - antes) / antes) * 100)})`, detalhe: `Aprovado em: ${v.aprovadoEm}` };
  });
  for (const x of fin.composicao.extras) {
    if (x.situacao === 'ativa' && fimExtra(x) >= p) {
      const fracao = x.rateio === 'fracao' ? ` (fração ${fmtFracao(fin.unidades[unidade].fracao)})` : '';
      linhas.push({ chave: x.id, titulo: 'Taxa extra', texto: `${x.descricao}: ${fmtReais(valorExtraDe(fin, x, unidade))} por mês em ${x.parcelas} parcelas, de ${nomeMes(x.inicio)} a ${nomeMes(fimExtra(x))}${fracao}`, detalhe: `Aprovado em: ${x.aprovadoEm}` });
    } else if (x.situacao === 'encerrada' && diferencaDias(hoje, x.encerradaEm.slice(0, 10)) <= DIAS_AVISO_ENCERRADA) {
      const texto = x.ultimaCompetencia ? `A taxa ${x.descricao} foi encerrada; a última parcela foi a de ${nomeMes(x.ultimaCompetencia)}` : `A taxa ${x.descricao} foi cancelada antes da primeira parcela`;
      linhas.push({ chave: x.id, titulo: 'Taxa extra encerrada', texto, detalhe: x.motivoEncerramento });
    }
  }
  return linhas;
}

export function alertasComposicao(estado) {
  return versoesAgendadas(estado.financeiro).map((v) => ({ chave: `reajuste-${v.id}`, href: '#sindico.cobranca.taxas', texto: `Reajuste agendado para ${nomeMes(v.vigencia)} · confira a prévia antes de emitir` }));
}
