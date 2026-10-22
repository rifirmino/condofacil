// Constantes e dados iniciais da cobrança (fase 2). Tudo relativo a "hoje": a competência vigente venceu há 9 dias.
import { somarDias, somarMes } from '../datas.js';
import { contasIniciais, balancetesIniciais, mesDoInstante } from '../financeiro/dados.js';

export const ETAPAS_REGUA = [
  { id: 'antes5', dias: -5, nome: '5 dias antes', acao: 'Lembrete com link e Pix', canais: ['App', 'WhatsApp'] },
  { id: 'vencimento', dias: 0, nome: 'No vencimento', acao: 'Lembrete "vence hoje"', canais: ['App', 'WhatsApp'] },
  { id: 'atraso1', dias: 1, nome: '1 dia após', acao: 'Aviso de atraso com valor atualizado', canais: ['App', 'E-mail', 'WhatsApp'] },
  { id: 'atraso15', dias: 15, nome: '15 dias após', acao: 'Segundo aviso e oferta de acordo', canais: ['E-mail', 'WhatsApp'] },
  { id: 'atraso30', dias: 30, nome: '30 dias após', acao: 'Notificação formal de débito em PDF', canais: ['E-mail'] },
  { id: 'atraso60', dias: 60, nome: '60 dias após', acao: 'Alerta ao síndico: cobrança jurídica ou negativação', canais: ['Painel do síndico'] },
];

export const CATEGORIAS_DESPESA = { pessoal: 'Pessoal', concessionarias: 'Concessionárias', manutencao: 'Manutenção', administracao: 'Administração', seguro: 'Seguro e outros' };
export const NOMES_FORMA = { pix: 'Pix', boleto: 'Boleto', cartao: 'Cartão', manual: 'Baixa manual' };
export const NOMES_RELACAO = { titular: 'titular', inquilino: 'inquilino', proprietario: 'proprietário' };

const RESPONSAVEIS_SEM_APP = { 103: 'Lúcia Ferraz', 202: 'Helena Prado', 304: 'Otávio Reis', 503: 'Márcio Lopes', 602: 'Sílvia Campos', 604: 'André Nogueira', 701: 'Teresa Barreto', 802: 'Paula Siqueira', 803: 'Rogério Antunes', 804: 'Denise Correia' };
const HISTORICO_RECEITAS = [2710000, 2685000, 2730000, 2760000, 2655000, 2700000, 2745000, 2690000, 2720000, 2735000, 2700000];
const HISTORICO_DESPESAS = [1780000, 1810000, 1750000, 1840000, 1795000, 1870000, 1820000, 1760000, 2940000, 1850000, 1790000];
const DEVEDORAS_VIGENTE = ['503', '704', '202'];
const FORMAS_SEMENTE = ['pix', 'boleto', 'pix', 'cartao'];

export function mesmoDiaDoMes(iso, meses) {
  const dia = Math.min(28, Number(iso.slice(8, 10)));
  return `${somarMes(iso.slice(0, 7), meses)}-${String(dia).padStart(2, '0')}`;
}

export function diferencaMeses(a, b) {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (ya - yb) * 12 + (ma - mb);
}

function documentoMascarado(unidade) {
  return `***.${unidade}.${String(((Number(unidade) * 7) % 900) + 100)}-**`;
}

// Linhas anuais da previsão a partir do orçado mensal de cada categoria, com um reajuste percentual.
export function linhasDoOrcado(orcamento, pct) {
  return Object.keys(CATEGORIAS_DESPESA).map((categoria) => ({ categoria, nome: CATEGORIAS_DESPESA[categoria], valor: Math.round(orcamento[categoria] * 12 * (1 + pct / 100)) }));
}

// Fração ideal por tipo (convenção): 28 aptos tipo A e 4 coberturas somam 100%.
export const FRACOES_TIPO = { A: 0.029385, cobertura: 0.044304 };

// A composição é uma lista de versões com vigência; cada competência usa a mais recente que já vale.
export function versaoEm(fin, competencia) {
  return fin.composicao.versoes.filter((v) => v.vigencia <= competencia).sort((a, b) => a.vigencia.localeCompare(b.vigencia)).at(-1) || null;
}

export function ordinariaDe(fin, versao, unidade) {
  const u = fin.unidades[unidade];
  return versao.modo === 'fracao' ? Math.round(versao.orcamento * u.fracao) : versao.ordinaria[u.tipo];
}

export function fundoDe(fin, versao, unidade) {
  return Math.round((ordinariaDe(fin, versao, unidade) * versao.fundoPct) / 100);
}

export function mensalDe(fin, versao, unidade) {
  return ordinariaDe(fin, versao, unidade) + fundoDe(fin, versao, unidade);
}

export function fimExtra(extra) {
  return somarMes(extra.inicio, extra.parcelas - 1);
}

