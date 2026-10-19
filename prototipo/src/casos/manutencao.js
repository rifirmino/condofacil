import { dadosIniciais } from '../dados.js';
import { alertasManutencao, listaOS } from '../manutencao/regras.js';
import { gerarOS, abrirOS, iniciarOS, pausarOS, concluirOS, validarOS } from '../manutencao/acoes.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

function estadoMan() {
  return dadosIniciais(AGORA_FASE2);
}

function osDe(e, id) {
  return e.manutencao.os.find((o) => o.id === id);
}

export const CASOS_MANUTENCAO = [
  {
    nome: 'manutenção: seed de OS, compras e caixa',
    rodar() {
      const e = estadoMan();
      const m = e.manutencao;
      igual(m.os.map((o) => [o.id, o.status, o.notificacao]), [['OS-001', 'validada', null], ['OS-002', 'concluida', 'OC-0037'], ['OS-003', 'em_execucao', 'OC-0039']]);
      igual(m.compras.map((c) => [c.id, c.status, c.valorEstimado]), [['CP-001', 'solicitada', 38000], ['CP-002', 'recebida', 14500]]);
      igual([m.caixa.fundo, m.caixa.saldo, m.caixa.gastos.length], [30000, 23950, 2]);
      igual(listaOS(e).map((o) => o.id), ['OS-003', 'OS-002', 'OS-001']);
      igual(['OC-0037', 'OC-0039'].map((id) => e.ocorrencias.find((o) => o.id === id).os), ['OS-002', 'OS-003']);
    },
  },
  {
    nome: 'manutenção: gerar OS a partir da notificação',
    rodar() {
      const e = estadoMan();
      igual(gerarOS(e, 'OC-0039', { responsavel: 'zelador' }, 'sindico', AGORA_FASE2).erro, 'Esta notificação já tem a OS-003');
      igual(gerarOS(e, 'OC-0040', { responsavel: 'zelador' }, 'zelador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      igual(gerarOS({ ...e, plano: 'basico' }, 'OC-0040', { responsavel: 'zelador' }, 'sindico', AGORA_FASE2).erro, 'Disponível no plano Intermediário');
      const r = gerarOS(e, 'OC-0040', { responsavel: 'prestador', prestador: 'Elevadores Atlas' }, 'sindico', AGORA_FASE2);
      const os = osDe(r.estado, 'OS-004');
      igual([os.origem, os.notificacao, os.local, os.prioridade, os.responsavel, os.prestador, os.status], ['notificacao', 'OC-0040', 'Elevador 2', 'alta', 'prestador', 'Elevadores Atlas', 'aberta']);
      const oc = r.estado.ocorrencias.find((o) => o.id === 'OC-0040');
      igual([oc.os, oc.status, oc.linha.at(-1).texto], ['OS-004', 'em_andamento', 'OS-004 aberta para o prestador Elevadores Atlas']);
    },
  },
  {
    nome: 'manutenção: ronda do zelador e fluxo da OS',
    rodar() {
      const e = estadoMan();
      igual(abrirOS(e, { local: '', descricao: 'x', prioridade: 'normal' }, 'zelador', AGORA_FASE2).erro, 'Informe o local e a descrição');
      igual(abrirOS(e, { local: 'x', descricao: 'x', prioridade: 'normal' }, 'morador', AGORA_FASE2).erro, 'Somente o zelador ou o síndico pode fazer isso');
      let r = abrirOS(e, { local: 'Piscina', descricao: 'Ralo solto', prioridade: 'normal' }, 'zelador', AGORA_FASE2);
      igual([osDe(r.estado, 'OS-004').origem, osDe(r.estado, 'OS-004').prazo.slice(0, 10)], ['ronda', '2026-10-26']);
      r = iniciarOS(r.estado, 'OS-004', 'zelador', AGORA_FASE2);
      r = pausarOS(r.estado, 'OS-004', 'aguardando_material', 'zelador', AGORA_FASE2);
      igual(osDe(r.estado, 'OS-004').status, 'aguardando_material');
      igual(concluirOS(r.estado, 'OS-004', { fotoDepois: false, horas: 1 }, 'zelador', AGORA_FASE2).erro, 'Anexe a foto do depois');
      igual(concluirOS(r.estado, 'OS-004', { fotoDepois: true, horas: 0 }, 'zelador', AGORA_FASE2).erro, 'Informe as horas gastas');
      igual(validarOS(r.estado, 'OS-004', 'sindico', AGORA_FASE2).erro, 'Só OS concluídas podem ser validadas');
      r = concluirOS(r.estado, 'OS-004', { fotoDepois: true, horas: 0.5, materiais: 'Parafusos', observacoes: '' }, 'zelador', AGORA_FASE2);
      igual(validarOS(r.estado, 'OS-004', 'zelador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      igual(osDe(validarOS(r.estado, 'OS-004', 'sindico', AGORA_FASE2).estado, 'OS-004').status, 'validada');
    },
  },
  {
    nome: 'manutenção: concluir OS resolve a notificação e avisa o morador',
    rodar() {
      const r = concluirOS(estadoMan(), 'OS-003', { fotoDepois: true, horas: 2, materiais: 'Registro 3/4"', observacoes: 'Trocado' }, 'zelador', AGORA_FASE2);
      const oc = r.estado.ocorrencias.find((o) => o.id === 'OC-0039');
      igual([oc.status, oc.linha.at(-1).texto, r.notificacao.para, r.notificacao.texto], ['resolvida', 'Reparo concluído pelo zelador (fotos do antes e depois)', 'Carla Mendes', 'Seu chamado OC-0039 foi resolvido']);
    },
  },
  {
    nome: 'manutenção: alertas de OS e compras',
    rodar() {
      let e = estadoMan();
      igual(alertasManutencao(e, AGORA_FASE2).map((a) => a.texto), ['OS-002 concluída: validar', 'CP-001 aguardando aprovação: Registro de 3/4" e conexões, R$ 380,00']);
      e = abrirOS(e, { local: 'Portão', descricao: 'Portão não fecha', prioridade: 'urgente' }, 'sindico', new Date(2026, 9, 19, 7, 0)).estado;
      igual(alertasManutencao(e, AGORA_FASE2)[0].texto, 'OS-004 urgente sem início há 3 h');
    },
  },
];
