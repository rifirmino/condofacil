import { PRIORIDADES, ORDEM_PRIORIDADE, CATEGORIAS } from '../dados.js';
import { horasEntre } from '../datas.js';

// Prazos derivados da linha do tempo: 1ª resposta = primeira entrada do síndico; solução = entrada com status "resolvida".
const HORA_MS = 3600000;
const ENCERRADAS = ['resolvida', 'fechada'];

function instanteMais(iso, horas) {
  return new Date(new Date(iso).getTime() + horas * HORA_MS).toISOString();
}

export function prazosDe(oc) {
  const p = PRIORIDADES[oc.prioridade];
  const respondida = oc.linha.find((l) => l.autor === 'Síndico');
  const resolvida = oc.linha.find((l) => l.status === 'resolvida');
  return {
    resposta: { limite: instanteMais(oc.criadaEm, p.resposta), em: respondida ? respondida.em : null },
    solucao: p.solucao === null ? null : { limite: instanteMais(oc.criadaEm, p.solucao), em: resolvida ? resolvida.em : null },
  };
}

export function prazosVencidos(oc, agora) {
  if (oc.arquivada) return { resposta: null, solucao: null };
  const p = prazosDe(oc);
  const atraso = (prazo, encerrou) => (prazo && !encerrou && agora > new Date(prazo.limite) ? Math.floor(horasEntre(new Date(prazo.limite), agora)) : null);
  return { resposta: atraso(p.resposta, !!p.resposta.em), solucao: atraso(p.solucao, !p.solucao || !!p.solucao.em || ENCERRADAS.includes(oc.status)) };
}

export function textoAtraso(horas) {
  return horas < 48 ? `${horas} h` : `${Math.floor(horas / 24)} dias`;
}

function proximoLimite(oc) {
  const p = prazosDe(oc);
  if (!p.resposta.em) return p.resposta.limite;
  return p.solucao && !p.solucao.em ? p.solucao.limite : '9999';
}

export function caixaDeEntrada(estado, agora, filtros = {}) {
  const { status = 'ativas', tipo = 'todos', prioridade = 'todas' } = filtros;
  return estado.ocorrencias
    .filter((o) => {
      if (status === 'arquivadas') return o.arquivada;
      if (o.arquivada) return false;
      if (status === 'ativas' && ENCERRADAS.includes(o.status)) return false;
      if (!['ativas', 'todas'].includes(status) && o.status !== status) return false;
      if (tipo !== 'todos' && CATEGORIAS[o.categoria].tipo !== tipo) return false;
      return prioridade === 'todas' || o.prioridade === prioridade;
    })
    .sort((a, b) => Number(ENCERRADAS.includes(a.status)) - Number(ENCERRADAS.includes(b.status))
      || ORDEM_PRIORIDADE.indexOf(a.prioridade) - ORDEM_PRIORIDADE.indexOf(b.prioridade)
      || proximoLimite(a).localeCompare(proximoLimite(b))
      || b.criadaEm.localeCompare(a.criadaEm));
}

export function parecidas(estado, categoria, unidade) {
  return estado.ocorrencias.filter((o) => o.categoria === categoria && o.unidade !== unidade && !o.arquivada && !ENCERRADAS.includes(o.status));
}

export function alertasNotificacoes(estado, agora) {
  const itens = [];
  for (const o of caixaDeEntrada(estado, agora, { status: 'ativas' })) {
    const v = prazosVencidos(o, agora);
    if (v.resposta !== null) itens.push({ chave: `resp-${o.id}`, texto: `${o.id}: 1ª resposta vencida há ${textoAtraso(v.resposta)}`, href: `#sindico.ocorrencias.${o.id}` });
    if (v.solucao !== null) itens.push({ chave: `sol-${o.id}`, texto: `${o.id}: solução vencida há ${textoAtraso(v.solucao)}`, href: `#sindico.ocorrencias.${o.id}` });
  }
  return itens;
}

export function indicadorAtendimento(estado) {
  const ativas = estado.ocorrencias.filter((o) => !o.arquivada && !ENCERRADAS.includes(o.status));
  const encerradas = estado.ocorrencias.filter((o) => ENCERRADAS.includes(o.status) && prazosDe(o).solucao);
  const noPrazo = encerradas.filter((o) => {
    const s = prazosDe(o).solucao;
    return s.em && s.em <= s.limite;
  }).length;
  const pct = encerradas.length ? Math.round((noPrazo / encerradas.length) * 100) : 100;
  return { abertas: ativas.length, noPrazo, comPrazo: encerradas.length, pct, alerta: pct < 80 };
}

export function urgentesAbertas(estado) {
  return estado.ocorrencias.filter((o) => o.prioridade === 'urgente' && !o.arquivada && !ENCERRADAS.includes(o.status));
}
