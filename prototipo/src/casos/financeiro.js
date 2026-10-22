import { dadosIniciais } from '../dados.js';
import { trocarPlano } from '../cobranca/acoes.js';
import { situacaoConta, contasFiltradas, alertasContas, totalAPagar } from '../financeiro/contas.js';
import { novaConta, pagarConta } from '../financeiro/acoes.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

const HOJE_FIN = '2026-10-19';

function contaDe(estado, id) {
  return estado.financeiro.contas.find((c) => c.id === id);
}

export const CASOS_FINANCEIRO = [
  {
    nome: 'financeiro: semente de contas bate com as despesas do mês',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const fin = e.financeiro;
      const pagas = fin.contas.filter((c) => c.situacao === 'paga');
      const porCategoria = {};
      for (const c of pagas) porCategoria[c.categoria] = (porCategoria[c.categoria] || 0) + c.valor;
      porCategoria.manutencao += 14500;
      igual(porCategoria, fin.despesasMes);
      igual(['CT-009', 'CT-010', 'CT-011'].map((id) => situacaoConta(contaDe(e, id), HOJE_FIN)), ['aberta', 'hoje', 'vencida']);
      igual(alertasContas(e, HOJE_FIN).map((a) => a.texto), ['Conta vencida: Dedetização trimestral (R$ 450,00)', 'Vence hoje: Gás da área gourmet (R$ 180,00)']);
      igual([contasFiltradas(e, 'vencidas', HOJE_FIN).length, contasFiltradas(e, 'pagas', HOJE_FIN).length, totalAPagar(e, HOJE_FIN)], [1, 8, 443000]);
    },
  },
  {
    nome: 'financeiro: pagar conta lança despesa, baixa saldo e gera a recorrente',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const r = pagarConta(e, 'CT-010', 'sindico', AGORA_FASE2);
      const fin = r.estado.financeiro;
      igual([contaDe(r.estado, 'CT-010').situacao, fin.despesasMes.concessionarias, fin.saldo], ['paga', 408000, e.financeiro.saldo - 18000]);
      igual([r.seguinte, contaDe(r.estado, 'CT-012').vencimento, contaDe(r.estado, 'CT-012').situacao], ['CT-012', '2026-11-19', 'aberta']);
      igual(fin.auditoria.at(-1).acao, 'Conta paga');
      igual(pagarConta(r.estado, 'CT-010', 'sindico', AGORA_FASE2).erro, 'Esta conta já foi paga');
      const d = pagarConta(e, 'CT-011', 'sindico', AGORA_FASE2);
      igual([d.seguinte, d.estado.financeiro.contas.length], [null, e.financeiro.contas.length]);
      igual(pagarConta(e, 'CT-010', 'zelador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      igual(pagarConta(trocarPlano(e, 'basico').estado, 'CT-010', 'sindico', AGORA_FASE2).erro, 'Disponível no plano Intermediário');
    },
  },
  {
    nome: 'financeiro: nova conta valida os campos',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const dados = { fornecedor: 'Pinturas Sol', categoria: 'manutencao', descricao: 'Pintura do hall', valor: 250000, vencimento: '2026-11-05', recorrente: false };
      igual(novaConta(e, { ...dados, fornecedor: ' ' }, 'sindico').erro, 'Informe o fornecedor');
      igual(novaConta(e, { ...dados, categoria: 'x' }, 'sindico').erro, 'Escolha a categoria');
      igual(novaConta(e, { ...dados, valor: 0 }, 'sindico').erro, 'Informe o valor');
      igual(novaConta(e, { ...dados, vencimento: '' }, 'sindico').erro, 'Informe o vencimento');
      const r = novaConta(e, dados, 'sindico');
      igual([r.id, contaDe(r.estado, r.id).situacao, r.estado.financeiro.proximaConta], ['CT-012', 'aberta', 13]);
    },
  },
];
