import { CATEGORIAS } from '../dados.js';
import { liberado } from '../planos.js';
import { trocarItem, nomesDaUnidade } from '../acoes.js';
import { isoDia, somarDias, fmtDataCurta, nomeMes } from '../datas.js';
import { fmtReais } from '../cobranca/regras.js';
import { primeiraNaoEmitida } from '../cobranca/composicao.js';
import { NOMES_TIPO_INFRACAO, NOMES_RESULTADO_INFRACAO, infracaoPorId, prazoVencido, podeDecidir } from './regras.js';

// Ações do processo de infração. O infrator vê só o fato descrito pelo síndico, nunca a notificação original.
const SO_SINDICO_INFRACAO = 'Somente o síndico pode fazer isso';

function erroInfracao(estado, mensagem) {
  return { estado, erro: mensagem };
}

function guardaInfracao(estado, perfil) {
  if (perfil !== 'sindico') return SO_SINDICO_INFRACAO;
  if (!liberado(estado.plano, 'multasDefesa')) return 'Disponível no plano Intermediário';
  return null;
}

function comEntradaInfracao(estado, id, mudanca, texto, autor, agora) {
  const p = infracaoPorId(estado, id);
  return { ...estado, infracoes: trocarItem(estado.infracoes, id, { ...mudanca, linha: [...p.linha, { em: agora.toISOString(), texto, autor }] }) };
}

function comEntradaNaOcorrencia(estado, ocId, texto, agora, mudanca = {}) {
  const oc = estado.ocorrencias.find((o) => o.id === ocId);
  return { ...estado, ocorrencias: trocarItem(estado.ocorrencias, ocId, { ...mudanca, linha: [...oc.linha, { em: agora.toISOString(), status: null, texto, autor: 'Síndico' }] }) };
}

export function abrirProcesso(estado, ocId, dados, perfil, agora) {
  const falha = guardaInfracao(estado, perfil);
  if (falha) return erroInfracao(estado, falha);
  const oc = estado.ocorrencias.find((o) => o.id === ocId);
  if (!oc) return erroInfracao(estado, 'Ocorrência não encontrada');
  if (CATEGORIAS[oc.categoria].tipo !== 'irregularidade') return erroInfracao(estado, 'Processo só vale para irregularidades');
  const unidade = String(dados.unidade || '').trim();
  if (!estado.condominio.unidades.includes(unidade)) return erroInfracao(estado, 'Informe a unidade infratora');
  const tipo = dados.tipo === 'advertencia' ? 'advertencia' : 'multa';
  const artigo = String(dados.artigo || '').trim();
  if (!artigo) return erroInfracao(estado, 'Informe o artigo do regimento');
  const fato = String(dados.fato || '').trim();
  if (!fato) return erroInfracao(estado, 'Descreva o fato');
  if (tipo === 'multa' && !(dados.valor > 0)) return erroInfracao(estado, 'Informe o valor da multa');
  const prazoDias = Number(dados.prazoDias);
  if (!Number.isInteger(prazoDias) || prazoDias < 5 || prazoDias > 30) return erroInfracao(estado, 'O prazo de defesa deve ser de 5 a 30 dias');
  if (estado.infracoes.some((p) => p.ocorrencia === ocId && p.unidade === unidade && p.situacao !== 'decidido')) return erroInfracao(estado, 'Já existe um processo aberto para esta unidade nesta notificação');
  const id = `PI-${String(estado.proximaInfracao).padStart(3, '0')}`;
  const prazoAte = somarDias(isoDia(agora), prazoDias);
  const nome = NOMES_TIPO_INFRACAO[tipo];
  const processo = {
    id, ocorrencia: ocId, unidade, tipo, artigo, fato, valor: tipo === 'multa' ? Math.round(dados.valor) : null, prazoDias,
    abertoEm: agora.toISOString(), prazoAte, situacao: 'defesa', defesa: null, prazoEncerrado: false, decisao: null, lancamento: null,
    linha: [{ em: agora.toISOString(), texto: `${nome} aberta com base no ${artigo}. Prazo de defesa até ${fmtDataCurta(prazoAte)}`, autor: 'Síndico' }],
  };
  const novo = comEntradaNaOcorrencia({ ...estado, infracoes: [...estado.infracoes, processo], proximaInfracao: estado.proximaInfracao + 1 }, ocId, `Processo ${id} aberto: ${nome.toLowerCase()} ao apto ${unidade}`, agora, { processos: [...(oc.processos || []), id] });
  return {
    estado: novo,
    id,
    notificacao: { canal: 'App + e-mail', para: nomesDaUnidade(estado, unidade), texto: `Notificação formal do condomínio (${id}): ${fato}. ${artigo}.${processo.valor ? ` Multa de ${fmtReais(processo.valor)}.` : ''} Defesa até ${fmtDataCurta(prazoAte)}.` },
  };
}

