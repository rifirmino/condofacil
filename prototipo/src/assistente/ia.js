import { CATEGORIAS, NOMES_STATUS } from '../dados.js';
import { areaPorId, comunicadosDaUnidade, encomendaParada, alertasDocumentos } from '../regras.js';
import { fmtReais, situacaoCobranca, valorAtualizado, devedores, indicadoresFinanceiros, proximaCompetencia } from '../cobranca/regras.js';
import { infracoesDaUnidade, situacaoInfracao, alertasInfracoes, NOMES_TIPO_INFRACAO } from '../infracoes/regras.js';
import { enquetesDaUnidade, apuracao, textoDiasRestantes, textoResultado, faltantes, alertasEnquetes } from '../enquetes/regras.js';
import { alertasNotificacoes } from '../notificacoes/regras.js';
import { listaOS, alertasManutencao } from '../manutencao/regras.js';
import { plantaoAgora, porteiroPorId, alertasEscala } from '../escala/regras.js';
import { alertasContas } from '../financeiro/contas.js';
import { mesesDaPrestacao, balanceteDe, saldoFinal, NOMES_SITUACAO_BALANCETE, alertasPrestacao } from '../financeiro/balancete.js';
import { POSTOS } from '../escala/dados.js';
import { ZELADOR } from '../manutencao/dados.js';
import { CONSELHEIRO } from '../financeiro/dados.js';
import { pessoaDaUnidade } from '../vendas/regras.js';
import { isoDia, fmtDataCurta, fmtHora, nomeMes } from '../datas.js';
import { MANUAL_ABEL } from './manual.js';

// Sr. Abel com IA (Avançado): o que cada perfil pode ver, montado do estado real, e as instruções enviadas ao Claude.
function quandoReservaAbel(estado, r) {
  return `${areaPorId(estado, r.areaId).nome}, ${fmtDataCurta(r.data)}, ${fmtHora(r.inicio)}–${fmtHora(r.fim)} (${r.status})`;
}

function contextoMorador(estado, eu, agora) {
  const hoje = isoDia(agora);
  const pessoa = pessoaDaUnidade(estado, eu);
  const fin = estado.financeiro;
  const responsavel = fin.unidades[eu].responsavel;
  const souResponsavel = !!responsavel && !!pessoa && responsavel.nome === pessoa.nome;
  const linhas = [`Pessoa: ${pessoa ? pessoa.nome : `Apto ${eu}`}, morador(a) do apto ${eu}. Responsável financeiro da unidade: ${responsavel ? responsavel.nome : 'não cadastrado'}${souResponsavel ? ' (é a própria pessoa)' : ' (outra pessoa: ela não vê as cobranças)'}.`];
  const pacotes = estado.encomendas.filter((e) => e.unidade === eu && e.status === 'aguardando');
  linhas.push(pacotes.length ? `Encomendas aguardando retirada: ${pacotes.map((e) => `${e.transportadora}, código ${e.codigo}, chegou em ${fmtDataCurta(isoDia(new Date(e.chegadaEm)))}${encomendaParada(e, agora) ? ' (parada há mais de 3 dias)' : ''}`).join('; ')}.` : 'Nenhuma encomenda aguardando retirada.');
  const reservas = estado.reservas.filter((r) => r.unidade === eu && ['pendente', 'confirmada'].includes(r.status) && r.data >= hoje);
  linhas.push(reservas.length ? `Reservas futuras da unidade: ${reservas.map((r) => quandoReservaAbel(estado, r)).join('; ')}.` : 'Nenhuma reserva futura.');
  if (souResponsavel) {
    const abertas = fin.cobrancas.filter((c) => c.unidade === eu && c.status === 'aberta');
    linhas.push(abertas.length
      ? `Cobranças em aberto: ${abertas.map((c) => `${nomeMes(c.competencia)}, ${situacaoCobranca(c, hoje) === 'vencida' ? 'vencida' : 'a vencer'}, vencimento ${fmtDataCurta(c.vencimento)}, valor atualizado ${fmtReais(valorAtualizado(c, fin.parametros, hoje).total)} (id ${c.id})`).join('; ')}.`
      : 'Nenhuma cobrança em aberto: financeiro em dia.');
  }
  const ocorrencias = estado.ocorrencias.filter((o) => o.unidade === eu);
  if (ocorrencias.length) linhas.push(`Ocorrências abertas por esta unidade: ${ocorrencias.map((o) => `${o.id} ${CATEGORIAS[o.categoria].nome} (${o.arquivada ? 'arquivada' : NOMES_STATUS[o.status]})`).join('; ')}.`);
  const naoLidos = comunicadosDaUnidade(estado, eu).filter((c) => !c.leituras.includes(eu));
  if (naoLidos.length) linhas.push(`Avisos não lidos: ${naoLidos.map((c) => `"${c.titulo}"`).join(', ')}.`);
  const { pendentes, respondidas, encerradas } = enquetesDaUnidade(estado, eu, agora);
  for (const e of pendentes) linhas.push(`Enquete aberta sem voto da unidade: ${e.id} "${e.pergunta}". Opções: ${e.opcoes.map((o) => `"${o.texto}" (id ${o.id})`).join(', ')}. ${e.tipo === 'multipla' ? `Até ${e.maxEscolhas} opções` : 'Escolha única'}, ${e.secreto ? 'voto secreto' : 'voto aberto'}, ${textoDiasRestantes(e, agora)}.`);
  for (const e of respondidas) linhas.push(`Enquete aberta já votada pela unidade: ${e.id} "${e.pergunta}" (pode trocar o voto até o encerramento).`);
  for (const e of encerradas) linhas.push(`Enquete encerrada: ${e.id} "${e.pergunta}": ${textoResultado(estado, e)}.`);
  for (const p of infracoesDaUnidade(estado, eu)) linhas.push(`Processo ${p.id} contra a unidade: ${NOMES_TIPO_INFRACAO[p.tipo]}${p.valor ? ` de ${fmtReais(p.valor)}` : ''}, ${p.artigo}, fato: "${p.fato}", situação: ${situacaoInfracao(p, hoje)}, prazo de defesa até ${fmtDataCurta(p.prazoAte)}${p.defesa ? ', defesa já enviada' : ''}.`);
  linhas.push(`Áreas reserváveis: ${estado.areas.map((a) => a.nome).join(', ')}.`);
  linhas.push('Esta pessoa NÃO pode ver: quem reservou outras datas, dívidas de outras unidades, autor de ocorrência anônima, votos de outras unidades, pedidos e conversas de outros moradores.');
  return linhas.join('\n');
}

