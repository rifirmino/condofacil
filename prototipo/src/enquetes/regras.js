import { destinatarios } from '../regras.js';
import { liberado } from '../planos.js';
import { isoDia, somarDias, momento, diferencaDias } from '../datas.js';

// Enquetes: situação no instante, público, apuração (simples ou por fração ideal), quórum, evolução e lembretes.
export const NOMES_SITUACAO_ENQUETE = { rascunho: 'Rascunho', aberta: 'Aberta', encerrada: 'Encerrada' };

export function enquetePorId(estado, id) {
  return estado.enquetes.find((e) => e.id === id) || null;
}

export function situacaoEnquete(e, agora) {
  return e.situacao === 'aberta' && new Date(e.encerraEm) <= agora ? 'encerrada' : e.situacao;
}

export function diasRestantes(e, agora) {
  return Math.max(0, diferencaDias(isoDia(new Date(e.encerraEm)), isoDia(agora)));
}

export function textoDiasRestantes(e, agora) {
  const n = diasRestantes(e, agora);
  if (n === 0) return 'termina hoje';
  return n === 1 ? 'falta 1 dia' : `faltam ${n} dias`;
}

export function unidadesDoPublico(estado, e) {
  return destinatarios(estado, e.publico);
}

export function faltantes(estado, e) {
  const comApp = new Set(estado.pessoas.map((p) => p.unidade));
  return unidadesDoPublico(estado, e).filter((u) => !e.votos[u]).map((unidade) => ({ unidade, semApp: !comApp.has(unidade) }));
}

export function apuracao(estado, e) {
  const publico = unidadesDoPublico(estado, e);
  const votantes = publico.filter((u) => e.votos[u]);
  const fracao = (u) => estado.financeiro.unidades[u].fracao;
  const pesoTotal = votantes.reduce((s, u) => s + fracao(u), 0);
  const opcoes = e.opcoes.map((o) => {
    const quem = votantes.filter((u) => e.votos[u].opcoes.includes(o.id));
    const peso = quem.reduce((s, u) => s + fracao(u), 0);
    return { id: o.id, texto: o.texto, votos: quem.length, pct: votantes.length ? (quem.length / votantes.length) * 100 : 0, pesoPct: pesoTotal ? (peso / pesoTotal) * 100 : 0 };
  });
  const participacaoPct = publico.length ? (votantes.length / publico.length) * 100 : 0;
  const quorumAtingido = !e.quorumPct || participacaoPct >= e.quorumPct;
  const medida = (o) => (e.peso === 'fracao' ? Math.round(o.pesoPct * 1000) : o.votos);
  const maior = Math.max(...opcoes.map(medida));
  const vencedoras = votantes.length ? opcoes.filter((o) => medida(o) === maior) : [];
  return { opcoes, participantes: votantes.length, total: publico.length, participacaoPct, quorumAtingido, semQuorum: !quorumAtingido, vencedoras };
}

export function textoResultado(estado, e) {
  const a = apuracao(estado, e);
  if (!a.participantes) return 'Ninguém votou';
  if (a.semQuorum) return `Sem quórum: ${Math.round(a.participacaoPct)}% de participação, mínimo de ${e.quorumPct}%`;
  if (a.vencedoras.length > 1) return `Empate entre ${a.vencedoras.map((o) => o.texto).join(' e ')}`;
  const v = a.vencedoras[0];
  return `Vencedora: ${v.texto} (${Math.round(e.peso === 'fracao' ? v.pesoPct : v.pct)}%${e.peso === 'fracao' ? ' por fração ideal' : ''})`;
}

export function evolucao(e, agora) {
  if (!e.abertaEm) return [];
  const inicio = isoDia(new Date(e.abertaEm));
  const fim = isoDia(situacaoEnquete(e, agora) === 'encerrada' ? new Date(e.encerradaEm || e.encerraEm) : agora);
  const dias = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) dias.push(d);
  const datas = Object.values(e.votos).map((v) => isoDia(new Date(v.em)));
  return dias.map((dia) => ({ dia, total: datas.filter((d) => d <= dia).length }));
}

export function marcosLembrete(e) {
  const ultimo = isoDia(new Date(e.encerraEm));
  return [somarDias(ultimo, -3), ultimo].map((d) => momento(d, 9).toISOString());
}

export function proximoLembreteAuto(e, agora) {
  if (!e.lembretesAuto || situacaoEnquete(e, agora) !== 'aberta') return null;
  const enviados = e.lembretes.filter((l) => l.automatico).length;
  return marcosLembrete(e).slice(enviados).find((m) => new Date(m) >= new Date(e.abertaEm)) || null;
}

export function enquetesPendentes(estado, unidade, agora) {
  return estado.enquetes.filter((e) => situacaoEnquete(e, agora) === 'aberta' && !e.votos[unidade] && unidadesDoPublico(estado, e).includes(unidade));
}

export function enquetesDaUnidade(estado, unidade, agora) {
  const visiveis = estado.enquetes.filter((e) => e.situacao !== 'rascunho' && unidadesDoPublico(estado, e).includes(unidade));
  return {
    pendentes: visiveis.filter((e) => situacaoEnquete(e, agora) === 'aberta' && !e.votos[unidade]),
    respondidas: visiveis.filter((e) => situacaoEnquete(e, agora) === 'aberta' && e.votos[unidade]),
    encerradas: visiveis.filter((e) => situacaoEnquete(e, agora) === 'encerrada'),
  };
}

export function alertasEnquetes(estado, agora) {
  const alertas = [];
  for (const e of estado.enquetes) {
    const s = situacaoEnquete(e, agora);
    if (s === 'aberta' && diasRestantes(e, agora) <= 1) {
      const n = faltantes(estado, e).length;
      if (n) alertas.push({ chave: `enquete-${e.id}`, href: `#sindico.enquetes.${e.id}`, texto: `Enquete "${e.pergunta}": ${textoDiasRestantes(e, agora) === 'termina hoje' ? 'termina hoje' : 'termina amanhã'}, ${n} unidades sem resposta` });
    }
    if (s === 'encerrada' && !e.resultado && liberado(estado.plano, 'enqueteCompleta')) alertas.push({ chave: `enquete-res-${e.id}`, href: `#sindico.enquetes.${e.id}`, texto: `Enquete encerrada: publique o resultado de "${e.pergunta}"` });
  }
  return alertas;
}
