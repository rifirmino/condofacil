import { nomeMes, somarMes } from '../datas.js';
import { fimExtra, parcelaDe } from './dados.js';
import { podeOperar, fmtReais } from './regras.js';
import { SO_SINDICO, comFinanceiro, comAuditoria } from './acoes.js';
import { MSG_ATA, NOMES_TIPO_UNIDADE, montarVersao, primeiraNaoEmitida, resumoVersao, textoValoresVersao, valorPorTipoExtra, versoesAgendadas } from './composicao.js';
import { publicarComunicado } from '../acoes.js';

// Reajuste da taxa e taxas extras: só o síndico, sempre com a ata, avisando os responsáveis financeiros.
function erroTaxa(estado, mensagem) {
  return { estado, erro: mensagem };
}

function responsaveisAvisados(fin) {
  return Object.values(fin.unidades).filter((u) => u.responsavel).length;
}

// Ajustes manuais da prévia guardam a lista inteira de itens: a partir da mudança, eles ficariam com valores velhos.
function semAjustesDesde(fin, desde) {
  let desfeitos = 0;
  const ajustesPrevia = {};
  for (const [competencia, porUnidade] of Object.entries(fin.ajustesPrevia)) {
    if (competencia >= desde) desfeitos += Object.keys(porUnidade).length;
    else ajustesPrevia[competencia] = porUnidade;
  }
  return { ajustesPrevia, desfeitos };
}

function comComunicado(estado, publicar, titulo, texto, agora) {
  if (!publicar) return estado;
  return publicarComunicado(estado, { tipo: 'assembleia', titulo, texto, publico: { tipo: 'todos' }, canais: ['push', 'email'] }, agora).estado;
}

function notificacaoTaxa(fin, texto, publicar) {
  return { canal: 'App + e-mail + WhatsApp', para: `${responsaveisAvisados(fin)} responsáveis`, texto: `${texto} avisado${publicar ? ' e publicado no mural' : ''}` };
}

export function novaComposicao(estado, dados, perfil, agora) {
  if (!podeOperar(perfil)) return erroTaxa(estado, SO_SINDICO);
  const aprovadoEm = String(dados.aprovadoEm || '').trim();
  if (!aprovadoEm) return erroTaxa(estado, MSG_ATA);
  const fin = estado.financeiro;
  const montada = montarVersao(fin, dados);
  if (montada.erro) return erroTaxa(estado, montada.erro);
  const versao = { id: `CV-${String(fin.composicao.proximaVersao).padStart(3, '0')}`, ...montada.versao, aprovadoEm, criadaEm: agora.toISOString(), criadaPor: 'Síndico' };
  const { ajustesPrevia, desfeitos } = semAjustesDesde(fin, versao.vigencia);
  const publicar = dados.publicar !== false;
  const composicao = { ...fin.composicao, versoes: [...fin.composicao.versoes.filter((v) => v.vigencia !== versao.vigencia), versao], proximaVersao: fin.composicao.proximaVersao + 1 };
  let novo = comFinanceiro(estado, { composicao, ajustesPrevia, auditoria: comAuditoria(estado, agora, 'Reajuste da taxa', `${nomeMes(versao.vigencia)} · ${resumoVersao(fin, versao)} · ${aprovadoEm}`) });
  const texto = `A partir de ${nomeMes(versao.vigencia)}, a taxa condominial passa a ser:\n${textoValoresVersao(novo.financeiro, versao)}\n\nAprovado em: ${aprovadoEm}.`;
  novo = comComunicado(novo, publicar, `Reajuste da taxa condominial a partir de ${nomeMes(versao.vigencia)}`, texto, agora);
  return { estado: novo, id: versao.id, desfeitos, notificacao: notificacaoTaxa(fin, `Reajuste a partir de ${nomeMes(versao.vigencia)}`, publicar) };
}

export function cancelarComposicao(estado, id, perfil, agora) {
  if (!podeOperar(perfil)) return erroTaxa(estado, SO_SINDICO);
  const fin = estado.financeiro;
  const versao = versoesAgendadas(fin).find((v) => v.id === id);
  if (!versao) return erroTaxa(estado, 'Esta competência já foi emitida');
  return { estado: comFinanceiro(estado, { composicao: { ...fin.composicao, versoes: fin.composicao.versoes.filter((v) => v.id !== id) }, auditoria: comAuditoria(estado, agora, 'Reajuste cancelado', `${versao.id} · ${nomeMes(versao.vigencia)}`) }) };
}

