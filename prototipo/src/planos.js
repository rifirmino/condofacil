// Planos da fase 2 e preço por plano (planilha de precificação, faixa de 31 a 70 unidades).
export const PLANOS = [
  { id: 'basico', nome: 'Básico', multiplicador: 1.0 },
  { id: 'intermediario', nome: 'Intermediário', multiplicador: 1.5 },
  { id: 'avancado', nome: 'Avançado', multiplicador: 2.2 },
];

export const PRECO_BASE = { faixa: '31 a 70 unidades', implantacao: 39900, porUnidade: 990 };

const RECURSOS_PLANO = {
  cobranca: 'basico',
  composicaoCompleta: 'intermediario',
  fracaoIdeal: 'intermediario',
  taxaExtra: 'intermediario',
  reguaCompleta: 'intermediario',
  notificacaoFormal: 'avancado',
  dashboardCompleto: 'intermediario',
  orcadoRealizado: 'avancado',
  acordos: 'intermediario',
  termoConfissao: 'avancado',
  notificacoesPrazo: 'intermediario',
  zelador: 'intermediario',
  indicadorAtendimento: 'avancado',
  cotacoes: 'avancado',
  caixaPequeno: 'avancado',
  escala: 'intermediario',
  checkin: 'avancado',
  relatorioHoras: 'avancado',
};

const ORDEM_PLANOS = ['basico', 'intermediario', 'avancado'];

export function liberado(plano, recurso) {
  return ORDEM_PLANOS.indexOf(plano) >= ORDEM_PLANOS.indexOf(RECURSOS_PLANO[recurso]);
}

export function planoMinimo(recurso) {
  return PLANOS.find((p) => p.id === RECURSOS_PLANO[recurso]);
}

export function mensalidade(planoId, unidades) {
  const plano = PLANOS.find((p) => p.id === planoId);
  return Math.round(PRECO_BASE.porUnidade * unidades * plano.multiplicador);
}
