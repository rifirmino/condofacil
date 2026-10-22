import { somarDias, somarMes, isoDia } from '../datas.js';

// Dados iniciais do financeiro operacional: contas a pagar do mês e balancetes dos dois meses anteriores.
export const CONSELHEIRO = { nome: 'Gustavo Freitas', unidade: '501', papel: 'Conselheiro fiscal' };
const ITENS_CATEGORIA = {
  pessoal: [['Folha de pagamento (zelador e porteiros CLT)', 0.735], ['Encargos (INSS e FGTS)', 1]],
  concessionarias: [['Energia elétrica · área comum', 0.54], ['Água e esgoto', 1]],
  manutencao: [['Manutenção dos elevadores · Elevadores Atlas', 0.63], ['Jardinagem · Verde Vida', 1]],
  administracao: [['Administradora e contabilidade · Lar Gestão', 1]],
  seguro: [['Seguro predial · Seguradora Horizonte', 1]],
};
const RECEITAS_PADRAO = { receitas: 2700000, despesas: 1790000 };
const SALAO_MES = 30000;
const DEDETIZACAO = 45000;

export function contasIniciais(hoje, em) {
  const dia = Number(hoje.slice(8, 10));
  const noMes = (k) => Math.min(k, dia - 1);
  const paga = (id, fornecedor, categoria, descricao, valor, dias) => ({ id, fornecedor, categoria, descricao, valor, vencimento: somarDias(hoje, -noMes(dias)), recorrente: true, situacao: 'paga', pagaEm: em(-noMes(dias), 10), comprovante: `comprovante-${id}.pdf`, boleto: `boleto-${id}.pdf` });
  const aberta = (id, fornecedor, categoria, descricao, valor, dias, recorrente) => ({ id, fornecedor, categoria, descricao, valor, vencimento: somarDias(hoje, dias), recorrente, situacao: 'aberta', pagaEm: null, comprovante: null, boleto: `boleto-${id}.pdf` });
  return [
    paga('CT-001', 'Folha de pagamento', 'pessoal', 'Salários do zelador e dos porteiros CLT', 720000, 15),
    paga('CT-002', 'Encargos trabalhistas', 'pessoal', 'INSS e FGTS do mês', 260000, 13),
    paga('CT-003', 'Distribuidora de energia', 'concessionarias', 'Energia elétrica · área comum', 210000, 12),
    paga('CT-004', 'Companhia de saneamento', 'concessionarias', 'Água e esgoto', 180000, 11),
    paga('CT-005', 'Elevadores Atlas', 'manutencao', 'Manutenção mensal dos elevadores', 145000, 10),
    paga('CT-006', 'Verde Vida Jardinagem', 'manutencao', 'Jardinagem mensal', 70500, 9),
    paga('CT-007', 'Lar Gestão', 'administracao', 'Administradora e contabilidade', 120000, 8),
    paga('CT-008', 'Seguradora Horizonte', 'seguro', 'Seguro predial (parcela)', 90000, 7),
    aberta('CT-009', 'Vigilância Prisma', 'pessoal', 'Portaria terceirizada (Edson e Rita)', 380000, 2, true),
    aberta('CT-010', 'Distribuidora de gás', 'concessionarias', 'Gás da área gourmet', 18000, 0, true),
    aberta('CT-011', 'Imunizadora Verde', 'manutencao', 'Dedetização trimestral', DEDETIZACAO, -1, false),
  ];
}

function despesasDoMes(total, orcamento, id, comDedetizacao) {
  const categorias = Object.keys(ITENS_CATEGORIA);
  const soma = categorias.reduce((s, c) => s + orcamento[c], 0);
  let restante = total;
  return categorias.map((categoria, i) => {
    const doCategoria = i === categorias.length - 1 ? restante : Math.round((total * orcamento[categoria]) / soma);
    restante -= doCategoria;
    const extra = comDedetizacao && categoria === 'manutencao' ? DEDETIZACAO : 0;
    const base = doCategoria - extra;
    let usado = 0;
    const itens = ITENS_CATEGORIA[categoria].map(([descricao, parte], n, lista) => {
      const valor = n === lista.length - 1 ? base - usado : Math.round(base * parte);
      usado += valor;
      return { id: `${id}-${categoria}-${n + 1}`, descricao, valor, nota: true };
    });
    if (extra) itens.push({ id: `${id}-manutencao-dedetizacao`, descricao: 'Dedetização · Imunizadora Verde', valor: extra, nota: false });
    return { categoria, itens };
  });
}

function balanceteGuardado(mes, situacao, valores, saldoInicial, orcamento, comDedetizacao, extras) {
  return {
    situacao, saldoInicial,
    receitas: [{ nome: 'Taxas condominiais', valor: valores.receitas - SALAO_MES }, { nome: 'Reservas do salão de festas', valor: SALAO_MES }],
    despesas: despesasDoMes(valores.despesas, orcamento, mes, comDedetizacao),
    inadimplencia: { unidades: 3, valor: 259500 },
    comentarios: [], correcao: null, fechadoEm: null, aprovadoEm: null, aprovadoPor: null, documento: null, resumo: null,
    ...extras,
  };
}

// Encadeia os saldos de trás para a frente: o mês anterior termina onde o mês corrente começou.
export function balancetesIniciais(hoje, em, { historico, saldo, orcamento, receitasDoMes, despesasDoMesAtual }) {
  const mes = hoje.slice(0, 7);
  const anterior = somarMes(mes, -1);
  const retrasado = somarMes(mes, -2);
  const valoresDe = (m) => historico.find((h) => h.mes === m) || RECEITAS_PADRAO;
  const finalAnterior = saldo - receitasDoMes + despesasDoMesAtual;
  const vAnt = valoresDe(anterior);
  const inicialAnterior = finalAnterior - vAnt.receitas + vAnt.despesas;
  const vRet = valoresDe(retrasado);
  const inicialRetrasado = inicialAnterior - vRet.receitas + vRet.despesas;
  const fechamento = em(-Math.max(1, Number(hoje.slice(8, 10)) - 3), 18);
  return {
    [retrasado]: balanceteGuardado(retrasado, 'aprovado', vRet, inicialRetrasado, orcamento, false, {
      fechadoEm: em(-35, 18), aprovadoEm: em(-30, 20), aprovadoPor: 'Gustavo Freitas', documento: 'd5', resumo: { publicadoEm: em(-29, 9), documento: null },
    }),
    [anterior]: balanceteGuardado(anterior, 'aberto', vAnt, inicialAnterior, orcamento, true, { preparadoEm: fechamento }),
  };
}

export function mesDoInstante(iso) {
  return isoDia(new Date(iso)).slice(0, 7);
}
