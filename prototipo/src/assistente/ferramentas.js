import { CATEGORIAS } from '../dados.js';
import { horariosDaArea } from '../regras.js';
import { solicitarReserva, abrirOcorrencia } from '../acoes.js';
import { enviarSegundaVia } from '../cobranca/acoes.js';
import { votar } from '../enquetes/acoes.js';
import { enquetePorId } from '../enquetes/regras.js';
import { pessoaDaUnidade } from '../vendas/regras.js';
import { fmtDataCurta } from '../datas.js';

// Ferramentas do Sr. Abel para o morador: as mesmas ações do app, com as mesmas regras e mensagens de erro.
function normalizarAbel(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function areaDoTexto(estado, texto) {
  const t = normalizarAbel(texto);
  return estado.areas.find((a) => normalizarAbel(a.nome).includes(t) || t.includes(normalizarAbel(a.nome)) || a.id === t) || null;
}

function dataDoTexto(texto) {
  const t = String(texto || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

function categoriaDoTexto(texto) {
  const t = normalizarAbel(texto);
  return Object.keys(CATEGORIAS).find((k) => k === t || normalizarAbel(CATEGORIAS[k].nome) === t || normalizarAbel(CATEGORIAS[k].nome).includes(t)) || null;
}

// obterEstado() devolve o estado atual; executar(fn) aplica a ação no app e devolve o resultado dela; aoAgir(titulo, texto) mostra o cartão no chat.
export function ferramentasAbel({ obterEstado, executar, agora, aoAgir = () => {} }) {
  const eu = () => obterEstado().moradorAtual;
  const rodar = (acao) => {
    const r = executar(acao);
    if (r.erro) throw new Error(r.erro);
    return r;
  };
  return [
    {
      name: 'consultar_agenda',
      description: 'Mostra os horários de uma área comum numa data, com livre ou ocupado, sem revelar quem reservou. Use antes de propor uma reserva.',
      inputSchema: { type: 'object', properties: { area: { type: 'string', description: 'Nome da área, ex.: churrasqueira' }, data: { type: 'string', description: 'AAAA-MM-DD' } }, required: ['area', 'data'] },
      execute(input) {
        const estado = obterEstado();
        const area = areaDoTexto(estado, input.area);
        if (!area) throw new Error('Área inexistente');
        const data = dataDoTexto(input.data);
        if (!data) throw new Error('Data inválida, use AAAA-MM-DD');
        return { area: area.nome, data: fmtDataCurta(data), taxa: area.taxa ? `R$ ${area.taxa},00` : 'grátis', aprovacao: area.aprovacao === 'automatica' ? 'automática' : 'o síndico aprova', horarios: horariosDaArea(estado, area.id, data, agora()).map((h) => ({ horario: h.rotulo, inicio: h.inicio, situacao: h.livre ? 'livre' : h.motivo.toLowerCase() })) };
      },
    },
    {
      name: 'solicitar_reserva',
      description: 'Pede a reserva de uma área para a unidade da pessoa. SÓ chame depois que a pessoa confirmou área, data, horário e taxa. Devolve confirmada ou pendente, ou o erro de regra.',
      inputSchema: { type: 'object', properties: { area: { type: 'string' }, data: { type: 'string', description: 'AAAA-MM-DD' }, inicio: { type: 'number', description: 'Hora de início do horário escolhido, ex.: 18' } }, required: ['area', 'data', 'inicio'] },
      execute(input) {
        const estado = obterEstado();
        const area = areaDoTexto(estado, input.area);
        if (!area) throw new Error('Área inexistente');
        const data = dataDoTexto(input.data);
        if (!data) throw new Error('Data inválida, use AAAA-MM-DD');
        const horario = horariosDaArea(estado, area.id, data, agora()).find((h) => h.inicio === Number(input.inicio));
        if (!horario) throw new Error('Horário inexistente para esta área');
        const r = rodar((e) => solicitarReserva(e, { areaId: area.id, unidade: eu(), data, inicio: horario.inicio, fim: horario.fim, aceiteTermo: true, convidados: [] }, agora()));
        const reserva = obterEstado().reservas.find((x) => x.id === r.id);
        aoAgir('Reserva solicitada', `${area.nome} · ${fmtDataCurta(data)} · ${horario.rotulo} · ${reserva.status}`);
        return { ok: true, area: area.nome, data: fmtDataCurta(data), horario: horario.rotulo, situacao: reserva.status, observacao: 'A taxa entra no próximo boleto. Cancelar com menos de 72 h pode ter multa.' };
      },
    },
    {
      name: 'abrir_ocorrencia',
      description: 'Registra uma ocorrência da unidade e devolve o protocolo. SÓ chame depois de mostrar o resumo (categoria, descrição, local, anônima, pública) e a pessoa confirmar.',
      inputSchema: { type: 'object', properties: { categoria: { type: 'string', description: `Uma de: ${Object.values(CATEGORIAS).map((c) => c.nome).join(', ')}` }, descricao: { type: 'string' }, local: { type: 'string' }, anonima: { type: 'boolean' }, publica: { type: 'boolean' } }, required: ['categoria', 'descricao'] },
      execute(input) {
        const categoria = categoriaDoTexto(input.categoria);
        if (!categoria) throw new Error('Escolha o tipo e a categoria');
        const r = rodar((e) => abrirOcorrencia(e, { categoria, descricao: input.descricao, local: input.local || '', unidade: eu(), anonima: !!input.anonima, publica: !!input.publica, foto: false }, agora()));
        aoAgir(`Ocorrência ${r.id} aberta`, `${CATEGORIAS[categoria].nome}${input.local ? ` · ${input.local}` : ''}${input.anonima ? ' · anônima' : ''}${input.publica ? ' · pública' : ''}`);
        return { ok: true, protocolo: r.id, acompanhamento: 'Ocorrências → Minhas' };
      },
    },
    {
      name: 'votar_enquete',
      description: 'Registra ou troca o voto da unidade numa enquete aberta. SÓ chame depois que a pessoa confirmou a opção. Use os ids das opções que estão nos dados.',
      inputSchema: { type: 'object', properties: { enquete: { type: 'string', description: 'Ex.: EN-001' }, opcoes: { type: 'array', items: { type: 'string' }, description: 'Ids ou textos das opções escolhidas' }, comentario: { type: 'string' } }, required: ['enquete', 'opcoes'] },
      execute(input) {
        const estado = obterEstado();
        const e = enquetePorId(estado, String(input.enquete || '').toUpperCase());
        if (!e) throw new Error('Enquete não encontrada');
        const escolhidas = [].concat(input.opcoes || []).map((o) => {
          const t = normalizarAbel(o);
          const achada = e.opcoes.find((x) => x.id === o || normalizarAbel(x.texto) === t || normalizarAbel(x.texto).includes(t));
          return achada ? achada.id : String(o);
        });
        const pessoa = pessoaDaUnidade(estado, eu());
        const r = rodar((s) => votar(s, e.id, { unidade: eu(), autor: pessoa ? pessoa.nome : `Apto ${eu()}`, opcoes: escolhidas, comentario: input.comentario }, agora()));
        aoAgir(r.trocou ? 'Voto alterado' : 'Voto registrado', `${e.id} · ${escolhidas.map((id) => e.opcoes.find((o) => o.id === id).texto).join(', ')} · ${e.secreto ? 'voto secreto' : 'voto aberto'}`);
        return { ok: true, enquete: e.id, trocou: r.trocou, observacao: 'Dá para trocar até o encerramento.' };
      },
    },
    {
      name: 'segunda_via',
      description: 'Envia a 2ª via da cobrança em aberto mais antiga da unidade, com valor atualizado, para o app e o WhatsApp do responsável financeiro.',
      execute() {
        const estado = obterEstado();
        const responsavel = estado.financeiro.unidades[eu()].responsavel;
        const pessoa = pessoaDaUnidade(estado, eu());
        if (!responsavel || !pessoa || responsavel.nome !== pessoa.nome) throw new Error(`As cobranças do apto ${eu()} vão para o responsável financeiro${responsavel ? ` (${responsavel.nome})` : ''}`);
        const c = estado.financeiro.cobrancas.filter((x) => x.unidade === eu() && x.status === 'aberta').sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];
        if (!c) throw new Error('Nenhuma cobrança em aberto: o financeiro está em dia');
        const r = rodar((e) => enviarSegundaVia(e, c.id, agora()));
        aoAgir('2ª via enviada', r.notificacao.texto);
        return { ok: true, texto: r.notificacao.texto };
      },
    },
  ];
}
