import { CATEGORIAS } from '../dados.js';
import { isoDia, fmtDataCurta } from '../datas.js';

// Processo de infração: advertência ou multa com prazo de defesa, decidida pelo síndico com justificativa.
export const NOMES_TIPO_INFRACAO = { advertencia: 'Advertência', multa: 'Multa' };
export const NOMES_SITUACAO_INFRACAO = { defesa: 'Aguardando defesa', analise: 'Em análise', decidido: 'Decidido' };
export const NOMES_RESULTADO_INFRACAO = { mantida: 'Mantida', convertida: 'Convertida em advertência', cancelada: 'Cancelada' };
export const PRAZO_DEFESA_PADRAO = 10;

export function infracaoPorId(estado, id) {
  return estado.infracoes.find((p) => p.id === id) || null;
}

export function prazoVencido(p, hoje) {
  return p.prazoEncerrado || hoje > p.prazoAte;
}

export function situacaoInfracao(p, hoje) {
  return p.situacao === 'defesa' && prazoVencido(p, hoje) ? 'analise' : p.situacao;
}

export function podeDecidir(p, hoje) {
  return p.situacao !== 'decidido' && (!!p.defesa || prazoVencido(p, hoje));
}

export function infracoesDaUnidade(estado, unidade) {
  return estado.infracoes.filter((p) => p.unidade === unidade).sort((a, b) => b.abertoEm.localeCompare(a.abertoEm));
}

export function infracoesAbertas(estado) {
  return estado.infracoes.filter((p) => p.situacao !== 'decidido').sort((a, b) => a.prazoAte.localeCompare(b.prazoAte));
}

export function alertasInfracoes(estado, hoje) {
  return infracoesAbertas(estado).filter((p) => podeDecidir(p, hoje)).map((p) => ({
    chave: `infracao-${p.id}`,
    href: `#sindico.ocorrencias.${p.id}`,
    texto: `${p.id}: ${p.defesa ? 'defesa recebida' : 'prazo de defesa encerrado'}, decida`,
  }));
}

export function fatoPadrao(oc) {
  return `${CATEGORIAS[oc.categoria].nome} registrada em ${fmtDataCurta(isoDia(new Date(oc.criadaEm)))}`;
}

export function textoDecisao(p) {
  if (!p.decisao) return null;
  const multa = p.decisao.resultado === 'mantida' && p.tipo === 'multa';
  return `${NOMES_RESULTADO_INFRACAO[p.decisao.resultado]}${multa ? ' · multa no boleto do próximo mês' : ''}`;
}
