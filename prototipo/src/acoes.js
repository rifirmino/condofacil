import { podeReservar, podeEntregar, destinatarios, proximoStatus, areaPorId, avisoCancelamento, STATUS_ATIVOS } from './regras.js';
import { CATEGORIAS, NOMES_STATUS, NOMES_CANAL, SINDICO } from './dados.js';
import { fmtDia, fmtHora, haQuanto } from './datas.js';

// Cada ação recebe o estado e devolve { estado, notificacao?, erro?, id?, aviso? } sem mutar nada.
function erroAcao(estado, mensagem) {
  return { estado, erro: mensagem };
}

export function trocarItem(lista, id, mudanca) {
  return lista.map((x) => (x.id === id ? { ...x, ...mudanca } : x));
}

export function nomesDaUnidade(estado, unidade) {
  const nomes = estado.pessoas.filter((p) => p.unidade === unidade).map((p) => p.nome);
  return nomes.length ? nomes.join(', ') : `Apto ${unidade}`;
}

function gerarCodigo(n) {
  return String((((n + 1) * 739391) % 900000) + 100000);
}

function quandoReserva(r) {
  return `${fmtDia(r.data)}, ${fmtHora(r.inicio)}–${fmtHora(r.fim)}`;
}

export function solicitarReserva(estado, pedido, agora) {
  const v = podeReservar(estado, pedido, agora);
  if (!v.ok) return erroAcao(estado, v.motivo);
  if (!pedido.aceiteTermo) return erroAcao(estado, 'Aceite o termo de responsabilidade');
  const area = areaPorId(estado, pedido.areaId);
  const status = area.aprovacao === 'automatica' ? 'confirmada' : 'pendente';
  const reserva = { id: `r${estado.reservas.length + 1}`, areaId: area.id, unidade: pedido.unidade, data: pedido.data, inicio: pedido.inicio, fim: pedido.fim, status, convidados: pedido.convidados || [], criadaEm: agora.toISOString() };
  const notificacao = status === 'pendente'
    ? { canal: 'Push', para: SINDICO, texto: `Nova reserva para aprovar: ${area.nome}, apto ${reserva.unidade}, ${quandoReserva(reserva)}` }
    : { canal: 'Push', para: nomesDaUnidade(estado, reserva.unidade), texto: `Reserva confirmada: ${area.nome}, ${quandoReserva(reserva)}` };
  return { estado: { ...estado, reservas: [...estado.reservas, reserva] }, id: reserva.id, notificacao };
}

export function aprovarReserva(estado, id) {
  const r = estado.reservas.find((x) => x.id === id);
  if (!r || r.status !== 'pendente') return erroAcao(estado, 'Reserva não está pendente');
  const area = areaPorId(estado, r.areaId);
  return {
    estado: { ...estado, reservas: trocarItem(estado.reservas, id, { status: 'confirmada' }) },
    notificacao: { canal: 'WhatsApp', para: nomesDaUnidade(estado, r.unidade), texto: `Reserva aprovada: ${area.nome}, ${quandoReserva(r)}. A portaria já recebeu a lista de convidados.` },
  };
}

export function recusarReserva(estado, id, motivo) {
  const r = estado.reservas.find((x) => x.id === id);
  if (!r || r.status !== 'pendente') return erroAcao(estado, 'Reserva não está pendente');
  const texto = String(motivo || '').trim();
  if (!texto) return erroAcao(estado, 'Escolha o motivo da recusa');
  const area = areaPorId(estado, r.areaId);
  return {
    estado: { ...estado, reservas: trocarItem(estado.reservas, id, { status: 'recusada', motivo: texto }) },
    notificacao: { canal: 'WhatsApp', para: nomesDaUnidade(estado, r.unidade), texto: `Reserva recusada: ${area.nome}, ${quandoReserva(r)}. Motivo: ${texto}.` },
  };
}

export function cancelarReserva(estado, id, agora) {
  const r = estado.reservas.find((x) => x.id === id);
  if (!r || !STATUS_ATIVOS.includes(r.status)) return erroAcao(estado, 'Reserva não pode ser cancelada');
  const aviso = avisoCancelamento(r, agora);
  const area = areaPorId(estado, r.areaId);
  return {
    estado: { ...estado, reservas: trocarItem(estado.reservas, id, { status: 'cancelada' }) },
    aviso,
    notificacao: { canal: 'Push', para: SINDICO, texto: `Reserva cancelada: ${area.nome}, apto ${r.unidade}, ${quandoReserva(r)}${aviso.multa ? ' (fora do prazo de 72 h)' : ''}` },
  };
}

