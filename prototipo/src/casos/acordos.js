import { dadosIniciais } from '../dados.js';
import { liberado, planoMinimo } from '../planos.js';
import { rotuloCobranca, devedores } from '../cobranca/regras.js';
import { debitosParaAcordo, simularAcordo, proporAcordo, cancelarProposta, marcarTermoLido, aceitarAcordo, alertasAcordos, acordoDaUnidade, cobrancasDoAcordo, progressoAcordo } from '../cobranca/acordos.js';
import { confirmarPagamentoAsaas, baixaManual } from '../cobranca/acoes.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

const HOJE_ACORDO = '2026-10-19';
const SET_704 = 'CB-2026-09-704';
const OUT_704 = 'CB-2026-10-704';

function estadoAcordo() {
  return dadosIniciais(AGORA_FASE2);
}

function simular704(mudanca = {}) {
  return simularAcordo(estadoAcordo(), { unidade: '704', originais: [SET_704, OUT_704], perdoaMulta: false, jurosPerdoadosPct: 0, entrada: 0, parcelas: 3, ...mudanca }, HOJE_ACORDO);
}

export const CASOS_ACORDOS = [
  {
    nome: 'acordos: rótulo das cobranças',
    rodar() {
      igual(rotuloCobranca({ competencia: '2026-09', acordo: null }), 'setembro de 2026');
      igual(rotuloCobranca({ competencia: '2026-10', acordo: { id: 'AC-001', numero: 2, de: 4 } }), 'Acordo AC-001 · parcela 2/4');
      igual(rotuloCobranca({ competencia: '2026-08', acordo: { id: 'AC-001', numero: 0, de: 4 } }), 'Acordo AC-001 · entrada');
    },
  },
  {
    nome: 'acordos: recursos por plano',
    rodar() {
      igual([liberado('basico', 'acordos'), liberado('intermediario', 'acordos'), liberado('intermediario', 'termoConfissao'), liberado('avancado', 'termoConfissao')], [false, true, false, true]);
      igual(planoMinimo('acordos').nome, 'Intermediário');
    },
  },
  {
    nome: 'acordos: débitos vencidos disponíveis por unidade',
    rodar() {
      const e = estadoAcordo();
      igual(debitosParaAcordo(e, '704', HOJE_ACORDO).map((c) => c.id), [OUT_704, SET_704]);
      igual(debitosParaAcordo(e, '302', HOJE_ACORDO), []);
    },
  },
  {
    nome: 'acordos: simulação sem desconto, com resto na última parcela',
    rodar() {
      igual(simular704(), { ok: true, valorOriginal: 173000, multa: 3460, juros: 1385, desconto: 0, total: 177845, valorParcela: 59281, ultimaParcela: 59283, cronograma: [
        { numero: 1, vencimento: '2026-11-10', valor: 59281 },
        { numero: 2, vencimento: '2026-12-10', valor: 59281 },
        { numero: 3, vencimento: '2027-01-10', valor: 59283 },
      ] });
    },
  },
  {
    nome: 'acordos: simulação com perdão da multa, metade dos juros e entrada',
    rodar() {
      const s = simular704({ perdoaMulta: true, jurosPerdoadosPct: 50, entrada: 30000 });
      igual([s.desconto, s.total, s.valorParcela, s.ultimaParcela], [4153, 173692, 47897, 47898]);
      igual(s.cronograma, [
        { numero: 0, vencimento: '2026-10-22', valor: 30000 },
        { numero: 1, vencimento: '2026-11-10', valor: 47897 },
        { numero: 2, vencimento: '2026-12-10', valor: 47897 },
        { numero: 3, vencimento: '2027-01-10', valor: 47898 },
      ]);
    },
  },
  {
    nome: 'acordos: validações da simulação',
    rodar() {
      const e = estadoAcordo();
      igual(simularAcordo(e, { unidade: '302', originais: ['CB-2026-10-302'], parcelas: 3 }, HOJE_ACORDO).motivo, 'Esta unidade não tem débitos vencidos');
      igual(simular704({ originais: [] }).motivo, 'Escolha ao menos um débito');
      igual(simular704({ originais: ['CB-2026-10-503'] }).motivo, 'Escolha só débitos vencidos desta unidade');
      igual(simular704({ jurosPerdoadosPct: 120 }).motivo, 'Informe um perdão de juros entre 0% e 100%');
      igual([simular704({ parcelas: 0 }).motivo, simular704({ parcelas: 13 }).motivo], ['Escolha de 1 a 12 parcelas', 'Escolha de 1 a 12 parcelas']);
      igual([simular704({ entrada: 177845 }).motivo, simular704({ entrada: -1 }).motivo], ['A entrada precisa ser menor que o total do acordo', 'A entrada precisa ser menor que o total do acordo']);
      igual(simular704({ originais: [OUT_704], entrada: 85000, parcelas: 12 }).motivo, 'Cada parcela precisa ter no mínimo R$ 50,00');
    },
  },
  {
    nome: 'acordos: proposta só pelo síndico, com auditoria do desconto',
    rodar() {
      const e = estadoAcordo();
      const dados = { unidade: '704', originais: [SET_704, OUT_704], perdoaMulta: true, jurosPerdoadosPct: 0, entrada: 30000, parcelas: 3 };
      igual(proporAcordo(e, dados, 'morador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      igual(proporAcordo({ ...e, plano: 'basico' }, dados, 'sindico', AGORA_FASE2).erro, 'Disponível no plano Intermediário');
      const r = proporAcordo(e, dados, 'sindico', AGORA_FASE2);
      const a = r.estado.financeiro.acordos.find((x) => x.id === r.id);
      igual([r.id, a.situacao, a.total, a.desconto, r.notificacao.texto], ['AC-002', 'aguardando', 174385, 3460, 'Proposta AC-002 enviada a Vicente Moraes']);
      igual(r.estado.financeiro.cobrancas.filter((c) => [SET_704, OUT_704].includes(c.id)).map((c) => c.status), ['aberta', 'aberta']);
      igual(r.estado.financeiro.auditoria.slice(-2).map((x) => x.acao), ['Proposta de acordo', 'Desconto em acordo']);
      igual(acordoDaUnidade(r.estado, '704'), 'aguardando');
      igual(alertasAcordos(r.estado, HOJE_ACORDO).map((x) => x.texto).includes('Proposta AC-002 aguarda aceite de Vicente Moraes'), true);
      igual(simularAcordo(r.estado, { ...dados, originais: [SET_704] }, HOJE_ACORDO).motivo, 'Este débito já está no acordo AC-002');
    },
  },
  {
    nome: 'acordos: cancelar proposta libera os débitos',
    rodar() {
      const r = proporAcordo(estadoAcordo(), { unidade: '704', originais: [SET_704], entrada: 0, parcelas: 2 }, 'sindico', AGORA_FASE2);
      igual(cancelarProposta(r.estado, 'AC-002', 'morador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      const c = cancelarProposta(r.estado, 'AC-002', 'sindico', AGORA_FASE2);
      igual([c.estado.financeiro.acordos.find((x) => x.id === 'AC-002').situacao, debitosParaAcordo(c.estado, '704', HOJE_ACORDO).length], ['cancelado', 2]);
      igual(cancelarProposta(c.estado, 'AC-002', 'sindico', AGORA_FASE2).erro, 'Só propostas aguardando aceite podem ser canceladas');
    },
  },
  {
    nome: 'acordos: aceite cancela as originais e cria entrada e parcelas',
    rodar() {
      const p = proporAcordo(estadoAcordo(), { unidade: '704', originais: [SET_704, OUT_704], perdoaMulta: true, entrada: 30000, parcelas: 3 }, 'sindico', AGORA_FASE2).estado;
      igual(aceitarAcordo(p, 'AC-002', { quem: 'Ana Souza', ciente: true }, AGORA_FASE2).erro, 'Só o responsável financeiro pode aceitar o acordo');
      igual(aceitarAcordo(p, 'AC-002', { quem: 'Vicente Moraes', ciente: false }, AGORA_FASE2).erro, 'Marque que leu e aceita as condições');
      igual(aceitarAcordo({ ...p, plano: 'basico' }, 'AC-002', { quem: 'Vicente Moraes', ciente: true }, AGORA_FASE2).erro, 'Disponível no plano Intermediário');
      const r = aceitarAcordo(p, 'AC-002', { quem: 'Vicente Moraes', ciente: true }, AGORA_FASE2);
      const fin = r.estado.financeiro;
      igual(fin.cobrancas.filter((c) => [SET_704, OUT_704].includes(c.id)).map((c) => [c.status, c.substituidaPor]), [['cancelada', 'AC-002'], ['cancelada', 'AC-002']]);
      igual(cobrancasDoAcordo(r.estado, 'AC-002').map((c) => [c.id, c.vencimento, c.valor, c.itens[0].descricao]), [
        ['AC-002-E', '2026-10-22', 30000, 'Acordo AC-002 · entrada'],
        ['AC-002-P1', '2026-11-10', 48128, 'Acordo AC-002 · parcela 1/3'],
        ['AC-002-P2', '2026-12-10', 48128, 'Acordo AC-002 · parcela 2/3'],
        ['AC-002-P3', '2027-01-10', 48129, 'Acordo AC-002 · parcela 3/3'],
      ]);
      igual([fin.acordos.find((a) => a.id === 'AC-002').situacao, fin.acordos.find((a) => a.id === 'AC-002').aceitoPor, r.notificacao.texto], ['ativo', 'Vicente Moraes', 'Acordo AC-002 aceito. A entrada vence em 22/10/2026.']);
      igual(devedores(r.estado, HOJE_ACORDO).some((d) => d.unidade === '704'), false);
      igual(aceitarAcordo(r.estado, 'AC-002', { quem: 'Vicente Moraes', ciente: true }, AGORA_FASE2).erro, 'Esta proposta não está aguardando aceite');
    },
  },
  {
    nome: 'acordos: termo de confissão obrigatório no Avançado',
    rodar() {
      const avancado = { ...estadoAcordo(), plano: 'avancado' };
      const p = proporAcordo(avancado, { unidade: '704', originais: [OUT_704], entrada: 0, parcelas: 2 }, 'sindico', AGORA_FASE2).estado;
      igual(aceitarAcordo(p, 'AC-002', { quem: 'Vicente Moraes', ciente: true }, AGORA_FASE2).erro, 'Leia o termo de confissão antes de aceitar');
      const lido = marcarTermoLido(p, 'AC-002', AGORA_FASE2).estado;
      igual(aceitarAcordo(lido, 'AC-002', { quem: 'Vicente Moraes', ciente: true }, AGORA_FASE2).estado.financeiro.acordos.find((a) => a.id === 'AC-002').situacao, 'ativo');
    },
  },
  {
    nome: 'acordos: pagar a última parcela quita o acordo',
    rodar() {
      const p = proporAcordo(estadoAcordo(), { unidade: '704', originais: [OUT_704], entrada: 0, parcelas: 1 }, 'sindico', AGORA_FASE2).estado;
      const a = aceitarAcordo(p, 'AC-002', { quem: 'Vicente Moraes', ciente: true }, AGORA_FASE2).estado;
      const r = confirmarPagamentoAsaas(a, 'AC-002-P1', 'evt-q', 'pix', AGORA_FASE2);
      igual([r.estado.financeiro.acordos.find((x) => x.id === 'AC-002').situacao, r.notificacao.texto.endsWith('· acordo AC-002 quitado')], ['quitado', true]);
    },
  },
  {
    nome: 'acordos: AC-001 da 304 com parcela 2 vencida',
    rodar() {
      const e = estadoAcordo();
      const a = e.financeiro.acordos[0];
      igual([a.id, a.unidade, a.situacao, a.valorOriginal, a.multa, a.juros, a.desconto, a.total, a.entrada, a.parcelas, a.valorParcela, a.aceitoPor], ['AC-001', '304', 'ativo', 143000, 2860, 1955, 2860, 144955, 30000, 4, 28738, 'Otávio Reis']);
      igual(e.financeiro.cobrancas.filter((c) => ['CB-2026-06-304', 'CB-2026-07-304'].includes(c.id)).map((c) => [c.status, c.substituidaPor]), [['cancelada', 'AC-001'], ['cancelada', 'AC-001']]);
      igual(cobrancasDoAcordo(e, 'AC-001').map((c) => [c.id, c.vencimento, c.valor, c.status]), [
        ['AC-001-E', '2026-08-08', 30000, 'paga'],
        ['AC-001-P1', '2026-09-10', 28738, 'paga'],
        ['AC-001-P2', '2026-10-10', 28738, 'aberta'],
        ['AC-001-P3', '2026-11-10', 28738, 'aberta'],
        ['AC-001-P4', '2026-12-10', 28741, 'aberta'],
      ]);
      igual(cobrancasDoAcordo(e, 'AC-001')[2].regua.map((r) => r.etapa), ['antes5', 'vencimento']);
      igual([e.financeiro.saldo, progressoAcordo(e, a).pagas, progressoAcordo(e, a).total, progressoAcordo(e, a).proxima.id], [4835000, 1, 4, 'AC-001-P2']);
      igual(alertasAcordos(e, HOJE_ACORDO).map((x) => x.texto), ['Acordo AC-001 (304): parcela 2 vencida']);
      igual(e.financeiro.auditoria.map((x) => x.acao), ['Proposta de acordo', 'Desconto em acordo', 'Acordo aceito']);
    },
  },
  {
    nome: 'acordos: baixa manual das últimas parcelas quita o AC-001',
    rodar() {
      let e = estadoAcordo();
      for (const id of ['AC-001-P2', 'AC-001-P3', 'AC-001-P4']) e = baixaManual(e, id, { data: HOJE_ACORDO, comprovante: 'c.pdf' }, 'sindico', AGORA_FASE2).estado;
      igual([e.financeiro.acordos[0].situacao, acordoDaUnidade(e, '304')], ['quitado', null]);
    },
  },
];
