import { dadosIniciais } from '../dados.js';
import { trocarPlano } from '../cobranca/acoes.js';
import { situacaoConta, contasFiltradas, alertasContas, totalAPagar } from '../financeiro/contas.js';
import { novaConta, pagarConta, fecharMes, comentarLancamento, pedirCorrecao, aprovarMes, anexarNota, responderComentario, reenviarAoConselho, registrarAjuste, publicarResumo } from '../financeiro/acoes.js';
import { balanceteVivo, balanceteDe, saldoFinal, totalDespesas, totalReceitas, itensSemNota, resumoDoBalancete, alertasPrestacao, mesesDaPrestacao, resumosPublicados } from '../financeiro/balancete.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

const HOJE_FIN = '2026-10-19';

function contaDe(estado, id) {
  return estado.financeiro.contas.find((c) => c.id === id);
}

export const CASOS_FINANCEIRO = [
  {
    nome: 'financeiro: semente de contas bate com as despesas do mês',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const fin = e.financeiro;
      const pagas = fin.contas.filter((c) => c.situacao === 'paga');
      const porCategoria = {};
      for (const c of pagas) porCategoria[c.categoria] = (porCategoria[c.categoria] || 0) + c.valor;
      porCategoria.manutencao += 14500;
      igual(porCategoria, fin.despesasMes);
      igual(['CT-009', 'CT-010', 'CT-011'].map((id) => situacaoConta(contaDe(e, id), HOJE_FIN)), ['aberta', 'hoje', 'vencida']);
      igual(alertasContas(e, HOJE_FIN).map((a) => a.texto), ['Conta vencida: Dedetização trimestral (R$ 450,00)', 'Vence hoje: Gás da área gourmet (R$ 180,00)']);
      igual([contasFiltradas(e, 'vencidas', HOJE_FIN).length, contasFiltradas(e, 'pagas', HOJE_FIN).length, totalAPagar(e, HOJE_FIN)], [1, 8, 443000]);
    },
  },
  {
    nome: 'financeiro: pagar conta lança despesa, baixa saldo e gera a recorrente',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const r = pagarConta(e, 'CT-010', 'sindico', AGORA_FASE2);
      const fin = r.estado.financeiro;
      igual([contaDe(r.estado, 'CT-010').situacao, fin.despesasMes.concessionarias, fin.saldo], ['paga', 408000, e.financeiro.saldo - 18000]);
      igual([r.seguinte, contaDe(r.estado, 'CT-012').vencimento, contaDe(r.estado, 'CT-012').situacao], ['CT-012', '2026-11-19', 'aberta']);
      igual(fin.auditoria.at(-1).acao, 'Conta paga');
      igual(pagarConta(r.estado, 'CT-010', 'sindico', AGORA_FASE2).erro, 'Esta conta já foi paga');
      const d = pagarConta(e, 'CT-011', 'sindico', AGORA_FASE2);
      igual([d.seguinte, d.estado.financeiro.contas.length], [null, e.financeiro.contas.length]);
      igual(pagarConta(e, 'CT-010', 'zelador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      igual(pagarConta(trocarPlano(e, 'basico').estado, 'CT-010', 'sindico', AGORA_FASE2).erro, 'Disponível no plano Intermediário');
    },
  },
  {
    nome: 'financeiro: nova conta valida os campos',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const dados = { fornecedor: 'Pinturas Sol', categoria: 'manutencao', descricao: 'Pintura do hall', valor: 250000, vencimento: '2026-11-05', recorrente: false };
      igual(novaConta(e, { ...dados, fornecedor: ' ' }, 'sindico').erro, 'Informe o fornecedor');
      igual(novaConta(e, { ...dados, categoria: 'x' }, 'sindico').erro, 'Escolha a categoria');
      igual(novaConta(e, { ...dados, valor: 0 }, 'sindico').erro, 'Informe o valor');
      igual(novaConta(e, { ...dados, vencimento: '' }, 'sindico').erro, 'Informe o vencimento');
      const r = novaConta(e, dados, 'sindico');
      igual([r.id, contaDe(r.estado, r.id).situacao, r.estado.financeiro.proximaConta], ['CT-012', 'aberta', 13]);
    },
  },
  {
    nome: 'prestação: saldos encadeados e mês corrente batendo com o saldo',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const fin = e.financeiro;
      const ago = fin.balancetes['2026-08'];
      const set = fin.balancetes['2026-09'];
      igual([ago.situacao, set.situacao, mesesDaPrestacao(e, HOJE_FIN)], ['aprovado', 'aberto', ['2026-10', '2026-09', '2026-08']]);
      igual(saldoFinal(ago), set.saldoInicial);
      igual([totalReceitas(set), totalDespesas(set)], [2700000, 1790000]);
      const vivo = balanceteVivo(e, HOJE_FIN);
      igual([vivo.saldoInicial, saldoFinal(vivo), totalDespesas(vivo)], [saldoFinal(set), fin.saldo, 1810000]);
      igual(vivo.despesas.flatMap((d) => d.itens).some((i) => i.id.startsWith('outros-')), false);
      igual(itensSemNota(set).map((i) => i.descricao), ['Dedetização · Imunizadora Verde']);
      igual(alertasPrestacao(e, HOJE_FIN).map((a) => a.texto), ['Feche o balancete de setembro de 2026']);
      igual(resumosPublicados(e).map((r) => r.mes), ['2026-08']);
      igual(e.documentos.find((d) => d.id === 'd5').titulo, 'Balancete de agosto de 2026');
      const pago = pagarConta(e, 'CT-010', 'sindico', AGORA_FASE2).estado;
      igual(saldoFinal(balanceteVivo(pago, HOJE_FIN)), pago.financeiro.saldo);
    },
  },
  {
    nome: 'prestação: fechar no Intermediário trava; mês corrente não fecha',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(fecharMes(e, '2026-10', 'sindico', AGORA_FASE2).erro, 'O mês ainda não terminou');
      const r = fecharMes(e, '2026-09', 'sindico', AGORA_FASE2);
      const b = r.estado.financeiro.balancetes['2026-09'];
      const doc = r.estado.documentos.find((d) => d.id === b.documento);
      igual([b.situacao, doc.titulo, doc.visibilidade, r.notificacao.texto], ['fechado', 'Balancete de setembro de 2026', 'conselho', 'Balancete de setembro de 2026 fechado e travado']);
      igual(fecharMes(r.estado, '2026-09', 'sindico', AGORA_FASE2).erro, 'Este mês já foi fechado');
      igual(anexarNota(r.estado, '2026-09', '2026-09-manutencao-dedetizacao', 'sindico').erro, 'Mês travado: registre um ajuste no mês corrente');
      const pub = publicarResumo(r.estado, '2026-09', 'sindico', AGORA_FASE2);
      igual([pub.estado.documentos.at(-1).visibilidade, publicarResumo(pub.estado, '2026-09', 'sindico', AGORA_FASE2).erro], ['todos', 'O resumo já foi publicado']);
      igual(publicarResumo(e, '2026-09', 'sindico', AGORA_FASE2).erro, 'Feche o mês antes de publicar');
    },
  },
  {
    nome: 'prestação: ciclo do conselho no Avançado',
    rodar() {
      const e = trocarPlano(dadosIniciais(AGORA_FASE2), 'avancado').estado;
      const f = fecharMes(e, '2026-09', 'sindico', AGORA_FASE2);
      igual([f.estado.financeiro.balancetes['2026-09'].situacao, f.notificacao.para], ['aguardando', 'Gustavo Freitas (conselho fiscal)']);
      const item = '2026-09-manutencao-dedetizacao';
      igual(comentarLancamento(f.estado, '2026-09', item, 'x', 'sindico', AGORA_FASE2).erro, 'Somente o conselho fiscal pode fazer isso');
      const c = comentarLancamento(f.estado, '2026-09', item, 'Falta a nota da dedetização', 'conselho', AGORA_FASE2);
      igual(c.id, 'CM-1');
      igual(pedirCorrecao(c.estado, '2026-09', ' ', 'conselho', AGORA_FASE2).erro, 'Informe o motivo');
      const p = pedirCorrecao(c.estado, '2026-09', 'Anexar a nota da dedetização', 'conselho', AGORA_FASE2);
      igual([p.estado.financeiro.balancetes['2026-09'].situacao, alertasPrestacao(p.estado, HOJE_FIN).map((a) => a.texto)], ['correcao', ['Balancete de setembro de 2026: o conselho pediu correção']]);
      igual(publicarResumo(p.estado, '2026-09', 'sindico', AGORA_FASE2).erro, 'Aguarde a aprovação do conselho');
      let s = anexarNota(p.estado, '2026-09', item, 'sindico').estado;
      s = responderComentario(s, '2026-09', 'CM-1', 'Nota anexada', 'sindico', AGORA_FASE2).estado;
      igual(itensSemNota(s.financeiro.balancetes['2026-09']).length, 0);
      s = reenviarAoConselho(s, '2026-09', 'sindico', AGORA_FASE2).estado;
      igual(s.financeiro.balancetes['2026-09'].situacao, 'aguardando');
      igual(anexarNota(s, '2026-09', item, 'sindico').erro, 'Aguarde a análise do conselho');
      const a = aprovarMes(s, '2026-09', 'conselho', AGORA_FASE2);
      const b = a.estado.financeiro.balancetes['2026-09'];
      igual([b.situacao, b.aprovadoPor, b.comentarios[0].resposta.texto], ['aprovado', 'Gustavo Freitas', 'Nota anexada']);
      igual(a.estado.documentos.find((d) => d.id === b.documento).versoes.length, 2);
      igual(publicarResumo(a.estado, '2026-09', 'sindico', AGORA_FASE2).erro, undefined);
      igual(aprovarMes(trocarPlano(f.estado, 'intermediario').estado, '2026-09', 'conselho', AGORA_FASE2).erro, 'Disponível no plano Avançado');
    },
  },
  {
    nome: 'prestação: ajuste de mês travado entra no mês corrente',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(registrarAjuste(e, '2026-09', { descricao: 'x', categoria: 'administracao', valor: 100 }, 'sindico', AGORA_FASE2).erro, 'Ajustes só valem para meses travados');
      const r = registrarAjuste(e, '2026-08', { descricao: 'Tarifa bancária não lançada', categoria: 'administracao', valor: 3500 }, 'sindico', AGORA_FASE2);
      const vivo = balanceteVivo(r.estado, HOJE_FIN);
      const adm = vivo.despesas.find((d) => d.categoria === 'administracao').itens.map((i) => i.descricao);
      igual([r.id, adm.includes('Ajuste referente a agosto de 2026: Tarifa bancária não lançada'), saldoFinal(vivo), r.estado.financeiro.saldo], ['AJ-1', true, e.financeiro.saldo - 3500, e.financeiro.saldo - 3500]);
    },
  },
  {
    nome: 'prestação: resumo para moradores sem unidades',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const resumo = resumoDoBalancete(e, balanceteDe(e, '2026-08', HOJE_FIN));
      igual([resumo.inadimplenciaPct, resumo.despesas.length, JSON.stringify(resumo).includes('unidade')], [9.4, 5, false]);
    },
  },
];
