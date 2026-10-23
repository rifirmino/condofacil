import { trocarItem } from '../acoes.js';
import { apenasDigitos, celularValido } from './regras.js';

// Primeiro acesso pelo convite (QR Code): quem está na planilha passa a ativo; quem não está aguarda o síndico aprovar.
function erroConvite(estado, mensagem) {
  return { estado, erro: mensagem };
}

function normalizarNome(nome) {
  return String(nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
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
  const existente = estado.pessoas.find((p) => p.unidade === u && (normalizarNome(p.nome) === normalizarNome(n) || (p.celular && p.celular === cel)));
  if (existente) {
    if (existente.situacao === 'pendente') return { estado, id: existente.id, situacao: 'pendente' };
    const ativo = { situacao: 'ativo', celular: existente.celular || cel, acessoEm: agora.toISOString() };
    return {
      estado: { ...estado, pessoas: trocarItem(estado.pessoas, existente.id, ativo), moradorAtual: u },
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

export function aprovarMorador(estado, id, perfil, agora) {
  if (perfil !== 'sindico') return erroConvite(estado, 'Somente o síndico pode fazer isso');
  const p = estado.pessoas.find((x) => x.id === id);
  if (!p || p.situacao !== 'pendente') return erroConvite(estado, 'Este cadastro não está aguardando aprovação');
  return {
    estado: { ...estado, pessoas: trocarItem(estado.pessoas, id, { situacao: 'ativo', acessoEm: agora.toISOString() }) },
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
