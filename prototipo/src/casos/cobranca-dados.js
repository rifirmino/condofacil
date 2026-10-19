import { dadosIniciais } from '../dados.js';
import { liberado, planoMinimo, mensalidade } from '../planos.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

function financeiroTeste() {
  return dadosIniciais(AGORA_FASE2).financeiro;
}

function cobrancaDe(f, unidade, competencia) {
  return f.cobrancas.find((c) => c.unidade === unidade && c.competencia === competencia);
}

export const CASOS_COBRANCA_DADOS = [
  {
    nome: 'cobrança: competência vigente venceu há 9 dias',
    rodar() {
      const f = financeiroTeste();
      igual([f.vigente, f.vencimentoVigente, f.parametros.diaVencimento, f.saldo, f.emitidas], ['2026-10', '2026-10-10', 10, 4835000, ['2026-10']]);
    },
  },
  {
    nome: 'cobrança: outubro com 31 emitidas, 28 pagas e 3 em aberto',
    rodar() {
      const outubro = financeiroTeste().cobrancas.filter((c) => c.competencia === '2026-10');
      igual([outubro.length, outubro.filter((c) => c.status === 'paga').length], [31, 28]);
      igual(outubro.filter((c) => c.status === 'aberta').map((c) => c.unidade), ['202', '503', '704']);
    },
  },
  {
    nome: 'cobrança: valores e itens de outubro por tipo de unidade',
    rodar() {
      const f = financeiroTeste();
      igual([cobrancaDe(f, '302', '2026-10').valor, cobrancaDe(f, '801', '2026-10').valor], [86500, 122800]);
      igual(cobrancaDe(f, '302', '2026-10').itens.map((i) => i.descricao), ['Taxa ordinária', 'Fundo de reserva (10%)', 'Pintura da fachada (parcela 3/10)']);
      igual(cobrancaDe(f, '403', '2026-10'), undefined);
    },
  },
  {
    nome: 'cobrança: responsáveis financeiros',
    rodar() {
      const u = financeiroTeste().unidades;
      igual([u['403'].responsavel, u['104'].responsavel.nome, u['104'].responsavel.relacao, u['202'].responsavel.nome, u['302'].responsavel.relacao, u['801'].tipo], [null, 'Carlos Andrade', 'proprietario', 'Helena Prado', 'titular', 'cobertura']);
    },
  },
  {
    nome: 'cobrança: débitos antigos e histórico da Ana',
    rodar() {
      const f = financeiroTeste();
      igual(f.cobrancas.filter((c) => c.status === 'aberta' && c.competencia !== '2026-10').map((c) => `${c.unidade}/${c.competencia}`), ['704/2026-09', '202/2026-09', '202/2026-08']);
      igual(f.cobrancas.filter((c) => c.unidade === '302' && c.status === 'paga').map((c) => c.competencia), ['2026-10', '2026-09', '2026-08']);
    },
  },
  {
    nome: 'cobrança: histórico de 11 meses com julho acima da receita',
    rodar() {
      const h = financeiroTeste().historico;
      igual([h.length, h[0].mes, h[8].mes, h[8].despesas > h[8].receitas], [11, '2025-11', '2026-07', true]);
    },
  },
  {
    nome: 'planos: recursos e preços',
    rodar() {
      igual([liberado('basico', 'cobranca'), liberado('basico', 'dashboardCompleto'), liberado('intermediario', 'dashboardCompleto'), liberado('intermediario', 'orcadoRealizado'), liberado('avancado', 'orcadoRealizado')], [true, false, true, false, true]);
      igual([mensalidade('basico', 32), mensalidade('intermediario', 32), mensalidade('avancado', 32)], [31680, 47520, 69696]);
      igual([planoMinimo('notificacaoFormal').nome, dadosIniciais(AGORA_FASE2).plano], ['Avançado', 'intermediario']);
    },
  },
];
