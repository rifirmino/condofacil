import { dadosIniciais, SINDICO } from '../dados.js';
import { podeReservar, areaPorId } from '../regras.js';
import { solicitarReserva, aprovarReserva, recusarReserva, cancelarReserva, registrarEncomenda, entregarEncomenda, lembrarEncomenda, publicarComunicado, marcarLido, reagir, abrirOcorrencia, avancarOcorrencia, comentarOcorrencia, arquivarOcorrencia, avaliarOcorrencia, euTambem } from '../acoes.js';
import { igual, AGORA_TESTE } from './afirmar.js';
import { configuracoes, salvarConfiguracoes } from '../configuracoes.js';
import { salvarArea, alternarArea, areasAtivas } from '../areas/acoes.js';

const PEDIDO_SALAO = { areaId: 'salao', unidade: '302', data: '2026-10-15', inicio: 13, fim: 18, convidados: [], aceiteTermo: true };

function acharPorId(lista, id) {
  return lista.find((x) => x.id === id);
}

export const CASOS_ACOES = [
  {
    nome: 'roteiro encomenda: portaria registra, morador é avisado e retira com código',
    rodar() {
      const r = registrarEncomenda(dadosIniciais(AGORA_TESTE), { unidade: '302', transportadora: 'Mercado Livre', foto: true, porteiro: 'Seu José' }, AGORA_TESTE);
      igual(r.erro, undefined);
      const nova = acharPorId(r.estado.encomendas, r.id);
      igual([r.id, nova.unidade, nova.status, nova.codigo.length], ['e8', '302', 'aguardando', 6]);
      igual([r.notificacao.canal, r.notificacao.para], ['WhatsApp', 'Ana Souza']);
      const errado = entregarEncomenda(r.estado, { id: r.id, codigo: '000000', nome: 'Ana Souza' }, AGORA_TESTE);
      igual(errado.erro, 'Código inválido');
      igual(errado.estado, r.estado);
      const ok = entregarEncomenda(r.estado, { id: r.id, codigo: nova.codigo, nome: 'Ana Souza' }, AGORA_TESTE);
      const entregue = acharPorId(ok.estado.encomendas, r.id);
      igual([entregue.status, entregue.retiradaPor], ['retirada', 'Ana Souza']);
    },
  },
  {
    nome: 'configuração: síndico desliga o QR Code e a portaria entrega sem código',
    rodar() {
      const r = registrarEncomenda(dadosIniciais(AGORA_TESTE), { unidade: '302', transportadora: 'Correios', foto: true, porteiro: 'Seu José' }, AGORA_TESTE);
      igual([configuracoes(r.estado).encomendaComQr, salvarConfiguracoes(r.estado, { encomendaComQr: false }, 'morador').erro], [true, 'Somente o síndico pode fazer isso']);
      const semQr = salvarConfiguracoes(r.estado, { encomendaComQr: false, inventada: 1 }, 'sindico').estado;
      igual(semQr.configuracoes, { encomendaComQr: false });
      const ok = entregarEncomenda(semQr, { id: r.id, codigo: '', nome: 'Ana Souza' }, AGORA_TESTE);
      igual([ok.erro, acharPorId(ok.estado.encomendas, r.id).status, entregarEncomenda(semQr, { id: r.id, codigo: '', nome: ' ' }, AGORA_TESTE).erro], [undefined, 'retirada', 'Informe quem retirou']);
    },
  },
  {
    nome: 'encomenda para unidade inexistente ou sem transportadora é recusada',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(registrarEncomenda(e, { unidade: '999', transportadora: 'Correios' }, AGORA_TESTE).erro, 'Unidade inexistente');
      igual(registrarEncomenda(e, { unidade: '302', transportadora: '' }, AGORA_TESTE).erro, 'Escolha a transportadora');
    },
  },
  {
    nome: 'lembrete de encomenda parada',
    rodar() {
      const r = lembrarEncomenda(dadosIniciais(AGORA_TESTE), 'e2', AGORA_TESTE);
      igual(acharPorId(r.estado.encomendas, 'e2').lembretes, 1);
      igual(r.notificacao.texto.includes('há 4 dias'), true);
    },
  },
  {
    nome: 'roteiro reserva: fica pendente, trava o horário e é aprovada',
    rodar() {
      const r = solicitarReserva(dadosIniciais(AGORA_TESTE), PEDIDO_SALAO, AGORA_TESTE);
      igual([r.id, acharPorId(r.estado.reservas, r.id).status, r.notificacao.para], ['r5', 'pendente', SINDICO]);
      igual(solicitarReserva(r.estado, { ...PEDIDO_SALAO, unidade: '303' }, AGORA_TESTE).erro, 'Horário já reservado');
      const ap = aprovarReserva(r.estado, 'r5');
      igual(acharPorId(ap.estado.reservas, 'r5').status, 'confirmada');
      igual([ap.notificacao.canal, ap.notificacao.para], ['WhatsApp', 'Ana Souza']);
    },
  },
  {
    nome: 'recusa exige motivo e libera o horário',
    rodar() {
      const r = solicitarReserva(dadosIniciais(AGORA_TESTE), PEDIDO_SALAO, AGORA_TESTE);
      igual(recusarReserva(r.estado, 'r5', '  ').erro, 'Escolha o motivo da recusa');
      const rec = recusarReserva(r.estado, 'r5', 'Data reservada para manutenção');
      igual([acharPorId(rec.estado.reservas, 'r5').status, acharPorId(rec.estado.reservas, 'r5').motivo], ['recusada', 'Data reservada para manutenção']);
      igual(podeReservar(rec.estado, { ...PEDIDO_SALAO, unidade: '303' }, AGORA_TESTE), { ok: true });
    },
  },
  {
    nome: 'área com aprovação automática confirma na hora',
    rodar() {
      const r = solicitarReserva(dadosIniciais(AGORA_TESTE), { ...PEDIDO_SALAO, areaId: 'quadra', data: '2026-10-09', inicio: 15, fim: 16 }, AGORA_TESTE);
      igual([acharPorId(r.estado.reservas, r.id).status, r.notificacao.para], ['confirmada', 'Ana Souza']);
    },
  },
  {
    nome: 'reserva sem aceite do termo é recusada',
    rodar() {
      igual(solicitarReserva(dadosIniciais(AGORA_TESTE), { ...PEDIDO_SALAO, aceiteTermo: false }, AGORA_TESTE).erro, 'Aceite o termo de responsabilidade');
    },
  },
  {
    nome: 'cancelar com menos de 72 h avisa multa',
    rodar() {
      const r = cancelarReserva(dadosIniciais(AGORA_TESTE), 'r2', AGORA_TESTE);
      igual([r.aviso.multa, acharPorId(r.estado.reservas, 'r2').status], [true, 'cancelada']);
      igual(r.notificacao.para, SINDICO);
    },
  },
  {
    nome: 'roteiro ocorrência: protocolo, status, avaliação e arquivamento',
    rodar() {
      const r = abrirOcorrencia(dadosIniciais(AGORA_TESTE), { categoria: 'vazamento', descricao: 'Infiltração no teto', local: 'Banheiro', unidade: '302' }, AGORA_TESTE);
      igual([r.id, r.estado.proximoProtocolo, r.notificacao.para], ['OC-0044', 45, SINDICO]);
      let e = r.estado;
      for (const status of ['em_analise', 'em_andamento', 'resolvida', 'fechada']) {
        const passo = avancarOcorrencia(e, 'OC-0044', AGORA_TESTE);
        igual(acharPorId(passo.estado.ocorrencias, 'OC-0044').status, status);
        igual(passo.notificacao.para, 'Ana Souza');
        e = passo.estado;
      }
      igual(avancarOcorrencia(e, 'OC-0044', AGORA_TESTE).erro, 'Ocorrência já está fechada');
      const av = avaliarOcorrencia(e, 'OC-0044', 5);
      igual(acharPorId(av.estado.ocorrencias, 'OC-0044').avaliacao, 5);
      const arq = arquivarOcorrencia(av.estado, 'OC-0044');
      const final = acharPorId(arq.estado.ocorrencias, 'OC-0044');
      igual([final.arquivada, final.linha.length], [true, 5]);
    },
  },
  {
    nome: 'RN07: só ocorrência fechada pode ser arquivada',
    rodar() {
      igual(arquivarOcorrencia(dadosIniciais(AGORA_TESTE), 'OC-0039').erro, 'Só ocorrências fechadas podem ser arquivadas');
    },
  },
  {
    nome: 'ocorrência sem categoria ou descrição é recusada',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(abrirOcorrencia(e, { categoria: '', descricao: 'x', unidade: '302' }, AGORA_TESTE).erro, 'Escolha o tipo e a categoria');
      igual(abrirOcorrencia(e, { categoria: 'barulho', descricao: '  ', unidade: '302' }, AGORA_TESTE).erro, 'Descreva a ocorrência');
    },
  },
  {
    nome: 'avaliação só depois de resolvida e com nota de 1 a 5',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(avaliarOcorrencia(e, 'OC-0042', 4).erro, 'A avaliação abre quando a ocorrência for resolvida');
      igual(avaliarOcorrencia(e, 'OC-0038', 0).erro, 'Escolha de 1 a 5 estrelas');
    },
  },
  {
    nome: 'comentário exige texto e entra na linha do tempo',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(comentarOcorrencia(e, 'OC-0039', '  ', AGORA_TESTE).erro, 'Escreva o comentário');
      const r = comentarOcorrencia(e, 'OC-0039', 'Peça encomendada', AGORA_TESTE);
      const ultima = acharPorId(r.estado.ocorrencias, 'OC-0039').linha.at(-1);
      igual([ultima.status, ultima.texto, ultima.autor], [null, 'Peça encomendada', 'Síndico']);
    },
  },
  {
    nome: 'eu também alterna na ocorrência pública',
    rodar() {
      const um = euTambem(dadosIniciais(AGORA_TESTE), 'OC-0040', '302');
      igual(acharPorId(um.estado.ocorrencias, 'OC-0040').eutambem.length, 8);
      const dois = euTambem(um.estado, 'OC-0040', '302');
      igual(acharPorId(dois.estado.ocorrencias, 'OC-0040').eutambem.length, 7);
      igual(euTambem(dois.estado, 'OC-0042', '302').erro, 'Ocorrência não é pública');
    },
  },
  {
    nome: 'roteiro comunicado: urgente vai também por SMS e a leitura é contada',
    rodar() {
      const r = publicarComunicado(dadosIniciais(AGORA_TESTE), { tipo: 'urgente', titulo: 'Vazamento de gás', texto: 'Evacuar o 3º andar', publico: { tipo: 'todos' }, canais: ['push'], fixado: false, anexo: null }, AGORA_TESTE);
      const c = acharPorId(r.estado.comunicados, r.id);
      igual([r.id, c.canais, c.leituras, r.notificacao.para], ['c6', ['push', 'sms'], [], '32 unidades']);
      const l1 = marcarLido(r.estado, 'c6', '302');
      const l2 = marcarLido(l1.estado, 'c6', '302');
      igual(acharPorId(l2.estado.comunicados, 'c6').leituras, ['302']);
    },
  },
  {
    nome: 'comunicado sem título, destinatário ou canal é recusado',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      const ok = { tipo: 'geral', titulo: 'Aviso', texto: 'Texto', publico: { tipo: 'todos' }, canais: ['push'], fixado: false, anexo: null };
      igual(publicarComunicado(e, { ...ok, titulo: ' ' }, AGORA_TESTE).erro, 'Informe o título');
      igual(publicarComunicado(e, { ...ok, texto: '' }, AGORA_TESTE).erro, 'Escreva o texto do comunicado');
      igual(publicarComunicado(e, { ...ok, publico: { tipo: 'unidades', valor: ['999'] } }, AGORA_TESTE).erro, 'Escolha ao menos uma unidade');
      igual(publicarComunicado(e, { ...ok, canais: [] }, AGORA_TESTE).erro, 'Escolha ao menos um canal');
    },
  },
  {
    nome: 'reação: uma por unidade, alternando',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      const util = reagir(e, 'c1', '302', 'util');
      igual(acharPorId(util.estado.comunicados, 'c1').reacoes.util.includes('302'), true);
      const desfeito = reagir(util.estado, 'c1', '302', 'util');
      igual(acharPorId(desfeito.estado.comunicados, 'c1').reacoes.util.includes('302'), false);
      const trocou = reagir(util.estado, 'c1', '302', 'duvida');
      const c = acharPorId(trocou.estado.comunicados, 'c1');
      igual([c.reacoes.util.includes('302'), c.reacoes.duvida.includes('302')], [false, true]);
    },
  },
  {
    nome: 'áreas comuns: síndico cadastra, edita, vincula e desativa',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      const base = { nome: 'Espaço gourmet', tipo: 'periodo', periodos: ['tarde', 'noite'], taxa: '80', aprovacao: 'manual', antecedenciaMin: '2', antecedenciaMax: '30', limiteMes: '', capacidade: '20', itens: 'Fogão e forno', regulamento: 'Até as 22h.', vinculadas: ['salao'] };
      igual([
        salvarArea(e, base, 'morador').erro,
        salvarArea(e, { ...base, nome: ' ' }, 'sindico').erro,
        salvarArea(e, { ...base, nome: 'salão de festas' }, 'sindico').erro,
        salvarArea(e, { ...base, periodos: [] }, 'sindico').erro,
        salvarArea(e, { ...base, tipo: 'hora', horaInicio: '22', horaFim: '8' }, 'sindico').erro,
        salvarArea(e, { ...base, antecedenciaMin: '10', antecedenciaMax: '5' }, 'sindico').erro,
        salvarArea(e, { ...base, taxa: '-1' }, 'sindico').erro,
        salvarArea(e, { ...base, limiteMes: '0' }, 'sindico').erro,
      ], ['Somente o síndico pode fazer isso', 'Informe o nome da área', 'Já existe uma área com esse nome', 'Marque ao menos um período', 'Horário de funcionamento inválido: a abertura vem antes do fechamento (0 a 24 h)', 'Antecedência inválida: a máxima precisa ser maior ou igual à mínima (até 365 dias)', 'Taxa inválida: use reais inteiros, 0 para sem taxa', 'Limite por mês inválido: deixe vazio para sem limite']);
      const r = salvarArea(e, base, 'sindico');
      const nova = areaPorId(r.estado, r.id);
      igual([r.id, nova.periodos.map((p) => p.id), nova.taxa, nova.limiteMes, nova.capacidade, nova.ativa, areaPorId(r.estado, 'salao').vinculadas], ['espaco-gourmet', ['tarde', 'noite'], 80, null, 20, true, ['churrasqueira', 'espaco-gourmet']]);
      // Reserva do salão bloqueia o espaço gourmet no mesmo horário, porque dividem o espaço.
      const pedido = { areaId: 'espaco-gourmet', unidade: '302', data: '2026-10-11', inicio: 18, fim: 23, convidados: [], aceiteTermo: true };
      igual([podeReservar(r.estado, pedido, AGORA_TESTE).motivo, podeReservar(r.estado, { ...pedido, data: '2026-10-12' }, AGORA_TESTE).ok], ['Horário já reservado', true]);
      const porHora = salvarArea(r.estado, { ...base, id: r.id, tipo: 'hora', horaInicio: '9', horaFim: '21', vinculadas: [] }, 'sindico').estado;
      const editada = areaPorId(porHora, r.id);
      igual([editada.tipo, editada.horaInicio, editada.horaFim, 'periodos' in editada, areaPorId(porHora, 'salao').vinculadas, porHora.areas.length], ['hora', 9, 21, false, ['churrasqueira'], e.areas.length + 1]);
      const fora = alternarArea(porHora, r.id, 'sindico');
      igual([fora.ativa, areasAtivas(fora.estado).some((a) => a.id === r.id), podeReservar(fora.estado, { ...pedido, inicio: 10, fim: 11 }, AGORA_TESTE).motivo, alternarArea(fora.estado, r.id, 'sindico').ativa], [false, false, 'Área desativada pelo síndico', true]);
    },
  },
];
