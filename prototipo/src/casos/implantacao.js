import { gerarUnidades, lerCsvUnidades, lerCsvMoradores, fracoesDasUnidades, identificadorCondominio, linkConvite, validarCondominio, mensagemWhatsAppConvite } from '../implantacao/regras.js';
import { condominioNovo } from '../implantacao/novo.js';
import { indicadoresSindico, alertasDocumentos, destinatarios, comunicadosDaUnidade, horariosDaArea } from '../regras.js';
import { indicadoresFinanceiros, devedores, previaCompetencia, proximaCompetencia, serieReceitasDespesas, tituloSerie, pendentesDaRegua } from '../cobranca/regras.js';
import { emitirCompetencia } from '../cobranca/acoes.js';
import { primeiraNaoEmitida, versaoVigente, alertasComposicao } from '../cobranca/composicao.js';
import { caixaDeEntrada, alertasNotificacoes, indicadorAtendimento } from '../notificacoes/regras.js';
import { listaOS, alertasManutencao } from '../manutencao/regras.js';
import { plantaoAgora, alertasEscala } from '../escala/regras.js';
import { alertasInfracoes } from '../infracoes/regras.js';
import { alertasEnquetes, enquetesDaUnidade } from '../enquetes/regras.js';
import { alertasContas } from '../financeiro/contas.js';
import { balanceteVivo, mesesDaPrestacao, alertasPrestacao, saldoFinal } from '../financeiro/balancete.js';
import { fluxoProjetado } from '../financeiro/fluxo.js';
import { contextoAbel } from '../assistente/ia.js';
import { responderAbel } from '../assistente/regras.js';
import { igual } from './afirmar.js';

export const AGORA_IMPLANTACAO = new Date(2026, 9, 23, 10, 0);
const CSV_TESTE = 'unidade;nome;email;celular;vinculo;responsavel\nA101;Maria Silva;maria@email.com;11987654321;titular;sim\nA102;João Souza;joao@email;119;locatário;não\nZ999;Pedro;;;;\nA101;Carlos Lima;carlos@email.com;11955554444;inquilino;sim';

export function configTeste() {
  const { unidades } = gerarUnidades({ blocos: ['A', 'B'], andares: 4, porAndar: 2, coberturaUltimo: true });
  const { validas } = lerCsvMoradores('A101;Maria Silva;maria@email.com;11987654321;titular;sim\nB201;Rui Costa;rui@email.com;11944443333;proprietario;sim', unidades.map((u) => u.id));
  return {
    condominio: { nome: 'Residencial Teste', cnpj: '12.345.678/0001-90', cep: '01310-100', endereco: 'Av. Paulista, 1000', cidade: 'São Paulo', uf: 'SP', sindico: { nome: 'Helena Prado', unidade: 'B402', email: 'helena@email.com', celular: '11999998888' }, plano: 'intermediario' },
    unidades,
    moradores: validas,
    cobranca: { diaVencimento: 10, multaPct: 2, jurosPct: 1, fundoPct: 10, modo: 'fixo', valores: { A: 50000, cobertura: 75000 }, orcamento: 0 },
    asaas: { situacao: 'aprovada', ambiente: 'sandbox' },
    areas: ['salao', 'academia'],
  };
}

