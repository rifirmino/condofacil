import { dadosIniciais } from '../dados.js';
import { previaCompetencia, devedores, indicadoresFinanceiros } from '../cobranca/regras.js';
import { salvarParametros, editarItemPrevia, emitirCompetencia, confirmarPagamentoAsaas, baixaManual, cancelarEReemitir, enviarSegundaVia, executarRegua, trocarPlano } from '../cobranca/acoes.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

const HOJE_ACOES = '2026-10-19';

function cobrancaPorId(estado, id) {
  return estado.financeiro.cobrancas.find((c) => c.id === id);
}

function comNovembroEmitido() {
  return emitirCompetencia(dadosIniciais(AGORA_FASE2), '2026-11', 'sindico', AGORA_FASE2).estado;
}

export const CASOS_COBRANCA_ACOES = [
  {
    nome: 'cobrança: emissão em lote de novembro',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(emitirCompetencia(e, '2026-11', 'morador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      igual(emitirCompetencia(e, '2026-10', 'sindico', AGORA_FASE2).erro, 'Competência já emitida');
      const r = emitirCompetencia(e, '2026-11', 'sindico', AGORA_FASE2);
      igual([r.emitidas, r.notificacao.para, r.estado.financeiro.cobrancas.filter((c) => c.competencia === '2026-11').length], [31, '31 responsáveis', 31]);
      igual(cobrancaPorId(r.estado, 'CB-2026-11-302').valor, 86500);
      igual(cobrancaPorId(r.estado, 'CB-2026-11-403'), undefined);
      igual(indicadoresFinanceiros(r.estado, HOJE_ACOES).arrecadado.proxima, { competencia: '2026-11', pagas: 0, total: 31 });
      igual(r.estado.financeiro.auditoria[0].acao, 'Emissão em lote');
    },
  },
  {
    nome: 'cobrança: confirmação do Asaas é idempotente',
    rodar() {
      const e = comNovembroEmitido();
      const um = confirmarPagamentoAsaas(e, 'CB-2026-11-302', 'evt-1', 'pix', AGORA_FASE2);
      const c = cobrancaPorId(um.estado, 'CB-2026-11-302');
      igual([c.status, c.valorPago, c.forma, um.estado.financeiro.saldo, um.notificacao.para], ['paga', 86500, 'pix', 4921500, 'Ana Souza']);
      const repetido = confirmarPagamentoAsaas(um.estado, 'CB-2026-11-302', 'evt-1', 'pix', AGORA_FASE2);
      igual(repetido.estado, um.estado);
      igual(repetido.notificacao, undefined);
      igual(confirmarPagamentoAsaas(um.estado, 'CB-2026-11-302', 'evt-2', 'pix', AGORA_FASE2).erro, 'Cobrança não está em aberto');
    },
  },
  {
    nome: 'cobrança: pagamento em atraso recebe o valor atualizado',
    rodar() {
      const r = confirmarPagamentoAsaas(dadosIniciais(AGORA_FASE2), 'CB-2026-10-503', 'evt-9', 'boleto', AGORA_FASE2);
      igual(cobrancaPorId(r.estado, 'CB-2026-10-503').valorPago, 88490);
    },
  },
  {
    nome: 'cobrança: baixa manual exige comprovante e fica na auditoria',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(baixaManual(e, 'CB-2026-10-503', { data: HOJE_ACOES, comprovante: '' }, 'sindico', AGORA_FASE2).erro, 'Anexe o comprovante');
      igual(baixaManual(e, 'CB-2026-10-503', { data: HOJE_ACOES, comprovante: 'x.pdf' }, 'morador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      const r = baixaManual(e, 'CB-2026-10-503', { data: HOJE_ACOES, comprovante: 'comprovante-503.pdf' }, 'sindico', AGORA_FASE2);
      const c = cobrancaPorId(r.estado, 'CB-2026-10-503');
      igual([c.status, c.forma, c.baixaManual.comprovante, devedores(r.estado, HOJE_ACOES).length], ['paga', 'manual', 'comprovante-503.pdf', 2]);
      igual(r.estado.financeiro.auditoria.at(-1).acao, 'Baixa manual');
    },
  },
  {
    nome: 'cobrança: régua de hoje envia uma vez por etapa',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const r = executarRegua(e, AGORA_FASE2);
      igual([r.resumo.length, r.notificacao.para], [6, '3 responsáveis']);
      igual(cobrancaPorId(r.estado, 'CB-2026-10-503').regua.map((x) => x.etapa), ['antes5', 'vencimento', 'atraso1']);
      const deNovo = executarRegua(r.estado, AGORA_FASE2);
      igual([deNovo.resumo, deNovo.notificacao], [[], undefined]);
      igual(executarRegua({ ...e, plano: 'basico' }, AGORA_FASE2).resumo, []);
    },
  },
  {
    nome: 'cobrança: cancelar e reemitir guarda o histórico',
    rodar() {
      const r = cancelarEReemitir(dadosIniciais(AGORA_FASE2), 'CB-2026-10-503', 'sindico', AGORA_FASE2);
      igual([cobrancaPorId(r.estado, 'CB-2026-10-503').status, r.id, cobrancaPorId(r.estado, r.id).substituiu, cobrancaPorId(r.estado, r.id).status], ['cancelada', 'CB-2026-10-503-R1', 'CB-2026-10-503', 'aberta']);
      igual(devedores(r.estado, HOJE_ACOES).length, 3);
    },
  },
  {
    nome: 'cobrança: ajuste da prévia antes de emitir',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const itens = previaCompetencia(e, '2026-11').linhas.find((l) => l.unidade === '302').itens.filter((i) => i.tipo !== 'fundo');
      const r = editarItemPrevia(e, '2026-11', '302', itens);
      igual(previaCompetencia(r.estado, '2026-11').linhas.find((l) => l.unidade === '302').total, 80000);
      igual(editarItemPrevia(e, '2026-11', '302', [{ tipo: 'avulso', descricao: ' ', valor: 100 }]).erro, 'Preencha descrição e valor de cada item');
      igual(editarItemPrevia(comNovembroEmitido(), '2026-11', '302', itens).erro, 'Competência já emitida');
    },
  },
  {
    nome: 'cobrança: parâmetros, 2ª via e plano',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(salvarParametros(e, { ...e.financeiro.parametros, multaPct: 3 }, 'sindico', AGORA_FASE2).erro, 'A multa por atraso é limitada a 2% (Código Civil, art. 1.336)');
      igual(salvarParametros(e, { ...e.financeiro.parametros, jurosPct: 0.5 }, 'sindico', AGORA_FASE2).estado.financeiro.parametros.jurosPct, 0.5);
      igual(enviarSegundaVia(e, 'CB-2026-10-503', AGORA_FASE2).notificacao.texto.includes('R$ 884,90'), true);
      igual(trocarPlano(e, 'premium').erro, 'Plano inexistente');
      igual(trocarPlano(e, 'basico').estado.plano, 'basico');
    },
  },
];