function contextoSindico(estado, agora) {
  const hoje = isoDia(agora);
  const ind = indicadoresFinanceiros(estado, hoje);
  const atencao = [
    ...estado.reservas.filter((r) => r.status === 'pendente').map((r) => `Reserva pendente: ${quandoReservaAbel(estado, r)}, apto ${r.unidade}`),
    ...alertasNotificacoes(estado, agora), ...alertasManutencao(estado, agora), ...alertasEscala(estado, agora), ...alertasInfracoes(estado, hoje),
    ...alertasEnquetes(estado, agora), ...alertasContas(estado, hoje), ...alertasPrestacao(estado, hoje),
  ].map((a) => (typeof a === 'string' ? a : a.texto));
  const docs = alertasDocumentos(estado.documentos, hoje).map((a) => `${a.documento.titulo}: ${a.dias < 0 ? `vencido há ${-a.dias} dias` : `vence em ${a.dias} dias`}`);
  const paradas = estado.encomendas.filter((e) => encomendaParada(e, agora)).map((e) => `encomenda do apto ${e.unidade} parada desde ${fmtDataCurta(isoDia(new Date(e.chegadaEm)))}`);
  const linhas = [`Pessoa: ${estado.condominio.sindico.nome}, síndico (apto ${estado.condominio.sindico.unidade}). Plano: ${estado.plano}. Condomínio: ${estado.condominio.nome}, ${estado.condominio.unidades.length} unidades.`];
  linhas.push(`Precisa da atenção: ${[...atencao, ...docs, ...paradas].join('; ') || 'nada pendente'}.`);
  linhas.push(`Financeiro: saldo ${fmtReais(ind.saldo.valor)}; arrecadação de ${nomeMes(ind.arrecadado.competencia)}: ${fmtReais(ind.arrecadado.recebido)} de ${fmtReais(ind.arrecadado.previsto)} (${ind.arrecadado.pct}%); despesas do mês ${fmtReais(ind.despesas.valor)} contra orçado ${fmtReais(ind.despesas.orcado)}; próxima competência ${nomeMes(proximaCompetencia(estado.financeiro))}.`);
  const lista = devedores(estado, hoje);
  linhas.push(`Inadimplência: ${lista.length} unidades (${ind.inadimplencia.pct}%): ${lista.map((d) => `${d.unidade} (${d.cobrancas} cobranças, ${fmtReais(d.valor)}, ${d.dias} dias${d.acordo ? `, acordo ${d.acordo}` : ''})`).join('; ')}.`);
  for (const e of estado.enquetes.filter((x) => x.situacao !== 'rascunho')) {
    const a = apuracao(estado, e);
    linhas.push(`Enquete ${e.id} "${e.pergunta}": ${a.participantes} de ${a.total} responderam; ${a.opcoes.map((o) => `${o.texto} ${o.votos}`).join(', ')}; ${textoResultado(estado, e)}; ${faltantes(estado, e).length} unidades sem resposta.`);
  }
  linhas.push('O síndico pode ver inadimplência e processos; trate esses dados com discrição. O Sr. Abel não aprova, não multa e não decide nada pelo síndico.');
  return linhas.join('\n');
}