export function parcelaDe(extra, competencia) {
  const n = diferencaMeses(competencia, extra.inicio) + 1;
  if (n < 1 || n > extra.parcelas) return null;
  if (extra.situacao === 'encerrada' && (!extra.ultimaCompetencia || competencia > extra.ultimaCompetencia)) return null;
  return n;
}

export function valorExtraDe(fin, extra, unidade) {
  const porMes = extra.total / extra.parcelas;
  return Math.round(extra.rateio === 'fracao' ? porMes * fin.unidades[unidade].fracao : porMes / Object.keys(fin.unidades).length);
}

export function itensBase(fin, unidade, competencia) {
  const v = versaoEm(fin, competencia);
  const itens = [
    { tipo: 'ordinaria', descricao: 'Taxa ordinária', valor: ordinariaDe(fin, v, unidade) },
    { tipo: 'fundo', descricao: `Fundo de reserva (${v.fundoPct}%)`, valor: fundoDe(fin, v, unidade) },
  ];
  fin.composicao.extras.forEach((x) => {
    const p = parcelaDe(x, competencia);
    if (p) itens.push({ tipo: 'extra', descricao: `${x.descricao} (parcela ${p}/${x.parcelas})`, valor: valorExtraDe(fin, x, unidade) });
  });
  return itens;
}

