import { trocarItem } from '../acoes.js';
import { apenasDigitos, celularValido } from './regras.js';
import { outrosDaUnidade, mesmoNome } from '../moradores/acoes.js';

// Primeiro acesso pelo convite (QR Code): quem está na planilha passa a ativo; quem não está aguarda o síndico aprovar.
function erroConvite(estado, mensagem) {
  return { estado, erro: mensagem };
}

// Código simulado do "SMS": fixo por celular, para o teste ponta a ponta poder conferi-lo.
export function codigoDoConvite(celular) {
  const d = apenasDigitos(celular);
  return String((Number(d.slice(-6) || '0') * 7919 + 104729) % 900000 + 100000);
}

export function confirmarConvite(estado, { unidade, nome, celular, codigo }, agora) {
  const u = String(unidade || '').toUpperCase().replace(/\s+/g, '');
  if (!estado.condominio.unidades.includes(u)) return erroConvite(estado, 'Escolha a sua unidade');
  const n = String(nome || '').trim();
  if (!n) return erroConvite(estado, 'Informe o seu nome');
  if (!celularValido(celular)) return erroConvite(estado, 'Informe um celular com DDD');
  if (String(codigo || '').trim() !== codigoDoConvite(celular)) return erroConvite(estado, 'Código inválido. Confira o SMS');
  const cel = apenasDigitos(celular);
  const existente = estado.pessoas.find((p) => p.unidade === u && (mesmoNome(p.nome, n) || (p.celular && p.celular === cel)));
  if (existente) {
    if (existente.situacao === 'pendente') return { estado, id: existente.id, situacao: 'pendente' };
    const ativo = { situacao: 'ativo', celular: existente.celular || cel, acessoEm: agora.toISOString() };
    return {
      estado: { ...estado, pessoas: trocarItem(estado.pessoas, existente.id, ativo), moradorAtual: u, pessoaAtual: existente.id },
      id: existente.id,
      situacao: 'ativo',
      notificacao: { canal: 'App', para: estado.condominio.sindico ? estado.condominio.sindico.nome : 'Síndico', texto: `${existente.nome} (apto ${u}) entrou no app pelo convite` },
    };
  }
  const id = `p${u}-c${estado.pessoas.length + 1}`;
  const pessoa = { id, nome: n, unidade: u, email: '', celular: cel, vinculo: 'titular', situacao: 'pendente', criadaEm: agora.toISOString(), recebeOfertas: false, vendedor: 'nao', pedidoVenda: null, motivoVendedor: null };
  return {
    estado: { ...estado, pessoas: [...estado.pessoas, pessoa] },
    id,
    situacao: 'pendente',
    notificacao: { canal: 'App + e-mail', para: estado.condominio.sindico ? estado.condominio.sindico.nome : 'Síndico', texto: `Novo morador no apto ${u}: ${n}. Aprove no Início` },
  };
}

// modo 'adicional' = mais um morador; 'substituir' = as outras pessoas da unidade (menos o síndico) saem, e a
// responsabilidade financeira de quem saiu passa para quem entrou, sem CPF (o síndico completa em Moradores).
export function aprovarMorador(estado, id, perfil, agora, modo = 'adicional') {
  if (perfil !== 'sindico') return erroConvite(estado, 'Somente o síndico pode fazer isso');
  const p = estado.pessoas.find((x) => x.id === id);
  if (!p || p.situacao !== 'pendente') return erroConvite(estado, 'Este cadastro não está aguardando aprovação');
  const saem = modo === 'substituir' ? outrosDaUnidade(estado, p) : [];
  let novo = { ...estado, pessoas: trocarItem(estado.pessoas, id, { situacao: 'ativo', acessoEm: agora.toISOString() }).filter((x) => !saem.includes(x)) };
  const fin = estado.financeiro;
  const resp = fin.unidades[p.unidade] && fin.unidades[p.unidade].responsavel;
  if (resp && saem.some((x) => x.nome === resp.nome)) {
    const responsavel = { ...resp, nome: p.nome, cpf: null, documento: 'CPF a informar pelo síndico' };
    novo = { ...novo, financeiro: { ...fin, unidades: { ...fin.unidades, [p.unidade]: { ...fin.unidades[p.unidade], responsavel } } } };
  }
  return {
    estado: novo,
    saiu: saem.map((x) => x.nome),
    notificacao: { canal: 'App + WhatsApp', para: p.nome, texto: `Seu acesso ao apto ${p.unidade} foi aprovado. Bem-vindo ao CondoFácil!` },
  };
}

export function recusarMorador(estado, id, perfil) {
  if (perfil !== 'sindico') return erroConvite(estado, 'Somente o síndico pode fazer isso');
  const p = estado.pessoas.find((x) => x.id === id);
  if (!p || p.situacao !== 'pendente') return erroConvite(estado, 'Este cadastro não está aguardando aprovação');
  return {
    estado: { ...estado, pessoas: estado.pessoas.filter((x) => x.id !== id) },
    notificacao: { canal: 'App + WhatsApp', para: p.nome, texto: `O cadastro no apto ${p.unidade} não foi confirmado. Fale com o síndico.` },
  };
}

export function moradoresPendentes(estado) {
  return estado.pessoas.filter((p) => p.situacao === 'pendente');
}