export function apresentarDefesa(estado, id, { unidade, autor, texto, anexo }, agora) {
  const p = infracaoPorId(estado, id);
  if (!p) return erroInfracao(estado, 'Processo não encontrado');
  if (unidade !== p.unidade) return erroInfracao(estado, `Só moradores do apto ${p.unidade} podem apresentar defesa`);
  if (p.situacao === 'decidido') return erroInfracao(estado, 'O processo já foi decidido');
  if (p.defesa) return erroInfracao(estado, 'A defesa já foi apresentada');
  if (prazoVencido(p, isoDia(agora))) return erroInfracao(estado, 'O prazo de defesa terminou');
  const escrita = String(texto || '').trim();
  if (!escrita) return erroInfracao(estado, 'Escreva a sua defesa');
  const defesa = { texto: escrita, anexo: anexo || null, autor, em: agora.toISOString() };
  return {
    estado: comEntradaInfracao(estado, id, { defesa, situacao: 'analise' }, `Defesa apresentada${anexo ? ' com anexo' : ''}`, autor, agora),
    notificacao: { canal: 'Painel do síndico', para: 'Síndico', texto: `${id}: defesa apresentada pelo apto ${p.unidade}` },
  };
}

export function encerrarPrazo(estado, id, perfil, agora) {
  const falha = guardaInfracao(estado, perfil);
  if (falha) return erroInfracao(estado, falha);
  const p = infracaoPorId(estado, id);
  if (!p || p.situacao !== 'defesa' || p.defesa) return erroInfracao(estado, 'Só processos aguardando defesa');
  return { estado: comEntradaInfracao(estado, id, { prazoEncerrado: true, situacao: 'analise' }, 'Prazo de defesa encerrado sem defesa', 'Síndico', agora) };
}

export function decidirProcesso(estado, id, { resultado, justificativa }, perfil, agora) {
  const falha = guardaInfracao(estado, perfil);
  if (falha) return erroInfracao(estado, falha);
  const p = infracaoPorId(estado, id);
  if (!p) return erroInfracao(estado, 'Processo não encontrado');
  if (p.situacao === 'decidido') return erroInfracao(estado, 'O processo já foi decidido');
  if (!podeDecidir(p, isoDia(agora))) return erroInfracao(estado, 'Aguarde a defesa ou o fim do prazo');
  if (!NOMES_RESULTADO_INFRACAO[resultado]) return erroInfracao(estado, 'Escolha a decisão');
  if (resultado === 'convertida' && p.tipo !== 'multa') return erroInfracao(estado, 'Só multas podem ser convertidas em advertência');
  const motivo = String(justificativa || '').trim();
  if (!motivo) return erroInfracao(estado, 'Informe a justificativa da decisão');
  const lanca = resultado === 'mantida' && p.tipo === 'multa';
  let novo = estado;
  let lancamento = null;
  if (lanca) {
    const fin = estado.financeiro;
    lancamento = primeiraNaoEmitida(fin);
    const item = { tipo: 'multa', descricao: `Multa por infração ${id} (${p.artigo})`, valor: p.valor };
    const ajuste = fin.ajustesPrevia[lancamento] && fin.ajustesPrevia[lancamento][p.unidade];
    const ajustesPrevia = ajuste ? { ...fin.ajustesPrevia, [lancamento]: { ...fin.ajustesPrevia[lancamento], [p.unidade]: [...ajuste, item] } } : fin.ajustesPrevia;
    novo = { ...estado, financeiro: { ...fin, avulsos: [...fin.avulsos, { unidade: p.unidade, competencia: lancamento, ...item }], ajustesPrevia } };
  }
  const texto = `Decisão: ${NOMES_RESULTADO_INFRACAO[resultado].toLowerCase()}. ${motivo}${lanca ? `. Multa de ${fmtReais(p.valor)} no boleto de ${nomeMes(lancamento)}` : ''}`;
  novo = comEntradaInfracao(novo, id, { situacao: 'decidido', decisao: { resultado, justificativa: motivo, em: agora.toISOString() }, lancamento }, texto, 'Síndico', agora);
  novo = comEntradaNaOcorrencia(novo, p.ocorrencia, `Decisão do processo ${id}: ${NOMES_RESULTADO_INFRACAO[resultado].toLowerCase()}`, agora);
  return {
    estado: novo,
    notificacao: { canal: 'App + e-mail', para: nomesDaUnidade(estado, p.unidade), texto: `Decisão do processo ${id}: ${NOMES_RESULTADO_INFRACAO[resultado].toLowerCase()}.${lanca ? ` Multa de ${fmtReais(p.valor)} no boleto de ${nomeMes(lancamento)}.` : ''}` },
  };
}

// Semente: multa aguardando defesa para o apto 104 (Juliana), aberta pela própria ação como faria o síndico.
export function comInfracaoInicial(estado, agora) {
  const abertura = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 10);
  const r = abrirProcesso(estado, 'OC-0041', { unidade: '104', tipo: 'multa', artigo: 'Art. 12 do regimento interno (silêncio depois das 22h)', fato: 'Música alta depois das 22h na unidade, registrada na noite anterior', valor: 20000, prazoDias: 10 }, 'sindico', abertura);
  return r.erro ? estado : r.estado;
}
