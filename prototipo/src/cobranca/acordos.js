import { liberado, planoMinimo } from '../planos.js';
import { somarDias, somarMes } from '../datas.js';
import { situacaoCobranca, valorAtualizado } from './regras.js';

// Acordos de inadimplência: o acordo junta débitos vencidos; cada entrada ou parcela vira uma cobrança comum marcada com o acordo.
export const PARCELA_MINIMA = 5000;
const MAX_PARCELAS = 12;
const DIAS_ENTRADA = 3;

function falhaAcordo(motivo) {
  return { ok: false, motivo };
}

export function planoInsuficiente(recurso) {
  return `Disponível no plano ${planoMinimo(recurso).nome}`;
}

export function acordoComDebito(estado, idCobranca) {
  return estado.financeiro.acordos.find((a) => ['aguardando', 'ativo'].includes(a.situacao) && a.originais.includes(idCobranca));
}

function vencidasSemAcordo(estado, unidade, hoje) {
  return estado.financeiro.cobrancas.filter((c) => c.unidade === unidade && !c.acordo && situacaoCobranca(c, hoje) === 'vencida');
}

export function debitosParaAcordo(estado, unidade, hoje) {
  return vencidasSemAcordo(estado, unidade, hoje).filter((c) => !acordoComDebito(estado, c.id)).sort((a, b) => b.vencimento.localeCompare(a.vencimento));
}

export function cronogramaAcordo(financeiro, hoje, entrada, parcelas, valorParcela, ultimaParcela) {
  const vencimentoEntrada = somarDias(hoje, DIAS_ENTRADA);
  const dia = String(financeiro.parametros.diaVencimento).padStart(2, '0');
  const linhas = entrada ? [{ numero: 0, vencimento: vencimentoEntrada, valor: entrada }] : [];
  for (let k = 1; k <= parcelas; k++) linhas.push({ numero: k, vencimento: `${somarMes(vencimentoEntrada.slice(0, 7), k)}-${dia}`, valor: k === parcelas ? ultimaParcela : valorParcela });
  return linhas;
}

export function simularAcordo(estado, dados, hoje) {
  const fin = estado.financeiro;
  const { unidade, originais = [], perdoaMulta = false, jurosPerdoadosPct = 0, entrada = 0, parcelas } = dados;
  const vencidas = vencidasSemAcordo(estado, unidade, hoje);
  if (!vencidas.length) return falhaAcordo('Esta unidade não tem débitos vencidos');
  if (!originais.length) return falhaAcordo('Escolha ao menos um débito');
  for (const id of originais) {
    const outro = acordoComDebito(estado, id);
    if (outro) return falhaAcordo(`Este débito já está no acordo ${outro.id}`);
  }
  const escolhidas = vencidas.filter((c) => originais.includes(c.id));
  if (escolhidas.length !== originais.length) return falhaAcordo('Escolha só débitos vencidos desta unidade');
  if (!Number.isFinite(jurosPerdoadosPct) || jurosPerdoadosPct < 0 || jurosPerdoadosPct > 100) return falhaAcordo('Informe um perdão de juros entre 0% e 100%');
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > MAX_PARCELAS) return falhaAcordo('Escolha de 1 a 12 parcelas');
  const valores = escolhidas.map((c) => valorAtualizado(c, fin.parametros, hoje));
  const valorOriginal = escolhidas.reduce((soma, c) => soma + c.valor, 0);
  const multa = valores.reduce((soma, v) => soma + v.multa, 0);
  const juros = valores.reduce((soma, v) => soma + v.juros, 0);
  const desconto = (perdoaMulta ? multa : 0) + Math.round((juros * jurosPerdoadosPct) / 100);
  const total = valorOriginal + multa + juros - desconto;
  if (!Number.isInteger(entrada) || entrada < 0 || entrada >= total) return falhaAcordo('A entrada precisa ser menor que o total do acordo');
  const valorParcela = Math.floor((total - entrada) / parcelas);
  if (valorParcela < PARCELA_MINIMA) return falhaAcordo('Cada parcela precisa ter no mínimo R$ 50,00');
  const ultimaParcela = total - entrada - valorParcela * (parcelas - 1);
  return { ok: true, valorOriginal, multa, juros, desconto, total, valorParcela, ultimaParcela, cronograma: cronogramaAcordo(fin, hoje, entrada, parcelas, valorParcela, ultimaParcela) };
}

export function cronogramaDoAcordo(estado, acordo, hoje) {
  const ultima = acordo.total - acordo.entrada - acordo.valorParcela * (acordo.parcelas - 1);
  return cronogramaAcordo(estado.financeiro, hoje, acordo.entrada, acordo.parcelas, acordo.valorParcela, ultima);
}

export function cobrancasDoAcordo(estado, id) {
  return estado.financeiro.cobrancas.filter((c) => c.acordo && c.acordo.id === id && c.status !== 'cancelada').sort((a, b) => a.acordo.numero - b.acordo.numero);
}

export function progressoAcordo(estado, acordo) {
  const lista = cobrancasDoAcordo(estado, acordo.id);
  const parcelas = lista.filter((c) => c.acordo.numero > 0);
  return { pagas: parcelas.filter((c) => c.status === 'paga').length, total: acordo.parcelas, proxima: lista.find((c) => c.status === 'aberta') || null };
}

export function propostaPendente(estado, unidade) {
  return estado.financeiro.acordos.find((a) => a.unidade === unidade && a.situacao === 'aguardando');
}

export function acordoAtivo(estado, unidade) {
  return estado.financeiro.acordos.find((a) => a.unidade === unidade && a.situacao === 'ativo');
}

export function acordoDaUnidade(estado, unidade) {
  if (acordoAtivo(estado, unidade)) return 'ativo';
  if (propostaPendente(estado, unidade)) return 'aguardando';
  return null;
}

export function alertasAcordos(estado, hoje) {
  const fin = estado.financeiro;
  const itens = [];
  for (const a of fin.acordos) {
    if (a.situacao === 'ativo') {
      for (const c of cobrancasDoAcordo(estado, a.id).filter((x) => situacaoCobranca(x, hoje) === 'vencida')) {
        itens.push({ chave: `acordo-${c.id}`, texto: `Acordo ${a.id} (${a.unidade}): ${c.acordo.numero ? `parcela ${c.acordo.numero}` : 'entrada'} vencida`, href: `#sindico.cobranca.${a.id}` });
      }
    }
    if (a.situacao === 'aguardando') {
      const r = fin.unidades[a.unidade].responsavel;
      itens.push({ chave: `proposta-${a.id}`, texto: `Proposta ${a.id} aguarda aceite de ${r ? r.nome : `apto ${a.unidade}`}`, href: `#sindico.cobranca.${a.id}` });
    }
  }
  return itens;
}
