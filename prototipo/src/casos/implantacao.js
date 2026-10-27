import { cpfValido, fmtCpf, enderecoDoViaCep, gerarUnidades, sugestaoPrimeiroAndar, andarDoNumero, lerCsvUnidades, lerCsvMoradores, fracoesDasUnidades, identificadorCondominio, linkConvite, validarCondominio, mensagemWhatsAppConvite } from '../implantacao/regras.js';
import { condominioNovo } from '../implantacao/novo.js';
import { indicadoresSindico, alertasDocumentos, destinatarios, comunicadosDaUnidade, horariosDaArea } from '../regras.js';
import { indicadoresFinanceiros, devedores, previaCompetencia, proximaCompetencia, serieReceitasDespesas, tituloSerie, pendentesDaRegua } from '../cobranca/regras.js';
import { emitirCompetencia } from '../cobranca/acoes.js';
import { primeiraNaoEmitida, versaoVigente, alertasComposicao, simularComposicao, resumoVersao } from '../cobranca/composicao.js';
import { candidataDaPrevisao } from '../cobranca/orcamento.js';
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
import { confirmarConvite, aprovarMorador, recusarMorador, codigoDoConvite, moradoresPendentes } from '../implantacao/acoes.js';
import { atualizarMeusDados, salvarResidentes, residentesDaUnidade, definirResponsavel, removerPessoa, outrosDaUnidade } from '../moradores/acoes.js';
import { pessoaDaUnidade } from '../vendas/regras.js';
import { igual } from './afirmar.js';

export const AGORA_IMPLANTACAO = new Date(2026, 9, 23, 10, 0);
const CSV_TESTE = 'unidade;nome;email;celular;vinculo;responsavel\n101A;Maria Silva;maria@email.com;11987654321;titular;sim\n102A;João Souza;joao@email;119;locatário;não\nZ999;Pedro;;;;\n101A;Carlos Lima;carlos@email.com;11955554444;inquilino;sim';

export function configTeste() {
  const { unidades } = gerarUnidades({ blocos: ['A', 'B'], andares: 4, porAndar: 2, coberturaUltimo: true });
  const { validas } = lerCsvMoradores('101A;Maria Silva;maria@email.com;11987654321;titular;sim\n201B;Rui Costa;rui@email.com;11944443333;proprietario;sim', unidades.map((u) => u.id));
  return {
    condominio: { nome: 'Residencial Teste', cnpj: '12.345.678/0001-90', cep: '01310-100', endereco: 'Av. Paulista, 1000', cidade: 'São Paulo', uf: 'SP', sindico: { nome: 'Helena Prado', unidade: '402B', email: 'helena@email.com', celular: '11999998888' }, plano: 'intermediario' },
    unidades,
    moradores: validas,
    cobranca: { diaVencimento: 10, multaPct: 2, jurosPct: 1, fundoPct: 10, modo: 'fixo', valores: { A: 50000, cobertura: 75000 }, orcamento: 0 },
    asaas: { situacao: 'aprovada', ambiente: 'sandbox' },
    areas: ['salao', 'academia'],
  };
}

