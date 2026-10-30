import { html, useState } from '../vendor.js';
import { CARGOS, CARGOS_PORTARIA, NOMES_VINCULO, MODELOS, POSTOS } from '../escala/dados.js';
import { colaboradores } from '../escala/regras.js';
import { salvarColaborador, alternarAtivo, escalaDoColaborador, textoEscala, DIAS_FOLGA } from '../escala/colaboradores.js';
import { fmtCpf } from '../implantacao/regras.js';
import { Campo, Erro, Sucesso, Vazio, Etiqueta } from './comum.js';

// Equipe do condomínio: CLT e terceirizados, com cargo, contato e, para os porteiros, a escala fixa.
function formDe(estado, p) {
  const a = p ? escalaDoColaborador(estado, p.id) : null;
  return {
    id: p ? p.id : null, nome: p ? p.nome : '', cargo: p ? p.cargo : 'porteiro', vinculo: p ? p.vinculo : 'clt', empresa: (p && p.empresa) || '',
    telefone: (p && p.telefone) || '', cpf: p && p.cpf ? fmtCpf(p.cpf) : '', admissao: (p && p.admissao) || '', postos: p ? p.postos : ['portaria'],
    temEscala: p ? !!a : true, posto: a ? a.posto : (p && p.postos[0]) || 'portaria', modelo: a ? a.modelo : '12x36', inicio: a ? String(a.inicio) : '7',
    primeiroDia: a && a.ancora ? a.ancora : '', folga: a && a.folga !== undefined ? String(a.folga) : '0',
  };
}