function contextoPortaria(estado, agora) {
  const hoje = isoDia(agora);
  const plantao = plantaoAgora(estado, agora);
  const turnos = Object.entries(POSTOS).map(([id, p]) => {
    const { atual, proximo } = plantao[id];
    return `${p.nome}: ${atual ? (atual.porteiro ? porteiroPorId(atual.porteiro).nome : 'descoberto') : 'fechado agora'}${proximo ? `, próximo ${proximo.porteiro ? porteiroPorId(proximo.porteiro).nome : 'descoberto'} às ${Number(proximo.inicio.slice(11, 13))}h` : ''}`;
  });
  const reservas = estado.reservas.filter((r) => r.data === hoje && ['pendente', 'confirmada'].includes(r.status));
  const pacotes = estado.encomendas.filter((e) => e.status === 'aguardando');
  return [
    'Pessoa: equipe da portaria (tablet da portaria).',
    `Plantão agora: ${turnos.join('; ')}.`,
    `Reservas de hoje: ${reservas.length ? reservas.map((r) => `${quandoReservaAbel(estado, r)}, apto ${r.unidade}, ${r.convidados.length} convidados`).join('; ') : 'nenhuma'}.`,
    `Encomendas aguardando retirada: ${pacotes.length} (${pacotes.map((e) => `apto ${e.unidade}`).join(', ')}).`,
    'A portaria NÃO vê dados financeiros nem autor de ocorrência anônima.',
  ].join('\n');
}

function contextoZelador(estado) {
  const os = listaOS(estado).filter((o) => o.status !== 'validada');
  const compras = estado.manutencao.compras.filter((c) => c.status !== 'recebida');
  return [
    `Pessoa: ${ZELADOR}, zelador. Plano: ${estado.plano}.`,
    `Ordens de serviço: ${os.length ? os.map((o) => `${o.id} "${o.descricao}" em ${o.local} (${o.status}, prioridade ${o.prioridade}, prazo ${fmtDataCurta(isoDia(new Date(o.prazo)))})`).join('; ') : 'nenhuma'}.`,
    `Compras em andamento: ${compras.length ? compras.map((c) => `${c.id} ${c.item} (${c.status})`).join('; ') : 'nenhuma'}.`,
    'O zelador NÃO vê receitas, inadimplência, saldo do condomínio nem dados pessoais de moradores.',
  ].join('\n');
}

function contextoConselho(estado, agora) {
  const hoje = isoDia(agora);
  const meses = mesesDaPrestacao(estado, hoje).map((m) => {
    const b = balanceteDe(estado, m, hoje);
    return `${nomeMes(m)}: ${NOMES_SITUACAO_BALANCETE[b.situacao]}${b.parcial ? ' (parcial)' : ''}, saldo final ${fmtReais(saldoFinal(b))}${b.comentarios.length ? `, ${b.comentarios.length} comentários` : ''}`;
  });
  return [`Pessoa: ${CONSELHEIRO.nome}, ${CONSELHEIRO.papel.toLowerCase()} (apto ${CONSELHEIRO.unidade}). Plano: ${estado.plano}.`, `Prestação de contas: ${meses.join('; ')}.`].join('\n');
}

export function contextoAbel(estado, perfil, agora) {
  if (perfil === 'morador') return contextoMorador(estado, estado.moradorAtual, agora);
  if (perfil === 'sindico') return contextoSindico(estado, agora);
  if (perfil === 'portaria') return contextoPortaria(estado, agora);
  if (perfil === 'zelador') return contextoZelador(estado);
  return contextoConselho(estado, agora);
}

export function instrucoesAbel(estado, perfil, agora) {
  return `Você é o Sr. Abel, a abelhinha assistente do aplicativo CondoFácil (gestão de condomínios). Siga à risca o MANUAL abaixo: ele define personalidade, limites e o funcionamento do app.

QUEM ESTÁ FALANDO COM VOCÊ: perfil "${perfil}". Hoje é ${fmtDataCurta(isoDia(agora))} (${isoDia(agora)}).

DADOS QUE ESTE PERFIL PODE VER (use para responder perguntas pessoais; nunca revele nada além disso):
${contextoAbel(estado, perfil, agora)}

REGRAS DE RESPOSTA:
- Português do Brasil, simpático, curto (2 a 6 frases ou passos numerados). Use **negrito** só para nomes de botões e telas.
- Responda apenas sobre o CondoFácil e a vida no condomínio. Fora disso, recuse com gentileza e volte ao tema.
- Se a pergunta pedir dados que este perfil não pode ver, explique que é privado e ofereça o que pode fazer.
- Antes de qualquer ação (reserva, ocorrência, voto, 2ª via), mostre um resumo e peça confirmação; só use a ferramenta depois do "sim".
- Se não souber, diga que não sabe e indique o síndico, a portaria ou comercial@condofacil.cloud. Não invente telas nem regras.

=== MANUAL DO SR. ABEL ===
${MANUAL_ABEL}
=== FIM DO MANUAL ===

Agora responda à conversa a seguir como Sr. Abel.`;
}
