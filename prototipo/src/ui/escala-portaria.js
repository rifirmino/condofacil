import { html, useState } from '../vendor.js';
import { liberado } from '../planos.js';
import { POSTOS, PORTEIROS } from '../escala/dados.js';
import { plantaoAgora, turnosDoPorteiro, feriadosDoMes, porteiroPorId, acharTurno, fmtTurno } from '../escala/regras.js';
import { proporTroca, aceitarTroca, recusarTroca, registrarFalta, fazerCheckin, fazerCheckout } from '../escala/acoes.js';
import { Campo, Erro, Sucesso, Vazio, Etiqueta } from './comum.js';
import { Bloqueado } from './financeiro-sindico.js';

// O porteiro vê só a própria escala e o plantão dos postos: nada financeiro.
function horaDoTurno(local) {
  return `${Number(local.slice(11, 13))}h`;
}

function textoCheckin(t) {
  const hora = `${Number(t.checkin.em.slice(11, 13))}h${t.checkin.em.slice(14, 16)}`;
  return `Check-in às ${hora}${t.checkin.atrasoMin ? ` · ${t.checkin.atrasoMin} min de atraso` : ' · no horário'}`;
}

export function PEscala({ estado, executar, agora }) {
  const [porteiro, setPorteiro] = useState('jose');
  const [abrindo, setAbrindo] = useState(null);
  const [colega, setColega] = useState('');
  const [motivo, setMotivo] = useState('falta');
  const [anexo, setAnexo] = useState(null);
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  if (!liberado(estado.plano, 'escala')) return html`<section><h1>Escala</h1><${Bloqueado} estado=${estado} recurso="escala" titulo="Escala, trocas e faltas dos porteiros" /></section>`;
  const plantao = plantaoAgora(estado, agora);
  const comCheckin = liberado(estado.plano, 'checkin');
  const meus = turnosDoPorteiro(estado, porteiro, agora).slice(0, 8);
  const feriados = Object.fromEntries(Object.keys(estado.escala.meses).flatMap((m) => feriadosDoMes(m)).map((f) => [f.dia, f.nome]));
  const recebidas = estado.escala.trocas.filter((x) => x.situacao === 'proposta' && x.para === porteiro);

  function rodar(acao, sucesso) {
    const r = executar(acao);
    setErro(r.erro || null);
    setMensagem(r.erro ? null : sucesso);
    if (!r.erro) {
      setAbrindo(null);
      setAnexo(null);
    }
  }

  function abrir(chave) {
    setAbrindo(abrindo === chave ? null : chave);
    setErro(null);
    setMensagem(null);
  }

  return html`<section class="pilha">
    <h1>Escala</h1>
    <h2>De plantão agora</h2>
    <div class="grade-cartoes">${Object.entries(POSTOS).map(([id, p]) => {
      const { atual, proximo } = plantao[id];
      return html`<div key=${id} class="cartao">
        <strong>${p.nome}</strong>
        <span>${atual ? `${atual.porteiro ? porteiroPorId(atual.porteiro).nome : 'Descoberto'} · ${horaDoTurno(atual.inicio)}–${horaDoTurno(atual.fim)}` : 'Posto fechado agora'}</span>
        <small class="sub">${proximo ? `Próximo: ${proximo.porteiro ? porteiroPorId(proximo.porteiro).nome : 'descoberto'} às ${horaDoTurno(proximo.inicio)}` : 'Próximo turno ainda sem escala'}</small>
        ${comCheckin && atual && atual.porteiro && (atual.checkin
          ? html`<small class="sub">${textoCheckin(atual)}</small>${!atual.checkout && html`<button type="button" class="btn secundario" onClick=${() => rodar((e) => fazerCheckout(e, atual.porteiro, new Date()), 'Check-out registrado.')}>Fazer check-out</button>`}`
          : html`<button type="button" class="btn primario" data-acao=${`checkin-${id}`} onClick=${() => rodar((e) => fazerCheckin(e, atual.porteiro, new Date()), 'Check-in registrado com foto.')}>Fazer check-in</button>`)}
      </div>`;
    })}</div>
    <h2>Meus plantões</h2>
    <div class="cel-pessoa escala-porteiros" role="group" aria-label="Porteiro">
      ${PORTEIROS.map((p) => html`<button type="button" key=${p.id} aria-pressed=${porteiro === p.id} onClick=${() => { setPorteiro(p.id); setAbrindo(null); setErro(null); setMensagem(null); }}>${p.nome}</button>`)}
    </div>
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
    ${recebidas.length > 0 && html`<div class="cartao">
      <strong>Trocas recebidas</strong>
      ${recebidas.map((x) => html`<div key=${x.id} class="linha-entre">
        <span>${porteiroPorId(x.de).nome} pede que você assuma ${fmtTurno(acharTurno(estado, x.turno))}</span>
        <span class="acoes">
          <button type="button" class="btn primario" onClick=${() => rodar((e) => aceitarTroca(e, x.id, porteiro), 'Troca aceita. Falta a aprovação do síndico.')}>Aceitar</button>
          <button type="button" class="btn secundario" onClick=${() => rodar((e) => recusarTroca(e, x.id, porteiro, 'portaria'), 'Troca recusada.')}>Recusar</button>
        </span>
      </div>`)}
    </div>`}
    ${meus.length
      ? html`<ul class="m-lista">${meus.map((t) => {
          const dia = t.inicio.slice(0, 10);
          const colegas = PORTEIROS.filter((p) => p.id !== porteiro && p.postos.includes(t.posto));
          return html`<li key=${t.id} class="cartao">
            <div class="linha-entre"><strong>${fmtTurno(t)}</strong><span>${POSTOS[t.posto].nome}${feriados[dia] ? html` <${Etiqueta} tipo="info">${feriados[dia]}<//>` : ''}${t.trocado ? html` <${Etiqueta}>troca<//>` : ''}</span></div>
            <div class="acoes">
              <button type="button" class="btn secundario" onClick=${() => { abrir(`troca-${t.id}`); setColega(colegas[0] ? colegas[0].id : ''); }}>Propor troca</button>
              <button type="button" class="btn secundario" onClick=${() => abrir(`falta-${t.id}`)}>Registrar falta</button>
            </div>
            ${abrindo === `troca-${t.id}` && html`<div class="pilha">
              <${Campo} rotulo="Colega"><select id="troca-colega" value=${colega} onChange=${(ev) => setColega(ev.target.value)}>${colegas.map((p) => html`<option key=${p.id} value=${p.id}>${p.nome}</option>`)}</select><//>
              <button type="button" class="btn primario" onClick=${() => rodar((e) => proporTroca(e, { turnoId: t.id, de: porteiro, para: colega }, 'portaria', new Date()), 'Proposta enviada ao colega.')}>Enviar proposta de troca</button>
            </div>`}
            ${abrindo === `falta-${t.id}` && html`<div class="pilha">
              <${Campo} rotulo="Motivo"><select id="falta-motivo" value=${motivo} onChange=${(ev) => setMotivo(ev.target.value)}><option value="falta">Falta</option><option value="atestado">Atestado</option></select><//>
              <button type="button" class="btn secundario" onClick=${() => setAnexo(`atestado-${porteiro}.pdf`)}>${anexo ? `Anexado: ${anexo}` : 'Anexar atestado'}</button>
              <button type="button" class="btn primario" onClick=${() => rodar((e) => registrarFalta(e, t.id, { quem: porteiro, motivo, anexo }, 'portaria'), 'Falta registrada. O síndico vai cobrir o turno.')}>Registrar</button>
            </div>`}
          </li>`;
        })}</ul>`
      : html`<${Vazio} texto="Nenhum plantão nos meses publicados." />`}
  </section>`;
}