export const CASOS_IMPLANTACAO = [
  {
    nome: 'implantação: gerador e planilha de unidades',
    rodar() {
      const g = gerarUnidades({ blocos: ['A', 'B'], andares: 4, porAndar: 2, coberturaUltimo: true });
      igual([g.unidades.length, g.unidades[0].id, g.unidades.at(-1).id, g.unidades.filter((u) => u.tipo === 'cobertura').length], [16, 'A101', 'B402', 4]);
      igual(gerarUnidades({ andares: 8, porAndar: 4 }).unidades.map((u) => u.id).slice(0, 5), ['101', '102', '103', '104', '201']);
      igual([gerarUnidades({ andares: 0, porAndar: 2 }).erro, gerarUnidades({ andares: 3, porAndar: 21 }).erro, gerarUnidades({ blocos: ['A', 'a'], andares: 2, porAndar: 2 }).erro, gerarUnidades({ blocos: Array.from({ length: 30 }, (_, i) => `B${i}`), andares: 40, porAndar: 1 }).erro], ['Informe de 1 a 40 andares', 'Informe de 1 a 20 apartamentos por andar', 'Blocos repetidos', 'No máximo 1000 unidades']);
      const csv = lerCsvUnidades('unidade,bloco,tipo\n101,,\n1201,,cobertura');
      igual(csv.unidades.map((u) => [u.id, u.andar, u.tipo]), [['101', 1, 'A'], ['1201', 12, 'cobertura']]);
      igual(lerCsvUnidades('101\n101').erro, 'Linha 2: unidade 101 repetida');
    },
  },
  {
    nome: 'implantação: planilha de moradores com erros por linha',
    rodar() {
      const r = lerCsvMoradores(CSV_TESTE, ['A101', 'A102']);
      igual(r.linhas.map((l) => l.erros), [[], ['E-mail inválido', 'Celular inválido'], ['Unidade Z999 não existe'], ['A unidade A101 já tem responsável financeiro']]);
      igual([r.validas.length, r.totalErros, r.linhas[1].dados.vinculo, r.linhas[0].numero], [1, 3, 'inquilino', 2]);
      igual(lerCsvMoradores('"A101","Silva, Maria","",""', ['A101']).validas[0].nome, 'Silva, Maria');
      igual(lerCsvMoradores('A101\tAna\t\t\tsocio', ['A101']).linhas[0].erros, ['Vínculo "socio" desconhecido']);
    },
  },
  {
    nome: 'implantação: frações, identificador, validação e divulgação',
    rodar() {
      const { unidades } = gerarUnidades({ blocos: ['A', 'B'], andares: 4, porAndar: 2, coberturaUltimo: true });
      const f = fracoesDasUnidades(unidades, { A: 50000, cobertura: 75000 });
      const soma = Object.values(f).reduce((s, x) => s + x, 0);
      igual([Math.abs(soma - 1) < 1e-9, f.A102 < f.A401, Math.round((f.A401 / f.A102) * 10) / 10], [true, true, 1.5]);
      igual([identificadorCondominio('Residencial Ipê Amarelo'), linkConvite('residencial-teste')], ['residencial-ipe-amarelo', 'https://condofacil.cloud/c/residencial-teste']);
      const base = configTeste().condominio;
      igual([validarCondominio({ ...base, nome: ' ' }), validarCondominio({ ...base, cnpj: '123' }), validarCondominio({ ...base, sindico: { nome: '' } }), validarCondominio(base)], ['Informe o nome do condomínio', 'O CNPJ deve ter 14 dígitos', 'Informe o nome do síndico', null]);
      igual(mensagemWhatsAppConvite('Residencial Teste', linkConvite('residencial-teste')).includes('https://condofacil.cloud/c/residencial-teste'), true);
    },
  },
  {
    nome: 'implantação: condomínio novo nasce válido e vazio',
    rodar() {
      const e = condominioNovo(configTeste(), AGORA_IMPLANTACAO);
      igual([e.origem, e.condominio.nome, e.condominio.unidades.length, e.pessoas.map((p) => p.nome), e.moradorAtual], ['novo', 'Residencial Teste', 16, ['Helena Prado', 'Maria Silva', 'Rui Costa'], 'B402']);
      igual([e.financeiro.unidades.A101.responsavel.nome, e.financeiro.unidades.B402.responsavel.nome, e.financeiro.unidades.A102.responsavel], ['Maria Silva', 'Helena Prado', null]);
      igual([e.areas.map((a) => a.id), e.financeiro.cobrancas.length, e.financeiro.saldo], [['salao', 'academia'], 0, 0]);
      igual([primeiraNaoEmitida(e.financeiro), proximaCompetencia(e.financeiro), versaoVigente(e.financeiro).id], ['2026-10', '2026-10', 'CV-001']);
      const previa = previaCompetencia(e, '2026-10');
      igual([previa.linhas.length, previa.linhas.find((l) => l.unidade === 'A101').total, previa.linhas.find((l) => l.unidade === 'A401').total, previa.linhas.filter((l) => l.bloqueada).length], [16, 55000, 82500, 13]);
      const emitido = emitirCompetencia(e, '2026-10', 'sindico', AGORA_IMPLANTACAO);
      igual([emitido.emitidas, emitido.estado.financeiro.emitidas, primeiraNaoEmitida(emitido.estado.financeiro)], [3, ['2026-10'], '2026-11']);
    },
  },
  {
    nome: 'implantação: regras principais funcionam com o condomínio vazio',
    rodar() {
      const e = condominioNovo(configTeste(), AGORA_IMPLANTACAO);
      const agora = AGORA_IMPLANTACAO;
      const hoje = '2026-10-23';
      const ind = indicadoresSindico(e, agora);
      igual([ind.adesao.com, ind.adesao.total], [2, 16]);
      const fin = indicadoresFinanceiros(e, hoje);
      igual([fin.saldo.valor, fin.saldo.despesaMedia, fin.inadimplencia.unidades, fin.despesas.desvio, fin.arrecadado.pct], [0, 0, 0, 0, 0]);
      igual(devedores(e, hoje), []);
      const serie = serieReceitasDespesas(e, hoje);
      igual([serie.length, typeof tituloSerie(serie)], [1, 'string']);
      igual(pendentesDaRegua(e, hoje, e.plano), []);
      igual([alertasDocumentos(e.documentos, hoje), alertasNotificacoes(e, agora), alertasManutencao(e, agora), alertasInfracoes(e, hoje), alertasEnquetes(e, agora), alertasContas(e, hoje), alertasPrestacao(e, hoje), alertasComposicao(e)], [[], [], [], [], [], [], [], []]);
      igual(alertasEscala(e, agora).length >= 0, true);
      igual([caixaDeEntrada(e, agora, { status: 'ativas' }), listaOS(e), indicadorAtendimento(e).abertas], [[], [], 0]);
      igual(Object.keys(plantaoAgora(e, agora)).length > 0, true);
      const vivo = balanceteVivo(e, hoje);
      igual([saldoFinal(vivo), mesesDaPrestacao(e, hoje)], [0, ['2026-10']]);
      igual(fluxoProjetado(e, hoje, 0).serie.length, 91);
      igual([destinatarios(e, { tipo: 'andar', valor: '4' }).length, comunicadosDaUnidade(e, 'A101'), enquetesDaUnidade(e, 'A101', agora).pendentes], [4, [], []]);
      igual(horariosDaArea(e, 'academia', '2026-10-24', agora).length, 17);
      for (const perfil of ['sindico', 'morador', 'portaria', 'zelador', 'conselho']) igual(typeof contextoAbel(e, perfil, agora), 'string', perfil);
      igual(responderAbel(e, 'morador', 'Tenho encomenda na portaria?', agora).texto.includes('Nenhuma encomenda'), true);
    },
  },
];
