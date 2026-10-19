import { dadosIniciais } from '../dados.js';
import { fmtReais, fmtReaisCurto, mesExtenso, situacaoCobranca, valorAtualizado, validarParametros, proximaCompetencia, previaCompetencia, etapaRegua, pendentesDaRegua, devedores, indicadoresFinanceiros, serieReceitasDespesas, tituloSerie, podeOperar } from '../cobranca/regras.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

const HOJE_FASE2 = '2026-10-19';
const PARAMETROS_OK = { diaVencimento: 10, diaFechamento: 20, multaPct: 2, jurosPct: 1, descontoPct: 0, descontoAprovadoEm: '', formas: ['pix'], tarifa: 'condominio' };

function estadoFase2() {
  return dadosIniciais(AGORA_FASE2);
}

function cobrancaFase2(estado, unidade, competencia) {
  return estado.financeiro.cobrancas.find((c) => c.unidade === unidade && c.competencia === competencia);
}

export const CASOS_COBRANCA_REGRAS = [
  {
    nome: 'cobrança: formatação de reais',
    rodar() {
      igual([fmtReais(4835000), fmtReaisCurto(4835000), fmtReais(86500), fmtReais(-5000), fmtReais(15840), mesExtenso('2026-07')], ['R$ 48.350,00', 'R$ 48.350', 'R$ 865,00', '−R$ 50,00', 'R$ 158,40', 'julho']);
    },
  },
  {
    nome: 'cobrança: valor atualizado com multa de 2% e juros de 1% ao mês',
    rodar() {
      const e = estadoFase2();
      const p = e.financeiro.parametros;
      igual(valorAtualizado(cobrancaFase2(e, '503', '2026-10'), p, HOJE_FASE2), { total: 88490, multa: 1730, juros: 260, dias: 9 });
      igual(valorAtualizado(cobrancaFase2(e, '704', '2026-09'), p, HOJE_FASE2).juros, 1125);
      igual(valorAtualizado(cobrancaFase2(e, '202', '2026-08'), p, HOJE_FASE2).total, 90248);
      igual(valorAtualizado(cobrancaFase2(e, '302', '2026-10'), p, HOJE_FASE2), { total: 86500, multa: 0, juros: 0, dias: 0 });
      igual([situacaoCobranca(cobrancaFase2(e, '503', '2026-10'), HOJE_FASE2), situacaoCobranca(cobrancaFase2(e, '302', '2026-10'), HOJE_FASE2)], ['vencida', 'paga']);
    },
  },
  {
    nome: 'cobrança: parâmetros respeitam o Código Civil e a assembleia',
    rodar() {
      igual(validarParametros(PARAMETROS_OK), { ok: true });
      igual(validarParametros({ ...PARAMETROS_OK, multaPct: 2.5 }).motivo, 'A multa por atraso é limitada a 2% (Código Civil, art. 1.336)');
      igual(validarParametros({ ...PARAMETROS_OK, descontoPct: 5 }).motivo, 'Informe a ata ou cláusula que aprova o desconto');
      igual(validarParametros({ ...PARAMETROS_OK, descontoPct: 5, descontoAprovadoEm: 'AGO 28/03/2026' }), { ok: true });
      igual(validarParametros({ ...PARAMETROS_OK, diaVencimento: 30 }).motivo, 'Use um dia entre 1 e 28');
      igual(validarParametros({ ...PARAMETROS_OK, formas: [] }).motivo, 'Escolha ao menos uma forma de pagamento');
    },
  },
  {
    nome: 'cobrança: prévia de novembro',
    rodar() {
      const e = estadoFase2();
      const previa = previaCompetencia(e, proximaCompetencia(e.financeiro));
      const linha = (u) => previa.linhas.find((l) => l.unidade === u);
      igual([previa.competencia, previa.vencimento, previa.linhas.length, previa.linhas.filter((l) => !l.bloqueada).length], ['2026-11', '2026-11-10', 32, 31]);
      igual([linha('403').bloqueada, linha('403').motivo], [true, 'Sem responsável financeiro']);
      igual([linha('302').total, linha('801').total, linha('104').total, linha('301').total], [86500, 122800, 101500, 81500]);
      igual(linha('302').itens[2].descricao, 'Pintura da fachada (parcela 4/10)');
    },
  },
  {
    nome: 'cobrança: etapas da régua por plano',
    rodar() {
      const e = estadoFase2();
      igual(etapaRegua(cobrancaFase2(e, '704', '2026-09'), HOJE_FASE2).id, 'atraso30');
      igual(etapaRegua(cobrancaFase2(e, '302', '2026-10'), HOJE_FASE2), null);
      const resumo = (plano) => pendentesDaRegua(e, HOJE_FASE2, plano).map((p) => [p.cobranca.unidade, p.cobranca.competencia, p.etapa.id]);
      igual(resumo('intermediario'), [['202', '2026-10', 'atraso1'], ['503', '2026-10', 'atraso1'], ['704', '2026-10', 'atraso1'], ['704', '2026-09', 'atraso15'], ['202', '2026-09', 'atraso15'], ['202', '2026-08', 'atraso60'], ['304', '2026-10', 'atraso1']]);
      igual(resumo('basico'), []);
      igual(resumo('avancado')[3], ['704', '2026-09', 'atraso30']);
    },
  },
  {
    nome: 'cobrança: devedores com valor atualizado e etapa',
    rodar() {
      igual(devedores(estadoFase2(), HOJE_FASE2).map((d) => [d.unidade, d.cobrancas, d.valor, d.dias, d.etapa.id, d.responsavel.nome]), [
        ['202', 3, 268093, 70, 'atraso60', 'Helena Prado'],
        ['704', 2, 177845, 39, 'atraso30', 'Vicente Moraes'],
        ['304', 1, 29399, 9, 'atraso1', 'Otávio Reis'],
        ['503', 1, 88490, 9, 'atraso1', 'Márcio Lopes'],
      ]);
    },
  },
  {
    nome: 'cobrança: devedores marcam acordo ativo',
    rodar() {
      igual(devedores(estadoFase2(), HOJE_FASE2).map((d) => [d.unidade, d.acordo]), [['202', null], ['704', null], ['304', 'ativo'], ['503', null]]);
    },
  },
  {
    nome: 'cobrança: indicadores do dashboard',
    rodar() {
      igual(indicadoresFinanceiros(estadoFase2(), HOJE_FASE2), {
        saldo: { valor: 4835000, despesaMedia: 1909545, alerta: false },
        arrecadado: { competencia: '2026-10', recebido: 2567200, previsto: 2826700, pct: 91, alerta: false, proxima: null },
        inadimplencia: { unidades: 4, total: 32, pct: 12.5, valor: 563827, alerta: true },
        despesas: { valor: 1810000, orcado: 1790000, desvio: 1.1, alerta: false },
      });
    },
  },
  {
    nome: 'cobrança: série de 12 meses e título do gráfico',
    rodar() {
      const serie = serieReceitasDespesas(estadoFase2(), HOJE_FASE2);
      igual([serie.length, serie[11]], [12, { mes: '2026-10', receitas: 2567200, despesas: 1810000 }]);
      igual(tituloSerie(serie), 'Despesa superou a receita só em julho');
      igual(tituloSerie([{ mes: '2026-01', receitas: 10, despesas: 5 }]), 'Receita cobriu a despesa em todos os meses');
    },
  },
  {
    nome: 'cobrança: só o síndico opera',
    rodar() {
      igual([podeOperar('sindico'), podeOperar('morador'), podeOperar('portaria')], [true, false, false]);
    },
  },
];