export function montarTaxaExtra(fin, dados) {
  const minimo = primeiraNaoEmitida(fin);
  const descricao = String(dados.descricao || '').trim();
  const parcelas = Number(dados.parcelas);
  if (!descricao) return { erro: 'Informe a descrição' };
  if (!(dados.total > 0)) return { erro: 'Informe o valor total' };
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 60) return { erro: 'As parcelas devem ser de 1 a 60' };
  if (!dados.inicio || dados.inicio < minimo) return { erro: `O início deve ser a partir de ${nomeMes(minimo)}` };
  return { extra: { descricao, total: Math.round(dados.total), parcelas, inicio: dados.inicio, rateio: dados.rateio === 'fracao' ? 'fracao' : 'igual' } };
}

export function criarTaxaExtra(estado, dados, perfil, agora) {
  if (!podeOperar(perfil)) return erroTaxa(estado, SO_SINDICO);
  const fin = estado.financeiro;
  const montada = montarTaxaExtra(fin, dados);
  if (montada.erro) return erroTaxa(estado, montada.erro);
  const aprovadoEm = String(dados.aprovadoEm || '').trim();
  if (!aprovadoEm) return erroTaxa(estado, MSG_ATA);
  const extra = { id: `TX-${String(fin.composicao.proximaExtra).padStart(3, '0')}`, ...montada.extra, aprovadoEm, situacao: 'ativa', ultimaCompetencia: null, motivoEncerramento: null, criadaEm: agora.toISOString(), encerradaEm: null };
  const { ajustesPrevia, desfeitos } = semAjustesDesde(fin, extra.inicio);
  const publicar = dados.publicar !== false;
  const periodo = `${nomeMes(extra.inicio)} a ${nomeMes(fimExtra(extra))}`;
  let novo = comFinanceiro(estado, {
    composicao: { ...fin.composicao, extras: [...fin.composicao.extras, extra], proximaExtra: fin.composicao.proximaExtra + 1 },
    ajustesPrevia,
    auditoria: comAuditoria(estado, agora, 'Taxa extra criada', `${extra.id} · ${extra.descricao} · ${fmtReais(extra.total)} em ${extra.parcelas}x · ${aprovadoEm}`),
  });
  const valores = valorPorTipoExtra(novo.financeiro, extra).map((v) => `${NOMES_TIPO_UNIDADE[v.tipo]}: ${fmtReais(v.valor)} por parcela`).join('\n');
  const texto = `Taxa extra aprovada: ${extra.descricao}, ${fmtReais(extra.total)} em ${extra.parcelas} parcelas, de ${periodo}${extra.rateio === 'fracao' ? ', rateada por fração ideal' : ''}.\n${valores}\n\nAprovado em: ${aprovadoEm}.`;
  novo = comComunicado(novo, publicar, `Taxa extra: ${extra.descricao}`, texto, agora);
  return { estado: novo, id: extra.id, desfeitos, notificacao: notificacaoTaxa(fin, `Taxa extra ${extra.descricao}`, publicar) };
}

export function encerrarTaxaExtra(estado, id, motivo, perfil, agora) {
  if (!podeOperar(perfil)) return erroTaxa(estado, SO_SINDICO);
  const fin = estado.financeiro;
  const extra = fin.composicao.extras.find((x) => x.id === id);
  if (!extra || extra.situacao !== 'ativa') return erroTaxa(estado, 'Só taxas ativas podem ser encerradas');
  const texto = String(motivo || '').trim();
  if (!texto) return erroTaxa(estado, 'Informe a ata ou o motivo');
  const ultimaEmitida = somarMes(primeiraNaoEmitida(fin), -1);
  const cobradas = [...fin.emitidas].sort().filter((c) => c <= ultimaEmitida && parcelaDe(extra, c));
  const ultimaCompetencia = cobradas.at(-1) || null;
  const encerrada = { ...extra, situacao: 'encerrada', ultimaCompetencia, motivoEncerramento: texto, encerradaEm: agora.toISOString() };
  const { ajustesPrevia, desfeitos } = semAjustesDesde(fin, primeiraNaoEmitida(fin));
  return {
    estado: comFinanceiro(estado, {
      composicao: { ...fin.composicao, extras: fin.composicao.extras.map((x) => (x.id === id ? encerrada : x)) },
      ajustesPrevia,
      auditoria: comAuditoria(estado, agora, 'Taxa extra encerrada', `${extra.id} · ${extra.descricao} · ${ultimaCompetencia ? `última parcela em ${nomeMes(ultimaCompetencia)}` : 'nenhuma parcela cobrada'} · ${texto}`),
    }),
    desfeitos,
    notificacao: { canal: 'App + e-mail + WhatsApp', para: `${responsaveisAvisados(fin)} responsáveis`, texto: `Taxa extra ${extra.descricao} encerrada${ultimaCompetencia ? `: última parcela em ${nomeMes(ultimaCompetencia)}` : ' antes da primeira parcela'}` },
  };
}
