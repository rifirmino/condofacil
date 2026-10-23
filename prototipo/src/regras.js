import { FLUXO_OCORRENCIA, NOMES_STATUS } from './dados.js';
import { prazosVencidos } from './notificacoes/regras.js';
import { isoDia, diferencaDias, momento, horasEntre, fmtHora } from './datas.js';

export const STATUS_ATIVOS = ['pendente', 'confirmada'];
const REGRA_OK = { ok: true };

function falhaRegra(motivo) {
  return { ok: false, motivo };
}

function sobrepoe(a, b) {
  return a.inicio < b.fim && b.inicio < a.fim;
}

function plural(n, um, varios) {
  return n === 1 ? `1 ${um}` : `${n} ${varios}`;
}

export function areaPorId(estado, id) {
  return estado.areas.find((a) => a.id === id);
}

export function conflito(estado, areaId, data, inicio, fim) {
  const area = areaPorId(estado, areaId);
  const ids = [areaId, ...(area.vinculadas || [])];
  const alvo = { inicio, fim };
  const bloqueio = estado.bloqueios.find((b) => b.areaId === areaId && b.data === data && sobrepoe(b, alvo));
  if (bloqueio) return { tipo: 'bloqueio', item: bloqueio };
  const reserva = estado.reservas.find((r) => ids.includes(r.areaId) && r.data === data && STATUS_ATIVOS.includes(r.status) && sobrepoe(r, alvo));
  if (reserva) return { tipo: 'reserva', item: reserva };
  return null;
}

export function podeReservar(estado, pedido, agora) {
  const area = areaPorId(estado, pedido.areaId);
  if (!area) return falhaRegra('Área inexistente');
  const dias = diferencaDias(pedido.data, isoDia(agora));
  if (dias < 0 || momento(pedido.data, pedido.inicio) <= agora) return falhaRegra('Esse horário já passou');
  if (dias < area.antecedenciaMin) return falhaRegra(`Reserve com pelo menos ${plural(area.antecedenciaMin, 'dia', 'dias')} de antecedência`);
  if (dias > area.antecedenciaMax) return falhaRegra(`Reservas abrem com no máximo ${area.antecedenciaMax} dias de antecedência`);
  const c = conflito(estado, area.id, pedido.data, pedido.inicio, pedido.fim);
  if (c && c.tipo === 'bloqueio') return falhaRegra(`Área bloqueada: ${c.item.motivo}`);
  if (c) return falhaRegra('Horário já reservado');
  if (area.limiteMes) {
    const mes = pedido.data.slice(0, 7);
    const usadas = estado.reservas.filter((r) => r.areaId === area.id && r.unidade === pedido.unidade && STATUS_ATIVOS.includes(r.status) && r.data.slice(0, 7) === mes).length;
    if (usadas >= area.limiteMes) return falhaRegra(`Limite de ${area.limiteMes} reservas/mês atingido para esta área`);
  }
  return REGRA_OK;
}

export function avisoCancelamento(reserva, agora) {
  const horas = Math.floor(horasEntre(agora, momento(reserva.data, reserva.inicio)));
  const multa = horas < 72;
  return {
    multa,
    horas,
    texto: multa
      ? `Faltam ${horas} h para a reserva. Pelo regulamento, cancelamentos com menos de 72 h perdem a taxa.`
      : `Faltam ${horas} h para a reserva. Cancelamento sem multa.`,
  };
}

export function podeEntregar(encomenda, codigo, nomeRetirada) {
  if (encomenda.status !== 'aguardando') return falhaRegra('Encomenda já entregue');
  if (String(codigo || '').trim() !== encomenda.codigo) return falhaRegra('Código inválido');
  if (!String(nomeRetirada || '').trim()) return falhaRegra('Informe quem retirou');
  return REGRA_OK;
}

export function proximoStatus(status) {
  const i = FLUXO_OCORRENCIA.indexOf(status);
  return FLUXO_OCORRENCIA[i + 1] || null;
}

export function acoesOcorrencia(oc) {
  if (oc.arquivada) return [];
  const acoes = [];
  const proximo = proximoStatus(oc.status);
  if (proximo) acoes.push({ id: 'avancar', rotulo: `Mover para "${NOMES_STATUS[proximo]}"` });
  acoes.push({ id: 'comentar', rotulo: 'Comentar' });
  if (oc.status === 'fechada') acoes.push({ id: 'arquivar', rotulo: 'Arquivar' });
  return acoes;
}

