import { dadosIniciais } from '../dados.js';
import { liberado, planoMinimo } from '../planos.js';
import { rotuloCobranca } from '../cobranca/regras.js';
import { debitosParaAcordo, simularAcordo } from '../cobranca/acordos.js';
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
];
