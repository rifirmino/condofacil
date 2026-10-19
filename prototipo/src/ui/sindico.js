import { html, useState } from '../vendor.js';
import { CATEGORIAS, TIPOS_COMUNICADO, MODELOS_COMUNICADO, NOMES_CANAL, NOMES_STATUS, FLUXO_OCORRENCIA } from '../dados.js';
import { areaPorId, statusDia, indicadoresSindico, slaVencido, alertasDocumentos, acoesOcorrencia, destinatarios, encomendaParada, moradoresDaUnidade } from '../regras.js';
import { aprovarReserva, recusarReserva, publicarComunicado, avancarOcorrencia, comentarOcorrencia, arquivarOcorrencia, lembrarEncomenda } from '../acoes.js';
import { aprovarVendedor, recusarVendedor, suspenderVendedor, reativarVendedor, ocultarAnuncio, mostrarAnuncio } from '../vendas/acoes.js';
import { nomeVizinho, fmtCentavos } from '../vendas/regras.js';
import { PainelFinanceiro, pendenciasCobranca, SCobranca } from './financeiro-sindico.js';
import { isoDia, somarMes, fmtDia, fmtHora, fmtDataHora, fmtDataCurta, haQuanto } from '../datas.js';
import { ir, fmtMoeda, Etiqueta, EtqReserva, EtqOcorrencia, Erro, Sucesso, Vazio, FotoFalsa, Calendario, LinhaTempo, Estrelas, PrevDoc, Campo, Icone, QuadroIcone } from './comum.js';

const MENU_SINDICO = [['inicio', 'Início', 'grafico'], ['cobranca', 'Cobrança', 'cifrao'], ['reservas', 'Reservas', 'calendario'], ['comunicados', 'Comunicados', 'megafone'], ['ocorrencias', 'Ocorrências', 'prancheta'], ['documentos', 'Documentos', 'documento'], ['encomendas', 'Encomendas', 'pacote'], ['vendas', 'Vendas', 'loja']];
const EM_BREVE = ['Acordos', 'Notificações e OS', 'Zelador', 'Escala de porteiros'];
const MOTIVOS_RECUSA = ['Data reservada para manutenção', 'Conflito com evento do condomínio', 'Unidade com pendência no regulamento', 'Documentação incompleta'];
const FILTROS_OCORRENCIA = [['ativas', 'Em aberto'], ['todas', 'Todas'], ...FLUXO_OCORRENCIA.map((s) => [s, NOMES_STATUS[s]]), ['arquivadas', 'Arquivadas']];

function textoAlerta(alerta) {
  const n = Math.abs(alerta.dias);
  const dias = n === 1 ? '1 dia' : `${n} dias`;
  if (alerta.dias < 0) return `Vencido há ${dias}`;
  if (alerta.dias === 0) return 'Vence hoje';
  return `Vence em ${dias}`;
}

function textoPrazo(oc) {
  const sla = CATEGORIAS[oc.categoria].sla;
  if (!sla) return 'Sem prazo';
  return oc.status === 'aberta' ? `${sla} h para atender` : 'Atendida';
}

function tipoEtiquetaComunicado(c) {
  return c.tipo === 'urgente' ? 'perigo' : 'info';
}

export function TelaSindico(props) {
  const tela = MENU_SINDICO.some(([id]) => id === props.rota.tela) ? props.rota.tela : 'inicio';
  const Conteudo = { inicio: SInicio, reservas: SReservas, comunicados: SComunicados, ocorrencias: SOcorrencias, documentos: SDocumentos, encomendas: SEncomendas, vendas: SVendas, cobranca: SCobranca }[tela];
  return html`<div class="painel">
    <nav class="painel-menu" aria-label="Menu do síndico">
      <p class="painel-usuario"><strong>Roberto Lima</strong><small>Síndico · apto 801</small></p>
      ${MENU_SINDICO.map(([id, nome, icone]) => html`<a key=${id} href=${`#sindico.${id}`} class=${id === tela ? 'ativa' : ''} aria-current=${id === tela ? 'page' : undefined}><${Icone} nome=${icone} tamanho=${20} />${nome}</a>`)}
      ${EM_BREVE.map((nome) => html`<span key=${nome} class="em-breve" aria-disabled="true">${nome}<small>Em breve · Intermediário</small></span>`)}
    </nav>
    <div class="painel-conteudo"><${Conteudo} ...${props} /></div>
  </div>`;
}