export function alertasDocumentos(documentos, hoje) {
  return documentos
    .filter((d) => d.vencimento)
    .map((d) => {
      const dias = diferencaDias(d.vencimento, hoje);
      const faixa = dias < 0 ? 'vencido' : dias <= 7 ? '7' : dias <= 30 ? '30' : dias <= 60 ? '60' : null;
      return { documento: d, dias, faixa };
    })
    .filter((a) => a.faixa)
    .sort((a, b) => a.dias - b.dias);
}

export function slaVencido(oc, agora) {
  const v = prazosVencidos(oc, agora);
  return v.resposta !== null || v.solucao !== null;
}

export function statusDia(estado, areaId, data) {
  if (estado.bloqueios.some((b) => b.areaId === areaId && b.data === data)) return 'bloqueado';
  const area = areaPorId(estado, areaId);
  const ids = [areaId, ...(area.vinculadas || [])];
  const doDia = estado.reservas.filter((r) => ids.includes(r.areaId) && r.data === data && STATUS_ATIVOS.includes(r.status));
  if (!doDia.length) return 'livre';
  return doDia.some((r) => r.status === 'pendente') ? 'pendente' : 'reservado';
}

export function horariosDaArea(estado, areaId, data, agora) {
  const area = areaPorId(estado, areaId);
  const base = area.tipo === 'periodo'
    ? area.periodos.map((p) => ({ inicio: p.inicio, fim: p.fim, rotulo: `${p.nome} (${fmtHora(p.inicio)}–${fmtHora(p.fim)})` }))
    : Array.from({ length: area.horaFim - area.horaInicio }, (_, i) => {
        const h = area.horaInicio + i;
        return { inicio: h, fim: h + 1, rotulo: `${fmtHora(h)}–${fmtHora(h + 1)}` };
      });
  return base.map((h) => {
    const c = conflito(estado, areaId, data, h.inicio, h.fim);
    const passou = momento(data, h.inicio) <= agora;
    let motivo = null;
    if (c) motivo = c.tipo === 'bloqueio' ? 'Bloqueado' : c.item.status === 'pendente' ? 'Pendente' : 'Reservado';
    else if (passou) motivo = 'Encerrado';
    return { ...h, livre: !motivo, motivo };
  });
}

// Com blocos ("A401"), o andar vem do cadastro da implantação; na demonstração, é o primeiro dígito.
export function andarDaUnidade(estado, unidade) {
  const info = estado.condominio.unidadesInfo && estado.condominio.unidadesInfo[unidade];
  return info ? info.andar : Number(unidade[0]);
}

export function destinatarios(estado, publico) {
  const todas = estado.condominio.unidades;
  if (publico.tipo === 'andar') return todas.filter((u) => String(andarDaUnidade(estado, u)) === String(publico.valor));
  if (publico.tipo === 'unidades') return todas.filter((u) => publico.valor.includes(u));
  return [...todas];
}

export function comunicadosDaUnidade(estado, unidade) {
  return estado.comunicados
    .filter((c) => destinatarios(estado, c.publico).includes(unidade))
    .sort((a, b) => Number(b.fixado) - Number(a.fixado) || b.publicadoEm.localeCompare(a.publicadoEm));
}

export function encomendaParada(encomenda, agora) {
  return encomenda.status === 'aguardando' && horasEntre(new Date(encomenda.chegadaEm), agora) > 72;
}

export function moradoresDaUnidade(estado, unidade) {
  return estado.pessoas.filter((p) => p.unidade === unidade && !p.naoResidente);
}

export function indicadoresSindico(estado, agora) {
  return {
    pendentes: estado.reservas.filter((r) => r.status === 'pendente').length,
    abertas: estado.ocorrencias.filter((o) => !o.arquivada && !['resolvida', 'fechada'].includes(o.status)).length,
    slaVencidas: estado.ocorrencias.filter((o) => slaVencido(o, agora)).length,
    paradas: estado.encomendas.filter((e) => encomendaParada(e, agora)).length,
    vencendo: alertasDocumentos(estado.documentos, isoDia(agora)).length,
    adesao: { com: new Set(estado.pessoas.filter((p) => !p.naoResidente).map((p) => p.unidade)).size, total: estado.condominio.unidades.length },
  };
}