export function financeiroInicial(hoje, em, pessoas, unidades) {
  const vencimentoVigente = mesmoDiaDoMes(somarDias(hoje, -9), 0);
  const vigente = vencimentoVigente.slice(0, 7);
  const proxima = somarMes(vigente, 1);
  const inicioCv1 = somarMes(vigente, -18);
  const inicioCv2 = somarMes(vigente, -6);
  const mesAge = somarMes(vigente, -3);
  const composicao = {
    versoes: [
      { id: 'CV-001', vigencia: inicioCv1, modo: 'fixo', ordinaria: { A: 61000, cobertura: 92000 }, orcamento: null, fundoPct: 10, aprovadoEm: `AGO de 30/03/${inicioCv1.slice(0, 4)}`, criadaEm: em(-560, 10), criadaPor: 'Síndico' },
      { id: 'CV-002', vigencia: inicioCv2, modo: 'fixo', ordinaria: { A: 65000, cobertura: 98000 }, orcamento: null, fundoPct: 10, aprovadoEm: `AGO de 28/03/${inicioCv2.slice(0, 4)}, item 3`, criadaEm: em(-200, 10), criadaPor: 'Síndico' },
    ],
    extras: [{ id: 'TX-001', descricao: 'Pintura da fachada', total: 4800000, parcelas: 10, inicio: somarMes(vigente, -2), rateio: 'igual', aprovadoEm: `AGE de 15/${mesAge.slice(5, 7)}/${mesAge.slice(0, 4)}`, situacao: 'ativa', ultimaCompetencia: null, motivoEncerramento: null, criadaEm: em(-75, 10), encerradaEm: null }],
    proximaVersao: 3,
    proximaExtra: 2,
  };
  const nomes = Object.fromEntries(pessoas.map((p) => [p.unidade, p.nome]));
  const naoResidentes = new Set(pessoas.filter((p) => p.naoResidente).map((p) => p.unidade));
  const unidadesFinanceiro = Object.fromEntries(unidades.map((u) => {
    let responsavel = null;
    if (u === '104') responsavel = { nome: 'Carlos Andrade', relacao: 'proprietario' };
    else if (nomes[u]) responsavel = { nome: nomes[u], relacao: naoResidentes.has(u) ? 'proprietario' : 'titular' };
    else if (RESPONSAVEIS_SEM_APP[u]) responsavel = { nome: RESPONSAVEIS_SEM_APP[u], relacao: 'proprietario' };
    if (responsavel) responsavel = { ...responsavel, documento: documentoMascarado(u), canais: ['App', 'E-mail', 'WhatsApp'] };
    const tipo = u[0] === '8' ? 'cobertura' : 'A';
    return [u, { tipo, fracao: FRACOES_TIPO[tipo], responsavel }];
  }));
  const novaCobranca = (unidade, competencia, vencimento, status, extras = {}) => {
    const itens = itensBase({ composicao, unidades: unidadesFinanceiro }, unidade, competencia);
    const valor = itens.reduce((soma, i) => soma + i.valor, 0);
    return { id: `CB-${competencia}-${unidade}`, unidade, competencia, vencimento, itens, valor, status, pagaEm: null, valorPago: status === 'paga' ? valor : null, forma: null, baixaManual: null, eventosAsaas: [], regua: [], substituiu: null, acordo: null, ...extras };
  };
  const enviadas = (ids) => ids.map((etapa) => ({ etapa, em: em(-30, 9) }));
  const cobrancas = [];
  unidades.filter((u) => unidadesFinanceiro[u].responsavel).forEach((u, i) => {
    if (DEVEDORAS_VIGENTE.includes(u)) cobrancas.push(novaCobranca(u, vigente, vencimentoVigente, 'aberta', { regua: [{ etapa: 'antes5', em: em(-14, 9) }, { etapa: 'vencimento', em: em(-9, 9) }] }));
    else cobrancas.push(novaCobranca(u, vigente, vencimentoVigente, 'paga', { pagaEm: em(-14 + (i % 6), 11), forma: FORMAS_SEMENTE[i % 4] }));
  });
  const vencimentoSetembro = mesmoDiaDoMes(vencimentoVigente, -1);
  const vencimentoAgosto = mesmoDiaDoMes(vencimentoVigente, -2);
  cobrancas.push(novaCobranca('704', somarMes(vigente, -1), vencimentoSetembro, 'aberta', { regua: enviadas(['antes5', 'vencimento', 'atraso1']) }));
  cobrancas.push(novaCobranca('202', somarMes(vigente, -1), vencimentoSetembro, 'aberta', { regua: enviadas(['antes5', 'vencimento', 'atraso1']) }));
  cobrancas.push(novaCobranca('202', somarMes(vigente, -2), vencimentoAgosto, 'aberta', { regua: enviadas(['antes5', 'vencimento', 'atraso1', 'atraso15', 'atraso30']) }));
  cobrancas.push(novaCobranca('302', somarMes(vigente, -1), vencimentoSetembro, 'paga', { pagaEm: em(-38, 10), forma: 'pix' }));
  cobrancas.push(novaCobranca('302', somarMes(vigente, -2), vencimentoAgosto, 'paga', { pagaEm: em(-68, 10), forma: 'pix' }));
  // Débitos de junho e julho da 304, substituídos pelo acordo AC-001 (ver comAcordoInicial).
  cobrancas.push(novaCobranca('304', somarMes(vigente, -4), mesmoDiaDoMes(vencimentoVigente, -4), 'aberta'));
  cobrancas.push(novaCobranca('304', somarMes(vigente, -3), mesmoDiaDoMes(vencimentoVigente, -3), 'aberta'));
  const historico = HISTORICO_RECEITAS.map((receitas, i) => ({ mes: somarMes(vigente, i - 11), receitas, despesas: HISTORICO_DESPESAS[i] }));
  const despesasMes = { pessoal: 980000, concessionarias: 390000, manutencao: 230000, administracao: 120000, seguro: 90000 };
  const saldo = 4835000;
  const receitasDoMes = cobrancas.filter((c) => c.status === 'paga' && mesDoInstante(c.pagaEm) === hoje.slice(0, 7)).reduce((s, c) => s + c.valorPago, 0);
  const orcamento = { pessoal: 950000, concessionarias: 420000, manutencao: 200000, administracao: 120000, seguro: 100000 };
  const anoPrevisao = Number(vigente.slice(0, 4)) + 1;
  const linhas8 = linhasDoOrcado(orcamento, 8);
  const previsoes = [
    { id: 'PO-001', ano: anoPrevisao, nome: 'Proposta do síndico', linhas: linhas8, margemPct: 12.5, criadaEm: em(-6, 21), atualizadaEm: em(-6, 21), documento: null },
    { id: 'PO-002', ano: anoPrevisao, nome: 'Com obra do telhado', linhas: [...linhas8, { categoria: null, nome: 'Obra do telhado', valor: 3600000 }], margemPct: 12.5, criadaEm: em(-4, 20), atualizadaEm: em(-4, 20), documento: null },
  ];
  return {
    parametros: { diaVencimento: Number(vencimentoVigente.slice(8, 10)), diaFechamento: 20, multaPct: 2, jurosPct: 1, descontoPct: 0, descontoAprovadoEm: '', formas: ['boleto', 'pix', 'cartao'], tarifa: 'condominio' },
    composicao,
    unidades: unidadesFinanceiro,
    avulsos: [
      { unidade: '104', competencia: proxima, tipo: 'avulso', descricao: 'Taxa do salão de festas (reserva)', valor: 15000 },
      { unidade: '301', competencia: proxima, tipo: 'credito', descricao: 'Crédito: pagamento em duplicidade', valor: -5000 },
    ],
    ajustesPrevia: {},
    vigente,
    vencimentoVigente,
    emitidas: [vigente],
    cobrancas,
    acordos: [],
    historico,
    despesasMes,
    orcamento,
    previsoes,
    proximaPrevisao: 3,
    saldo,
    contas: contasIniciais(hoje, em),
    proximaConta: 12,
    balancetes: balancetesIniciais(hoje, em, { historico, saldo, orcamento, receitasDoMes, despesasDoMesAtual: Object.values(despesasMes).reduce((s, v) => s + v, 0) }),
    ajustesMes: [],
    proximoComentario: 1,
    auditoria: [],
  };
}
