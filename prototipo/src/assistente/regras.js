import { MANUAL_ABEL } from './manual.js';
import { isoDia, fmtDia, fmtDataCurta } from '../datas.js';
import { areaPorId } from '../regras.js';
import { fmtReais, situacaoCobranca, valorAtualizado, rotuloCobranca, devedores } from '../cobranca/regras.js';
import { NOMES_STATUS_OS } from '../manutencao/dados.js';

// Sr. Abel sem IA: entende algumas intenções com dados do próprio perfil e, no resto, busca a seção do manual.
// Mesmas regras de privacidade da versão com IA: cada perfil só recebe o que já pode ver no app.

export const PERFIS_ABEL = {
  morador: { sugestoes: ['Tenho encomenda na portaria?', 'Como pago o condomínio?', 'Minhas reservas', 'Como abro uma ocorrência?', 'Quem está devendo?', 'Como começo a vender?'] },
  sindico: { sugestoes: ['Quem está inadimplente?', 'Encomendas paradas', 'Como emito os boletos?', 'Como faço um acordo?', 'Como reajusto a taxa?', 'Multa com defesa'] },
  portaria: { sugestoes: ['Reservas de hoje', 'Encomendas aguardando', 'Morador perdeu o código', 'Como troco meu plantão?'] },
  zelador: { sugestoes: ['Minhas OS', 'Como concluo uma OS?', 'Preciso comprar material', 'Caixa pequeno'] },
  conselho: { sugestoes: ['Como aprovo a prestação de contas?', 'Onde vejo os balancetes?', 'O que é fluxo de caixa?'] },
};

const PALAVRAS_VAZIAS = new Set('a o e de da do das dos em no na nos nas um uma para por com como que eu meu minha qual quais quando onde tem ter ser se ao os as e posso faco fazer voce sr abel oi ola bom dia tarde noite favor'.split(' '));

