import { dadosIniciais } from '../dados.js';
import { previaCompetencia } from '../cobranca/regras.js';
import { editarItemPrevia, trocarPlano } from '../cobranca/acoes.js';
import { infracaoPorId, situacaoInfracao, podeDecidir, alertasInfracoes, infracoesDaUnidade } from '../infracoes/regras.js';
import { abrirProcesso, apresentarDefesa, encerrarPrazo, decidirProcesso } from '../infracoes/acoes.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

const MULTA_503 = { unidade: '503', tipo: 'multa', artigo: 'Art. 18 (obras só em dias úteis)', fato: 'Obra no domingo às 8h', valor: 15000, prazoDias: 10 };
const DEPOIS_DO_PRAZO = new Date(2026, 9, 30, 10, 0);

function itensDaPrevia(estado, unidade) {
  return previaCompetencia(estado, '2026-11').linhas.find((l) => l.unidade === unidade).itens;
}

function defesaJuliana(estado, extra = {}) {
  return apresentarDefesa(estado, 'PI-001', { unidade: '104', autor: 'Juliana Costa', texto: 'Era aniversário e encerramos às 22h30.', anexo: 'convite.pdf', ...extra }, AGORA_FASE2);
}

export const CASOS_INFRACOES = [
  {
    nome: 'multas: semente PI-001 aguardando defesa do 104',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const p = infracaoPorId(e, 'PI-001');
      igual([p.unidade, p.tipo, p.valor, p.prazoAte, p.situacao, e.proximaInfracao], ['104', 'multa', 20000, '2026-10-29', 'defesa', 2]);
      igual(e.ocorrencias.find((o) => o.id === 'OC-0041').processos, ['PI-001']);
      igual([infracoesDaUnidade(e, '104').length, infracoesDaUnidade(e, '302').length], [1, 0]);
      igual(alertasInfracoes(e, '2026-10-19'), []);
      igual(situacaoInfracao(p, '2026-10-30'), 'analise');
    },
  },
  {
    nome: 'multas: abertura valida e não revela o denunciante',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(abrirProcesso(e, 'OC-0039', MULTA_503, 'sindico', AGORA_FASE2).erro, 'Processo só vale para irregularidades');
      igual(abrirProcesso(e, 'OC-0043', MULTA_503, 'zelador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      igual(abrirProcesso(e, 'OC-0043', { ...MULTA_503, unidade: '999' }, 'sindico', AGORA_FASE2).erro, 'Informe a unidade infratora');
      igual(abrirProcesso(e, 'OC-0043', { ...MULTA_503, artigo: ' ' }, 'sindico', AGORA_FASE2).erro, 'Informe o artigo do regimento');
      igual(abrirProcesso(e, 'OC-0043', { ...MULTA_503, valor: 0 }, 'sindico', AGORA_FASE2).erro, 'Informe o valor da multa');
      igual(abrirProcesso(e, 'OC-0043', { ...MULTA_503, prazoDias: 4 }, 'sindico', AGORA_FASE2).erro, 'O prazo de defesa deve ser de 5 a 30 dias');
      igual(abrirProcesso(e, 'OC-0043', { ...MULTA_503, tipo: 'advertencia', valor: 0 }, 'sindico', AGORA_FASE2).erro, undefined);
      igual(abrirProcesso(trocarPlano(e, 'basico').estado, 'OC-0043', MULTA_503, 'sindico', AGORA_FASE2).erro, 'Disponível no plano Intermediário');
      const r = abrirProcesso(e, 'OC-0043', MULTA_503, 'sindico', AGORA_FASE2);
      igual([r.id, r.notificacao.para.includes('Apto 503') || r.notificacao.para.length > 0], ['PI-002', true]);
      igual([r.notificacao.texto.includes('Sônia'), r.notificacao.texto.includes('702'), r.notificacao.texto.includes('OC-0043')], [false, false, false]);
      igual(r.notificacao.texto, 'Notificação formal do condomínio (PI-002): Obra no domingo às 8h. Art. 18 (obras só em dias úteis). Multa de R$ 150,00. Defesa até 29/10/2026.');
      igual(r.estado.ocorrencias.find((o) => o.id === 'OC-0043').linha.at(-1).texto, 'Processo PI-002 aberto: multa ao apto 503');
      igual(abrirProcesso(r.estado, 'OC-0043', MULTA_503, 'sindico', AGORA_FASE2).erro, 'Já existe um processo aberto para esta unidade nesta notificação');
    },
  },
  {
    nome: 'multas: defesa só da unidade, uma vez e dentro do prazo',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(apresentarDefesa(e, 'PI-001', { unidade: '302', autor: 'Ana Souza', texto: 'x' }, AGORA_FASE2).erro, 'Só moradores do apto 104 podem apresentar defesa');
      igual(defesaJuliana(e, { texto: ' ' }).erro, 'Escreva a sua defesa');
      igual(apresentarDefesa(e, 'PI-001', { unidade: '104', autor: 'Juliana Costa', texto: 'x' }, DEPOIS_DO_PRAZO).erro, 'O prazo de defesa terminou');
      const r = defesaJuliana(e);
      const p = infracaoPorId(r.estado, 'PI-001');
      igual([p.situacao, p.defesa.anexo, r.notificacao.para], ['analise', 'convite.pdf', 'Síndico']);
      igual(defesaJuliana(r.estado).erro, 'A defesa já foi apresentada');
      igual(alertasInfracoes(r.estado, '2026-10-19').map((a) => a.texto), ['PI-001: defesa recebida, decida']);
    },
  },
  {
    nome: 'multas: fim do prazo e decisão',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(decidirProcesso(e, 'PI-001', { resultado: 'mantida', justificativa: 'x' }, 'sindico', AGORA_FASE2).erro, 'Aguarde a defesa ou o fim do prazo');
      const fim = encerrarPrazo(e, 'PI-001', 'sindico', AGORA_FASE2).estado;
      igual([podeDecidir(infracaoPorId(fim, 'PI-001'), '2026-10-19'), encerrarPrazo(fim, 'PI-001', 'sindico', AGORA_FASE2).erro], [true, 'Só processos aguardando defesa']);
      igual(alertasInfracoes(fim, '2026-10-19').map((a) => a.texto), ['PI-001: prazo de defesa encerrado, decida']);
      igual(decidirProcesso(fim, 'PI-001', { resultado: 'mantida', justificativa: ' ' }, 'sindico', AGORA_FASE2).erro, 'Informe a justificativa da decisão');
      const m = decidirProcesso(fim, 'PI-001', { resultado: 'mantida', justificativa: 'Sem defesa no prazo' }, 'sindico', AGORA_FASE2);
      const multa = itensDaPrevia(m.estado, '104').find((i) => i.tipo === 'multa');
      igual([multa.descricao.startsWith('Multa por infração PI-001'), multa.valor, infracaoPorId(m.estado, 'PI-001').lancamento], [true, 20000, '2026-11']);
      igual(m.notificacao.texto, 'Decisão do processo PI-001: mantida. Multa de R$ 200,00 no boleto de novembro de 2026.');
      igual(decidirProcesso(m.estado, 'PI-001', { resultado: 'cancelada', justificativa: 'x' }, 'sindico', AGORA_FASE2).erro, 'O processo já foi decidido');
      igual(m.estado.ocorrencias.find((o) => o.id === 'OC-0041').linha.at(-1).texto, 'Decisão do processo PI-001: mantida');
      const c = decidirProcesso(defesaJuliana(e).estado, 'PI-001', { resultado: 'convertida', justificativa: 'Primeira ocorrência' }, 'sindico', AGORA_FASE2);
      igual([itensDaPrevia(c.estado, '104').some((i) => i.tipo === 'multa'), infracaoPorId(c.estado, 'PI-001').lancamento], [false, null]);
      const adv = abrirProcesso(e, 'OC-0043', { ...MULTA_503, tipo: 'advertencia', valor: 0 }, 'sindico', AGORA_FASE2).estado;
      const advFim = encerrarPrazo(adv, 'PI-002', 'sindico', AGORA_FASE2).estado;
      igual(decidirProcesso(advFim, 'PI-002', { resultado: 'convertida', justificativa: 'x' }, 'sindico', AGORA_FASE2).erro, 'Só multas podem ser convertidas em advertência');
    },
  },
  {
    nome: 'multas: lançamento respeita ajuste manual da prévia',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const ajustado = editarItemPrevia(e, '2026-11', '104', [{ tipo: 'ordinaria', descricao: 'Taxa ordinária', valor: 65000 }]).estado;
      const fim = encerrarPrazo(ajustado, 'PI-001', 'sindico', AGORA_FASE2).estado;
      const m = decidirProcesso(fim, 'PI-001', { resultado: 'mantida', justificativa: 'Sem defesa' }, 'sindico', AGORA_FASE2).estado;
      igual(itensDaPrevia(m, '104').map((i) => i.tipo), ['ordinaria', 'multa']);
    },
  },
];
