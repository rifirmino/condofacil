import { dadosIniciais } from '../dados.js';
import { versaoEm, parcelaDe, ordinariaDe } from '../cobranca/dados.js';
import { previaCompetencia } from '../cobranca/regras.js';
import { editarItemPrevia } from '../cobranca/acoes.js';
import { montarVersao, simularComposicao, mudancasDaUnidade, alertasComposicao, primeiraNaoEmitida, versoesAgendadas } from '../cobranca/composicao.js';
import { novaComposicao, cancelarComposicao, criarTaxaExtra, encerrarTaxaExtra } from '../cobranca/acoes-composicao.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

const ATA_TESTE = 'AGE de 15/10/2026';

function itensDe(estado, competencia, unidade) {
  return previaCompetencia(estado, competencia).linhas.find((l) => l.unidade === unidade).itens;
}

function reajuste6(estado, extra = {}) {
  return novaComposicao(estado, { vigencia: '2026-11', forma: 'percentual', pct: 6, aprovadoEm: ATA_TESTE, ...extra }, 'sindico', AGORA_FASE2);
}

export const CASOS_COMPOSICAO = [
  {
    nome: 'taxas: semente mantém os valores e as versões',
    rodar() {
      const fin = dadosIniciais(AGORA_FASE2).financeiro;
      igual(fin.cobrancas.find((c) => c.id === 'CB-2026-10-302').valor, 86500);
      igual([versaoEm(fin, '2026-05').id, versaoEm(fin, '2025-04').id, primeiraNaoEmitida(fin)], ['CV-002', 'CV-001', '2026-11']);
      igual(parcelaDe(fin.composicao.extras[0], '2026-10'), 3);
      const soma = Object.values(fin.unidades).reduce((s, u) => s + u.fracao, 0);
      igual(soma > 0.99999 && soma < 1.00001, true);
    },
  },
  {
    nome: 'taxas: montar versão por percentual, vigência e fração ideal',
    rodar() {
      const fin = dadosIniciais(AGORA_FASE2).financeiro;
      igual(montarVersao(fin, { vigencia: '2026-11', forma: 'percentual', pct: 6 }).versao.ordinaria, { A: 68900, cobertura: 103880 });
      igual(montarVersao(fin, { vigencia: '2026-10', forma: 'percentual', pct: 6 }).erro, 'A vigência deve ser a partir de novembro de 2026');
      igual(montarVersao(fin, { vigencia: '2026-11', forma: 'percentual', pct: '' }).erro, 'Informe um percentual ou valores válidos');
      igual(montarVersao(fin, { vigencia: '2026-11', modo: 'fracao', forma: 'percentual', pct: 5 }).erro, 'Ao trocar o modo, informe os valores');
      igual(montarVersao(fin, { vigencia: '2026-11', forma: 'percentual', pct: 5, fundoPct: 31 }).erro, 'O fundo de reserva deve ser de 0% a 30%');
      const v = montarVersao(fin, { vigencia: '2026-11', modo: 'fracao', forma: 'valores', orcamento: 2212000 }).versao;
      igual([ordinariaDe(fin, v, '302'), ordinariaDe(fin, v, '801')], [65000, 98000]);
    },
  },
  {
    nome: 'taxas: simulação, mudanças da unidade e alerta',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const v = montarVersao(e.financeiro, { vigencia: '2026-11', forma: 'percentual', pct: 6 }).versao;
      const s = simularComposicao(e.financeiro, v);
      igual([s.tipos[0].antes, s.tipos[0].depois, s.arrecadacaoAntes], [71500, 75790, 28 * 71500 + 4 * 107800]);
      const r = reajuste6(e).estado;
      const linhas = mudancasDaUnidade(r, '302', '2026-10-19');
      igual(linhas.length, 2);
      igual(linhas[0].texto, 'A partir de novembro de 2026: de R$ 715,00 para R$ 757,90 (+6,0%)');
      igual(linhas[1].texto.startsWith('Pintura da fachada: R$ 150,00 por mês em 10 parcelas'), true);
      igual(alertasComposicao(r).map((a) => a.texto), ['Reajuste agendado para novembro de 2026 · confira a prévia antes de emitir']);
    },
  },
  {
    nome: 'taxas: reajuste agendado, comunicado e meses já emitidos',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(novaComposicao(e, { vigencia: '2026-11', forma: 'percentual', pct: 6 }, 'sindico', AGORA_FASE2).erro, 'Informe a ata ou data da assembleia');
      igual(novaComposicao(e, { vigencia: '2026-11', forma: 'percentual', pct: 6, aprovadoEm: ATA_TESTE }, 'zelador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      const r = reajuste6(e);
      igual([r.id, r.notificacao.para, r.desfeitos], ['CV-003', '31 responsáveis', 0]);
      igual(itensDe(r.estado, '2026-11', '302')[0].valor, 68900);
      igual(r.estado.financeiro.cobrancas.find((c) => c.id === 'CB-2026-10-302').valor, 86500);
      igual(r.estado.comunicados.at(-1).titulo, 'Reajuste da taxa condominial a partir de novembro de 2026');
      igual(reajuste6(e, { publicar: false }).estado.comunicados.length, e.comunicados.length);
      const outra = novaComposicao(r.estado, { vigencia: '2026-11', forma: 'percentual', pct: 4, aprovadoEm: ATA_TESTE }, 'sindico', AGORA_FASE2).estado;
      igual(versoesAgendadas(outra.financeiro).map((v) => [v.id, v.ordinaria.A]), [['CV-004', 67600]]);
    },
  },
  {
    nome: 'taxas: ajustes manuais desfeitos e cancelamento',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const ajustado = editarItemPrevia(e, '2026-11', '302', [{ tipo: 'ordinaria', descricao: 'Taxa ordinária', valor: 1 }]).estado;
      const r = reajuste6(ajustado);
      igual([r.desfeitos, r.estado.financeiro.ajustesPrevia['2026-11']], [1, undefined]);
      const c = cancelarComposicao(r.estado, 'CV-003', 'sindico', AGORA_FASE2);
      igual([versoesAgendadas(c.estado.financeiro).length, itensDe(c.estado, '2026-11', '302')[0].valor], [0, 65000]);
      igual(cancelarComposicao(r.estado, 'CV-002', 'sindico', AGORA_FASE2).erro, 'Esta competência já foi emitida');
    },
  },
  {
    nome: 'taxas: taxa extra por fração ideal e encerramento',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const dados = { descricao: 'Troca dos elevadores', total: 3000000, parcelas: 12, inicio: '2026-12', rateio: 'fracao', aprovadoEm: ATA_TESTE };
      igual(criarTaxaExtra(e, { ...dados, parcelas: 61 }, 'sindico', AGORA_FASE2).erro, 'As parcelas devem ser de 1 a 60');
      igual(criarTaxaExtra(e, { ...dados, inicio: '2026-10' }, 'sindico', AGORA_FASE2).erro, 'O início deve ser a partir de novembro de 2026');
      const r = criarTaxaExtra(e, dados, 'sindico', AGORA_FASE2);
      igual([r.id, r.estado.comunicados.at(-1).titulo], ['TX-002', 'Taxa extra: Troca dos elevadores']);
      const extras = itensDe(r.estado, '2026-12', '302').filter((i) => i.tipo === 'extra');
      igual(extras.map((i) => [i.descricao, i.valor]), [['Pintura da fachada (parcela 5/10)', 15000], ['Troca dos elevadores (parcela 1/12)', Math.round(250000 * 0.029385)]]);
      igual(itensDe(r.estado, '2026-11', '302').filter((i) => i.tipo === 'extra').length, 1);
      const enc = encerrarTaxaExtra(r.estado, 'TX-001', 'AGE de 15/10/2026, item 2', 'sindico', AGORA_FASE2);
      const tx1 = enc.estado.financeiro.composicao.extras[0];
      igual([tx1.situacao, tx1.ultimaCompetencia], ['encerrada', '2026-10']);
      igual(itensDe(enc.estado, '2026-11', '302').filter((i) => i.tipo === 'extra').length, 0);
      igual(enc.estado.financeiro.cobrancas.find((c) => c.id === 'CB-2026-10-302').valor, 86500);
      igual(encerrarTaxaExtra(enc.estado, 'TX-001', 'x', 'sindico', AGORA_FASE2).erro, 'Só taxas ativas podem ser encerradas');
      igual(encerrarTaxaExtra(enc.estado, 'TX-002', '', 'sindico', AGORA_FASE2).erro, 'Informe a ata ou o motivo');
      const tx2 = encerrarTaxaExtra(enc.estado, 'TX-002', 'Cancelada na AGE', 'sindico', AGORA_FASE2).estado;
      igual(tx2.financeiro.composicao.extras[1].ultimaCompetencia, null);
      igual(mudancasDaUnidade(tx2, '302', '2026-10-19').map((l) => l.texto), ['A taxa Pintura da fachada foi encerrada; a última parcela foi a de outubro de 2026', 'A taxa Troca dos elevadores foi cancelada antes da primeira parcela']);
    },
  },
];
