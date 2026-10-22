import { dadosIniciais } from '../dados.js';
import { trocarPlano } from '../cobranca/acoes.js';
import { enquetePorId, situacaoEnquete, diasRestantes, faltantes, apuracao, textoResultado, evolucao, proximoLembreteAuto, enquetesPendentes, enquetesDaUnidade, alertasEnquetes } from '../enquetes/regras.js';
import { salvarEnquete, publicarEnquete, votar, enviarLembrete, encerrarEnquete, prorrogarEnquete, publicarResultado } from '../enquetes/acoes.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

const NOVA = { pergunta: 'Quais melhorias no salão de festas?', opcoes: ['Ar-condicionado', 'Som ambiente', 'Novas cadeiras'], dias: 7, publico: { tipo: 'todos' }, tipo: 'multipla', maxEscolhas: 2, comentarios: true, secreto: false };
const DEPOIS = new Date(2026, 9, 24, 9, 0);

function votoAna(estado, id, opcoes, extra = {}) {
  return votar(estado, id, { unidade: '302', autor: 'Ana Souza', opcoes, ...extra }, AGORA_FASE2);
}

export const CASOS_ENQUETES = [
  {
    nome: 'enquetes: semente com aberta, encerrada e rascunho',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const en1 = enquetePorId(e, 'EN-001');
      igual(e.enquetes.map((x) => situacaoEnquete(x, AGORA_FASE2)), ['aberta', 'encerrada', 'rascunho']);
      igual([diasRestantes(en1, AGORA_FASE2), faltantes(e, en1).length, faltantes(e, en1).some((f) => f.unidade === '302')], [4, 18, true]);
      const a1 = apuracao(e, en1);
      igual([a1.participantes, a1.opcoes.map((o) => o.votos), textoResultado(e, en1)], [14, [4, 7, 3], 'Vencedora: Às 7h (50%)']);
      igual(textoResultado(e, enquetePorId(e, 'EN-002')), 'Vencedora: Cinza claro (55% por fração ideal)');
      igual(apuracao(e, enquetePorId(e, 'EN-002')).quorumAtingido, true);
      igual([enquetesPendentes(e, '302', AGORA_FASE2).map((x) => x.id), enquetesPendentes(e, '104', AGORA_FASE2).length], [['EN-001'], 0]);
      igual(enquetesDaUnidade(e, '302', AGORA_FASE2).encerradas.map((x) => x.id), ['EN-002']);
      const ev = evolucao(en1, AGORA_FASE2);
      igual([ev[0].dia, ev.at(-1).dia, ev.at(-1).total], ['2026-10-16', '2026-10-19', 14]);
      igual(proximoLembreteAuto(en1, AGORA_FASE2), new Date(2026, 9, 20, 9, 0).toISOString());
      igual(alertasEnquetes(e, AGORA_FASE2), []);
      igual(alertasEnquetes(e, new Date(2026, 9, 22, 10, 0)).map((a) => a.texto), ['Enquete "Qual horário a academia deve abrir aos domingos?": termina amanhã, 18 unidades sem resposta']);
    },
  },
  {
    nome: 'enquetes: criar, validar e publicar',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(salvarEnquete(e, { ...NOVA, pergunta: ' ' }, 'sindico', AGORA_FASE2).erro, 'Escreva a pergunta');
      igual(salvarEnquete(e, { ...NOVA, opcoes: ['Sim'] }, 'sindico', AGORA_FASE2).erro, 'Informe pelo menos 2 opções');
      igual(salvarEnquete(e, { ...NOVA, opcoes: ['Sim', 'sim'] }, 'sindico', AGORA_FASE2).erro, 'Opções repetidas');
      igual(salvarEnquete(e, { ...NOVA, dias: 61 }, 'sindico', AGORA_FASE2).erro, 'Escolha uma data limite de 1 a 60 dias');
      igual(salvarEnquete(e, NOVA, 'morador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      const r = salvarEnquete(e, NOVA, 'sindico', AGORA_FASE2);
      const en = enquetePorId(r.estado, r.id);
      igual([r.id, en.situacao, en.tipo, en.maxEscolhas, en.secreto, en.peso], ['EN-004', 'rascunho', 'multipla', 2, false, 'unidade']);
      const basico = enquetePorId(salvarEnquete(trocarPlano(e, 'basico').estado, NOVA, 'sindico', AGORA_FASE2).estado, 'EN-004');
      igual([basico.tipo, basico.comentarios, basico.secreto, basico.lembretesAuto], ['unica', false, true, false]);
      const p = publicarEnquete(r.estado, r.id, 'sindico', AGORA_FASE2);
      igual([enquetePorId(p.estado, r.id).situacao, p.notificacao.para, p.notificacao.texto], ['aberta', '32 unidades', 'Nova enquete: Quais melhorias no salão de festas? · responda até 26/10/2026']);
      igual(publicarEnquete(p.estado, r.id, 'sindico', AGORA_FASE2).erro, 'Só rascunhos podem ser publicados');
      const andar = publicarEnquete(salvarEnquete(e, { ...NOVA, publico: { tipo: 'andar', valor: '3' } }, 'sindico', AGORA_FASE2).estado, 'EN-004', 'sindico', AGORA_FASE2);
      igual(andar.notificacao.para, '4 unidades');
    },
  },
  {
    nome: 'enquetes: voto por unidade, troca, limite e prazo',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(votoAna(e, 'EN-001', []).erro, 'Escolha uma opção');
      igual(votoAna(e, 'EN-001', ['o1', 'o2']).erro, 'Escolha só uma opção');
      const v = votoAna(e, 'EN-001', ['o3'], { comentario: 'Mais tarde é melhor' });
      igual([enquetesPendentes(v.estado, '302', AGORA_FASE2).length, apuracao(v.estado, enquetePorId(v.estado, 'EN-001')).participantes, v.trocou], [0, 15, false]);
      const t = votoAna(v.estado, 'EN-001', ['o2']);
      igual([t.trocou, enquetePorId(t.estado, 'EN-001').votos['302'].opcoes, apuracao(t.estado, enquetePorId(t.estado, 'EN-001')).participantes], [true, ['o2'], 15]);
      igual(votar(e, 'EN-001', { unidade: '302', autor: 'Ana', opcoes: ['o1'] }, new Date(2026, 9, 24, 1, 0)).erro, 'A enquete está encerrada');
      igual(votoAna(e, 'EN-003', ['b1']).erro, 'Enquete não encontrada');
      const andar = publicarEnquete(salvarEnquete(e, { ...NOVA, publico: { tipo: 'andar', valor: '1' } }, 'sindico', AGORA_FASE2).estado, 'EN-004', 'sindico', AGORA_FASE2).estado;
      igual(votoAna(andar, 'EN-004', ['EN-004-o1']).erro, 'Sua unidade não faz parte do público desta enquete');
      const multi = publicarEnquete(salvarEnquete(e, NOVA, 'sindico', AGORA_FASE2).estado, 'EN-004', 'sindico', AGORA_FASE2).estado;
      igual(votoAna(multi, 'EN-004', ['EN-004-o1', 'EN-004-o2', 'EN-004-o3']).erro, 'Escolha até 2 opções');
      igual(enquetePorId(votoAna(multi, 'EN-004', ['EN-004-o1', 'EN-004-o3'], { comentario: 'Urgente o ar' }).estado, 'EN-004').votos['302'].comentario, 'Urgente o ar');
    },
  },
  {
    nome: 'enquetes: lembrete, prorrogação, encerramento e resultado',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const l = enviarLembrete(e, 'EN-001', 'sindico', AGORA_FASE2);
      igual([l.notificacao.para, l.notificacao.texto], ['18 unidades', 'Faltam 4 dias para a enquete "Qual horário a academia deve abrir aos domingos?". Sua unidade ainda não votou']);
      igual(enviarLembrete(e, 'EN-001', 'sindico', new Date(2026, 9, 23, 9, 0)).notificacao.texto.startsWith('Hoje é o último dia'), true);
      igual(enviarLembrete(trocarPlano(e, 'basico').estado, 'EN-001', 'sindico', AGORA_FASE2, true).erro, 'Disponível no plano Intermediário');
      const auto = enviarLembrete(e, 'EN-001', 'sindico', AGORA_FASE2, true).estado;
      igual(proximoLembreteAuto(enquetePorId(auto, 'EN-001'), AGORA_FASE2), new Date(2026, 9, 23, 9, 0).toISOString());
      const p = prorrogarEnquete(e, 'EN-001', 3, 'sindico', AGORA_FASE2);
      igual([diasRestantes(enquetePorId(p.estado, 'EN-001'), AGORA_FASE2), prorrogarEnquete(p.estado, 'EN-001', 2, 'sindico', AGORA_FASE2).erro], [7, 'Só é possível prorrogar uma vez']);
      igual(situacaoEnquete(enquetePorId(e, 'EN-001'), DEPOIS), 'encerrada');
      igual(alertasEnquetes(e, DEPOIS).map((a) => a.texto), ['Enquete encerrada: publique o resultado de "Qual horário a academia deve abrir aos domingos?"']);
      igual(publicarResultado(e, 'EN-001', 'sindico', AGORA_FASE2).erro, 'Encerre a enquete antes de publicar');
      const fim = encerrarEnquete(e, 'EN-001', 'sindico', AGORA_FASE2);
      igual([situacaoEnquete(enquetePorId(fim.estado, 'EN-001'), AGORA_FASE2), fim.notificacao.texto], ['encerrada', 'Enquete encerrada · Vencedora: Às 7h (50%)']);
      igual(votoAna(fim.estado, 'EN-001', ['o1']).erro, 'A enquete está encerrada');
      const res = publicarResultado(fim.estado, 'EN-001', 'sindico', AGORA_FASE2);
      const com = res.estado.comunicados.at(-1);
      const doc = res.estado.documentos.at(-1);
      igual([com.titulo, doc.pasta, doc.visibilidade, com.texto.includes('302') || com.texto.includes('Apto')], ['Resultado da enquete: Qual horário a academia deve abrir aos domingos?', 'Enquetes', 'todos', false]);
      igual(publicarResultado(res.estado, 'EN-001', 'sindico', AGORA_FASE2).erro, 'O resultado já foi publicado');
      igual(publicarResultado(trocarPlano(fim.estado, 'basico').estado, 'EN-001', 'sindico', AGORA_FASE2).erro, 'Disponível no plano Intermediário');
    },
  },
  {
    nome: 'enquetes: empate e sem quórum',
    rodar() {
      const e = trocarPlano(dadosIniciais(AGORA_FASE2), 'avancado').estado;
      let s = publicarEnquete(salvarEnquete(e, { ...NOVA, tipo: 'unica', opcoes: ['Sim', 'Não'], quorumPct: 50 }, 'sindico', AGORA_FASE2).estado, 'EN-004', 'sindico', AGORA_FASE2).estado;
      s = votar(s, 'EN-004', { unidade: '101', autor: 'Carla', opcoes: ['EN-004-o1'] }, AGORA_FASE2).estado;
      s = votar(s, 'EN-004', { unidade: '102', autor: 'Paulo', opcoes: ['EN-004-o2'] }, AGORA_FASE2).estado;
      const en = enquetePorId(s, 'EN-004');
      igual([apuracao(s, en).vencedoras.length, textoResultado(s, en)], [2, 'Sem quórum: 6% de participação, mínimo de 50%']);
      igual(textoResultado(s, { ...en, quorumPct: null }), 'Empate entre Sim e Não');
    },
  },
];
