import { fmtReais } from '../cobranca/regras.js';
import { somarDias } from '../datas.js';
import { mesDoInstante } from './dados.js';

// Contas a pagar: situação no dia, filtros da lista e alertas do síndico.
export const NOMES_SITUACAO_CONTA = { paga: 'Paga', vencida: 'Vencida', hoje: 'Vence hoje', aberta: 'A pagar' };
export const FILTROS_CONTAS = [['proximas', 'Próximos 30 dias'], ['vencidas', 'Vencidas'], ['pagas', 'Pagas no mês'], ['todas', 'Todas']];

export function situacaoConta(conta, hoje) {
  if (conta.situacao === 'paga') return 'paga';
  if (conta.vencimento < hoje) return 'vencida';
  if (conta.vencimento === hoje) return 'hoje';
  return 'aberta';
}

export function contasFiltradas(estado, filtro, hoje) {
  const contas = estado.financeiro.contas;
  const limite = somarDias(hoje, 30);
  const lista = {
    proximas: contas.filter((c) => c.situacao === 'aberta' && c.vencimento <= limite),
    vencidas: contas.filter((c) => situacaoConta(c, hoje) === 'vencida'),
    pagas: contas.filter((c) => c.situacao === 'paga' && mesDoInstante(c.pagaEm) === hoje.slice(0, 7)),
    todas: contas,
  }[filtro] || contas;
  return [...lista].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

export function totalAPagar(estado, hoje) {
  return contasFiltradas(estado, 'proximas', hoje).reduce((s, c) => s + c.valor, 0);
}

export function alertasContas(estado, hoje) {
  return estado.financeiro.contas
    .filter((c) => ['vencida', 'hoje'].includes(situacaoConta(c, hoje)))
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    .map((c) => ({ chave: `conta-${c.id}`, href: '#sindico.financeiro.contas', texto: `${situacaoConta(c, hoje) === 'vencida' ? 'Conta vencida' : 'Vence hoje'}: ${c.descricao} (${fmtReais(c.valor)})` }));
}

export function serieDaConta(conta) {
  return `${conta.fornecedor}|${conta.descricao}`;
}
