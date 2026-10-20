import { dadosIniciais, CATEGORIAS } from '../dados.js';
import { liberado } from '../planos.js';
import { slaVencido } from '../regras.js';
import { prazosVencidos, textoAtraso, caixaDeEntrada, parecidas, alertasNotificacoes, indicadorAtendimento, urgentesAbertas } from '../notificacoes/regras.js';
import { abrirOcorrencia, euTambem } from '../acoes.js';
import { definirPrioridade, pedirInformacao, gerarAdvertencia, arquivarComJustificativa } from '../notificacoes/acoes.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

function estadoNotif() {
  return dadosIniciais(AGORA_FASE2);
}

function ocDe(e, id) {
  return e.ocorrencias.find((o) => o.id === id);
}

export const CASOS_NOTIFICACOES = [
  {
    nome: 'notificações: categorias por tipo com prioridade padrão',
    rodar() {
      igual([CATEGORIAS.vazamento.tipo, CATEGORIAS.vazamento.prioridade, CATEGORIAS.obra.tipo, CATEGORIAS.elogio.tipo, CATEGORIAS.jardim.prioridade], ['manutencao', 'urgente', 'irregularidade', 'outro', 'baixa']);
      igual(Object.keys(CATEGORIAS).length, 18);
      igual([liberado('basico', 'notificacoesPrazo'), liberado('intermediario', 'notificacoesPrazo'), liberado('intermediario', 'indicadorAtendimento'), liberado('avancado', 'caixaPequeno')], [false, true, false, true]);
    },
  },
  {
    nome: 'notificações: seed remapeado e OC-0043',
    rodar() {
      const e = estadoNotif();
      igual(e.ocorrencias.map((o) => [o.id, o.categoria, o.prioridade]).sort(), [
        ['OC-0037', 'eletrica', 'alta'], ['OC-0038', 'elogio', 'baixa'], ['OC-0039', 'vazamento', 'urgente'], ['OC-0040', 'elevador', 'alta'],
        ['OC-0041', 'barulho', 'normal'], ['OC-0042', 'vaga', 'normal'], ['OC-0043', 'obra', 'normal'],
      ]);
      igual([e.proximoProtocolo, e.versao], [44, 6]);
    },
  },
  {
    nome: 'notificações: prazos de 1ª resposta e de solução',
    rodar() {
      const e = estadoNotif();
      igual(prazosVencidos(ocDe(e, 'OC-0042'), AGORA_FASE2), { resposta: 27, solucao: null });
      igual(prazosVencidos(ocDe(e, 'OC-0039'), AGORA_FASE2), { resposta: null, solucao: 50 });
      igual(prazosVencidos(ocDe(e, 'OC-0041'), AGORA_FASE2), { resposta: null, solucao: null });
      igual([textoAtraso(27), textoAtraso(50), textoAtraso(1)], ['27 h', '2 dias', '1 h']);
      igual([slaVencido(ocDe(e, 'OC-0042'), AGORA_FASE2), slaVencido(ocDe(e, 'OC-0039'), AGORA_FASE2), slaVencido(ocDe(e, 'OC-0038'), AGORA_FASE2)], [true, true, false]);
    },
  },
  {
    nome: 'notificações: caixa de entrada por prioridade e prazo',
    rodar() {
      const e = estadoNotif();
      igual(caixaDeEntrada(e, AGORA_FASE2, { status: 'ativas' }).map((o) => o.id), ['OC-0039', 'OC-0040', 'OC-0042', 'OC-0043', 'OC-0041']);
      igual(caixaDeEntrada(e, AGORA_FASE2, { status: 'ativas', tipo: 'irregularidade' }).map((o) => o.id), ['OC-0042', 'OC-0043', 'OC-0041']);
      igual(caixaDeEntrada(e, AGORA_FASE2, { status: 'todas', prioridade: 'alta' }).map((o) => o.id), ['OC-0040', 'OC-0037']);
    },
  },
  {
    nome: 'notificações: parecidas, alertas, urgentes e atendimento',
    rodar() {
      const e = estadoNotif();
      igual(parecidas(e, 'vazamento', '302').map((o) => o.id), ['OC-0039']);
      igual(parecidas(e, 'vazamento', '101'), []);
      igual(alertasNotificacoes(e, AGORA_FASE2).map((a) => a.texto), ['OC-0039: solução vencida há 2 dias', 'OC-0042: 1ª resposta vencida há 27 h']);
      igual(urgentesAbertas(e).map((o) => o.id), ['OC-0039']);
      igual(indicadorAtendimento(e), { abertas: 5, noPrazo: 1, comPrazo: 1, pct: 100, alerta: false });
    },
  },
  {
    nome: 'notificações: abertura grava prioridade e exige categoria',
    rodar() {
      const e = estadoNotif();
      igual(abrirOcorrencia(e, { categoria: '', descricao: 'x', unidade: '302' }, AGORA_FASE2).erro, 'Escolha o tipo e a categoria');
      const r = abrirOcorrencia(e, { categoria: 'vazamento', descricao: 'Água descendo pela parede', local: 'Hall do 3º', unidade: '302' }, AGORA_FASE2);
      igual([r.id, ocDe(r.estado, r.id).prioridade], ['OC-0044', 'urgente']);
      igual(ocDe(euTambem(e, 'OC-0039', '302').estado, 'OC-0039').eutambem, ['302']);
    },
  },
  {
    nome: 'notificações: prioridade e pedido de informação contam como resposta',
    rodar() {
      const e = estadoNotif();
      igual(definirPrioridade(e, 'OC-0042', 'alta', 'morador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      igual(definirPrioridade({ ...e, plano: 'basico' }, 'OC-0042', 'alta', 'sindico', AGORA_FASE2).erro, 'Disponível no plano Intermediário');
      igual(ocDe(definirPrioridade(e, 'OC-0042', 'alta', 'sindico', AGORA_FASE2).estado, 'OC-0042').prioridade, 'alta');
      const r = pedirInformacao(e, 'OC-0042', 'Qual a placa do carro?', 'sindico', AGORA_FASE2);
      igual([ocDe(r.estado, 'OC-0042').status, prazosVencidos(ocDe(r.estado, 'OC-0042'), AGORA_FASE2).resposta], ['em_analise', null]);
    },
  },
  {
    nome: 'notificações: advertência só para irregularidade e sem expor o denunciante',
    rodar() {
      const e = estadoNotif();
      igual(gerarAdvertencia(e, 'OC-0039', '503', 'sindico', AGORA_FASE2).erro, 'Advertência só vale para irregularidades');
      igual(gerarAdvertencia(e, 'OC-0043', '', 'sindico', AGORA_FASE2).erro, 'Informe a unidade advertida');
      const r = gerarAdvertencia(e, 'OC-0043', '503', 'sindico', AGORA_FASE2);
      igual([ocDe(r.estado, 'OC-0043').advertencia.unidade, r.notificacao.para], ['503', 'Apto 503']);
      igual([r.notificacao.texto.includes('702'), r.notificacao.texto.includes('Sônia')], [false, false]);
      igual(ocDe(r.estado, 'OC-0043').linha.at(-1).texto, 'Advertência enviada ao apto 503');
    },
  },
  {
    nome: 'notificações: arquivar exige motivo',
    rodar() {
      const e = estadoNotif();
      igual(arquivarComJustificativa(e, 'OC-0041', ' ', 'sindico', AGORA_FASE2).erro, 'Informe o motivo do arquivamento');
      const r = arquivarComJustificativa(e, 'OC-0041', 'Duplicada da OC-0043', 'sindico', AGORA_FASE2);
      igual([ocDe(r.estado, 'OC-0041').arquivada, ocDe(r.estado, 'OC-0041').motivoArquivamento], [true, 'Duplicada da OC-0043']);
    },
  },
];
