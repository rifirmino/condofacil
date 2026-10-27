import { html, useState } from '../vendor.js';
import { atualizarMeusDados, salvarResidentes, residentesDaUnidade, definirResponsavel, removerPessoa, ehSindico } from '../moradores/acoes.js';
import { fmtCpf } from '../implantacao/regras.js';
import { NOMES_RELACAO } from '../cobranca/dados.js';
import { pessoaDaUnidade } from '../vendas/regras.js';
import { Campo, Erro, Sucesso, Vazio, Etiqueta } from './comum.js';

// Meus dados (morador, só a própria unidade) e Moradores (síndico, todas as unidades e o responsável financeiro).
const NOMES_SITUACAO_PESSOA = { ativo: ['ok', 'usa o app'], convidado: ['neutro', 'convidado'], pendente: ['alerta', 'aguardando aprovação'] };

// Na demonstração o documento vem pronto (mascarado); no condomínio implantado, o CPF do cadastro.
function documentoDoResponsavel(resp) {
  if (resp.cpf) return `CPF ${fmtCpf(resp.cpf)}`;
  return resp.documento && !/a informar|implantação/.test(resp.documento) ? resp.documento : 'sem CPF';
}

function fmtTelefone(t) {
  const d = String(t || '');
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;
}

function EditorResidentes({ estado, unidade, executar }) {
  const [lista, setLista] = useState(() => {
    const atuais = residentesDaUnidade(estado, unidade).map((r) => ({ nome: r.nome, telefone: fmtTelefone(r.telefone) }));
    return atuais.length ? atuais : [{ nome: '', telefone: '' }];
  });
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);
  const mudar = (i, chave) => (ev) => setLista(lista.map((r, j) => (j === i ? { ...r, [chave]: ev.target.value } : r)));
  function salvar() {
    const r = executar((e) => salvarResidentes(e, unidade, lista));
    setErro(r.erro || null);
    setOk(r.erro ? null : 'Lista salva.');
  }
  return html`<div class="pilha">
    ${lista.map((r, i) => html`<div key=${i} class="linha-residente">
      <input id=${`residente-nome-${i}`} aria-label=${`Nome da pessoa ${i + 1}`} placeholder="Nome" value=${r.nome} onInput=${mudar(i, 'nome')} />
      <input id=${`residente-telefone-${i}`} aria-label=${`Telefone da pessoa ${i + 1} (opcional)`} placeholder="Telefone (opcional)" inputmode="tel" value=${r.telefone} onInput=${mudar(i, 'telefone')} />
      <button type="button" class="btn-link" onClick=${() => setLista(lista.filter((_, j) => j !== i))}>Remover</button>
    </div>`)}
    <div class="acoes">
      <button type="button" class="btn secundario" onClick=${() => setLista([...lista, { nome: '', telefone: '' }])}>Adicionar pessoa</button>
      <button type="button" class="btn primario" data-acao="salvar-residentes" onClick=${salvar}>Salvar lista</button>
    </div>
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${ok} />
  </div>`;
}

export function MDados({ estado, eu, executar }) {
  const pessoa = pessoaDaUnidade(estado, eu);
  const [form, setForm] = useState(() => ({ nome: pessoa ? pessoa.nome : '', cpf: pessoa && pessoa.cpf ? fmtCpf(pessoa.cpf) : '', celular: pessoa ? fmtTelefone(pessoa.celular) : '', email: pessoa ? pessoa.email || '' : '' }));
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);
  if (!pessoa) return html`<section class="m-pagina"><${Vazio} texto="Nenhum cadastro nesta unidade." /></section>`;
  const resp = estado.financeiro.unidades[eu] && estado.financeiro.unidades[eu].responsavel;
  const campo = (chave) => (ev) => setForm({ ...form, [chave]: ev.target.value });
  function salvar() {
    const r = executar((e) => atualizarMeusDados(e, pessoa.id, form));
    setErro(r.erro || null);
    setOk(r.erro ? null : 'Seus dados foram atualizados.');
  }
  return html`<section class="m-pagina">
    <a class="voltar" href="#morador.mais">‹ Mais</a>
    <h1 class="m-titulo">Meus dados</h1>
    <p class="m-sub">Apto ${eu} · só você e o síndico veem estes dados.</p>
    <div class="pilha formulario">
      <${Campo} rotulo="Nome"><input id="dados-nome" value=${form.nome} onInput=${campo('nome')} autocomplete="name" /><//>
      <${Campo} rotulo="CPF"><input id="dados-cpf" inputmode="numeric" value=${form.cpf} onInput=${campo('cpf')} placeholder="000.000.000-00" /><//>
      <${Campo} rotulo="Celular" dica="Com DDD"><input id="dados-celular" inputmode="tel" value=${form.celular} onInput=${campo('celular')} autocomplete="tel" /><//>
      <${Campo} rotulo="E-mail"><input id="dados-email" type="email" value=${form.email} onInput=${campo('email')} autocomplete="email" /><//>
      <button type="button" class="btn primario bloco" data-acao="salvar-meus-dados" onClick=${salvar}>Salvar meus dados</button>
      <${Erro} texto=${erro} />
      <${Sucesso} texto=${ok} />
    </div>
    <h2>Quem mora no apartamento</h2>
    <small class="m-ajuda">Nome de cada morador; o telefone é opcional. Ajuda a portaria a saber quem é do apartamento.</small>
    <${EditorResidentes} estado=${estado} unidade=${eu} executar=${executar} />
    <h2>Responsável financeiro</h2>
    <div class="cartao"><strong>${resp ? resp.nome : 'Ainda não definido'}</strong><small class="sub">Definido pelo síndico. Para mudar, fale com ele.</small></div>
  </section>`;
}

