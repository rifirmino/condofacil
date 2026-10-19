// Constantes e dados iniciais da cobrança (fase 2). Tudo relativo a "hoje": a competência vigente venceu há 9 dias.
import { somarDias, somarMes } from '../datas.js';

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

const RESPONSAVEIS_SEM_APP = { 103: 'Lúcia Ferraz', 202: 'Helena Prado', 304: 'Otávio Reis', 503: 'Márcio Lopes', 602: 'Sílvia Campos', 604: 'André Nogueira', 701: 'Teresa Barreto', 704: 'Vicente Moraes', 802: 'Paula Siqueira', 803: 'Rogério Antunes', 804: 'Denise Correia' };
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

export function itensBase(composicao, tipo, competencia) {
  const ordinaria = composicao.ordinaria[tipo];
  const itens = [
    { tipo: 'ordinaria', descricao: 'Taxa ordinária', valor: ordinaria },
    { tipo: 'fundo', descricao: `Fundo de reserva (${composicao.fundoPct}%)`, valor: Math.round((ordinaria * composicao.fundoPct) / 100) },
  ];
  const extra = composicao.extra;
  const parcela = diferencaMeses(competencia, extra.inicio) + 1;
  if (parcela >= 1 && parcela <= extra.parcelas) {
    itens.push({ tipo: 'extra', descricao: `${extra.descricao} (parcela ${parcela}/${extra.parcelas})`, valor: Math.round(extra.total / extra.parcelas / extra.unidades) });
  }
  return itens;
}

export function financeiroInicial(hoje, em, pessoas, unidades) {
  const vencimentoVigente = mesmoDiaDoMes(somarDias(hoje, -9), 0);
  const vigente = vencimentoVigente.slice(0, 7);
  const proxima = somarMes(vigente, 1);
  const composicao = {
    ordinaria: { A: 65000, cobertura: 98000 },
    fundoPct: 10,
    extra: { descricao: 'Pintura da fachada', total: 4800000, parcelas: 10, inicio: somarMes(vigente, -2), unidades: 32 },
  };
  const nomes = Object.fromEntries(pessoas.map((p) => [p.unidade, p.nome]));
  const unidadesFinanceiro = Object.fromEntries(unidades.map((u) => {
    let responsavel = null;
    if (u === '104') responsavel = { nome: 'Carlos Andrade', relacao: 'proprietario' };
    else if (nomes[u]) responsavel = { nome: nomes[u], relacao: 'titular' };
    else if (RESPONSAVEIS_SEM_APP[u]) responsavel = { nome: RESPONSAVEIS_SEM_APP[u], relacao: 'proprietario' };
    if (responsavel) responsavel = { ...responsavel, documento: documentoMascarado(u), canais: ['App', 'E-mail', 'WhatsApp'] };
    return [u, { tipo: u[0] === '8' ? 'cobertura' : 'A', responsavel }];
  }));
  const novaCobranca = (unidade, competencia, vencimento, status, extras = {}) => {
    const itens = itensBase(composicao, unidadesFinanceiro[unidade].tipo, competencia);
    const valor = itens.reduce((soma, i) => soma + i.valor, 0);
    return { id: `CB-${competencia}-${unidade}`, unidade, competencia, vencimento, itens, valor, status, pagaEm: null, valorPago: status === 'paga' ? valor : null, forma: null, baixaManual: null, eventosAsaas: [], regua: [], substituiu: null, ...extras };
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
    historico: HISTORICO_RECEITAS.map((receitas, i) => ({ mes: somarMes(vigente, i - 11), receitas, despesas: HISTORICO_DESPESAS[i] })),
    despesasMes: { pessoal: 980000, concessionarias: 390000, manutencao: 230000, administracao: 120000, seguro: 90000 },
    orcamento: { pessoal: 950000, concessionarias: 420000, manutencao: 200000, administracao: 120000, seguro: 100000 },
    saldo: 4835000,
    auditoria: [],
  };
}
