import { previaCompetencia, podeOperar, mesExtenso } from '../cobranca/regras.js';
import { comFinanceiro, comAuditoria, confirmarPagamentoAsaas, SO_SINDICO } from '../cobranca/acoes.js';

// Modo conectado: converte o que o servidor devolve do Asaas sandbox nas mesmas estruturas do modo simulado.
export const MSG_SEM_CPF = 'Sem CPF: não será emitida';

export function previaConectada(estado, competencia) {
  const previa = previaCompetencia(estado, competencia);
  return {
    ...previa,
    linhas: previa.linhas.map((l) => (!l.bloqueada && !l.responsavel.cpf ? { ...l, bloqueada: true, motivo: MSG_SEM_CPF } : l)),
  };
}

export function linhasParaAsaas(estado, competencia, apenas = null) {
  const previa = previaConectada(estado, competencia);
  const { multaPct, jurosPct } = estado.financeiro.parametros;
  return previa.linhas.filter((l) => !l.bloqueada && (!apenas || apenas.includes(l.unidade))).map((l) => {
    const pessoa = estado.pessoas.find((p) => p.unidade === l.unidade && p.nome === l.responsavel.nome);
    return {
      unidade: l.unidade,
      responsavel: { nome: l.responsavel.nome, cpf: l.responsavel.cpf, email: pessoa ? pessoa.email : '', celular: pessoa ? pessoa.celular : '' },
      valor: l.total,
      vencimento: previa.vencimento,
      descricao: `Taxa condominial de ${mesExtenso(competencia)} · apto ${l.unidade}`,
      multaPct,
      jurosPct,
    };
  });
}

function cobrancaDoAsaas(competencia, linha, c) {
  return {
    id: `CB-${competencia}-${linha.unidade}`, unidade: linha.unidade, competencia, vencimento: c.vencimento, itens: linha.itens, valor: c.valor,
    status: 'aberta', pagaEm: null, valorPago: null, forma: null, baixaManual: null, eventosAsaas: [], regua: [], substituiu: null, acordo: null,
    asaas: { id: c.asaasId, referencia: c.referencia, faturaUrl: c.faturaUrl, boletoUrl: c.boletoUrl, pixCopiaCola: c.pixCopiaCola, pixImagem: c.pixImagem },
  };
}

export function aplicarEmissao(estado, competencia, resultados, perfil, agora) {
  if (!podeOperar(perfil)) return { estado, erro: SO_SINDICO };
  const fin = estado.financeiro;
  const previa = previaCompetencia(estado, competencia);
  const existentes = new Set(fin.cobrancas.filter((c) => c.competencia === competencia && !c.acordo).map((c) => c.unidade));
  const novas = resultados.filter((r) => r.ok && !existentes.has(r.unidade)).map((r) => cobrancaDoAsaas(competencia, previa.linhas.find((l) => l.unidade === r.unidade), r.cobranca));
  // Falhas antigas das unidades reenviadas agora são substituídas pelo resultado novo.
  const anteriores = ((fin.falhasAsaas || {})[competencia] || []).filter((f) => !resultados.some((r) => r.unidade === f.unidade));
  const falhas = [...anteriores, ...resultados.filter((r) => !r.ok).map((r) => ({ unidade: r.unidade, erro: r.erro }))];
  const emitidas = fin.emitidas.includes(competencia) ? fin.emitidas : [...fin.emitidas, competencia];
  return {
    estado: comFinanceiro(estado, {
      cobrancas: [...fin.cobrancas, ...novas],
      emitidas,
      falhasAsaas: { ...(fin.falhasAsaas || {}), [competencia]: falhas },
      auditoria: comAuditoria(estado, agora, 'Emissão no Asaas sandbox', `${mesExtenso(competencia)}: ${novas.length} cobranças${falhas.length ? ` · falharam: ${falhas.map((f) => f.unidade).join(', ')}` : ''}`),
    }),
    emitidas: novas.length,
    falhas,
    notificacao: novas.length ? { canal: 'Asaas sandbox', para: `${novas.length} responsáveis`, texto: `Cobranças de ${mesExtenso(competencia)} emitidas no Asaas sandbox: boleto, Pix e fatura` } : undefined,
  };
}

export function aplicarSituacoes(estado, cobrancasServidor, agora) {
  let atual = estado;
  let baixas = 0;
  let notificacao;
  for (const s of cobrancasServidor) {
    if (s.situacao !== 'paga') continue;
    const id = `CB-${s.competencia}-${s.unidade}`;
    const c = atual.financeiro.cobrancas.find((x) => x.id === id);
    if (!c || c.status !== 'aberta') continue;
    const r = confirmarPagamentoAsaas(atual, id, `evt-${s.asaasId}`, s.forma || 'boleto', s.pagoEm ? new Date(`${s.pagoEm.slice(0, 10)}T12:00:00`) : agora);
    if (r.erro) continue;
    atual = r.estado;
    baixas += 1;
    notificacao = r.notificacao;
  }
  return { estado: atual, baixas, notificacao };
}
