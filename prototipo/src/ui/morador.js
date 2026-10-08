import { html, useState } from '../vendor.js';
import { UNIDADE_ANA, CATEGORIAS, TIPOS_COMUNICADO } from '../dados.js';
import { areaPorId, statusDia, horariosDaArea, comunicadosDaUnidade, avisoCancelamento, encomendaParada, STATUS_ATIVOS } from '../regras.js';
import { solicitarReserva, cancelarReserva, marcarLido, reagir, abrirOcorrencia, avaliarOcorrencia, euTambem } from '../acoes.js';
import { isoDia, somarMes, diferencaDias, fmtDia, fmtHora, fmtDataHora, fmtDataCurta, haQuanto } from '../datas.js';
import { ir, fmtMoeda, Etiqueta, EtqReserva, EtqOcorrencia, Erro, Sucesso, Vazio, FotoFalsa, Calendario, QrFalso, LinhaTempo, Estrelas, PrevDoc, Campo } from './comum.js';

const ABAS_MORADOR = [['inicio', 'Início', '⌂'], ['reservas', 'Reservas', '📅'], ['avisos', 'Avisos', '📣'], ['ocorrencias', 'Ocorrências', '📝'], ['mais', 'Mais', '☰']];

function relogio(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function lerConvidados(texto) {
  return texto.split('\n').map((l) => l.trim()).filter(Boolean).map((linha) => {
    const [nome, ...resto] = linha.split(',');
    return { nome: nome.trim(), documento: resto.join(',').trim() || 'não informado' };
  });
}

function textoAntecedencia(area) {
  const limite = area.limiteMes ? ` · até ${area.limiteMes} por mês` : '';
  return area.antecedenciaMin === 0
    ? `Reserve com até ${area.antecedenciaMax} dias de antecedência${limite}`
    : `Reserve de ${area.antecedenciaMin} a ${area.antecedenciaMax} dias antes${limite}`;
}

function tipoEtiquetaAviso(c) {
  return c.tipo === 'urgente' ? 'perigo' : 'info';
}

export function TelaMorador(props) {
  const telas = { inicio: MInicio, reservas: MReservas, avisos: MAvisos, ocorrencias: MOcorrencias, mais: MMais, documentos: MDocumentos, encomendas: MEncomendas };
  const Conteudo = telas[props.rota.tela] || MInicio;
  const aba = ['documentos', 'encomendas'].includes(props.rota.tela) ? 'mais' : props.rota.tela;
  return html`<div class="celular">
    <div class="cel-status" aria-hidden="true"><span>${relogio(props.agora)}</span><span>CondoFácil</span></div>
    <div class="cel-conteudo"><${Conteudo} ...${props} /></div>
    <nav class="cel-abas" aria-label="Navegação do morador">
      ${ABAS_MORADOR.map(([id, nome, icone]) => html`<a key=${id} href=${`#morador.${id}`} class=${id === aba ? 'ativa' : ''} aria-current=${id === aba ? 'page' : undefined}><span aria-hidden="true">${icone}</span>${nome}</a>`)}
    </nav>
  </div>`;
}

function MCartaoEncomenda({ encomenda, agora }) {
  return html`<article class="cartao encomenda" data-codigo=${encomenda.codigo}>
    <div>
      <strong>${encomenda.transportadora}</strong>
      <span class="sub">Chegou ${haQuanto(encomenda.chegadaEm, agora)}</span>
      ${encomendaParada(encomenda, agora) && html`<${Etiqueta} tipo="alerta">Retire em breve<//>`}
      <span class="m-codigo">Código <b>${encomenda.codigo}</b></span>
      <small class="sub">Mostre o QR Code na portaria.</small>
    </div>
    <${QrFalso} texto=${encomenda.codigo} tamanho=${104} />
  </article>`;
}

function MInicio({ estado, agora }) {
  const hoje = isoDia(agora);
  const pacotes = estado.encomendas.filter((e) => e.unidade === UNIDADE_ANA && e.status === 'aguardando');
  const fixado = comunicadosDaUnidade(estado, UNIDADE_ANA).find((c) => c.fixado);
  const proxima = estado.reservas
    .filter((r) => r.unidade === UNIDADE_ANA && STATUS_ATIVOS.includes(r.status) && r.data >= hoje)
    .sort((a, b) => a.data.localeCompare(b.data) || a.inicio - b.inicio)[0];
  return html`<section class="m-pagina">
    <h1 class="m-titulo">Olá, Ana</h1>
    <p class="m-sub">Apto 302 · Residencial Ipê Amarelo</p>
    <h2>Encomendas na portaria</h2>
    ${pacotes.length ? pacotes.map((e) => html`<${MCartaoEncomenda} key=${e.id} encomenda=${e} agora=${agora} />`) : html`<${Vazio} texto="Nenhuma encomenda esperando por você." />`}
    ${fixado && html`<h2>Fixado pelo síndico</h2>
      <a class="cartao link" href=${`#morador.avisos.${fixado.id}`}>
        <${Etiqueta} tipo=${tipoEtiquetaAviso(fixado)}>${TIPOS_COMUNICADO[fixado.tipo]}<//>
        <strong>${fixado.titulo}</strong>
        ${!fixado.leituras.includes(UNIDADE_ANA) && html`<span class="m-nao-lido">Toque para confirmar a leitura</span>`}
      </a>`}
    <h2>Próxima reserva</h2>
    ${proxima
      ? html`<a class="cartao link" href="#morador.reservas">
          <div class="linha-entre"><strong>${areaPorId(estado, proxima.areaId).nome}</strong><${EtqReserva} status=${proxima.status} /></div>
          <span>${fmtDia(proxima.data)} · ${fmtHora(proxima.inicio)}–${fmtHora(proxima.fim)}</span>
        </a>`
      : html`<${Vazio} texto="Você não tem reservas futuras." />`}
    <a class="btn primario bloco" href="#morador.ocorrencias.nova">Abrir ocorrência</a>
  </section>`;
}

function MReservas({ estado, executar, agora }) {
  const hoje = isoDia(agora);
  const [areaId, setAreaId] = useState(null);
  const [anoMes, setAnoMes] = useState(hoje.slice(0, 7));
  const [data, setData] = useState(null);
  const [horario, setHorario] = useState(null);
  const [termo, setTermo] = useState(false);
  const [convidados, setConvidados] = useState('');
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const area = areaId ? areaPorId(estado, areaId) : null;

  function recomecar(texto) {
    setAreaId(null);
    setData(null);
    setHorario(null);
    setTermo(false);
    setConvidados('');
    setErro(null);
    setMensagem(texto || null);
  }

  function solicitar() {
    const pedido = { areaId, unidade: UNIDADE_ANA, data, inicio: horario.inicio, fim: horario.fim, convidados: lerConvidados(convidados), aceiteTermo: termo };
    const r = executar((e) => solicitarReserva(e, pedido, new Date()));
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    const status = r.estado.reservas.find((x) => x.id === r.id).status;
    recomecar(status === 'pendente'
      ? 'Reserva solicitada! Aguardando aprovação do síndico. O horário já está guardado para você.'
      : 'Reserva confirmada!');
  }

  if (!area) {
    return html`<section class="m-pagina">
      <h1 class="m-titulo">Reservas</h1>
      <${Sucesso} texto=${mensagem} />
      <h2>Escolha a área</h2>
      ${estado.areas.map((a) => html`<button type="button" key=${a.id} class="cartao link" onClick=${() => { setAreaId(a.id); setMensagem(null); }}>
        <strong>${a.nome}</strong>
        <span>${a.tipo === 'periodo' ? 'Por período' : 'Por hora'} · ${a.taxa ? fmtMoeda(a.taxa) : 'Sem taxa'}</span>
        <small class="sub">${a.aprovacao === 'manual' ? 'Precisa de aprovação do síndico' : 'Confirmação na hora'}</small>
      </button>`)}
      <${MMinhasReservas} estado=${estado} executar=${executar} agora=${agora} />
    </section>`;
  }

  if (!horario) {
    const horarios = data ? horariosDaArea(estado, area.id, data, agora) : [];
    const statusDe = (iso) => {
      const dias = diferencaDias(iso, hoje);
      return dias < area.antecedenciaMin || dias > area.antecedenciaMax ? 'indisponivel' : statusDia(estado, area.id, iso);
    };
    return html`<section class="m-pagina">
      <button type="button" class="voltar" onClick=${() => recomecar()}>‹ Áreas</button>
      <h1 class="m-titulo">${area.nome}</h1>
      <p class="m-sub">${textoAntecedencia(area)}</p>
      <${Calendario} anoMes=${anoMes} statusDe=${statusDe} selecionado=${data} aoEscolher=${(iso) => { setData(iso); setErro(null); }} aoMudarMes=${(n) => setAnoMes(somarMes(anoMes, n))} />
      ${data && html`<h2>${fmtDia(data)}</h2>
        <div class="m-horarios">
          ${horarios.map((h) => html`<button type="button" key=${h.inicio} class="btn opcao" disabled=${!h.livre} onClick=${() => setHorario(h)}>${h.rotulo}${h.motivo && html`<small>${h.motivo}</small>`}</button>`)}
        </div>`}
    </section>`;
  }

  return html`<section class="m-pagina">
    <button type="button" class="voltar" onClick=${() => { setHorario(null); setErro(null); }}>‹ Horários</button>
    <h1 class="m-titulo">Confirmar reserva</h1>
    <dl class="resumo">
      <dt>Área</dt><dd>${area.nome}</dd>
      <dt>Quando</dt><dd>${fmtDia(data)}, ${fmtHora(horario.inicio)}–${fmtHora(horario.fim)}</dd>
      <dt>Taxa</dt><dd>${area.taxa ? `${fmtMoeda(area.taxa)} no próximo boleto` : 'Sem taxa'}</dd>
      <dt>Aprovação</dt><dd>${area.aprovacao === 'manual' ? 'Pelo síndico em até 48 h; o horário fica guardado para você' : 'Automática'}</dd>
      <dt>Inclui</dt><dd>${area.itens}</dd>
    </dl>
    <p class="m-regulamento">${area.regulamento} Cancelamento sem multa até 72 h antes.</p>
    <${Campo} rotulo="Convidados (opcional)" dica="Um por linha: nome, documento. A lista vai para a portaria."><textarea id="reserva-convidados" rows="3" value=${convidados} onInput=${(ev) => setConvidados(ev.target.value)}></textarea><//>
    <label class="check"><input id="reserva-termo" type="checkbox" checked=${termo} onChange=${(ev) => setTermo(ev.target.checked)} /><span>Li e aceito o termo de responsabilidade</span></label>
    <${Erro} texto=${erro} />
    <button type="button" class="btn primario bloco" disabled=${!termo} onClick=${solicitar}>Solicitar reserva</button>
  </section>`;
}

function MMinhasReservas({ estado, executar, agora }) {
  const [cancelando, setCancelando] = useState(null);
  const [aviso, setAviso] = useState(null);
  const hoje = isoDia(agora);
  const minhas = estado.reservas.filter((r) => r.unidade === UNIDADE_ANA).sort((a, b) => b.data.localeCompare(a.data));

  function confirmar(id) {
    const r = executar((e) => cancelarReserva(e, id, new Date()));
    setCancelando(null);
    setAviso(r.erro || (r.aviso.multa ? 'Reserva cancelada fora do prazo: a taxa será retida conforme o regulamento.' : 'Reserva cancelada sem multa.'));
  }

  return html`<h2>Minhas reservas</h2>
    <${Sucesso} texto=${aviso} />
    ${minhas.length
      ? html`<ul class="m-lista">${minhas.map((r) => {
          const podeCancelar = STATUS_ATIVOS.includes(r.status) && r.data >= hoje;
          return html`<li key=${r.id} class="cartao">
            <div class="linha-entre"><strong>${areaPorId(estado, r.areaId).nome}</strong><${EtqReserva} status=${r.status} /></div>
            <span>${fmtDia(r.data)} · ${fmtHora(r.inicio)}–${fmtHora(r.fim)}</span>
            ${r.motivo && html`<small class="sub">Motivo: ${r.motivo}</small>`}
            ${podeCancelar && (cancelando === r.id
              ? html`<div class="cartao">
                  <p class="m-texto">${avisoCancelamento(r, agora).texto}</p>
                  <div class="acoes">
                    <button type="button" class="btn perigo" onClick=${() => confirmar(r.id)}>Confirmar cancelamento</button>
                    <button type="button" class="btn secundario" onClick=${() => setCancelando(null)}>Manter reserva</button>
                  </div>
                </div>`
              : html`<button type="button" class="btn secundario" onClick=${() => setCancelando(r.id)}>Cancelar</button>`)}
          </li>`;
        })}</ul>`
      : html`<${Vazio} texto="Você ainda não fez reservas." />`}`;
}

function MAvisos({ estado, rota, executar }) {
  const lista = comunicadosDaUnidade(estado, UNIDADE_ANA);
  const c = rota.id ? lista.find((x) => x.id === rota.id) : null;
  if (c) {
    const lido = c.leituras.includes(UNIDADE_ANA);
    return html`<section class="m-pagina">
      <a class="voltar" href="#morador.avisos">‹ Avisos</a>
      <div><${Etiqueta} tipo=${tipoEtiquetaAviso(c)}>${TIPOS_COMUNICADO[c.tipo]}<//></div>
      <h1 class="m-titulo">${c.titulo}</h1>
      <p class="m-sub">${fmtDataHora(c.publicadoEm)} · Roberto Lima, síndico</p>
      <p class="m-texto">${c.texto}</p>
      ${c.anexo && html`<p class="anexo">📎 ${c.anexo}</p>`}
      ${lido
        ? html`<p class="sucesso">✓ Você confirmou a leitura</p>`
        : html`<button type="button" class="btn primario bloco" onClick=${() => executar((e) => marcarLido(e, c.id, UNIDADE_ANA))}>Li e estou ciente</button>`}
      <div class="reacoes" role="group" aria-label="Reações">
        ${[['util', 'Útil'], ['duvida', 'Tenho dúvida']].map(([tipo, nome]) => html`<button type="button" key=${tipo} class="btn secundario" aria-pressed=${c.reacoes[tipo].includes(UNIDADE_ANA)} onClick=${() => executar((e) => reagir(e, c.id, UNIDADE_ANA, tipo))}>${nome} · ${c.reacoes[tipo].length}</button>`)}
      </div>
    </section>`;
  }
  return html`<section class="m-pagina">
    <h1 class="m-titulo">Avisos</h1>
    <ul class="m-lista">${lista.map((x) => {
      const lido = x.leituras.includes(UNIDADE_ANA);
      return html`<li key=${x.id}><a class=${`cartao link${lido ? '' : ' nao-lido'}`} href=${`#morador.avisos.${x.id}`}>
        <div class="linha-entre"><${Etiqueta} tipo=${tipoEtiquetaAviso(x)}>${TIPOS_COMUNICADO[x.tipo]}<//>${x.fixado && html`<small>📌 Fixado</small>`}</div>
        <strong>${x.titulo}</strong>
        <small class="sub">${fmtDataHora(x.publicadoEm)}${lido ? '' : ' · não lido'}</small>
      </a></li>`;
    })}</ul>
  </section>`;
}

function MOcorrencias(props) {
  const { estado, rota } = props;
  if (rota.id === 'nova') return html`<${MNovaOcorrencia} ...${props} />`;
  const oc = rota.id ? estado.ocorrencias.find((o) => o.id === rota.id && (o.unidade === UNIDADE_ANA || o.publica)) : null;
  if (oc) return html`<${MDetalheOcorrencia} executar=${props.executar} oc=${oc} />`;
  const minhas = estado.ocorrencias.filter((o) => o.unidade === UNIDADE_ANA);
  const publicas = estado.ocorrencias.filter((o) => o.publica && o.unidade !== UNIDADE_ANA);
  const item = (o) => html`<li key=${o.id}><a class="cartao link" href=${`#morador.ocorrencias.${o.id}`}>
    <div class="linha-entre"><strong>${CATEGORIAS[o.categoria].nome}</strong><${EtqOcorrencia} status=${o.status} arquivada=${o.arquivada} /></div>
    <span>${o.descricao}</span>
    <small class="sub">${o.id}${o.publica ? ` · ${o.eutambem.length} "eu também"` : ''}</small>
  </a></li>`;
  return html`<section class="m-pagina">
    <h1 class="m-titulo">Ocorrências</h1>
    <a class="btn primario bloco" href="#morador.ocorrencias.nova">Abrir ocorrência</a>
    <h2>Minhas</h2>
    ${minhas.length ? html`<ul class="m-lista">${minhas.map(item)}</ul>` : html`<${Vazio} texto="Você não abriu ocorrências." />`}
    <h2>Públicas do condomínio</h2>
    ${publicas.length ? html`<ul class="m-lista">${publicas.map(item)}</ul>` : html`<${Vazio} texto="Nenhuma ocorrência pública." />`}
  </section>`;
}

function MNovaOcorrencia({ executar }) {
  const [categoria, setCategoria] = useState('');
  const [local, setLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [foto, setFoto] = useState(false);
  const [anonima, setAnonima] = useState(false);
  const [publica, setPublica] = useState(false);
  const [erro, setErro] = useState(null);

  function enviar() {
    const r = executar((e) => abrirOcorrencia(e, { categoria, local, descricao, foto, anonima, publica, unidade: UNIDADE_ANA }, new Date()));
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    ir('morador', 'ocorrencias', r.id);
  }

  return html`<section class="m-pagina">
    <a class="voltar" href="#morador.ocorrencias">‹ Ocorrências</a>
    <h1 class="m-titulo">Abrir ocorrência</h1>
    <${Campo} rotulo="Categoria"><select id="ocorrencia-categoria" value=${categoria} onChange=${(ev) => setCategoria(ev.target.value)}>
      <option value="">Escolha…</option>
      ${Object.entries(CATEGORIAS).map(([id, c]) => html`<option key=${id} value=${id}>${c.nome}</option>`)}
    </select><//>
    <${Campo} rotulo="Local"><input id="ocorrencia-local" value=${local} onInput=${(ev) => setLocal(ev.target.value)} placeholder="Ex.: garagem, 5º andar, salão" /><//>
    <${Campo} rotulo="Descrição"><textarea id="ocorrencia-descricao" rows="4" value=${descricao} onInput=${(ev) => setDescricao(ev.target.value)}></textarea><//>
    ${foto ? html`<${FotoFalsa} rotulo="Foto anexada" />` : html`<button type="button" class="btn secundario" onClick=${() => setFoto(true)}>Anexar foto</button>`}
    <label class="check"><input id="ocorrencia-anonima" type="checkbox" checked=${anonima} onChange=${(ev) => setAnonima(ev.target.checked)} /><span>Enviar como anônima</span></label>
    <small class="m-ajuda">O síndico vê o conteúdo, mas não quem enviou.</small>
    <label class="check"><input id="ocorrencia-publica" type="checkbox" checked=${publica} onChange=${(ev) => setPublica(ev.target.checked)} /><span>Tornar pública</span></label>
    <small class="m-ajuda">Todos os moradores veem e podem marcar "eu também".</small>
    <${Erro} texto=${erro} />
    <button type="button" class="btn primario bloco" onClick=${enviar}>Enviar ocorrência</button>
  </section>`;
}

function MDetalheOcorrencia({ executar, oc }) {
  const [nota, setNota] = useState(0);
  const [erro, setErro] = useState(null);
  const minha = oc.unidade === UNIDADE_ANA;
  const podeAvaliar = minha && ['resolvida', 'fechada'].includes(oc.status) && !oc.avaliacao;

  function avaliar() {
    const r = executar((e) => avaliarOcorrencia(e, oc.id, nota));
    setErro(r.erro || null);
  }

  return html`<section class="m-pagina">
    <a class="voltar" href="#morador.ocorrencias">‹ Ocorrências</a>
    <p class="protocolo">Protocolo ${oc.id}</p>
    <h1 class="m-titulo">${CATEGORIAS[oc.categoria].nome}</h1>
    <div><${EtqOcorrencia} status=${oc.status} arquivada=${oc.arquivada} /></div>
    <p class="m-texto">${oc.descricao}</p>
    ${oc.local && html`<p class="m-sub">Local: ${oc.local}</p>`}
    ${oc.foto && html`<${FotoFalsa} rotulo="Foto enviada" />`}
    ${oc.publica && html`<button type="button" class="btn secundario" aria-pressed=${oc.eutambem.includes(UNIDADE_ANA)} onClick=${() => executar((e) => euTambem(e, oc.id, UNIDADE_ANA))}>Eu também · ${oc.eutambem.length}</button>`}
    <h2>Andamento</h2>
    <${LinhaTempo} linha=${oc.linha} />
    ${podeAvaliar && html`<div class="cartao">
      <strong>Como foi o atendimento?</strong>
      <${Estrelas} valor=${nota} aoEscolher=${setNota} />
      <${Erro} texto=${erro} />
      <button type="button" class="btn primario" disabled=${!nota} onClick=${avaliar}>Enviar avaliação</button>
    </div>`}
    ${minha && oc.avaliacao && html`<div class="cartao"><strong>Sua avaliação</strong><${Estrelas} valor=${oc.avaliacao} /></div>`}
  </section>`;
}

function MMais() {
  return html`<section class="m-pagina">
    <h1 class="m-titulo">Mais</h1>
    <a class="cartao link" href="#morador.encomendas"><strong>Encomendas</strong><span class="sub">Na portaria e histórico de retiradas</span></a>
    <a class="cartao link" href="#morador.documentos"><strong>Documentos</strong><span class="sub">Convenção, regimento, atas e laudos</span></a>
  </section>`;
}

function MDocumentos({ estado }) {
  const [aberto, setAberto] = useState(null);
  const visiveis = estado.documentos.filter((d) => d.visibilidade === 'todos');
  const pastas = [...new Set(visiveis.map((d) => d.pasta))];
  const doc = aberto ? visiveis.find((d) => d.id === aberto) : null;
  if (doc) return html`<section class="m-pagina"><${PrevDoc} documento=${doc} aoFechar=${() => setAberto(null)} /></section>`;
  return html`<section class="m-pagina">
    <a class="voltar" href="#morador.mais">‹ Mais</a>
    <h1 class="m-titulo">Documentos</h1>
    ${pastas.map((p) => html`<div key=${p}>
      <h2>${p}</h2>
      <ul class="m-lista">${visiveis.filter((d) => d.pasta === p).map((d) => {
        const atual = d.versoes[d.versoes.length - 1];
        return html`<li key=${d.id}><button type="button" class="cartao link" onClick=${() => setAberto(d.id)}>
          <strong>${d.titulo}</strong>
          <small class="sub">Versão ${atual.versao} · ${fmtDataCurta(atual.data)}</small>
        </button></li>`;
      })}</ul>
    </div>`)}
  </section>`;
}

function MEncomendas({ estado, agora }) {
  const minhas = estado.encomendas.filter((e) => e.unidade === UNIDADE_ANA);
  const aguardando = minhas.filter((e) => e.status === 'aguardando');
  const retiradas = minhas.filter((e) => e.status === 'retirada').sort((a, b) => b.retiradaEm.localeCompare(a.retiradaEm));
  return html`<section class="m-pagina">
    <a class="voltar" href="#morador.mais">‹ Mais</a>
    <h1 class="m-titulo">Encomendas</h1>
    <h2>Na portaria</h2>
    ${aguardando.length ? aguardando.map((e) => html`<${MCartaoEncomenda} key=${e.id} encomenda=${e} agora=${agora} />`) : html`<${Vazio} texto="Nada esperando por você." />`}
    <h2>Retiradas</h2>
    ${retiradas.length
      ? html`<ul class="m-lista">${retiradas.map((e) => html`<li key=${e.id} class="cartao"><strong>${e.transportadora}</strong><small class="sub">Retirada por ${e.retiradaPor} em ${fmtDataHora(e.retiradaEm)}</small></li>`)}</ul>`
      : html`<${Vazio} texto="Nenhuma retirada ainda." />`}
  </section>`;
}
