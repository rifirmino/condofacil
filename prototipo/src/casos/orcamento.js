import { dadosIniciais } from '../dados.js';
import { linhasDoOrcado, ordinariaDe } from '../cobranca/dados.js';
import { trocarPlano } from '../cobranca/acoes.js';
import { despesaAnual, ordinariaNecessaria, candidataDaPrevisao, simularPrevisao, resultadoComTaxaAtual, margemAtual, compararPrevisoes } from '../cobranca/orcamento.js';
import { salvarPrevisao, excluirPrevisao, gerarDocumentoPrevisao } from '../cobranca/acoes-orcamento.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

function previsaoDe(estado, id) {
  return estado.financeiro.previsoes.find((p) => p.id === id);
}

export const CASOS_ORCAMENTO = [
  {
    nome: 'orçamento: cálculo da previsão com 8% e margem de 12,5%',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const fin = e.financeiro;
      const po1 = previsaoDe(e, 'PO-001');
      igual([po1.ano, despesaAnual(po1.linhas), ordinariaNecessaria(po1.linhas, 12.5)], [2027, 23198400, 2209371]);
      igual(linhasDoOrcado(fin.orcamento, 0)[0], { categoria: 'pessoal', nome: 'Pessoal', valor: 11400000 });
      igual(candidataDaPrevisao(fin, po1).ordinaria, { A: 64923, cobertura: 97884 });
      igual(simularPrevisao(fin, po1).tipos[0].antes, 71500);
      igual(resultadoComTaxaAtual(fin, po1), 27600);
      igual(margemAtual(e, '2026-10-19'), 12.5);
      const po2 = previsaoDe(e, 'PO-002');
      igual([despesaAnual(po2.linhas), candidataDaPrevisao(fin, po2).ordinaria.A, resultadoComTaxaAtual(fin, po2) < 0], [26798400, 74998, true]);
    },
  },
  {
    nome: 'orçamento: modo fração usa o orçamento necessário',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const fin = { ...e.financeiro, composicao: { ...e.financeiro.composicao, versoes: [...e.financeiro.composicao.versoes, { id: 'CV-009', vigencia: '2026-10', modo: 'fracao', ordinaria: null, orcamento: 2212000, fundoPct: 10 }] } };
      const v = candidataDaPrevisao(fin, previsaoDe(e, 'PO-001'));
      igual([v.modo, v.orcamento, v.vigencia, ordinariaDe(fin, v, '302')], ['fracao', 2209371, '2026-11', 64922]);
    },
  },
  {
    nome: 'orçamento: salvar, salvar por cima, excluir e comparar',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const base = { ano: 2027, nome: 'Enxuta', linhas: linhasDoOrcado(e.financeiro.orcamento, 5), margemPct: 10 };
      igual(salvarPrevisao(e, { ...base, nome: ' ' }, 'sindico', AGORA_FASE2).erro, 'Informe o nome da previsão');
      igual(salvarPrevisao(e, { ...base, linhas: [...base.linhas, { categoria: null, nome: '', valor: 100 }] }, 'sindico', AGORA_FASE2).erro, 'Cada linha precisa de nome e valor');
      igual(salvarPrevisao(e, { ...base, margemPct: 51 }, 'sindico', AGORA_FASE2).erro, 'A margem de inadimplência deve ser de 0% a 50%');
      igual(salvarPrevisao(e, base, 'zelador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      igual(salvarPrevisao(trocarPlano(e, 'basico').estado, base, 'sindico', AGORA_FASE2).erro, 'Disponível no plano Intermediário');
      const r = salvarPrevisao(e, base, 'sindico', AGORA_FASE2);
      igual([r.id, r.estado.financeiro.previsoes.length], ['PO-003', 3]);
      const por = salvarPrevisao(r.estado, { ...base, id: 'PO-003', nome: 'Enxuta revisada' }, 'sindico', AGORA_FASE2);
      igual([por.id, previsaoDe(por.estado, 'PO-003').nome, por.estado.financeiro.previsoes.length], ['PO-003', 'Enxuta revisada', 3]);
      igual(excluirPrevisao(por.estado, 'PO-003', 'sindico').estado.financeiro.previsoes.length, 2);
      const c = compararPrevisoes(e.financeiro, previsaoDe(e, 'PO-001'), previsaoDe(e, 'PO-002'));
      igual(c.linhas.at(-1), { nome: 'Obra do telhado', a: 0, b: 3600000 });
      igual([c.total.b - c.total.a, c.tipos[0].tipo, c.tipos[0].b > c.tipos[0].a], [3600000, 'A', true]);
    },
  },
  {
    nome: 'orçamento: documento para a AGO cria e depois versiona',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(gerarDocumentoPrevisao(e, 'PO-009', 'sindico', AGORA_FASE2).erro, 'Salve a previsão antes de gerar o documento');
      const r = gerarDocumentoPrevisao(e, 'PO-001', 'sindico', AGORA_FASE2);
      const doc = r.estado.documentos.find((d) => d.id === r.id);
      igual([r.id, doc.pasta, doc.titulo, doc.visibilidade, previsaoDe(r.estado, 'PO-001').documento], ['d9', 'Previsão orçamentária', 'Previsão orçamentária 2027 · Proposta do síndico', 'todos', 'd9']);
      const r2 = gerarDocumentoPrevisao(r.estado, 'PO-001', 'sindico', AGORA_FASE2);
      igual([r2.versao, r2.estado.documentos.length, r2.estado.documentos.find((d) => d.id === 'd9').versoes.length], [2, e.documentos.length + 1, 2]);
    },
  },
];