function FormColaborador({ estado, inicial, executar, aoFechar }) {
  const [form, setForm] = useState(() => formDe(estado, inicial));
  const [erro, setErro] = useState(null);
  const campo = (chave) => (ev) => setForm({ ...form, [chave]: ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value });
  const alternarPosto = (id) => setForm({ ...form, postos: form.postos.includes(id) ? form.postos.filter((x) => x !== id) : [...form.postos, id] });
  const daPortaria = CARGOS_PORTARIA.includes(form.cargo);
  const porteiro = form.cargo === 'porteiro';
  const ciclo2 = MODELOS[form.modelo].ciclo === 2;
  function salvar() {
    const escala = porteiro && form.temEscala ? { posto: form.posto, modelo: form.modelo, inicio: form.inicio, primeiroDia: form.primeiroDia, folga: form.folga } : null;
    const r = executar((e) => salvarColaborador(e, { ...form, escala }, 'sindico'));
    if (r.erro) setErro(r.erro);
    else aoFechar(`${form.nome.trim()} ${inicial ? 'atualizado' : 'cadastrado'}.`);
  }
  return html`<div class="cartao pilha formulario" id="form-colaborador">
    <h2>${inicial ? `Editar ${inicial.nome}` : 'Novo colaborador'}</h2>
    <div class="edicao-anuncio">
      <${Campo} rotulo="Nome"><input id="colab-nome" value=${form.nome} onInput=${campo('nome')} /><//>
      <${Campo} rotulo="Cargo"><select id="colab-cargo" value=${form.cargo} onChange=${campo('cargo')}>${Object.entries(CARGOS).map(([k, n]) => html`<option key=${k} value=${k}>${n}</option>`)}</select><//>
      <${Campo} rotulo="Vínculo"><select id="colab-vinculo" value=${form.vinculo} onChange=${campo('vinculo')}>${Object.entries(NOMES_VINCULO).map(([k, n]) => html`<option key=${k} value=${k}>${n}</option>`)}</select><//>
      ${form.vinculo === 'terceirizado' && html`<${Campo} rotulo="Empresa"><input id="colab-empresa" value=${form.empresa} onInput=${campo('empresa')} placeholder="Ex.: Vigilância Prisma" /><//>`}
      <${Campo} rotulo="Telefone" dica="Com DDD"><input id="colab-telefone" inputmode="tel" value=${form.telefone} onInput=${campo('telefone')} placeholder="(11) 90000-0000" /><//>
      <${Campo} rotulo="CPF" dica="Opcional"><input id="colab-cpf" inputmode="numeric" value=${form.cpf} onInput=${campo('cpf')} placeholder="000.000.000-00" /><//>
      <${Campo} rotulo="Admissão" dica="Opcional"><input id="colab-admissao" type="date" value=${form.admissao} onInput=${campo('admissao')} /><//>
    </div>
    ${daPortaria && html`<fieldset class="pilha"><legend>Postos em que trabalha</legend>
      ${Object.entries(POSTOS).map(([id, p]) => html`<label key=${id} class="check"><input id=${`colab-posto-${id}`} type="checkbox" checked=${form.postos.includes(id)} onChange=${() => alternarPosto(id)} /><span>${p.nome}</span></label>`)}
    </fieldset>`}
    ${form.cargo === 'folguista' && html`<p class="sub">O folguista não tem escala fixa: ele aparece primeiro nas sugestões para cobrir folgas, faltas e férias.</p>`}
    ${porteiro && html`<fieldset class="pilha"><legend>Escala</legend>
      <label class="check"><input id="colab-tem-escala" type="checkbox" checked=${form.temEscala} onChange=${campo('temEscala')} /><span>Tem escala fixa</span></label>
      ${form.temEscala && html`<div class="edicao-anuncio">
        <${Campo} rotulo="Posto"><select id="colab-escala-posto" value=${form.posto} onChange=${campo('posto')}>${form.postos.map((id) => html`<option key=${id} value=${id}>${POSTOS[id].nome}</option>`)}</select><//>
        <${Campo} rotulo="Modelo"><select id="colab-modelo" value=${form.modelo} onChange=${campo('modelo')}>${Object.entries(MODELOS).map(([k, m]) => html`<option key=${k} value=${k}>${m.nome}</option>`)}</select><//>
        <${Campo} rotulo="Início do turno" dica="Hora, de 0 a 23"><input id="colab-inicio" type="number" min="0" max="23" value=${form.inicio} onInput=${campo('inicio')} /><//>
        ${ciclo2
          ? html`<${Campo} rotulo="Primeiro plantão" dica="Dali em diante, dia sim, dia não"><input id="colab-primeiro-dia" type="date" value=${form.primeiroDia} onInput=${campo('primeiroDia')} /><//>`
          : html`<${Campo} rotulo="Dia de folga"><select id="colab-folga" value=${form.folga} onChange=${campo('folga')}>${DIAS_FOLGA.map((d, i) => html`<option key=${d} value=${String(i)}>${d}</option>`)}</select><//>`}
      </div>`}
      <small class="sub">A escala vale para os meses gerados daqui em diante. Meses já gerados são ajustados turno a turno em Escala.</small>
    </fieldset>`}
    <div class="acoes">
      <button type="button" class="btn secundario" onClick=${() => aoFechar(null)}>Cancelar</button>
      <button type="button" class="btn primario" data-acao="salvar-colaborador" onClick=${salvar}>${inicial ? 'Salvar alterações' : 'Cadastrar colaborador'}</button>
    </div>
    <${Erro} texto=${erro} />
  </div>`;
}

export function SColaboradores({ estado, executar }) {
  const [editando, setEditando] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const lista = [...colaboradores(estado)].sort((a, b) => (a.ativo === false) - (b.ativo === false) || a.nome.localeCompare(b.nome));
  function fechar(texto) {
    setEditando(null);
    if (texto) setMensagem(texto);
  }
  function alternar(p) {
    const r = executar((e) => alternarAtivo(e, p.id, 'sindico'));
    setMensagem(r.erro || (r.ativo ? `${p.nome} reativado. Configure a escala dele, se tiver.` : `${p.nome} desligado: sai das próximas escalas.`));
  }
  return html`<section class="pilha">
    <h1>Colaboradores</h1>
    <p class="sub">A equipe do condomínio, fixa (CLT) ou terceirizada. Os porteiros cadastrados aqui formam a escala da portaria.</p>
    ${editando === null && html`<div class="acoes"><button type="button" class="btn primario" data-acao="novo-colaborador" onClick=${() => { setEditando('novo'); setMensagem(null); }}>Novo colaborador</button></div>`}
    ${editando === 'novo' && html`<${FormColaborador} estado=${estado} inicial=${null} executar=${executar} aoFechar=${fechar} />`}
    <${Sucesso} texto=${mensagem} />
    ${lista.length === 0 && html`<${Vazio} texto="Nenhum colaborador cadastrado. Comece pelos porteiros para montar a escala." />`}
    ${lista.map((p) => {
      if (editando === p.id) return html`<${FormColaborador} key=${p.id} estado=${estado} inicial=${p} executar=${executar} aoFechar=${fechar} />`;
      const escala = textoEscala(escalaDoColaborador(estado, p.id));
      return html`<div key=${p.id} class=${`cartao pilha${p.ativo === false ? ' desligado' : ''}`} data-colaborador=${p.id}>
        <div class="linha-entre"><strong>${p.nome}</strong>${p.ativo === false ? html`<${Etiqueta}>Desligado<//>` : html`<${Etiqueta} tipo=${p.vinculo === 'clt' ? 'ok' : 'info'}>${p.vinculo === 'clt' ? 'CLT' : 'Terceirizado'}<//>`}</div>
        <span class="sub">${CARGOS[p.cargo]}${p.empresa ? ` · ${p.empresa}` : ''}${p.telefone ? ` · ${p.telefone}` : ''}</span>
        ${p.postos.length > 0 && html`<span class="sub">Postos: ${p.postos.map((x) => POSTOS[x].nome).join(', ')}</span>`}
        ${CARGOS_PORTARIA.includes(p.cargo) && html`<span class="sub">Escala: ${escala || (p.cargo === 'folguista' ? 'folguista, cobre folgas e faltas' : 'sem escala fixa')}</span>`}
        <div class="acoes">
          <button type="button" class="btn-link" data-editar-colaborador=${p.id} onClick=${() => { setEditando(p.id); setMensagem(null); }}>Editar</button>
          <button type="button" class="btn-link" onClick=${() => alternar(p)}>${p.ativo === false ? 'Reativar' : 'Desligar'}</button>
        </div>
      </div>`;
    })}
  </section>`;
}