function SInicio({ estado, agora }) {
  const ind = indicadoresSindico(estado, agora);
  const pendentes = estado.reservas.filter((r) => r.status === 'pendente');
  const vencidas = estado.ocorrencias.filter((o) => slaVencido(o, agora));
  const paradas = estado.encomendas.filter((e) => encomendaParada(e, agora));
  const alertas = alertasDocumentos(estado.documentos, isoDia(agora));
  const vendedoresPendentes = estado.pessoas.filter((p) => p.vendedor === 'pendente');
  const pendCobranca = pendenciasCobranca(estado, isoDia(agora));
  const pct = Math.round((ind.adesao.com / ind.adesao.total) * 100);
  const cartoes = [
    ['Reservas pendentes', ind.pendentes, '#sindico.reservas', ind.pendentes ? 'alerta' : 'ok', 'Aguardando sua aprovação', 'calendario'],
    ['Ocorrências abertas', ind.abertas, '#sindico.ocorrencias', ind.slaVencidas ? 'perigo' : 'info', ind.slaVencidas ? `${ind.slaVencidas} com prazo vencido` : 'Todas dentro do prazo', 'prancheta'],
    ['Encomendas paradas', ind.paradas, '#sindico.encomendas', ind.paradas ? 'alerta' : 'ok', 'Há mais de 3 dias na portaria', 'pacote'],
    ['Documentos vencendo', ind.vencendo, '#sindico.documentos', ind.vencendo ? 'perigo' : 'ok', 'Vencidos ou nos próximos 60 dias', 'documento'],
  ];
  const semPendencias = !pendentes.length && !vencidas.length && !paradas.length && !alertas.length && !vendedoresPendentes.length && !pendCobranca.length;
  return html`<section>
    <h1>Olá, Roberto</h1>
    <${PainelFinanceiro} estado=${estado} agora=${agora} />
    <h2>Precisa da sua atenção</h2>
    ${semPendencias
      ? html`<${Vazio} texto="Nada pendente. Bom trabalho!" />`
      : html`<ul class="atencao">
          ${pendCobranca.map((p) => html`<li key=${p.chave}><a href=${p.href}>${p.texto}</a></li>`)}
          ${pendentes.map((r) => html`<li key=${r.id}><a href="#sindico.reservas">Aprovar reserva: ${areaPorId(estado, r.areaId).nome}, apto ${r.unidade}, ${fmtDia(r.data)}</a></li>`)}
          ${vencidas.map((o) => html`<li key=${o.id}><a href=${`#sindico.ocorrencias.${o.id}`}>Prazo vencido: ${o.id} · ${CATEGORIAS[o.categoria].nome}</a></li>`)}
          ${paradas.map((e) => html`<li key=${e.id}><a href="#sindico.encomendas">Encomenda parada: apto ${e.unidade}, chegou ${haQuanto(e.chegadaEm, agora)}</a></li>`)}
          ${alertas.map((a) => html`<li key=${a.documento.id}><a href="#sindico.documentos">${textoAlerta(a)}: ${a.documento.titulo}</a></li>`)}
          ${vendedoresPendentes.map((p) => html`<li key=${`v${p.unidade}`}><a href="#sindico.vendas">Aprovar vendedor: ${p.nome}, apto ${p.unidade}</a></li>`)}
        </ul>`}
    <h2>Operação</h2>
    <div class="indicadores">
      ${cartoes.map(([rotulo, valor, href, tipo, detalhe, icone]) => html`<a key=${rotulo} class=${`indicador ind-${tipo}`} href=${href}><${QuadroIcone} nome=${icone} cheio=${tipo === 'perigo' || tipo === 'alerta'} /><span class="ind-rotulo">${rotulo}</span><strong>${valor}</strong><small>${detalhe}</small></a>`)}
    </div>
    <div class="cartao adesao">
      <div class="linha-entre"><strong>Adesão dos moradores</strong><span>${ind.adesao.com} de ${ind.adesao.total} unidades com app</span></div>
      <div class="barra" role="progressbar" aria-label="Adesão" aria-valuenow=${pct} aria-valuemin="0" aria-valuemax="100"><span style=${`width:${pct}%`}></span></div>
      <small class="sub">Meta do piloto: 60% das unidades em 30 dias. Hoje: ${pct}%.</small>
    </div>
  </section>`;
}

function SReservas({ estado, executar, agora }) {
  const hoje = isoDia(agora);
  const [areaId, setAreaId] = useState('salao');
  const [anoMes, setAnoMes] = useState(hoje.slice(0, 7));
  const [dia, setDia] = useState(hoje);
  const [recusando, setRecusando] = useState(null);
  const [motivo, setMotivo] = useState(MOTIVOS_RECUSA[0]);
  const [erro, setErro] = useState(null);
  const pendentes = estado.reservas.filter((r) => r.status === 'pendente').sort((a, b) => a.data.localeCompare(b.data));
  const doDia = estado.reservas.filter((r) => r.data === dia && r.areaId === areaId && r.status !== 'cancelada').sort((a, b) => a.inicio - b.inicio);
  const bloqueios = estado.bloqueios.filter((b) => b.data === dia && b.areaId === areaId);

  function aprovar(id) {
    const r = executar((e) => aprovarReserva(e, id));
    setErro(r.erro || null);
  }

  function recusar(id) {
    const r = executar((e) => recusarReserva(e, id, motivo));
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    setRecusando(null);
    setErro(null);
  }

  return html`<section>
    <h1>Reservas</h1>
    <h2>Pendentes de aprovação</h2>
    <${Erro} texto=${erro} />
    ${pendentes.length
      ? html`<ul class="lista-cartoes">${pendentes.map((r) => html`<li key=${r.id} class="cartao">
          <div class="linha-entre"><strong>${areaPorId(estado, r.areaId).nome} · apto ${r.unidade}</strong><span>${fmtDia(r.data)}, ${fmtHora(r.inicio)}–${fmtHora(r.fim)}</span></div>
          <small class="sub">Solicitada ${haQuanto(r.criadaEm, agora)} · ${r.convidados.length} convidados · aprovação automática em 48 h se não houver resposta</small>
          ${recusando === r.id
            ? html`<div class="recusa">
                <${Campo} rotulo="Motivo da recusa"><select id=${`motivo-${r.id}`} value=${motivo} onChange=${(ev) => setMotivo(ev.target.value)}>${MOTIVOS_RECUSA.map((m) => html`<option key=${m} value=${m}>${m}</option>`)}</select><//>
                <button type="button" class="btn perigo" onClick=${() => recusar(r.id)}>Confirmar recusa</button>
                <button type="button" class="btn secundario" onClick=${() => setRecusando(null)}>Voltar</button>
              </div>`
            : html`<div class="acoes">
                <button type="button" class="btn primario" data-acao=${`aprovar-${r.id}`} onClick=${() => aprovar(r.id)}>Aprovar</button>
                <button type="button" class="btn secundario" data-acao=${`recusar-${r.id}`} onClick=${() => setRecusando(r.id)}>Recusar</button>
              </div>`}
        </li>`)}</ul>`
      : html`<${Vazio} texto="Nenhuma reserva aguardando aprovação." />`}
    <h2>Agenda</h2>
    <div class="chips" role="group" aria-label="Área">
      ${estado.areas.map((a) => html`<button type="button" key=${a.id} class="chip" aria-pressed=${a.id === areaId} onClick=${() => setAreaId(a.id)}>${a.nome}</button>`)}
    </div>
    <div class="agenda">
      <${Calendario} anoMes=${anoMes} statusDe=${(iso) => statusDia(estado, areaId, iso)} selecionado=${dia} aoEscolher=${setDia} aoMudarMes=${(n) => setAnoMes(somarMes(anoMes, n))} />
      <div>
        <h3>${fmtDia(dia)}</h3>
        ${bloqueios.map((b) => html`<p key=${b.id} class="cartao bloqueio">Bloqueado ${fmtHora(b.inicio)}–${fmtHora(b.fim)}: ${b.motivo}</p>`)}
        ${doDia.length
          ? html`<ul class="lista-cartoes">${doDia.map((r) => html`<li key=${r.id} class="cartao"><div class="linha-entre"><span>${fmtHora(r.inicio)}–${fmtHora(r.fim)} · apto ${r.unidade}</span><${EtqReserva} status=${r.status} /></div></li>`)}</ul>`
          : !bloqueios.length && html`<${Vazio} texto="Nenhuma reserva neste dia." />`}
      </div>
    </div>
    <h2>Regras das áreas</h2>
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Área</th><th>Tipo</th><th>Taxa</th><th>Aprovação</th><th>Antecedência</th><th>Limite</th></tr></thead>
      <tbody>${estado.areas.map((a) => html`<tr key=${a.id}>
        <td>${a.nome}</td>
        <td>${a.tipo === 'periodo' ? 'Período' : 'Por hora'}</td>
        <td>${a.taxa ? fmtMoeda(a.taxa) : '—'}</td>
        <td>${a.aprovacao === 'manual' ? 'Manual' : 'Automática'}</td>
        <td>${a.antecedenciaMin} a ${a.antecedenciaMax} dias</td>
        <td>${a.limiteMes ? `${a.limiteMes} por mês` : 'Sem limite'}</td>
      </tr>`)}</tbody>
    </table></div>
  </section>`;
}

function BarraLeitura({ lidas, total }) {
  const pct = total ? Math.round((lidas / total) * 100) : 0;
  return html`<div class="leitura">
    <div class="barra" role="progressbar" aria-label="Leitura" aria-valuenow=${pct} aria-valuemin="0" aria-valuemax="100"><span style=${`width:${pct}%`}></span></div>
    <small class="sub">${lidas} de ${total} unidades leram</small>
  </div>`;
}

function SComunicados(props) {
  const { estado, rota } = props;
  if (rota.id === 'novo') return html`<${SNovoComunicado} executar=${props.executar} />`;
  const c = rota.id ? estado.comunicados.find((x) => x.id === rota.id) : null;
  if (c) return html`<${SDetalheComunicado} estado=${estado} c=${c} />`;
  const lista = [...estado.comunicados].sort((a, b) => b.publicadoEm.localeCompare(a.publicadoEm));
  return html`<section>
    <div class="linha-entre"><h1>Comunicados</h1><a class="btn primario" href="#sindico.comunicados.novo">Novo comunicado</a></div>
    <ul class="lista-cartoes">${lista.map((x) => html`<li key=${x.id}><a class="cartao link" href=${`#sindico.comunicados.${x.id}`}>
      <div class="linha-entre"><span class="etq-linha"><${Etiqueta} tipo=${tipoEtiquetaComunicado(x)}>${TIPOS_COMUNICADO[x.tipo]}<//>${x.fixado && html`<small class="fixado"><${Icone} nome="alfinete" tamanho=${16} />Fixado</small>`}</span><small class="sub">${fmtDataHora(x.publicadoEm)}</small></div>
      <strong>${x.titulo}</strong>
      <${BarraLeitura} lidas=${x.leituras.length} total=${destinatarios(estado, x.publico).length} />
    </a></li>`)}</ul>
  </section>`;
}

function SDetalheComunicado({ estado, c }) {
  const dest = destinatarios(estado, c.publico);
  return html`<section>
    <a class="voltar" href="#sindico.comunicados">‹ Comunicados</a>
    <div><${Etiqueta} tipo=${tipoEtiquetaComunicado(c)}>${TIPOS_COMUNICADO[c.tipo]}<//></div>
    <h1>${c.titulo}</h1>
    <p class="sub">Publicado em ${fmtDataHora(c.publicadoEm)} · ${c.canais.map((k) => NOMES_CANAL[k]).join(', ')}</p>
    <p class="texto-longo">${c.texto}</p>
    ${c.anexo && html`<p class="anexo"><${Icone} nome="clipe" tamanho=${18} />${c.anexo}</p>`}
    <h2>Confirmação de leitura</h2>
    <${BarraLeitura} lidas=${c.leituras.length} total=${dest.length} />
    <div class="grade-unidades">${dest.map((u) => {
      const lida = c.leituras.includes(u);
      return html`<span key=${u} class=${lida ? 'lida' : 'nao-lida'} aria-label=${`Apto ${u}: ${lida ? 'leu' : 'não leu'}`}>${u}</span>`;
    })}</div>
    <p class="legenda"><span class="lida">Leu</span> <span class="nao-lida">Não leu</span></p>
    <p class="sub">${c.reacoes.util.length} acharam útil · ${c.reacoes.duvida.length} com dúvida</p>
  </section>`;
}

function SNovoComunicado({ executar }) {
  const [tipo, setTipo] = useState('geral');
  const [titulo, setTitulo] = useState(MODELOS_COMUNICADO.geral.titulo);
  const [texto, setTexto] = useState(MODELOS_COMUNICADO.geral.texto);
  const [publicoTipo, setPublicoTipo] = useState('todos');
  const [andar, setAndar] = useState('1');
  const [unidades, setUnidades] = useState('');
  const [canais, setCanais] = useState(['push', 'email', 'whatsapp']);
  const [fixado, setFixado] = useState(false);
  const [anexo, setAnexo] = useState(null);
  const [erro, setErro] = useState(null);
  const urgente = tipo === 'urgente';

  function trocarTipo(novo) {
    setTipo(novo);
    setTitulo(MODELOS_COMUNICADO[novo].titulo);
    setTexto(MODELOS_COMUNICADO[novo].texto);
  }

  function alternarCanal(k) {
    setCanais(canais.includes(k) ? canais.filter((x) => x !== k) : [...canais, k]);
  }

  function publicar() {
    let publico = { tipo: 'todos' };
    if (publicoTipo === 'andar') publico = { tipo: 'andar', valor: andar };
    if (publicoTipo === 'unidades') publico = { tipo: 'unidades', valor: unidades.split(/[\s,;]+/).filter(Boolean) };
    const r = executar((e) => publicarComunicado(e, { tipo, titulo, texto, publico, canais, fixado, anexo }, new Date()));
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    ir('sindico', 'comunicados', r.id);
  }

  return html`<section class="formulario">
    <a class="voltar" href="#sindico.comunicados">‹ Comunicados</a>
    <h1>Novo comunicado</h1>
    <${Campo} rotulo="Tipo" dica="Trocar o tipo preenche um modelo pronto."><select id="comunicado-tipo" value=${tipo} onChange=${(ev) => trocarTipo(ev.target.value)}>${Object.entries(TIPOS_COMUNICADO).map(([id, nome]) => html`<option key=${id} value=${id}>${nome}</option>`)}</select><//>
    <${Campo} rotulo="Título"><input id="comunicado-titulo" value=${titulo} onInput=${(ev) => setTitulo(ev.target.value)} /><//>
    <${Campo} rotulo="Texto"><textarea id="comunicado-texto" rows="7" value=${texto} onInput=${(ev) => setTexto(ev.target.value)}></textarea><//>
    <fieldset>
      <legend>Público</legend>
      ${[['todos', 'Todo o condomínio'], ['andar', 'Um andar'], ['unidades', 'Unidades específicas']].map(([id, nome]) => html`<label key=${id} class="check"><input id=${`publico-${id}`} type="radio" name="publico" checked=${publicoTipo === id} onChange=${() => setPublicoTipo(id)} /><span>${nome}</span></label>`)}
      ${publicoTipo === 'andar' && html`<${Campo} rotulo="Andar"><select id="comunicado-andar" value=${andar} onChange=${(ev) => setAndar(ev.target.value)}>${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => html`<option key=${n} value=${String(n)}>${n}º andar</option>`)}</select><//>`}
      ${publicoTipo === 'unidades' && html`<${Campo} rotulo="Unidades" dica="Separe por vírgula. Ex.: 302, 303"><input id="comunicado-unidades" value=${unidades} onInput=${(ev) => setUnidades(ev.target.value)} /><//>`}
    </fieldset>
    <fieldset>
      <legend>Canais</legend>
      ${Object.entries(NOMES_CANAL).map(([k, nome]) => {
        const travado = k === 'sms' && urgente;
        return html`<label key=${k} class="check"><input id=${`canal-${k}`} type="checkbox" checked=${travado || canais.includes(k)} disabled=${travado} onChange=${() => alternarCanal(k)} /><span>${nome}${travado ? ' (obrigatório em urgentes)' : ''}</span></label>`;
      })}
    </fieldset>
    <label class="check"><input id="comunicado-fixar" type="checkbox" checked=${fixado} onChange=${(ev) => setFixado(ev.target.checked)} /><span>Fixar no topo</span></label>
    ${anexo
      ? html`<p class="anexo"><${Icone} nome="clipe" tamanho=${18} />${anexo} <button type="button" class="btn-link" onClick=${() => setAnexo(null)}>remover</button></p>`
      : html`<button type="button" class="btn secundario" onClick=${() => setAnexo('comunicado-anexo.pdf')}>Anexar PDF</button>`}
    <${Erro} texto=${erro} />
    <button type="button" class="btn primario" onClick=${publicar}>Publicar comunicado</button>
  </section>`;
}

function SOcorrencias(props) {
  const { estado, rota, agora } = props;
  const [filtro, setFiltro] = useState('ativas');
  const oc = rota.id ? estado.ocorrencias.find((o) => o.id === rota.id) : null;
  if (oc) return html`<${SDetalheOcorrencia} executar=${props.executar} agora=${agora} oc=${oc} />`;
  const lista = estado.ocorrencias
    .filter((o) => {
      if (filtro === 'arquivadas') return o.arquivada;
      if (o.arquivada) return false;
      if (filtro === 'todas') return true;
      if (filtro === 'ativas') return !['resolvida', 'fechada'].includes(o.status);
      return o.status === filtro;
    })
    .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
  return html`<section>
    <h1>Ocorrências</h1>
    <div class="formulario"><${Campo} rotulo="Mostrar"><select id="ocorrencias-filtro" value=${filtro} onChange=${(ev) => setFiltro(ev.target.value)}>${FILTROS_OCORRENCIA.map(([id, nome]) => html`<option key=${id} value=${id}>${nome}</option>`)}</select><//></div>
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Protocolo</th><th>Categoria</th><th>Unidade</th><th>Status</th><th>Prazo</th><th>Aberta</th></tr></thead>
      <tbody>${lista.map((o) => html`<tr key=${o.id} class="clicavel" onClick=${() => ir('sindico', 'ocorrencias', o.id)}>
        <td><a href=${`#sindico.ocorrencias.${o.id}`}>${o.id}</a></td>
        <td>${CATEGORIAS[o.categoria].nome}${o.publica && html` <${Etiqueta}>Pública<//>`}</td>
        <td>${o.anonima ? 'Anônima' : o.unidade}</td>
        <td><${EtqOcorrencia} status=${o.status} arquivada=${o.arquivada} /></td>
        <td>${slaVencido(o, agora) ? html`<${Etiqueta} tipo="perigo">Vencido<//>` : textoPrazo(o)}</td>
        <td>${haQuanto(o.criadaEm, agora)}</td>
      </tr>`)}</tbody>
    </table></div>
    ${!lista.length && html`<${Vazio} texto="Nenhuma ocorrência neste filtro." />`}
  </section>`;
}

function SDetalheOcorrencia({ executar, agora, oc }) {
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState(null);
  const acoes = acoesOcorrencia(oc);

  function fazer(acao) {
    const r = executar((e) => {
      if (acao === 'avancar') return avancarOcorrencia(e, oc.id, new Date(), texto);
      if (acao === 'comentar') return comentarOcorrencia(e, oc.id, texto, new Date());
      return arquivarOcorrencia(e, oc.id);
    });
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    setErro(null);
    setTexto('');
  }

  return html`<section>
    <a class="voltar" href="#sindico.ocorrencias">‹ Ocorrências</a>
    <p class="protocolo">Protocolo ${oc.id}</p>
    <div class="linha-entre"><h1>${CATEGORIAS[oc.categoria].nome}</h1><${EtqOcorrencia} status=${oc.status} arquivada=${oc.arquivada} /></div>
    <p class="sub">${oc.anonima ? 'Autor anônimo' : `Apto ${oc.unidade}`}${oc.local ? ` · ${oc.local}` : ''} · aberta ${haQuanto(oc.criadaEm, agora)}${slaVencido(oc, agora) ? ' · prazo vencido' : ''}</p>
    <p class="texto-longo">${oc.descricao}</p>
    ${oc.foto && html`<${FotoFalsa} rotulo="Foto enviada pelo morador" />`}
    ${oc.publica && html`<p class="sub">Pública · ${oc.eutambem.length} moradores marcaram "eu também"</p>`}
    ${oc.avaliacao && html`<div><span class="sub">Avaliação do morador</span><${Estrelas} valor=${oc.avaliacao} /></div>`}
    <h2>Linha do tempo</h2>
    <${LinhaTempo} linha=${oc.linha} />
    ${acoes.length
      ? html`<div class="cartao">
          <${Campo} rotulo="Mensagem ao morador" dica="Opcional ao mudar o status; obrigatória para comentar."><textarea id="ocorrencia-mensagem" rows="2" value=${texto} onInput=${(ev) => setTexto(ev.target.value)}></textarea><//>
          <${Erro} texto=${erro} />
          <div class="acoes">${acoes.map((a) => html`<button type="button" key=${a.id} class=${a.id === 'avancar' ? 'btn primario' : 'btn secundario'} onClick=${() => fazer(a.id)}>${a.rotulo}</button>`)}</div>
        </div>`
      : html`<p class="sub">Ocorrência arquivada. O histórico fica guardado para auditoria e não pode ser apagado.</p>`}
  </section>`;
}

function SDocumentos({ estado, agora }) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(null);
  const [historico, setHistorico] = useState(null);
  const alertas = alertasDocumentos(estado.documentos, isoDia(agora));
  const termo = busca.trim().toLowerCase();
  const docs = estado.documentos.filter((d) => !termo || d.titulo.toLowerCase().includes(termo) || d.pasta.toLowerCase().includes(termo));
  const pastas = [...new Set(docs.map((d) => d.pasta))];
  const doc = aberto ? estado.documentos.find((d) => d.id === aberto) : null;
  if (doc) return html`<section><${PrevDoc} documento=${doc} aoFechar=${() => setAberto(null)} /></section>`;
  return html`<section>
    <h1>Documentos</h1>
    ${alertas.length > 0 && html`<div class="alertas">${alertas.map((a) => html`<p key=${a.documento.id} class=${`alerta-doc faixa-${a.faixa}`}><strong>${textoAlerta(a)}</strong> · ${a.documento.titulo} (${fmtDataCurta(a.documento.vencimento)})</p>`)}</div>`}
    <div class="formulario"><${Campo} rotulo="Buscar documento"><input id="documentos-busca" type="search" value=${busca} onInput=${(ev) => setBusca(ev.target.value)} placeholder="Ex.: ata, AVCB, regimento" /><//></div>
    ${pastas.map((p) => html`<div key=${p}>
      <h2>${p}</h2>
      <ul class="lista-cartoes">${docs.filter((d) => d.pasta === p).map((d) => {
        const atual = d.versoes[d.versoes.length - 1];
        return html`<li key=${d.id} class="cartao">
          <div class="linha-entre"><button type="button" class="btn-link" onClick=${() => setAberto(d.id)}>${d.titulo}</button>${d.visibilidade === 'conselho' && html`<${Etiqueta}>Só conselho<//>`}</div>
          <small class="sub">Vigente: versão ${atual.versao} de ${fmtDataCurta(atual.data)}${d.vencimento ? ` · vence em ${fmtDataCurta(d.vencimento)}` : ''}</small>
          ${d.versoes.length > 1 && html`<button type="button" class="btn-link" onClick=${() => setHistorico(historico === d.id ? null : d.id)}>${historico === d.id ? 'Ocultar histórico' : `Histórico (${d.versoes.length} versões)`}</button>`}
          ${historico === d.id && html`<ul class="historico">${[...d.versoes].reverse().map((v) => html`<li key=${v.versao}>Versão ${v.versao} · ${fmtDataCurta(v.data)}</li>`)}</ul>`}
        </li>`;
      })}</ul>
    </div>`)}
    ${!docs.length && html`<${Vazio} texto="Nenhum documento encontrado." />`}
  </section>`;
}

function SEncomendas({ estado, executar, agora }) {
  const [mensagem, setMensagem] = useState(null);
  const lista = [...estado.encomendas].sort((a, b) => b.chegadaEm.localeCompare(a.chegadaEm));

  function lembrar(id) {
    const r = executar((e) => lembrarEncomenda(e, id, new Date()));
    setMensagem(r.erro || 'Lembrete reenviado por WhatsApp.');
  }

  return html`<section>
    <h1>Encomendas</h1>
    <${Sucesso} texto=${mensagem} />
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Unidade</th><th>Morador</th><th>Transportadora</th><th>Chegada</th><th>Situação</th><th>Ação</th></tr></thead>
      <tbody>${lista.map((e) => {
        const parada = encomendaParada(e, agora);
        let situacao = html`<${Etiqueta} tipo="alerta">Aguardando<//>`;
        if (e.status === 'retirada') situacao = html`<${Etiqueta} tipo="ok">Retirada por ${e.retiradaPor}<//>`;
        else if (parada) situacao = html`<${Etiqueta} tipo="perigo">Parada, chegou ${haQuanto(e.chegadaEm, agora)}<//>`;
        return html`<tr key=${e.id}>
          <td>${e.unidade}</td>
          <td>${moradoresDaUnidade(estado, e.unidade).map((m) => m.nome).join(', ') || '—'}</td>
          <td>${e.transportadora}</td>
          <td>${fmtDataHora(e.chegadaEm)}</td>
          <td>${situacao}${e.lembretes ? html` <small class="sub">${e.lembretes} lembrete(s)</small>` : ''}</td>
          <td>${e.status === 'aguardando' && html`<button type="button" class="btn secundario" onClick=${() => lembrar(e.id)}>Reenviar lembrete</button>`}</td>
        </tr>`;
      })}</tbody>
    </table></div>
  </section>`;
}

function SVendas({ estado, executar, agora }) {
  const [editando, setEditando] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState(null);
  const mes = isoDia(agora).slice(0, 7);
  const pendentes = estado.pessoas.filter((p) => p.vendedor === 'pendente');
  const vendedores = estado.pessoas.filter((p) => ['aprovado', 'suspenso'].includes(p.vendedor));
  const pedidosNoMes = (unidade) => estado.pedidos.filter((p) => (!unidade || p.vendedor === unidade) && isoDia(new Date(p.criadoEm)).slice(0, 7) === mes).length;

  function rodar(acao) {
    const r = executar(acao);
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    setErro(null);
    setEditando(null);
    setMotivo('');
  }

  function abrir(tipo, id) {
    setEditando({ tipo, id });
    setMotivo('');
    setErro(null);
  }

  function confirmar() {
    const { tipo, id } = editando;
    if (tipo === 'recusar') rodar((e) => recusarVendedor(e, id, motivo));
    if (tipo === 'suspender') rodar((e) => suspenderVendedor(e, id, motivo));
    if (tipo === 'ocultar') rodar((e) => ocultarAnuncio(e, id, motivo));
  }

  const caixaMotivo = (tipo, id) => editando && editando.tipo === tipo && editando.id === id && html`<div class="recusa">
    <${Campo} rotulo="Motivo"><input id=${`motivo-${tipo}-${id}`} value=${motivo} onInput=${(ev) => setMotivo(ev.target.value)} /><//>
    <button type="button" class="btn perigo" onClick=${confirmar}>Confirmar</button>
    <button type="button" class="btn secundario" onClick=${() => setEditando(null)}>Voltar</button>
  </div>`;

  return html`<section>
    <h1>Vendas entre moradores</h1>
    <div class="indicadores">
      <div class="indicador"><${QuadroIcone} nome="sacola" /><span class="ind-rotulo">Pedidos no mês</span><strong>${pedidosNoMes()}</strong><small>Entre todos os vendedores</small></div>
      <div class="indicador"><${QuadroIcone} nome="loja" /><span class="ind-rotulo">Vendedores ativos</span><strong>${vendedores.filter((p) => p.vendedor === 'aprovado').length}</strong><small>${pendentes.length} aguardando aprovação</small></div>
    </div>
    <p class="sub">Por privacidade, conversas e detalhes dos pedidos ficam só entre comprador e vendedor.</p>
    <${Erro} texto=${erro} />
    <h2>Solicitações para vender</h2>
    ${pendentes.length
      ? html`<ul class="lista-cartoes">${pendentes.map((p) => html`<li key=${p.unidade} class="cartao">
          <div class="linha-entre"><strong>${p.nome} · apto ${p.unidade}</strong><small class="sub">${fmtDataHora(p.pedidoVenda.em)}</small></div>
          <span>${p.pedidoVenda.texto}</span>
          ${caixaMotivo('recusar', p.unidade) || html`<div class="acoes">
            <button type="button" class="btn primario" data-acao=${`aprovar-vendedor-${p.unidade}`} onClick=${() => rodar((e) => aprovarVendedor(e, p.unidade))}>Aprovar</button>
            <button type="button" class="btn secundario" onClick=${() => abrir('recusar', p.unidade)}>Recusar</button>
          </div>`}
        </li>`)}</ul>`
      : html`<${Vazio} texto="Nenhuma solicitação aguardando." />`}
    <h2>Vendedores</h2>
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Vendedor</th><th>Situação</th><th>Anúncios ativos</th><th>Pedidos no mês</th><th>Ação</th></tr></thead>
      <tbody>${vendedores.map((p) => html`<tr key=${p.unidade}>
        <td>${p.nome} · apto ${p.unidade}</td>
        <td>${p.vendedor === 'aprovado' ? html`<${Etiqueta} tipo="ok">Ativo<//>` : html`<${Etiqueta} tipo="perigo">Suspenso<//>`}</td>
        <td>${estado.anuncios.filter((a) => a.vendedor === p.unidade && a.ativo && !a.oculto).length}</td>
        <td>${pedidosNoMes(p.unidade)}</td>
        <td>${p.vendedor === 'aprovado'
          ? caixaMotivo('suspender', p.unidade) || html`<button type="button" class="btn secundario" onClick=${() => abrir('suspender', p.unidade)}>Suspender</button>`
          : html`<button type="button" class="btn secundario" onClick=${() => rodar((e) => reativarVendedor(e, p.unidade))}>Reativar</button>`}</td>
      </tr>`)}</tbody>
    </table></div>
    <h2>Anúncios</h2>
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Anúncio</th><th>Vendedor</th><th>Preço</th><th>Disponível</th><th>Situação</th><th>Ação</th></tr></thead>
      <tbody>${[...estado.anuncios].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).map((a) => {
        let situacao = html`<${Etiqueta} tipo="ok">Na vitrine<//>`;
        if (a.oculto) situacao = html`<${Etiqueta} tipo="perigo">Oculto<//>`;
        else if (!a.ativo) situacao = html`<${Etiqueta}>Pausado<//>`;
        return html`<tr key=${a.id}>
          <td>${a.titulo}${a.oculto ? html`<br /><small class="sub">Motivo: ${a.motivoOculto}</small>` : ''}</td>
          <td>${nomeVizinho(estado, a.vendedor)} · apto ${a.vendedor}</td>
          <td>${fmtCentavos(a.preco)}</td>
          <td>${a.quantidade}</td>
          <td>${situacao}</td>
          <td>${a.oculto
            ? html`<button type="button" class="btn secundario" onClick=${() => rodar((e) => mostrarAnuncio(e, a.id))}>Mostrar</button>`
            : caixaMotivo('ocultar', a.id) || html`<button type="button" class="btn secundario" onClick=${() => abrir('ocultar', a.id)}>Ocultar</button>`}</td>
        </tr>`;
      })}</tbody>
    </table></div>
  </section>`;
}
