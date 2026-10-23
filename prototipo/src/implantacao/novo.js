import { isoDia, somarMes } from '../datas.js';
import { AREAS_MODELO, identificadorCondominio, fracoesDasUnidades, apenasDigitos } from './regras.js';

// Estado completo de um condomínio recém-implantado: os dados cadastrados e todo o resto vazio, no mesmo formato da demonstração.
export const VERSAO_CONDOMINIO_NOVO = 11;

function pessoaNova(m, n, agora, situacao = 'ativo') {
  return { id: `p${m.unidade}-${n}`, nome: m.nome, unidade: m.unidade, email: m.email || '', celular: m.celular || '', vinculo: m.vinculo || 'titular', situacao, criadaEm: agora.toISOString(), recebeOfertas: false, vendedor: 'nao', pedidoVenda: null, motivoVendedor: null, naoResidente: m.vinculo === 'proprietario' };
}

export function condominioNovo(config, agora) {
  const hoje = isoDia(agora);
  const mes = hoje.slice(0, 7);
  const c = config.condominio;
  const unidades = config.unidades;
  const ids = unidades.map((u) => u.id);
  const sindico = { nome: c.sindico.nome.trim(), unidade: c.sindico.unidade || ids[0], email: c.sindico.email || '', celular: apenasDigitos(c.sindico.celular) };
  const moradores = [...(config.moradores || [])];
  if (sindico.unidade && !moradores.some((m) => m.nome === sindico.nome)) moradores.unshift({ unidade: sindico.unidade, nome: sindico.nome, email: sindico.email, celular: sindico.celular, vinculo: 'titular', responsavel: !moradores.some((m) => m.unidade === sindico.unidade && m.responsavel) });
  // Só o síndico já usa o app; quem veio da planilha está "convidado" até entrar pelo convite.
  const pessoas = moradores.map((m, n) => pessoaNova(m, n + 1, agora, m.nome === sindico.nome && m.unidade === sindico.unidade ? 'ativo' : 'convidado'));
  const cob = config.cobranca;
  const valores = { A: Math.round(cob.valores.A), cobertura: Math.round(cob.valores.cobertura || cob.valores.A) };
  const fracoes = fracoesDasUnidades(unidades, valores);
  const unidadesFinanceiro = Object.fromEntries(unidades.map((u) => {
    const r = moradores.find((m) => m.unidade === u.id && m.responsavel);
    return [u.id, { tipo: u.tipo, fracao: fracoes[u.id], responsavel: r ? { nome: r.nome, relacao: r.vinculo === 'proprietario' ? 'proprietario' : r.vinculo === 'inquilino' ? 'inquilino' : 'titular', documento: 'CPF informado na implantação', canais: ['App', 'E-mail', 'WhatsApp'] } : null }];
  }));
  const vigente = somarMes(mes, -1);
  const versao = cob.modo === 'fracao'
    ? { id: 'CV-001', vigencia: mes, modo: 'fracao', ordinaria: null, orcamento: Math.round(cob.orcamento), fundoPct: cob.fundoPct, aprovadoEm: 'Implantação do condomínio', criadaEm: agora.toISOString(), criadaPor: 'Síndico' }
    : { id: 'CV-001', vigencia: mes, modo: 'fixo', ordinaria: valores, orcamento: null, fundoPct: cob.fundoPct, aprovadoEm: 'Implantação do condomínio', criadaEm: agora.toISOString(), criadaPor: 'Síndico' };
  const identificador = identificadorCondominio(c.nome);
  const categorias = { pessoal: 0, concessionarias: 0, manutencao: 0, administracao: 0, seguro: 0 };
  return {
    versao: VERSAO_CONDOMINIO_NOVO,
    origem: 'novo',
    geradoEm: hoje,
    proximoProtocolo: 1,
    infracoes: [],
    proximaInfracao: 1,
    enquetes: [],
    proximaEnquete: 1,
    condominio: {
      id: config.id || `cond-${identificador}-${agora.getTime().toString(36)}`, nome: c.nome.trim(), identificador, cnpj: apenasDigitos(c.cnpj), cep: apenasDigitos(c.cep), endereco: c.endereco || '', cidade: c.cidade || '', uf: c.uf || '',
      sindico, unidades: ids, unidadesInfo: Object.fromEntries(unidades.map((u) => [u.id, { bloco: u.bloco, andar: u.andar, tipo: u.tipo }])),
      asaas: config.asaas || { situacao: 'pendente', ambiente: 'sandbox' }, criadoEm: agora.toISOString(),
    },
    pessoas,
    areas: (config.areas || []).map((id) => AREAS_MODELO[id]).filter(Boolean).map((a) => ({ ...a, vinculadas: [] })),
    reservas: [], bloqueios: [], comunicados: [], ocorrencias: [], documentos: [], encomendas: [],
    moradorAtual: pessoas.length ? pessoas[0].unidade : ids[0],
    sacola: [], anuncios: [], pedidos: [], proximoPedido: 1,
    manutencao: { os: [], compras: [], caixa: { fundo: 30000, saldo: 30000, gastos: [], reposicoes: [] }, proximaOS: 1, proximaCompra: 1 },
    plano: c.plano || 'intermediario',
    financeiro: {
      parametros: { diaVencimento: cob.diaVencimento, diaFechamento: 20, multaPct: cob.multaPct, jurosPct: cob.jurosPct, descontoPct: 0, descontoAprovadoEm: '', formas: ['boleto', 'pix', 'cartao'], tarifa: 'condominio' },
      composicao: { versoes: [versao], extras: [], proximaVersao: 2, proximaExtra: 1 },
      unidades: unidadesFinanceiro,
      avulsos: [], ajustesPrevia: {},
      vigente, vencimentoVigente: `${vigente}-${String(cob.diaVencimento).padStart(2, '0')}`, emitidas: [],
      cobrancas: [], acordos: [], historico: [],
      despesasMes: { ...categorias }, orcamento: { ...categorias },
      previsoes: [], proximaPrevisao: 1, saldo: 0,
      contas: [], proximaConta: 1, balancetes: {}, ajustesMes: [], proximoComentario: 1, auditoria: [],
    },
    escala: { atribuicoes: [], ferias: [], trocas: [], meses: {}, proximaTroca: 1, semEquipe: true },
  };
}