export function registrarEncomenda(estado, dados, agora) {
  const unidade = String(dados.unidade || '').trim();
  if (!estado.condominio.unidades.includes(unidade)) return erroAcao(estado, 'Unidade inexistente');
  if (!dados.transportadora) return erroAcao(estado, 'Escolha a transportadora');
  const encomenda = { id: `e${estado.encomendas.length + 1}`, unidade, transportadora: dados.transportadora, codigo: gerarCodigo(estado.encomendas.length), chegadaEm: agora.toISOString(), status: 'aguardando', foto: !!dados.foto, retiradaPor: null, retiradaEm: null, lembretes: 0, registradaPor: dados.porteiro || 'Seu José' };
  return {
    estado: { ...estado, encomendas: [...estado.encomendas, encomenda] },
    id: encomenda.id,
    notificacao: { canal: 'WhatsApp', para: nomesDaUnidade(estado, unidade), texto: `Chegou sua encomenda (${encomenda.transportadora}). Código de retirada: ${encomenda.codigo}` },
  };
}

export function entregarEncomenda(estado, { id, codigo, nome }, agora) {
  const e = estado.encomendas.find((x) => x.id === id);
  if (!e) return erroAcao(estado, 'Encomenda não encontrada');
  const v = podeEntregar(e, codigo, nome);
  if (!v.ok) return erroAcao(estado, v.motivo);
  const quem = nome.trim();
  return {
    estado: { ...estado, encomendas: trocarItem(estado.encomendas, id, { status: 'retirada', retiradaPor: quem, retiradaEm: agora.toISOString() }) },
    notificacao: { canal: 'Push', para: nomesDaUnidade(estado, e.unidade), texto: `Encomenda (${e.transportadora}) retirada por ${quem}.` },
  };
}

export function lembrarEncomenda(estado, id, agora) {
  const e = estado.encomendas.find((x) => x.id === id);
  if (!e || e.status !== 'aguardando') return erroAcao(estado, 'Encomenda já entregue');
  return {
    estado: { ...estado, encomendas: trocarItem(estado.encomendas, id, { lembretes: e.lembretes + 1 }) },
    notificacao: { canal: 'WhatsApp', para: nomesDaUnidade(estado, e.unidade), texto: `Lembrete: sua encomenda (${e.transportadora}) chegou ${haQuanto(e.chegadaEm, agora)} e está na portaria.` },
  };
}

export function publicarComunicado(estado, dados, agora) {
  const titulo = String(dados.titulo || '').trim();
  const texto = String(dados.texto || '').trim();
  if (!titulo) return erroAcao(estado, 'Informe o título');
  if (!texto) return erroAcao(estado, 'Escreva o texto do comunicado');
  const dest = destinatarios(estado, dados.publico);
  if (!dest.length) return erroAcao(estado, 'Escolha ao menos uma unidade');
  const canais = [...(dados.canais || [])];
  if (dados.tipo === 'urgente' && !canais.includes('sms')) canais.push('sms');
  if (!canais.length) return erroAcao(estado, 'Escolha ao menos um canal');
  const comunicado = { id: `c${estado.comunicados.length + 1}`, tipo: dados.tipo, titulo, texto, publico: dados.publico, canais, fixado: !!dados.fixado, anexo: dados.anexo || null, publicadoEm: agora.toISOString(), leituras: [], reacoes: { util: [], duvida: [] } };
  return {
    estado: { ...estado, comunicados: [...estado.comunicados, comunicado] },
    id: comunicado.id,
    notificacao: { canal: canais.map((k) => NOMES_CANAL[k]).join(' + '), para: `${dest.length} unidades`, texto: titulo },
  };
}

export function marcarLido(estado, id, unidade) {
  const c = estado.comunicados.find((x) => x.id === id);
  if (!c) return erroAcao(estado, 'Comunicado não encontrado');
  if (c.leituras.includes(unidade)) return { estado };
  return { estado: { ...estado, comunicados: trocarItem(estado.comunicados, id, { leituras: [...c.leituras, unidade] }) } };
}

export function reagir(estado, id, unidade, tipo) {
  const c = estado.comunicados.find((x) => x.id === id);
  if (!c) return erroAcao(estado, 'Comunicado não encontrado');
  const tinha = c.reacoes[tipo].includes(unidade);
  const reacoes = { util: c.reacoes.util.filter((u) => u !== unidade), duvida: c.reacoes.duvida.filter((u) => u !== unidade) };
  if (!tinha) reacoes[tipo] = [...reacoes[tipo], unidade];
  return { estado: { ...estado, comunicados: trocarItem(estado.comunicados, id, { reacoes }) } };
}

