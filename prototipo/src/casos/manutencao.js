import { dadosIniciais } from '../dados.js';
import { alertasManutencao, listaOS, cotacoesMinimas } from '../manutencao/regras.js';
import { gerarOS, abrirOS, iniciarOS, pausarOS, concluirOS, validarOS, solicitarCompra, anexarCotacao, aprovarCompra, recusarCompra, receberCompra, gastoCaixa, reporCaixa } from '../manutencao/acoes.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

function estadoMan() {
  return dadosIniciais(AGORA_FASE2);
}

function compraDe(e, id) {
  return e.manutencao.compras.find((x) => x.id === id);
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
  {
    nome: 'compras: solicitação, recusa e aprovação',
    rodar() {
      const e = estadoMan();
      igual(solicitarCompra(e, { item: '', quantidade: 1, valorEstimado: 100 }, 'zelador', AGORA_FASE2).erro, 'Informe item, quantidade e valor');
      const s = solicitarCompra(e, { item: 'Bomba reserva', quantidade: 1, valorEstimado: 250000, categoria: 'manutencao' }, 'zelador', AGORA_FASE2);
      igual(s.id, 'CP-003');
      igual(aprovarCompra(s.estado, 'CP-003', 'zelador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      igual(recusarCompra(s.estado, 'CP-003', '', 'sindico', AGORA_FASE2).erro, 'Informe o motivo da recusa');
      igual(compraDe(recusarCompra(s.estado, 'CP-003', 'Fora do orçamento', 'sindico', AGORA_FASE2).estado, 'CP-003').status, 'recusada');
      igual(compraDe(aprovarCompra(s.estado, 'CP-003', 'sindico', AGORA_FASE2).estado, 'CP-003').status, 'aprovada');
    },
  },
  {
    nome: 'compras: cotações mínimas no Avançado',
    rodar() {
      const e = { ...estadoMan(), plano: 'avancado' };
      igual([cotacoesMinimas(50000).minimo, cotacoesMinimas(50001).minimo, cotacoesMinimas(200001).minimo], [1, 2, 3]);
      let s = solicitarCompra(e, { item: 'Bomba reserva', quantidade: 1, valorEstimado: 250000, categoria: 'manutencao', cotacoes: [{ fornecedor: 'A', valor: 250000 }] }, 'zelador', AGORA_FASE2);
      igual(aprovarCompra(s.estado, 'CP-003', 'sindico', AGORA_FASE2).erro, 'Anexe 3 cotações para compras acima de R$ 2.000,00');
      s = anexarCotacao(s.estado, 'CP-003', { fornecedor: 'B', valor: 240000 }, 'sindico', AGORA_FASE2);
      s = anexarCotacao(s.estado, 'CP-003', { fornecedor: 'C', valor: 260000 }, 'zelador', AGORA_FASE2);
      igual(compraDe(aprovarCompra(s.estado, 'CP-003', 'sindico', AGORA_FASE2).estado, 'CP-003').status, 'aprovada');
      igual(aprovarCompra(estadoMan(), 'CP-001', 'sindico', AGORA_FASE2).erro, undefined);
    },
  },
  {
    nome: 'compras: recebimento com nota lança a despesa',
    rodar() {
      const a = aprovarCompra(estadoMan(), 'CP-001', 'sindico', AGORA_FASE2).estado;
      igual(receberCompra(a, 'CP-001', { valorFinal: 39000, nota: '' }, 'zelador', AGORA_FASE2).erro, 'Anexe a nota fiscal (obrigatória acima de R$ 200,00)');
      igual(receberCompra(estadoMan(), 'CP-001', { valorFinal: 39000, nota: 'n.pdf' }, 'zelador', AGORA_FASE2).erro, 'Só compras aprovadas podem ser recebidas');
      const r = receberCompra(a, 'CP-001', { valorFinal: 39000, nota: 'nota-CP-001.pdf' }, 'zelador', AGORA_FASE2);
      igual([compraDe(r.estado, 'CP-001').status, r.estado.financeiro.despesasMes.manutencao, r.estado.financeiro.saldo, r.estado.financeiro.auditoria.at(-1).acao], ['recebida', 269000, 4796000, 'Compra lançada']);
    },
  },
  {
    nome: 'caixa pequeno: cupom, limite, saldo e reposição',
    rodar() {
      const e = { ...estadoMan(), plano: 'avancado' };
      igual(gastoCaixa(estadoMan(), { descricao: 'x', valor: 1000, cupom: true }, 'zelador', AGORA_FASE2).erro, 'Disponível no plano Avançado');
      igual(gastoCaixa(e, { descricao: 'Fusíveis', valor: 1000, cupom: false }, 'zelador', AGORA_FASE2).erro, 'Anexe a foto do cupom');
      igual(gastoCaixa(e, { descricao: 'Fusíveis', valor: 20001, cupom: true }, 'zelador', AGORA_FASE2).erro, 'Gasto acima de R$ 200,00: faça uma compra');
      const g = gastoCaixa(e, { descricao: 'Fusíveis', valor: 2500, cupom: true }, 'zelador', AGORA_FASE2);
      igual(g.estado.manutencao.caixa.saldo, 21450);
      const sem = gastoCaixa(g.estado, { descricao: 'Ferramentas', valor: 19000, cupom: true }, 'zelador', AGORA_FASE2).estado;
      igual(sem.manutencao.caixa.saldo, 2450);
      igual(gastoCaixa(sem, { descricao: 'x', valor: 3000, cupom: true }, 'zelador', AGORA_FASE2).erro, 'Saldo do caixa pequeno insuficiente');
      igual(reporCaixa(sem, 'zelador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      const r = reporCaixa(sem, 'sindico', AGORA_FASE2);
      igual([r.estado.manutencao.caixa.saldo, r.estado.financeiro.despesasMes.manutencao, r.estado.financeiro.saldo, r.estado.manutencao.caixa.reposicoes[0].valor], [30000, 257550, 4807450, 27550]);
    },
  },
];
