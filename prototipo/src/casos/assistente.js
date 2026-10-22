import { dadosIniciais } from '../dados.js';
import { MANUAL_ABEL } from '../assistente/manual.js';
import { secoesManualAbel, intencaoAbel, responderAbel, saudacaoAbel } from '../assistente/regras.js';
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
];