export const CASOS_IMPLANTACAO = [
  {
    nome: 'implantação: CPF do responsável na planilha',
    rodar() {
      igual([cpfValido('529.982.247-25'), cpfValido('52998224724'), cpfValido('11111111111'), cpfValido('123'), fmtCpf('52998224725')], [true, false, false, false, '529.982.247-25']);
      const l = lerCsvMoradores('101A;Maria;;;titular;sim;529.982.247-25\n102A;João;;;titular;sim;123\n201A;Ana;;;titular;sim', ['101A', '102A', '201A']);
      igual([l.linhas[0].dados.cpf, l.linhas[1].erros, l.linhas[2].dados.cpf, l.linhas[2].erros], ['52998224725', ['CPF inválido'], '', []]);
      const cfg = configTeste();
      const e = condominioNovo({ ...cfg, moradores: [{ ...cfg.moradores[0], cpf: '52998224725' }, cfg.moradores[1]] }, AGORA_IMPLANTACAO);
      igual([e.financeiro.unidades['101A'].responsavel.cpf, e.financeiro.unidades['201B'].responsavel.cpf], ['52998224725', null]);
    },
  },
  {
    nome: 'implantação: gerador e planilha de unidades',
    rodar() {
      const g = gerarUnidades({ blocos: ['A', 'B'], andares: 4, porAndar: 2, coberturaUltimo: true });
      igual([g.unidades.length, g.unidades[0].id, g.unidades.at(-1).id, g.unidades.filter((u) => u.tipo === 'cobertura').length], [16, '101A', '402B', 4]);
      igual(gerarUnidades({ andares: 8, porAndar: 4 }).unidades.map((u) => u.id).slice(0, 5), ['101', '102', '103', '104', '201']);
      igual([gerarUnidades({ andares: 0, porAndar: 2 }).erro, gerarUnidades({ andares: 3, porAndar: 21 }).erro, gerarUnidades({ blocos: ['A', 'a'], andares: 2, porAndar: 2 }).erro, gerarUnidades({ blocos: Array.from({ length: 30 }, (_, i) => `B${i}`), andares: 40, porAndar: 1 }).erro], ['Informe de 1 a 40 andares', 'Informe de 1 a 20 apartamentos por andar', 'Blocos repetidos', 'No máximo 1000 unidades']);
      const csv = lerCsvUnidades('unidade,bloco,tipo\n101,,\n1201,,cobertura');
      igual(csv.unidades.map((u) => [u.id, u.andar, u.tipo]), [['101', 1, 'A'], ['1201', 12, 'cobertura']]);
      igual(lerCsvUnidades('101\n101').erro, 'Linha 2: unidade 101 repetida');
    },
  },
  {
    nome: 'implantação: endereço pelo CEP (ViaCEP)',
    rodar() {
      igual(enderecoDoViaCep({ cep: '01310-100', logradouro: 'Avenida Paulista', bairro: 'Bela Vista', localidade: 'São Paulo', uf: 'SP' }), { endereco: 'Avenida Paulista', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP' });
      igual([enderecoDoViaCep({ erro: 'true' }), enderecoDoViaCep(null), enderecoDoViaCep({ localidade: 'Santo André', uf: 'SP' }).endereco], [null, null, '']);
    },
  },
  {
    nome: 'implantação: 1º andar digitado, soma por andar e bloco depois do número',
    rodar() {
      const g = gerarUnidades({ blocos: ['A', 'B'], andares: 4, primeiroAndar: [11, 12, 13, 14], somar: 10 });
      const ids = g.unidades.map((u) => u.id);
      igual([ids.length, ids.slice(0, 5), ids.slice(-4), g.unidades.find((u) => u.id === '31B').andar], [32, ['11A', '12A', '13A', '14A', '21A'], ['41B', '42B', '43B', '44B'], 3]);
      igual([gerarUnidades({ andares: 2, primeiroAndar: [11, 11], somar: 10 }).erro, gerarUnidades({ andares: 2, primeiroAndar: [1, 11], somar: 10 }).erro, gerarUnidades({ andares: 2, primeiroAndar: ['', 12], somar: 10 }).erro], ['Há números repetidos no 1º andar', 'A unidade 11 se repete entre andares: aumente o valor a somar', 'Preencha os números do 1º andar']);
      igual([sugestaoPrimeiroAndar(4, 10), sugestaoPrimeiroAndar(2, 100)], [[11, 12, 13, 14], [101, 102]]);
      const planilha = ['unidade;bloco;tipo', ...['A', 'B'].flatMap((b) => [11, 12, 13, 14, 21, 22, 23, 24, 31, 32, 33, 34, 41, 42, 43, 44].map((n) => `${n};${b};PADRAO`))].join('\n');
      const csv = lerCsvUnidades(planilha);
      igual([csv.erro, csv.unidades.length, csv.unidades[16].id, csv.unidades.find((u) => u.id === '24A').andar], [undefined, 32, '11B', 2]);
      igual([andarDoNumero('11A'), andarDoNumero('1204'), andarDoNumero('7'), lerCsvUnidades('11A;A\n11;A').erro, lerCsvUnidades('T1;;;0\nG2;;padrão;5').unidades.map((u) => u.andar)], [1, 12, 1, 'Linha 2: unidade 11A repetida', [1, 5]]);
    },
  },
  {
    nome: 'implantação: planilha de moradores com erros por linha',
    rodar() {
      const r = lerCsvMoradores(CSV_TESTE, ['101A', '102A']);
      igual(r.linhas.map((l) => l.erros), [[], ['E-mail inválido', 'Celular inválido'], ['Unidade Z999 não existe'], ['A unidade 101A já tem responsável financeiro']]);
      igual([r.validas.length, r.totalErros, r.linhas[1].dados.vinculo, r.linhas[0].numero], [1, 3, 'inquilino', 2]);
      igual(lerCsvMoradores('"101A","Silva, Maria","",""', ['101A']).validas[0].nome, 'Silva, Maria');
      igual(lerCsvMoradores('101A\tAna\t\t\tsocio', ['101A']).linhas[0].erros, ['Vínculo "socio" desconhecido']);
    },
  },
  {
    nome: 'implantação: frações, identificador, validação e divulgação',
    rodar() {
      const { unidades } = gerarUnidades({ blocos: ['A', 'B'], andares: 4, porAndar: 2, coberturaUltimo: true });
      const f = fracoesDasUnidades(unidades, { A: 50000, cobertura: 75000 });
      const soma = Object.values(f).reduce((s, x) => s + x, 0);
      igual([Math.abs(soma - 1) < 1e-9, f['102A'] < f['401A'], Math.round((f['401A'] / f['102A']) * 10) / 10], [true, true, 1.5]);
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
      igual([e.origem, e.condominio.nome, e.condominio.unidades.length, e.pessoas.map((p) => p.nome), e.moradorAtual], ['novo', 'Residencial Teste', 16, ['Helena Prado', 'Maria Silva', 'Rui Costa'], '402B']);
      igual([e.financeiro.unidades['101A'].responsavel.nome, e.financeiro.unidades['402B'].responsavel.nome, e.financeiro.unidades['102A'].responsavel], ['Maria Silva', 'Helena Prado', null]);
      igual([e.areas.map((a) => a.id), e.financeiro.cobrancas.length, e.financeiro.saldo], [['salao', 'academia'], 0, 0]);
      igual([primeiraNaoEmitida(e.financeiro), proximaCompetencia(e.financeiro), versaoVigente(e.financeiro).id], ['2026-10', '2026-10', 'CV-001']);
      const previa = previaCompetencia(e, '2026-10');
      igual([previa.linhas.length, previa.linhas.find((l) => l.unidade === '101A').total, previa.linhas.find((l) => l.unidade === '401A').total, previa.linhas.filter((l) => l.bloqueada).length], [16, 55000, 82500, 13]);
      const emitido = emitirCompetencia(e, '2026-10', 'sindico', AGORA_IMPLANTACAO);
      igual([emitido.emitidas, emitido.estado.financeiro.emitidas, primeiraNaoEmitida(emitido.estado.financeiro)], [3, ['2026-10'], '2026-11']);
    },
  },
  {
    nome: 'implantação: reajuste antes da primeira emissão e condomínio sem coberturas',
    rodar() {
      const e = condominioNovo(configTeste(), AGORA_IMPLANTACAO);
      const candidata = candidataDaPrevisao(e.financeiro, { linhas: [{ categoria: 'limpeza', valor: 1200000 }], margemPct: 0 });
      const sim = simularComposicao(e.financeiro, candidata);
      igual([sim.tipos.map((x) => x.antes), sim.arrecadacaoAntes], [[55000, 82500], 12 * 55000 + 4 * 82500]);
      const cfg = configTeste();
      const semCobertura = condominioNovo({ ...cfg, unidades: gerarUnidades({ blocos: [], andares: 2, porAndar: 2, coberturaUltimo: false }).unidades, moradores: [], condominio: { ...cfg.condominio, sindico: { nome: 'Helena Prado', unidade: '201' } } }, AGORA_IMPLANTACAO);
      const v = versaoVigente(semCobertura.financeiro);
      igual([simularComposicao(semCobertura.financeiro, v).tipos.map((x) => x.tipo), resumoVersao(semCobertura.financeiro, v).includes('Cobertura')], [['A'], false]);
    },
  },
  {
    nome: 'implantação: regras principais funcionam com o condomínio vazio',
    rodar() {
      const e = condominioNovo(configTeste(), AGORA_IMPLANTACAO);
      const agora = AGORA_IMPLANTACAO;
      const hoje = '2026-10-23';
      const ind = indicadoresSindico(e, agora);
      igual([ind.adesao.com, ind.adesao.total], [1, 16]);
      const fin = indicadoresFinanceiros(e, hoje);
      igual([fin.saldo.valor, fin.saldo.despesaMedia, fin.inadimplencia.unidades, fin.despesas.desvio, fin.arrecadado.pct], [0, 0, 0, 0, 0]);
      igual(devedores(e, hoje), []);
      const serie = serieReceitasDespesas(e, hoje);
      igual([serie.length, tituloSerie(serie), fin.arrecadado.alerta], [1, 'Ainda sem receitas e despesas registradas', false]);
      igual(pendentesDaRegua(e, hoje, e.plano), []);
      igual([alertasDocumentos(e.documentos, hoje), alertasNotificacoes(e, agora), alertasManutencao(e, agora), alertasInfracoes(e, hoje), alertasEnquetes(e, agora), alertasContas(e, hoje), alertasPrestacao(e, hoje), alertasComposicao(e)], [[], [], [], [], [], [], [], []]);
      igual(alertasEscala(e, agora).length >= 0, true);
      igual([caixaDeEntrada(e, agora, { status: 'ativas' }), listaOS(e), indicadorAtendimento(e).abertas], [[], [], 0]);
      igual(Object.keys(plantaoAgora(e, agora)).length > 0, true);
      const vivo = balanceteVivo(e, hoje);
      igual([saldoFinal(vivo), mesesDaPrestacao(e, hoje)], [0, ['2026-10']]);
      igual(fluxoProjetado(e, hoje, 0).serie.length, 91);
      igual([destinatarios(e, { tipo: 'andar', valor: '4' }).length, comunicadosDaUnidade(e, '101A'), enquetesDaUnidade(e, '101A', agora).pendentes], [4, [], []]);
      igual(horariosDaArea(e, 'academia', '2026-10-24', agora).length, 17);
      for (const perfil of ['sindico', 'morador', 'portaria', 'zelador', 'conselho']) igual(typeof contextoAbel(e, perfil, agora), 'string', perfil);
      igual(responderAbel(e, 'morador', 'Tenho encomenda na portaria?', agora).texto.includes('Nenhuma encomenda'), true);
    },
  },
  {
    nome: 'implantação: primeiro acesso pelo convite e aprovação do síndico',
    rodar() {
      const e = condominioNovo(configTeste(), AGORA_IMPLANTACAO);
      igual(e.pessoas.map((p) => p.situacao), ['ativo', 'convidado', 'convidado']);
      const cod = codigoDoConvite('11987654321');
      igual(confirmarConvite(e, { unidade: '101A', nome: 'Maria Silva', celular: '11987654321', codigo: '000000' }, AGORA_IMPLANTACAO).erro, 'Código inválido. Confira o SMS');
      igual(confirmarConvite(e, { unidade: 'Z1', nome: 'x', celular: '11987654321', codigo: cod }, AGORA_IMPLANTACAO).erro, 'Escolha a sua unidade');
      const maria = confirmarConvite(e, { unidade: '101a', nome: 'maria silva', celular: '(11) 98765-4321', codigo: cod }, AGORA_IMPLANTACAO);
      igual([maria.situacao, maria.estado.pessoas[1].situacao, maria.estado.moradorAtual, indicadoresSindico(maria.estado, AGORA_IMPLANTACAO).adesao.com], ['ativo', 'ativo', '101A', 2]);
      const novo = confirmarConvite(maria.estado, { unidade: '202A', nome: 'Paulo Reis', celular: '11911112222', codigo: codigoDoConvite('11911112222') }, AGORA_IMPLANTACAO);
      igual([novo.situacao, moradoresPendentes(novo.estado).map((p) => p.nome), novo.notificacao.texto], ['pendente', ['Paulo Reis'], 'Novo morador no apto 202A: Paulo Reis. Aprove no Início']);
      igual(aprovarMorador(novo.estado, novo.id, 'morador', AGORA_IMPLANTACAO).erro, 'Somente o síndico pode fazer isso');
      const ok = aprovarMorador(novo.estado, novo.id, 'sindico', AGORA_IMPLANTACAO).estado;
      igual([moradoresPendentes(ok).length, indicadoresSindico(ok, AGORA_IMPLANTACAO).adesao.com], [0, 3]);
      igual(recusarMorador(novo.estado, novo.id, 'sindico').estado.pessoas.length, 3);
    },
  },
  {
    nome: 'moradores: convite com outro nome, substituir na aprovação e pessoa atual no app',
    rodar() {
      const e = condominioNovo(configTeste(), AGORA_IMPLANTACAO);
      // Planilha: Maria Silva no 101A; pelo convite entra Ricardo, que não estava na planilha.
      const pedido = confirmarConvite(e, { unidade: '101A', nome: 'Ricardo Firmino', celular: '11925913118', codigo: codigoDoConvite('11925913118') }, AGORA_IMPLANTACAO);
      const ricardo = pedido.estado.pessoas.find((p) => p.id === pedido.id);
      igual([pedido.situacao, outrosDaUnidade(pedido.estado, ricardo).map((p) => p.nome)], ['pendente', ['Maria Silva']]);
      const adicional = aprovarMorador(pedido.estado, pedido.id, 'sindico', AGORA_IMPLANTACAO);
      igual([adicional.estado.pessoas.filter((p) => p.unidade === '101A').length, adicional.saiu], [2, []]);
      const sub = aprovarMorador(pedido.estado, pedido.id, 'sindico', AGORA_IMPLANTACAO, 'substituir');
      const resp = sub.estado.financeiro.unidades['101A'].responsavel;
      igual([sub.saiu, sub.estado.pessoas.filter((p) => p.unidade === '101A').map((p) => p.nome), resp.nome, resp.cpf], [['Maria Silva'], ['Ricardo Firmino'], 'Ricardo Firmino', null]);
      // O síndico nunca sai numa substituição.
      const naUnidadeDoSindico = confirmarConvite(e, { unidade: '402B', nome: 'Outra Pessoa', celular: '11900001111', codigo: codigoDoConvite('11900001111') }, AGORA_IMPLANTACAO);
      igual(aprovarMorador(naUnidadeDoSindico.estado, naUnidadeDoSindico.id, 'sindico', AGORA_IMPLANTACAO, 'substituir').saiu, []);
      // Com duas pessoas ativas no 101A, o app mostra quem entrou pelo convite.
      const ativos = { ...adicional.estado, pessoas: adicional.estado.pessoas.map((p) => (p.unidade === '101A' ? { ...p, situacao: 'ativo' } : p)) };
      const entrou = confirmarConvite(ativos, { unidade: '101A', nome: 'Ricardo Firmino', celular: '11925913118', codigo: codigoDoConvite('11925913118') }, AGORA_IMPLANTACAO);
      igual([pessoaDaUnidade(entrou.estado, '101A').nome, pessoaDaUnidade({ ...entrou.estado, pessoaAtual: null }, '101A').nome], ['Ricardo Firmino', 'Maria Silva']);
    },
  },
  {
    nome: 'moradores: meus dados, quem mora no apartamento, responsável financeiro e remoção',
    rodar() {
      const e = condominioNovo(configTeste(), AGORA_IMPLANTACAO);
      const maria = e.pessoas.find((p) => p.nome === 'Maria Silva');
      const r = atualizarMeusDados(e, maria.id, { nome: ' Maria S. Souza ', cpf: '529.982.247-25', celular: '(11) 98765-4321', email: 'maria@novo.com' });
      igual(r.estado.pessoas.find((p) => p.id === maria.id), { ...maria, nome: 'Maria S. Souza', cpf: '52998224725', celular: '11987654321', email: 'maria@novo.com' });
      igual([atualizarMeusDados(e, maria.id, { nome: '' }).erro, atualizarMeusDados(e, maria.id, { nome: 'M', cpf: '123' }).erro, atualizarMeusDados(e, maria.id, { nome: 'M', celular: '119' }).erro, atualizarMeusDados(e, 'x', { nome: 'M' }).erro], ['Informe o seu nome', 'CPF inválido', 'Celular inválido: use DDD + número', 'Cadastro não encontrado']);
      const casa = salvarResidentes(e, '101A', [{ nome: 'João Silva', telefone: '' }, { nome: ' Ana Silva ', telefone: '(11) 91234-5678' }, { nome: '', telefone: '' }]);
      igual(residentesDaUnidade(casa.estado, '101A'), [{ nome: 'João Silva', telefone: '' }, { nome: 'Ana Silva', telefone: '11912345678' }]);
      igual([residentesDaUnidade(e, '101A'), salvarResidentes(e, '101A', [{ nome: '', telefone: '11912345678' }]).erro, salvarResidentes(e, '101A', [{ nome: 'X', telefone: '12' }]).erro], [[], 'Informe o nome de cada pessoa', 'Telefone inválido: use DDD + número']);
      const def = definirResponsavel(e, '102A', { nome: 'Carlos Lima', cpf: '529.982.247-25', relacao: 'inquilino' }, 'sindico');
      igual(def.estado.financeiro.unidades['102A'].responsavel, { nome: 'Carlos Lima', relacao: 'inquilino', cpf: '52998224725', documento: 'CPF 529.982.247-25', canais: ['App', 'E-mail', 'WhatsApp'] });
      igual([definirResponsavel(e, '102A', { nome: 'X', cpf: '1' }, 'sindico').erro, definirResponsavel(e, '102A', { nome: 'X', cpf: '52998224725' }, 'morador').erro], ['Informe um CPF válido', 'Somente o síndico pode fazer isso']);
      const helena = e.pessoas.find((p) => p.nome === 'Helena Prado');
      igual([removerPessoa(e, maria.id, 'sindico').estado.pessoas.length, removerPessoa(e, helena.id, 'sindico').erro, removerPessoa(e, maria.id, 'morador').erro], [e.pessoas.length - 1, 'O síndico não pode ser removido por aqui', 'Somente o síndico pode fazer isso']);
    },
  },
];