export function semAcentoAbel(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function secoesManualAbel(manual = MANUAL_ABEL) {
  return manual.split(/\n(?=## )/).filter((s) => s.startsWith('## ')).map((s) => ({ titulo: s.split('\n')[0].replace(/^## \d+\.\s*/, ''), corpo: s }));
}

const SECOES = secoesManualAbel();

export function intencaoAbel(pergunta) {
  const t = semAcentoAbel(pergunta);
  if (/incendio|fogo|fumaca|cheiro de gas|vazamento de gas|ferid|desmai|assalt|invas|socorro/.test(t)) return 'emergencia';
  if (/quem (esta|ta|anda)? ?devendo|inadimpl|devedor|quem deve|quem nao pagou|quem esta atrasad/.test(t)) return 'devedores';
  if (/quem reservou|de quem e a reserva|quem abriu|quem fez a (denuncia|ocorrencia)|telefone d[oa] (morador|vizinh)|onde mora/.test(t)) return 'dadoTerceiro';
  if (/encomenda|pacote|entrega|correio|mercado livre|amazon|shopee|codigo de retirada|perdeu o codigo/.test(t)) return 'encomendas';
  if (/minhas? reservas?|reservas? de hoje|tenho reserva/.test(t)) return 'reservas';
  if (/minhas? os\b|ordens? de servico|minhas ordens/.test(t)) return 'os';
  if (/(meu|minha|quanto).*(boleto|condominio|taxa|cobranca)|(boleto|cobranca).*(aberto|vencid|atrasad|pagar)|2a via|segunda via/.test(t)) return 'cobranca';
  return null;
}

function linkAbel(rotulo, perfil, tela) {
  return { rotulo, perfil, tela };
}

function buscarNoManual(pergunta) {
  const termos = semAcentoAbel(pergunta).split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !PALAVRAS_VAZIAS.has(t));
  let melhor = null;
  let nota = 0;
  for (const s of SECOES) {
    const corpo = semAcentoAbel(s.corpo);
    const titulo = semAcentoAbel(s.titulo);
    let n = 0;
    for (const t of termos) {
      const raiz = t.slice(0, Math.max(4, t.length - 2));
      n += Math.min(corpo.split(raiz).length - 1, 4) + (titulo.includes(raiz) ? 6 : 0);
    }
    if (n > nota) { nota = n; melhor = s; }
  }
  return nota >= 3 ? melhor : null;
}

function trechoSecao(secao, max = 9) {
  return secao.corpo.split('\n').slice(1).filter((l) => l.trim() && !l.startsWith('|') && !l.startsWith('**Mensagens')).slice(0, max).join('\n');
}

function nomeDaUnidade(estado, unidade) {
  const p = estado.pessoas.find((x) => x.unidade === unidade);
  return p ? p.nome.split(' ')[0] : `apto ${unidade}`;
}

export function saudacaoAbel(estado, perfil) {
  if (perfil === 'morador') return `Oi, ${nomeDaUnidade(estado, estado.moradorAtual)}! Eu sou o **Sr. Abel** 🐝. Posso ajudar com encomendas, boletos, reservas, ocorrências e vendas. O que você precisa?`;
  if (perfil === 'sindico') return 'Olá, Roberto! **Sr. Abel** na área 🐝. Pergunte sobre inadimplência, encomendas paradas ou como usar qualquer tela.';
  if (perfil === 'portaria') return 'Olá! Aqui é o **Sr. Abel** 🐝. Posso ajudar com encomendas, reservas de hoje e a escala.';
  if (perfil === 'zelador') return 'E aí, Seu Antônio! **Sr. Abel** por aqui 🐝. Quer ver suas OS ou tirar dúvida de compra?';
  return 'Olá! Eu sou o **Sr. Abel** 🐝. Posso explicar a prestação de contas e onde achar os documentos.';
}

// Devolve { texto, links } — texto com **negrito** e listas com "- ".
export function responderAbel(estado, perfil, pergunta, agora) {
  const hoje = isoDia(agora);
  const intencao = intencaoAbel(pergunta);

  if (intencao === 'emergencia') {
    return { texto: 'Isso é uma emergência! Primeiro ligue:\n- **193** Bombeiros (fogo, gás, resgate)\n- **192** SAMU (pessoa ferida ou passando mal)\n- **190** Polícia\n\nDepois avise a portaria. Quando estiver seguro, abra uma ocorrência para registrar.', links: [] };
  }

  if (intencao === 'devedores' || intencao === 'dadoTerceiro') {
    if (perfil === 'sindico' && intencao === 'devedores') {
      const lista = devedores(estado, hoje);
      if (!lista.length) return { texto: 'Boa notícia: nenhuma unidade com cobrança vencida hoje. 🐝', links: [] };
      const linhas = lista.map((d) => `- **${d.unidade}**${d.responsavel ? ` · ${d.responsavel.nome}` : ''}: ${d.cobrancas} cobrança(s), ${fmtReais(d.valor)} atualizado, ${d.dias} dias${d.acordo ? ' · em acordo' : ''}`);
      return { texto: `Unidades com cobrança vencida (trate com discrição):\n${linhas.join('\n')}\n\nVocê pode disparar a régua ou propor um acordo em **Cobrança**.`, links: [linkAbel('Abrir Cobrança', 'sindico', 'cobranca')] };
    }
    return { texto: 'Essa informação é privada e eu não posso compartilhar 🐝. Cada morador só vê os próprios dados, e assuntos de outras unidades ficam com o síndico. Posso te ajudar com alguma coisa da sua unidade?', links: [] };
  }

  if (intencao === 'encomendas') {
    const aguardando = estado.encomendas.filter((e) => e.status === 'aguardando');
    if (perfil === 'morador') {
      const minhas = aguardando.filter((e) => e.unidade === estado.moradorAtual);
      if (!minhas.length) return { texto: 'Nenhuma encomenda sua aguardando na portaria agora. Quando chegar, eu te aviso pelo app. 📦', links: [] };
      const linhas = minhas.map((e) => `- ${e.transportadora}, chegou ${fmtDataCurta(e.chegadaEm.slice(0, 10))} · código **${e.codigo}**`);
      return { texto: `Você tem ${minhas.length} encomenda(s) na portaria:\n${linhas.join('\n')}\n\nMostre o QR Code ou o código na portaria para retirar.`, links: [linkAbel('Ver encomendas', 'morador', 'mais')] };
    }
    if (perfil === 'portaria' || perfil === 'sindico') {
      if (/perdeu|esqueceu/.test(semAcentoAbel(pergunta))) return { texto: 'Sem problema: em **Entregar**, busque pela **unidade** em vez do código, confirme com o morador e registre o nome de quem retirou. O morador também vê o código de novo no app, em Mais → Encomendas.', links: [linkAbel('Ir para Entregar', 'portaria', 'entregar')] };
      const porUnidade = {};
      for (const e of aguardando) porUnidade[e.unidade] = (porUnidade[e.unidade] || 0) + 1;
      const linhas = Object.entries(porUnidade).map(([u, n]) => `- apto **${u}**: ${n}`);
      return { texto: `${aguardando.length} encomenda(s) aguardando retirada:\n${linhas.join('\n')}`, links: perfil === 'portaria' ? [linkAbel('Ir para Entregar', 'portaria', 'entregar')] : [linkAbel('Abrir Encomendas', 'sindico', 'encomendas')] };
    }
  }

  if (intencao === 'reservas') {
    const nomeArea = (r) => (areaPorId(estado, r.areaId) || { nome: r.areaId }).nome;
    if (perfil === 'portaria' || /hoje/.test(semAcentoAbel(pergunta))) {
      const deHoje = estado.reservas.filter((r) => r.data === hoje && r.status === 'confirmada');
      if (perfil !== 'portaria' && perfil !== 'sindico') return { texto: 'Eu só mostro as reservas da sua unidade. Toque em **Reservas** para ver o calendário com os horários livres.', links: [linkAbel('Abrir Reservas', 'morador', 'reservas')] };
      if (!deHoje.length) return { texto: 'Nenhuma reserva confirmada para hoje.', links: [] };
      return { texto: `Reservas de hoje:\n${deHoje.map((r) => `- ${nomeArea(r)} · ${r.inicio}h–${r.fim}h · apto ${r.unidade} · ${r.convidados.length} convidado(s)`).join('\n')}`, links: perfil === 'portaria' ? [linkAbel('Ver lista de convidados', 'portaria', 'hoje')] : [] };
    }
    if (perfil === 'morador') {
      const minhas = estado.reservas.filter((r) => r.unidade === estado.moradorAtual && r.data >= hoje && (r.status === 'confirmada' || r.status === 'pendente'));
      if (!minhas.length) return { texto: 'Você não tem reservas futuras. Quer reservar? Vá em **Reservas**, escolha a área, o dia e o horário.', links: [linkAbel('Fazer uma reserva', 'morador', 'reservas')] };
      return { texto: `Suas próximas reservas:\n${minhas.map((r) => `- ${nomeArea(r)} · ${fmtDia(r.data)} · ${r.inicio}h–${r.fim}h · ${r.status === 'pendente' ? 'aguardando o síndico' : 'confirmada'}`).join('\n')}\n\nCancelar com menos de 72 h do início pode ter multa.`, links: [linkAbel('Abrir Reservas', 'morador', 'reservas')] };
    }
  }

  if (intencao === 'os' && (perfil === 'zelador' || perfil === 'sindico')) {
    const abertas = estado.manutencao.os.filter((o) => o.status !== 'concluida' && o.status !== 'validada');
    if (!abertas.length) return { texto: 'Nenhuma OS em aberto. Bom trabalho! 🐝', links: [] };
    return { texto: `OS em aberto:\n${abertas.map((o) => `- **${o.id}** · ${o.local}: ${o.descricao} · ${NOMES_STATUS_OS[o.status]} · prazo ${fmtDataCurta(o.prazo.slice(0, 10))}`).join('\n')}\n\nPara concluir, anexe a foto do depois e informe as horas gastas.`, links: [linkAbel('Abrir OS', perfil, perfil === 'zelador' ? 'os' : 'manutencao')] };
  }

  if (intencao === 'cobranca' && perfil === 'morador') {
    const fin = estado.financeiro;
    const minhas = fin.cobrancas.filter((c) => c.unidade === estado.moradorAtual && c.status === 'aberta');
    if (!minhas.length) return { texto: 'Você está em dia: nenhuma cobrança em aberto. 🎉 Quando a próxima for emitida, ela aparece em **Financeiro** para pagar por boleto, Pix ou cartão.', links: [linkAbel('Abrir Financeiro', 'morador', 'financeiro')] };
    const linhas = minhas.map((c) => {
      const v = valorAtualizado(c, fin.parametros, hoje);
      const vencida = situacaoCobranca(c, hoje) === 'vencida';
      return `- ${rotuloCobranca(c)} · ${fmtReais(v.total)} · ${vencida ? `vencida há ${v.dias} dias (com multa e juros)` : `vence ${fmtDataCurta(c.vencimento)}`}`;
    });
    return { texto: `Cobranças em aberto da sua unidade:\n${linhas.join('\n')}\n\nPague em **Financeiro** por boleto, Pix ou cartão. A baixa é automática.`, links: [linkAbel('Pagar agora', 'morador', 'financeiro')] };
  }

  const secao = buscarNoManual(pergunta);
  if (!secao) return { texto: 'Hmm, essa eu não sei responder 🐝. Eu entendo de reservas, boletos, encomendas, ocorrências, vendas, escala e planos do CondoFácil. Para outros assuntos, fale com o síndico.', links: [] };
  return { texto: `Sobre **${secao.titulo}**:\n\n${trechoSecao(secao)}`, links: [] };
}