export function abrirOcorrencia(estado, dados, agora) {
  if (!CATEGORIAS[dados.categoria]) return erroAcao(estado, 'Escolha o tipo e a categoria');
  const descricao = String(dados.descricao || '').trim();
  if (!descricao) return erroAcao(estado, 'Descreva a ocorrência');
  const id = `OC-${String(estado.proximoProtocolo).padStart(4, '0')}`;
  const em = agora.toISOString();
  const ocorrencia = { id, categoria: dados.categoria, descricao, local: String(dados.local || '').trim(), unidade: dados.unidade, anonima: !!dados.anonima, publica: !!dados.publica, foto: !!dados.foto, status: 'aberta', eutambem: [], linha: [{ em, status: 'aberta', texto: 'Ocorrência aberta', autor: dados.anonima ? 'Anônimo' : nomesDaUnidade(estado, dados.unidade) }], avaliacao: null, arquivada: false, criadaEm: em, prioridade: CATEGORIAS[dados.categoria].prioridade, os: null, processos: [], motivoArquivamento: null };
  return {
    estado: { ...estado, ocorrencias: [ocorrencia, ...estado.ocorrencias], proximoProtocolo: estado.proximoProtocolo + 1 },
    id,
    notificacao: { canal: 'Push', para: SINDICO, texto: `Nova ocorrência ${id}: ${CATEGORIAS[dados.categoria].nome}` },
  };
}

export function avancarOcorrencia(estado, id, agora, texto = '') {
  const oc = estado.ocorrencias.find((x) => x.id === id);
  if (!oc) return erroAcao(estado, 'Ocorrência não encontrada');
  if (oc.arquivada) return erroAcao(estado, 'Ocorrência arquivada');
  const proximo = proximoStatus(oc.status);
  if (!proximo) return erroAcao(estado, 'Ocorrência já está fechada');
  const mensagem = String(texto || '').trim();
  const entrada = { em: agora.toISOString(), status: proximo, texto: mensagem || `Status alterado para ${NOMES_STATUS[proximo]}`, autor: 'Síndico' };
  return {
    estado: { ...estado, ocorrencias: trocarItem(estado.ocorrencias, id, { status: proximo, linha: [...oc.linha, entrada] }) },
    notificacao: { canal: 'Push', para: nomesDaUnidade(estado, oc.unidade), texto: `${oc.id}: ${NOMES_STATUS[proximo]}${mensagem ? ` — ${mensagem}` : ''}` },
  };
}

export function comentarOcorrencia(estado, id, texto, agora, autor = 'Síndico') {
  const oc = estado.ocorrencias.find((x) => x.id === id);
  if (!oc) return erroAcao(estado, 'Ocorrência não encontrada');
  const mensagem = String(texto || '').trim();
  if (!mensagem) return erroAcao(estado, 'Escreva o comentário');
  const entrada = { em: agora.toISOString(), status: null, texto: mensagem, autor };
  return {
    estado: { ...estado, ocorrencias: trocarItem(estado.ocorrencias, id, { linha: [...oc.linha, entrada] }) },
    notificacao: { canal: 'Push', para: nomesDaUnidade(estado, oc.unidade), texto: `${oc.id}: novo comentário do síndico` },
  };
}

export function arquivarOcorrencia(estado, id) {
  const oc = estado.ocorrencias.find((x) => x.id === id);
  if (!oc) return erroAcao(estado, 'Ocorrência não encontrada');
  if (oc.status !== 'fechada') return erroAcao(estado, 'Só ocorrências fechadas podem ser arquivadas');
  return { estado: { ...estado, ocorrencias: trocarItem(estado.ocorrencias, id, { arquivada: true }) } };
}

export function avaliarOcorrencia(estado, id, nota) {
  const oc = estado.ocorrencias.find((x) => x.id === id);
  if (!oc) return erroAcao(estado, 'Ocorrência não encontrada');
  if (!['resolvida', 'fechada'].includes(oc.status)) return erroAcao(estado, 'A avaliação abre quando a ocorrência for resolvida');
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) return erroAcao(estado, 'Escolha de 1 a 5 estrelas');
  return {
    estado: { ...estado, ocorrencias: trocarItem(estado.ocorrencias, id, { avaliacao: nota }) },
    notificacao: { canal: 'Push', para: SINDICO, texto: `${oc.id} avaliada com ${nota} de 5 estrelas` },
  };
}

export function euTambem(estado, id, unidade) {
  const oc = estado.ocorrencias.find((x) => x.id === id);
  if (!oc) return erroAcao(estado, 'Ocorrência não encontrada');
  if (!oc.publica && oc.unidade === unidade) return erroAcao(estado, 'Ocorrência não é pública');
  const eutambem = oc.eutambem.includes(unidade) ? oc.eutambem.filter((u) => u !== unidade) : [...oc.eutambem, unidade];
  return { estado: { ...estado, ocorrencias: trocarItem(estado.ocorrencias, id, { eutambem }) } };
}
