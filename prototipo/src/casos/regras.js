import { dadosIniciais } from '../dados.js';
import { podeReservar, avisoCancelamento, podeEntregar, acoesOcorrencia, alertasDocumentos, slaVencido, statusDia, horariosDaArea, destinatarios, comunicadosDaUnidade, indicadoresSindico } from '../regras.js';
import { igual, AGORA_TESTE } from './afirmar.js';

function pedidoTeste(areaId, data, inicio, fim, unidade = '302') {
  return { areaId, unidade, data, inicio, fim };
}

function reservaExtra(id, data) {
  return { id, areaId: 'salao', unidade: '302', data, inicio: 13, fim: 18, status: 'confirmada', convidados: [], criadaEm: AGORA_TESTE.toISOString() };
}

export const CASOS_REGRAS = [
  {
    nome: 'RN02: horário livre pode ser reservado',
    rodar() {
      igual(podeReservar(dadosIniciais(AGORA_TESTE), pedidoTeste('salao', '2026-10-15', 13, 18), AGORA_TESTE), { ok: true });
    },
  },
  {
    nome: 'RN02: reserva confirmada bloqueia o horário',
    rodar() {
      igual(podeReservar(dadosIniciais(AGORA_TESTE), pedidoTeste('salao', '2026-10-11', 18, 23), AGORA_TESTE), { ok: false, motivo: 'Horário já reservado' });
    },
  },
  {
    nome: 'RN02: reserva pendente já trava o horário',
    rodar() {
      igual(podeReservar(dadosIniciais(AGORA_TESTE), pedidoTeste('salao', '2026-10-18', 18, 23), AGORA_TESTE), { ok: false, motivo: 'Horário já reservado' });
    },
  },
  {
    nome: 'RN02: área vinculada também fica ocupada',
    rodar() {
      igual(podeReservar(dadosIniciais(AGORA_TESTE), pedidoTeste('churrasqueira', '2026-10-11', 18, 23), AGORA_TESTE), { ok: false, motivo: 'Horário já reservado' });
    },
  },
  {
    nome: 'bloqueio de manutenção impede a reserva',
    rodar() {
      igual(podeReservar(dadosIniciais(AGORA_TESTE), pedidoTeste('quadra', '2026-10-13', 10, 11), AGORA_TESTE), { ok: false, motivo: 'Área bloqueada: Manutenção da pintura' });
    },
  },
  {
    nome: 'antecedência mínima e máxima',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(podeReservar(e, pedidoTeste('salao', '2026-10-09', 13, 18), AGORA_TESTE).motivo, 'Reserve com pelo menos 2 dias de antecedência');
      igual(podeReservar(e, pedidoTeste('churrasqueira', '2026-10-08', 13, 18), AGORA_TESTE).motivo, 'Reserve com pelo menos 1 dia de antecedência');
      igual(podeReservar(e, pedidoTeste('salao', '2026-12-08', 13, 18), AGORA_TESTE).motivo, 'Reservas abrem com no máximo 60 dias de antecedência');
    },
  },
  {
    nome: 'horário que já passou não pode ser reservado',
    rodar() {
      igual(podeReservar(dadosIniciais(AGORA_TESTE), pedidoTeste('quadra', '2026-10-08', 9, 10), AGORA_TESTE).motivo, 'Esse horário já passou');
      igual(podeReservar(dadosIniciais(AGORA_TESTE), pedidoTeste('quadra', '2026-10-07', 9, 10), AGORA_TESTE).motivo, 'Esse horário já passou');
    },
  },
  {
    nome: 'RN05: limite de reservas por mês por unidade',
    rodar() {
      const base = dadosIniciais(AGORA_TESTE);
      const e = { ...base, reservas: [...base.reservas, reservaExtra('x1', '2026-10-20'), reservaExtra('x2', '2026-10-22')] };
      igual(podeReservar(e, pedidoTeste('salao', '2026-10-24', 13, 18), AGORA_TESTE).motivo, 'Limite de 2 reservas/mês atingido para esta área');
      igual(podeReservar(e, pedidoTeste('salao', '2026-11-05', 13, 18), AGORA_TESTE), { ok: true });
      igual(podeReservar(e, pedidoTeste('salao', '2026-10-24', 13, 18, '303'), AGORA_TESTE), { ok: true });
    },
  },
  {
    nome: 'RN04: cancelamento com menos de 72 h avisa multa',
    rodar() {
      const perto = avisoCancelamento({ data: '2026-10-10', inicio: 18 }, AGORA_TESTE);
      igual([perto.multa, perto.horas], [true, 56]);
      const longe = avisoCancelamento({ data: '2026-10-20', inicio: 18 }, AGORA_TESTE);
      igual(longe.multa, false);
    },
  },
  {
    nome: 'RN06: entrega exige código válido e nome de quem retirou',
    rodar() {
      const enc = dadosIniciais(AGORA_TESTE).encomendas.find((x) => x.id === 'e1');
      igual(podeEntregar(enc, '000000', 'Ana Souza').motivo, 'Código inválido');
      igual(podeEntregar(enc, '481203', '  ').motivo, 'Informe quem retirou');
      igual(podeEntregar(enc, ' 481203 ', 'Ana Souza'), { ok: true });
      igual(podeEntregar({ ...enc, status: 'retirada' }, '481203', 'Ana Souza').motivo, 'Encomenda já entregue');
    },
  },
  {
    nome: 'RN07: ocorrência fechada só pode ser arquivada, nunca apagada',
    rodar() {
      igual(acoesOcorrencia({ status: 'fechada', arquivada: false }).map((a) => a.id), ['comentar', 'arquivar']);
      const aberta = acoesOcorrencia({ status: 'aberta', arquivada: false });
      igual(aberta.map((a) => a.id), ['avancar', 'comentar']);
      igual(aberta[0].rotulo, 'Mover para "Em análise"');
      igual(acoesOcorrencia({ status: 'fechada', arquivada: true }), []);
    },
  },
  {
    nome: 'RN13: alertas de vencimento de documentos',
    rodar() {
      const alertas = alertasDocumentos(dadosIniciais(AGORA_TESTE).documentos, '2026-10-08');
      igual(alertas.map((a) => [a.documento.id, a.faixa, a.dias]), [['d8', 'vencido', -3], ['d6', '30', 25], ['d7', '60', 58]]);
    },
  },
  {
    nome: 'SLA vencido só para ocorrência aberta além do prazo',
    rodar() {
      const oc = (id) => dadosIniciais(AGORA_TESTE).ocorrencias.find((o) => o.id === id);
      igual([slaVencido(oc('OC-0042'), AGORA_TESTE), slaVencido(oc('OC-0041'), AGORA_TESTE), slaVencido(oc('OC-0038'), AGORA_TESTE)], [true, false, false]);
    },
  },
  {
    nome: 'status do dia no calendário',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual([statusDia(e, 'salao', '2026-10-11'), statusDia(e, 'salao', '2026-10-18'), statusDia(e, 'quadra', '2026-10-13'), statusDia(e, 'academia', '2026-10-08')], ['reservado', 'pendente', 'bloqueado', 'livre']);
    },
  },
  {
    nome: 'horários da área marcam ocupados e encerrados',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(horariosDaArea(e, 'salao', '2026-10-11', AGORA_TESTE).map((h) => [h.inicio, h.livre, h.motivo]), [[13, true, null], [18, false, 'Reservado']]);
      igual(horariosDaArea(e, 'quadra', '2026-10-08', AGORA_TESTE).slice(0, 4).map((h) => [h.inicio, h.livre, h.motivo]), [[8, false, 'Encerrado'], [9, false, 'Encerrado'], [10, false, 'Encerrado'], [11, true, null]]);
      igual(horariosDaArea(e, 'salao', '2026-10-11', AGORA_TESTE)[0].rotulo, 'Tarde (13h–18h)');
    },
  },
  {
    nome: 'destinatários de comunicado',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(destinatarios(e, { tipo: 'andar', valor: '5' }), ['501', '502', '503', '504']);
      igual(destinatarios(e, { tipo: 'unidades', valor: ['302', '999'] }), ['302']);
      igual(destinatarios(e, { tipo: 'todos' }).length, 32);
    },
  },
  {
    nome: 'comunicados da unidade: fixado primeiro',
    rodar() {
      igual(comunicadosDaUnidade(dadosIniciais(AGORA_TESTE), '302').map((c) => c.id), ['c1', 'c5', 'c3', 'c2', 'c4']);
    },
  },
  {
    nome: 'indicadores do síndico',
    rodar() {
      igual(indicadoresSindico(dadosIniciais(AGORA_TESTE), AGORA_TESTE), { pendentes: 1, abertas: 4, slaVencidas: 1, paradas: 1, vencendo: 3, adesao: { com: 20, total: 32 } });
    },
  },
];
