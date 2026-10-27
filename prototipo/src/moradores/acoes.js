import { trocarItem } from '../acoes.js';
import { apenasDigitos, cpfValido, fmtCpf, celularValido, emailValido } from '../implantacao/regras.js';
import { NOMES_RELACAO } from '../cobranca/dados.js';

// Cadastro dos moradores: o morador cuida dos próprios dados e de quem mora com ele; o síndico, do responsável financeiro.
const SO_SINDICO_CADASTRO = 'Somente o síndico pode fazer isso';
const MAX_RESIDENTES = 15;

function erroCadastro(estado, mensagem) {
  return { estado, erro: mensagem };
}

export function ehSindico(estado, pessoa) {
  const s = estado.condominio.sindico;
  return !!s && pessoa.nome === s.nome && pessoa.unidade === s.unidade;
}

// As outras pessoas da unidade, menos o síndico: quem sai quando a aprovação substitui.
export function outrosDaUnidade(estado, pessoa) {
  return estado.pessoas.filter((p) => p.unidade === pessoa.unidade && p.id !== pessoa.id && !ehSindico(estado, p));
}

export function residentesDaUnidade(estado, unidade) {
  return (estado.residentes || {})[unidade] || [];
}

export function atualizarMeusDados(estado, idPessoa, { nome, cpf, celular, email }) {
  const p = estado.pessoas.find((x) => x.id === idPessoa);
  if (!p) return erroCadastro(estado, 'Cadastro não encontrado');
  const n = String(nome || '').trim();
  if (!n) return erroCadastro(estado, 'Informe o seu nome');
  if (String(cpf || '').trim() && !cpfValido(cpf)) return erroCadastro(estado, 'CPF inválido');
  if (String(celular || '').trim() && !celularValido(celular)) return erroCadastro(estado, 'Celular inválido: use DDD + número');
  if (String(email || '').trim() && !emailValido(email)) return erroCadastro(estado, 'E-mail inválido');
  return { estado: { ...estado, pessoas: trocarItem(estado.pessoas, idPessoa, { nome: n, cpf: apenasDigitos(cpf), celular: apenasDigitos(celular), email: String(email || '').trim() }) } };
}

export function salvarResidentes(estado, unidade, lista) {
  const limpa = lista.map((r) => ({ nome: String(r.nome || '').trim(), telefone: String(r.telefone || '').trim() })).filter((r) => r.nome || r.telefone);
  if (limpa.some((r) => !r.nome)) return erroCadastro(estado, 'Informe o nome de cada pessoa');
  if (limpa.some((r) => r.telefone && !celularValido(r.telefone))) return erroCadastro(estado, 'Telefone inválido: use DDD + número');
  if (limpa.length > MAX_RESIDENTES) return erroCadastro(estado, `No máximo ${MAX_RESIDENTES} pessoas por apartamento`);
  const residentes = { ...(estado.residentes || {}), [unidade]: limpa.map((r) => ({ nome: r.nome, telefone: apenasDigitos(r.telefone) })) };
  return { estado: { ...estado, residentes } };
}

export function definirResponsavel(estado, unidade, { nome, cpf, relacao }, perfil) {
  if (perfil !== 'sindico') return erroCadastro(estado, SO_SINDICO_CADASTRO);
  const fin = estado.financeiro;
  if (!fin.unidades[unidade]) return erroCadastro(estado, 'Unidade não encontrada');
  const n = String(nome || '').trim();
  if (!n) return erroCadastro(estado, 'Informe o nome do responsável financeiro');
  if (!cpfValido(cpf)) return erroCadastro(estado, 'Informe um CPF válido');
  const atual = fin.unidades[unidade].responsavel || {};
  const responsavel = { ...atual, nome: n, relacao: NOMES_RELACAO[relacao] ? relacao : atual.relacao || 'titular', cpf: apenasDigitos(cpf), documento: `CPF ${fmtCpf(cpf)}`, canais: atual.canais || ['App', 'E-mail', 'WhatsApp'] };
  return {
    estado: { ...estado, financeiro: { ...fin, unidades: { ...fin.unidades, [unidade]: { ...fin.unidades[unidade], responsavel } } } },
    notificacao: { canal: 'App', para: n, texto: `Você é o responsável financeiro do apto ${unidade}: as cobranças passam a sair no seu nome` },
  };
}

export function removerPessoa(estado, id, perfil) {
  if (perfil !== 'sindico') return erroCadastro(estado, SO_SINDICO_CADASTRO);
  const p = estado.pessoas.find((x) => x.id === id);
  if (!p) return erroCadastro(estado, 'Cadastro não encontrado');
  if (ehSindico(estado, p)) return erroCadastro(estado, 'O síndico não pode ser removido por aqui');
  return { estado: { ...estado, pessoas: estado.pessoas.filter((x) => x.id !== id), pessoaAtual: estado.pessoaAtual === id ? null : estado.pessoaAtual } };
}
