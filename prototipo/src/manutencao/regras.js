import { ORDEM_PRIORIDADE } from '../dados.js';
import { horasEntre } from '../datas.js';
import { fmtReais } from '../cobranca/regras.js';

// Regras do zelador: ordem das OS, cotações mínimas por faixa de valor e alertas ao síndico.
const LIMITE_COTACAO_1 = 50000;
const LIMITE_COTACAO_2 = 200000;
const ATIVAS_OS = ['aberta', 'em_execucao', 'aguardando_material', 'aguardando_prestador'];

export function listaOS(estado) {
  const fase = (o) => (ATIVAS_OS.includes(o.status) ? 0 : o.status === 'concluida' ? 1 : 2);
  return [...estado.manutencao.os].sort((a, b) => fase(a) - fase(b) || ORDEM_PRIORIDADE.indexOf(a.prioridade) - ORDEM_PRIORIDADE.indexOf(b.prioridade) || a.prazo.localeCompare(b.prazo));
}

export function osAtiva(os) {
  return ATIVAS_OS.includes(os.status);
}

export function cotacoesMinimas(valor) {
  if (valor > LIMITE_COTACAO_2) return { minimo: 3, acimaDe: LIMITE_COTACAO_2 };
  if (valor > LIMITE_COTACAO_1) return { minimo: 2, acimaDe: LIMITE_COTACAO_1 };
  return { minimo: 1, acimaDe: 0 };
}

export function textoCotacoes(valor) {
  const r = cotacoesMinimas(valor);
  return r.acimaDe ? `Anexe ${r.minimo} cotações para compras acima de ${fmtReais(r.acimaDe)}` : 'Anexe 1 cotação';
}

export function alertasManutencao(estado, agora) {
  const m = estado.manutencao;
  const itens = [];
  for (const o of m.os.filter((x) => x.prioridade === 'urgente' && x.status === 'aberta')) {
    const h = Math.floor(horasEntre(new Date(o.criadaEm), agora));
    if (h >= 2) itens.push({ chave: `osu-${o.id}`, texto: `${o.id} urgente sem início há ${h} h`, href: `#sindico.manutencao.${o.id}` });
  }
  for (const o of m.os.filter((x) => x.status === 'concluida')) itens.push({ chave: `osv-${o.id}`, texto: `${o.id} concluída: validar`, href: `#sindico.manutencao.${o.id}` });
  for (const c of m.compras.filter((x) => x.status === 'solicitada')) itens.push({ chave: `cp-${c.id}`, texto: `${c.id} aguardando aprovação: ${c.item}, ${fmtReais(c.valorEstimado)}`, href: `#sindico.manutencao.${c.id}` });
  return itens;
}