function FormResponsavel({ estado, unidade, executar, aoFechar }) {
  const atual = estado.financeiro.unidades[unidade].responsavel || {};
  const [form, setForm] = useState({ nome: atual.nome || '', cpf: atual.cpf ? fmtCpf(atual.cpf) : '', relacao: atual.relacao || 'titular' });
  const [erro, setErro] = useState(null);
  const campo = (chave) => (ev) => setForm({ ...form, [chave]: ev.target.value });
  function salvar() {
    const r = executar((e) => definirResponsavel(e, unidade, form, 'sindico'));
    if (r.erro) setErro(r.erro);
    else aoFechar();
  }
  const nomes = estado.pessoas.filter((p) => p.unidade === unidade).map((p) => p.nome);
  return html`<div class="cartao pilha formulario">
    <div class="edicao-anuncio">
      <${Campo} rotulo="Nome do responsável"><input id=${`resp-nome-${unidade}`} list=${`resp-nomes-${unidade}`} value=${form.nome} onInput=${campo('nome')} /><datalist id=${`resp-nomes-${unidade}`}>${nomes.map((n) => html`<option key=${n} value=${n} />`)}</datalist><//>
      <${Campo} rotulo="CPF"><input id=${`resp-cpf-${unidade}`} inputmode="numeric" value=${form.cpf} onInput=${campo('cpf')} placeholder="000.000.000-00" /><//>
      <${Campo} rotulo="Relação"><select id=${`resp-relacao-${unidade}`} value=${form.relacao} onChange=${campo('relacao')}>${Object.entries(NOMES_RELACAO).map(([k, n]) => html`<option key=${k} value=${k}>${n}</option>`)}</select><//>
    </div>
    <div class="acoes">
      <button type="button" class="btn secundario" onClick=${aoFechar}>Cancelar</button>
      <button type="button" class="btn primario" data-acao="salvar-responsavel" onClick=${salvar}>Salvar responsável</button>
    </div>
    <${Erro} texto=${erro} />
  </div>`;
}

export function SMoradores({ estado, executar }) {
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const termo = busca.trim().toLowerCase();
  const unidades = estado.condominio.unidades.filter((u) => !termo || u.toLowerCase().includes(termo) || estado.pessoas.some((p) => p.unidade === u && p.nome.toLowerCase().includes(termo)));
  function remover(p) {
    const r = executar((e) => removerPessoa(e, p.id, 'sindico'));
    setMensagem(r.erro || `${p.nome} removido do apto ${p.unidade}.`);
  }
  return html`<section class="pilha">
    <h1>Moradores</h1>
    <p class="sub">Quem mora em cada unidade, a situação no app e o responsável financeiro, que só o síndico define.</p>
    <${Campo} rotulo="Buscar por unidade ou nome"><input id="busca-moradores" value=${busca} onInput=${(ev) => setBusca(ev.target.value)} /><//>
    <${Sucesso} texto=${mensagem} />
    ${unidades.length === 0 && html`<${Vazio} texto="Nenhuma unidade encontrada." />`}
    ${unidades.slice(0, 80).map((u) => {
      const pessoas = estado.pessoas.filter((p) => p.unidade === u);
      const residentes = residentesDaUnidade(estado, u);
      const resp = estado.financeiro.unidades[u] && estado.financeiro.unidades[u].responsavel;
      return html`<div key=${u} class="cartao pilha" data-unidade-moradores=${u}>
        <div class="linha-entre"><strong>Apto ${u}</strong>
          <span class="sub resp-financeiro"><span>Responsável financeiro: ${resp ? `${resp.nome} · ${documentoDoResponsavel(resp)}` : 'não definido'}</span>
            <button type="button" class="btn-link" data-definir-responsavel=${u} onClick=${() => setEditando(editando === u ? null : u)}>${resp ? 'Alterar' : 'Definir'}</button></span>
        </div>
        ${editando === u && html`<${FormResponsavel} estado=${estado} unidade=${u} executar=${executar} aoFechar=${() => setEditando(null)} />`}
        ${pessoas.length === 0 ? html`<small class="sub">Ninguém cadastrado. Quem mora aqui pode entrar pelo QR Code do convite.</small>` : html`<ul class="itens-sacola">${pessoas.map((p) => {
          const [tipo, rotulo] = NOMES_SITUACAO_PESSOA[p.situacao] || ['ok', 'usa o app'];
          return html`<li key=${p.id}><span>${p.nome}${ehSindico(estado, p) ? ' (síndico)' : ''} <${Etiqueta} tipo=${tipo}>${rotulo}<//><small class="sub">${[p.celular && fmtTelefone(p.celular), p.email, p.cpf && `CPF ${fmtCpf(p.cpf)}`].filter(Boolean).join(' · ')}</small></span>
            ${!ehSindico(estado, p) && html`<button type="button" class="btn-link" data-remover-pessoa=${p.id} onClick=${() => remover(p)}>Remover</button>`}</li>`;
        })}</ul>`}
        ${residentes.length > 0 && html`<small class="sub">Também moram: ${residentes.map((r) => (r.telefone ? `${r.nome} (${fmtTelefone(r.telefone)})` : r.nome)).join(', ')}</small>`}
      </div>`;
    })}
    ${unidades.length > 80 && html`<small class="sub">Mostrando 80 de ${unidades.length} unidades: use a busca.</small>`}
  </section>`;
}
