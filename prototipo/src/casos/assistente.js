import { dadosIniciais } from '../dados.js';
import { MANUAL_ABEL } from '../assistente/manual.js';
import { secoesManualAbel, intencaoAbel, responderAbel, saudacaoAbel } from '../assistente/regras.js';
import { contextoAbel, instrucoesAbel } from '../assistente/ia.js';
import { ferramentasAbel } from '../assistente/ferramentas.js';
import { trocarMorador } from '../vendas/acoes.js';
import { enquetePorId } from '../enquetes/regras.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

function contem(texto, trecho, contexto) {
  if (!texto.includes(trecho)) throw new Error(`${contexto}: esperado conter "${trecho}", obtido "${texto.slice(0, 160)}"`);
}
function naoContem(texto, trecho, contexto) {
  if (texto.includes(trecho)) throw new Error(`${contexto}: não deveria conter "${trecho}"`);
}

export const CASOS_ASSISTENTE = [
  {
    nome: 'assistente: manual tem as seções',
    rodar() {
      const titulos = secoesManualAbel(MANUAL_ABEL).map((s) => s.titulo);
      for (const t of ['Quem é o Sr. Abel', 'Reservas de áreas comuns', 'Encomendas', 'Financeiro do morador (taxa condominial)', 'Vendas entre moradores (feira do condomínio)', 'Planos do CondoFácil', 'Privacidade (LGPD)']) igual(titulos.includes(t), true, t);
    },
  },
  {
    nome: 'assistente: reconhece intenções',
    rodar() {
      igual(['Tenho encomenda na portaria?', 'quem está devendo condomínio?', 'Tem cheiro de gás no corredor!', 'Minhas reservas', 'quanto é meu boleto?', 'quem reservou o salão sábado?', 'Como funciona a enquete?'].map(intencaoAbel), ['encomendas', 'devedores', 'emergencia', 'reservas', 'cobranca', 'dadoTerceiro', null]);
    },
  },
  {
    nome: 'assistente: morador vê só as próprias encomendas',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const r = responderAbel(e, 'morador', 'Tenho encomenda na portaria?', AGORA_FASE2);
      contem(r.texto, 'Você tem 2 encomenda(s)', 'Ana');
      contem(r.texto, '481203', 'código da Ana');
      naoContem(r.texto, '219884', 'código do 504');
      igual(r.links.map((l) => l.tela), ['mais']);
    },
  },
  {
    nome: 'assistente: privacidade da inadimplência por perfil',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const morador = responderAbel(e, 'morador', 'Quem está devendo?', AGORA_FASE2);
      contem(morador.texto, 'privada', 'morador');
      naoContem(morador.texto, '704', 'morador');
      const sindico = responderAbel(e, 'sindico', 'Quem está inadimplente?', AGORA_FASE2);
      contem(sindico.texto, '**704**', 'síndico');
      contem(sindico.texto, '**202**', 'síndico');
      igual(responderAbel(e, 'portaria', 'quem deve condomínio?', AGORA_FASE2).texto.includes('privada'), true, 'portaria');
    },
  },
  {
    nome: 'assistente: emergência vem antes de tudo',
    rodar() {
      const r = responderAbel(dadosIniciais(AGORA_FASE2), 'morador', 'Socorro, tem fumaça no 5º andar', AGORA_FASE2);
      contem(r.texto, '193', 'bombeiros');
    },
  },
  {
    nome: 'assistente: reservas de hoje na portaria e do morador',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      contem(responderAbel(e, 'portaria', 'Reservas de hoje', AGORA_FASE2).texto, 'Churrasqueira · 13h–18h · apto 603', 'portaria');
      const ana = responderAbel(e, 'morador', 'Minhas reservas', AGORA_FASE2).texto;
      contem(ana, 'Quadra', 'Ana');
      naoContem(ana, '603', 'Ana');
    },
  },
  {
    nome: 'assistente: busca no manual e fora do tema',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      contem(responderAbel(e, 'morador', 'Como começo a vender meus doces?', AGORA_FASE2).texto, 'Vendas entre moradores', 'vendas');
      contem(responderAbel(e, 'sindico', 'Como reajusto a taxa?', AGORA_FASE2).texto, 'reajuste', 'reajuste');
      contem(responderAbel(e, 'morador', 'qual a capital da Mongólia?', AGORA_FASE2).texto, 'não sei', 'fora do tema');
      contem(saudacaoAbel(e, 'morador'), 'Ana', 'saudação');
    },
  },
  {
    nome: 'assistente IA: contexto de cada perfil respeita a privacidade',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const ana = contextoAbel(e, 'morador', AGORA_FASE2);
      contem(ana, 'Ana Souza', 'Ana');
      contem(ana, '481203', 'encomenda da Ana');
      contem(ana, 'EN-001', 'enquete pendente');
      naoContem(ana, '219884', 'encomenda do 504');
      naoContem(ana, 'Inadimplência', 'devedores');
      naoContem(ana, 'Sônia', 'autora de outra ocorrência');
      naoContem(ana, 'PI-001', 'processo do 104');
      const juliana = contextoAbel(trocarMorador(e, '104').estado, 'morador', AGORA_FASE2);
      contem(juliana, 'PI-001', 'processo da Juliana');
      naoContem(juliana, '481203', 'encomenda da Ana');
      const sindico = contextoAbel(e, 'sindico', AGORA_FASE2);
      contem(sindico, 'Inadimplência', 'síndico');
      contem(sindico, '704', 'devedor');
      const portaria = contextoAbel(e, 'portaria', AGORA_FASE2);
      naoContem(portaria, 'Inadimplência', 'portaria');
      naoContem(contextoAbel(e, 'zelador', AGORA_FASE2), 'R$', 'zelador sem valores');
      contem(instrucoesAbel(e, 'morador', AGORA_FASE2), '=== MANUAL DO SR. ABEL ===', 'instruções');
    },
  },
  {
    nome: 'assistente IA: ferramentas do morador usam as ações do app',
    rodar() {
      let estado = dadosIniciais(AGORA_FASE2);
      const feitos = [];
      const executar = (acao) => { const r = acao(estado); if (!r.erro) estado = r.estado; return r; };
      const t = Object.fromEntries(ferramentasAbel({ obterEstado: () => estado, executar, agora: () => AGORA_FASE2, aoAgir: (a) => feitos.push(a) }).map((x) => [x.name, x]));
      const agenda = t.consultar_agenda.execute({ area: 'churrasqueira', data: '2026-10-24' });
      igual([agenda.area, agenda.horarios.length > 0, JSON.stringify(agenda).includes('apto')], ['Churrasqueira', true, false]);
      const livre = agenda.horarios.find((h) => h.situacao === 'livre');
      const r = t.solicitar_reserva.execute({ area: 'churrasqueira', data: '2026-10-24', inicio: livre.inicio });
      igual([r.ok, estado.reservas.at(-1).unidade, estado.reservas.at(-1).areaId], [true, '302', 'churrasqueira']);
      let erro = null;
      try { t.solicitar_reserva.execute({ area: 'churrasqueira', data: '2026-10-24', inicio: livre.inicio }); } catch (x) { erro = x.message; }
      igual(erro, 'Horário já reservado');
      const oc = t.abrir_ocorrencia.execute({ categoria: 'iluminação', descricao: 'Lâmpada queimada no hall', local: 'Hall do 3º andar' }) ;
      igual(oc.ok, true);
      const v = t.votar_enquete.execute({ enquete: 'EN-001', opcoes: ['Às 7h'] });
      igual([v.ok, enquetePorId(estado, 'EN-001').votos['302'].opcoes, v.trocou], [true, ['o2'], false]);
      igual(t.votar_enquete.execute({ enquete: 'en-001', opcoes: ['o3'] }).trocou, true);
      erro = null;
      try { t.segunda_via.execute({}); } catch (x) { erro = x.message; }
      igual(erro, 'Nenhuma cobrança em aberto: o financeiro está em dia');
      estado = trocarMorador(estado, '104').estado;
      erro = null;
      try { t.segunda_via.execute({}); } catch (x) { erro = x.message; }
      igual(erro.startsWith('As cobranças do apto 104 vão para o responsável financeiro'), true);
      igual(feitos.length, 4);
    },
  },
  {
    nome: 'assistente: enquetes respondidas com os dados do perfil',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(['Tem enquete para eu votar?', 'Como está a enquete da academia?', 'Como funciona a enquete?'].map(intencaoAbel), ['enquetes', 'enquetes', null]);
      contem(responderAbel(e, 'morador', 'Tem enquete para eu votar?', AGORA_FASE2).texto, 'Qual horário a academia deve abrir aos domingos?', 'Ana');
      contem(responderAbel(e, 'sindico', 'Como está a enquete da academia?', AGORA_FASE2).texto, '14 de 32 responderam', 'síndico');
      contem(responderAbel(e, 'morador', 'Tem enquete para eu votar?', AGORA_FASE2).texto, 'faltam 4 dias', 'prazo');
    },
  },
];
