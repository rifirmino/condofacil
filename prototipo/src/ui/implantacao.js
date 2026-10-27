import { html, useState, useEffect } from '../vendor.js';
import { PASSOS_IMPLANTACAO, CONTATO_COMERCIAL, MODELO_CSV_MORADORES, AREAS_MODELO, NOMES_VINCULO_MORADOR, UFS, validarCondominio, gerarUnidades, lerCsvUnidades, lerCsvMoradores, fracoesDasUnidades, identificadorCondominio, linkConvite, mensagemWhatsAppConvite, fmtCpf, apenasDigitos, sugestaoPrimeiroAndar } from '../implantacao/regras.js';
import { CONEXAO, chamarApi } from '../conectado/cliente.js';
import { condominioNovo } from '../implantacao/novo.js';
import { PLANOS, mensalidade } from '../planos.js';
import { fmtReais } from '../cobranca/regras.js';
import { lerPreco } from '../vendas/regras.js';
import { ir, Campo, Erro, Sucesso, Etiqueta, Icone } from './comum.js';

// Assistente de implantação: do cadastro do condomínio ao QR Code de divulgação e à ativação.
const URL_QRCODE = 'https://unpkg.com/qrcode-generator@1.4.4/qrcode.js';
let promessaQr = null;

function carregarQrcode() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  if (!promessaQr) {
    promessaQr = new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = URL_QRCODE;
      s.onload = () => (window.qrcode ? ok(window.qrcode) : falha(new Error('QR indisponível')));
      s.onerror = () => { promessaQr = null; falha(new Error('QR indisponível')); };
      document.head.appendChild(s);
    });
  }
  return promessaQr;
}

export function QrCodeReal({ texto, tamanho = 220 }) {
  const [svg, setSvg] = useState(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let ativo = true;
    carregarQrcode().then((qrcode) => {
      const qr = qrcode(0, 'M');
      qr.addData(texto);
      qr.make();
      if (ativo) setSvg(qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: `QR Code para ${texto}` }));
    }).catch(() => ativo && setFalhou(true));
    return () => { ativo = false; };
  }, [texto]);
  if (falhou) return html`<div class="qr-real qr-falhou" style=${`width:${tamanho}px;height:${tamanho}px`}><small>QR Code indisponível sem internet. Use o link:</small><strong>${texto}</strong></div>`;
  if (!svg) return html`<div class="qr-real" style=${`width:${tamanho}px;height:${tamanho}px`}><small class="sub">Gerando QR Code…</small></div>`;
  return html`<div class="qr-real" style=${`width:${tamanho}px;height:${tamanho}px`} dangerouslySetInnerHTML=${{ __html: svg }}></div>`;
}

export function rascunhoPadrao() {
  return {
    condominio: { nome: '', cnpj: '', cep: '', endereco: '', cidade: '', uf: 'SP', sindico: { nome: '', unidade: '', email: '', celular: '' }, plano: 'intermediario' },
    geracao: { modo: 'gerador', blocos: '', andares: '4', porAndar: '4', somar: '100', primeiro: ['101', '102', '103', '104'], coberturaUltimo: false, csv: '' },
    unidades: [],
    csvMoradores: '',
    moradores: [],
    cobranca: { diaVencimento: '10', multaPct: '2', jurosPct: '1', fundoPct: '10', modo: 'fixo', A: '', cobertura: '', orcamento: '' },
    asaas: { ambiente: 'sandbox', cnpj: '', banco: '', agencia: '', conta: '', situacao: 'pendente' },
    areas: ['salao', 'churrasqueira'],
    concluidos: [],
  };
}

function numeroImplantacao(texto) {
  const n = Number(String(texto ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

// Converte o rascunho (textos do formulário) na configuração que o condominioNovo espera.
export function configDoRascunho(r) {
  return {
    id: r.idCondominio,
    condominio: { ...r.condominio, sindico: { ...r.condominio.sindico, unidade: String(r.condominio.sindico.unidade || '').toUpperCase().replace(/\s+/g, '') } },
    unidades: r.unidades,
    moradores: r.moradores,
    cobranca: { diaVencimento: Number(r.cobranca.diaVencimento), multaPct: numeroImplantacao(r.cobranca.multaPct), jurosPct: numeroImplantacao(r.cobranca.jurosPct), fundoPct: numeroImplantacao(r.cobranca.fundoPct), modo: r.cobranca.modo, valores: { A: lerPreco(r.cobranca.A), cobertura: lerPreco(r.cobranca.cobertura) || lerPreco(r.cobranca.A) }, orcamento: lerPreco(r.cobranca.orcamento) },
    asaas: r.asaas,
    areas: r.areas,
  };
}

export function validarPasso(passo, r) {
  if (passo === 'condominio') return validarCondominio(r.condominio);
  if (passo === 'unidades') return r.unidades.length ? null : 'Gere ou importe as unidades';
  if (passo === 'moradores') return lerCsvMoradores(r.csvMoradores, r.unidades.map((u) => u.id)).totalErros ? 'Corrija as linhas com erro (ou apague-as) antes de continuar' : null;
  if (passo === 'cobranca') {
    const c = configDoRascunho(r).cobranca;
    if (!Number.isInteger(c.diaVencimento) || c.diaVencimento < 1 || c.diaVencimento > 28) return 'O vencimento deve ser entre o dia 1 e o dia 28';
    if (!(c.multaPct >= 0 && c.multaPct <= 2)) return 'A multa por atraso é limitada a 2%';
    if (!(c.jurosPct >= 0 && c.jurosPct <= 10)) return 'Informe os juros ao mês (0% a 10%)';
    if (!(c.fundoPct >= 0 && c.fundoPct <= 30)) return 'O fundo de reserva deve ser de 0% a 30%';
    if (c.modo === 'fixo' && !(c.valores.A > 0)) return 'Informe o valor da taxa do apartamento padrão';
    if (c.modo === 'fracao' && !(c.orcamento > 0)) return 'Informe o orçamento mensal';
    return null;
  }
  if (passo === 'divulgacao') {
    const u = configDoRascunho(r).condominio.sindico.unidade;
    if (u && !r.unidades.some((x) => x.id === u)) return `A unidade do síndico (${u}) não existe. Corrija no passo Condomínio`;
    return null;
  }
  return null;
}

function PassoCondominio({ r, mudar }) {
  const c = r.condominio;
  const campo = (chave) => (ev) => mudar({ condominio: { ...c, [chave]: ev.target.value } });
  const sindico = (chave) => (ev) => mudar({ condominio: { ...c, sindico: { ...c.sindico, [chave]: ev.target.value } } });
  return html`<div class="pilha formulario">
    <${Campo} rotulo="Nome do condomínio"><input id="impl-nome" value=${c.nome} onInput=${campo('nome')} placeholder="Ex.: Residencial Jardim das Flores" /><//>
    <div class="edicao-anuncio">
      <${Campo} rotulo="CNPJ" dica="Opcional nesta etapa"><input id="impl-cnpj" inputmode="numeric" value=${c.cnpj} onInput=${campo('cnpj')} placeholder="00.000.000/0000-00" /><//>
      <${Campo} rotulo="CEP"><input id="impl-cep" inputmode="numeric" value=${c.cep} onInput=${campo('cep')} placeholder="00000-000" /><//>
      <${Campo} rotulo="Endereço"><input id="impl-endereco" value=${c.endereco} onInput=${campo('endereco')} placeholder="Rua e número" /><//>
      <${Campo} rotulo="Cidade"><input id="impl-cidade" value=${c.cidade} onInput=${campo('cidade')} /><//>
      <${Campo} rotulo="UF"><select id="impl-uf" value=${c.uf} onChange=${campo('uf')}>${UFS.map((u) => html`<option key=${u} value=${u}>${u}</option>`)}</select><//>
      <${Campo} rotulo="Plano"><select id="impl-plano" value=${c.plano} onChange=${campo('plano')}>${PLANOS.map((p) => html`<option key=${p.id} value=${p.id}>${p.nome}</option>`)}</select><//>
    </div>
    <h2>Síndico</h2>
    <div class="edicao-anuncio">
      <${Campo} rotulo="Nome do síndico"><input id="impl-sindico" value=${c.sindico.nome} onInput=${sindico('nome')} /><//>
      <${Campo} rotulo="Apto do síndico" dica="Deve existir entre as unidades"><input id="impl-sindico-apto" value=${c.sindico.unidade} onInput=${sindico('unidade')} placeholder="Ex.: 101 ou A101" /><//>
      <${Campo} rotulo="E-mail do síndico"><input id="impl-sindico-email" type="email" value=${c.sindico.email} onInput=${sindico('email')} /><//>
      <${Campo} rotulo="Celular do síndico"><input id="impl-sindico-celular" inputmode="tel" value=${c.sindico.celular} onInput=${sindico('celular')} placeholder="(11) 90000-0000" /><//>
    </div>
  </div>`;
}

// Rascunhos antigos não têm os números do 1º andar nem a soma: completa com a sugestão.
function geracaoCompleta(g) {
  const somar = g.somar ?? '100';
  const sugestao = sugestaoPrimeiroAndar(g.porAndar, Number(somar) || 100).map(String);
  const primeiro = sugestao.map((s, i) => (g.primeiro && g.primeiro[i] !== undefined ? g.primeiro[i] : s));
  return { ...g, somar, primeiro };
}

function GradeUnidades({ unidades }) {
  const blocos = [...new Set(unidades.map((u) => u.bloco || ''))];
  return html`<div class="grade-unidades">${blocos.map((b) => {
    const doBloco = unidades.filter((u) => (u.bloco || '') === b);
    const andares = [...new Set(doBloco.map((u) => u.andar))].sort((x, y) => y - x);
    return html`<div key=${b} class="pilha">
      ${b && html`<strong>Bloco ${b}</strong>`}
      ${andares.slice(0, 40).map((a) => html`<div key=${a} class="linha-andar"><span class="sub">${a}º andar</span>
        <span class="lista-unidades">${doBloco.filter((u) => u.andar === a).map((u) => html`<span key=${u.id} class=${`etq-turno ${u.tipo === 'cobertura' ? 't-tarde' : 't-folga'}`}>${u.id}</span>`)}</span></div>`)}
    </div>`;
  })}</div>`;
}

function PassoUnidades({ r, mudar }) {
  const g = geracaoCompleta(r.geracao);
  const [erro, setErro] = useState(null);
  const valor = (ev) => (ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value);
  const campo = (chave) => (ev) => mudar({ geracao: { ...g, [chave]: valor(ev) } });
  // Mudar a soma troca os números do 1º andar que ainda estão na sugestão anterior (101 → 11 ao passar de 100 para 10).
  function mudarSomar(ev) {
    const anterior = sugestaoPrimeiroAndar(g.porAndar, Number(g.somar) || 100).map(String);
    const nova = sugestaoPrimeiroAndar(g.porAndar, Number(ev.target.value) || 100).map(String);
    mudar({ geracao: { ...g, somar: ev.target.value, primeiro: g.primeiro.map((p, i) => (p === anterior[i] ? nova[i] : p)) } });
  }
  const mudarPrimeiro = (i) => (ev) => mudar({ geracao: { ...g, primeiro: g.primeiro.map((p, j) => (j === i ? ev.target.value : p)) } });
  function gerar() {
    const res = g.modo === 'gerador'
      ? gerarUnidades({ blocos: g.blocos.split(/[\s,;]+/).filter(Boolean), andares: Number(g.andares), primeiroAndar: g.primeiro, somar: Number(g.somar), coberturaUltimo: g.coberturaUltimo })
      : lerCsvUnidades(g.csv);
    setErro(res.erro || null);
    if (!res.erro) mudar({ unidades: res.unidades });
  }
  const coberturas = r.unidades.filter((u) => u.tipo === 'cobertura').length;
  return html`<div class="pilha formulario">
    <${Campo} rotulo="Como cadastrar"><select id="impl-modo-unidades" value=${g.modo} onChange=${campo('modo')}><option value="gerador">Gerar por blocos, andares e apartamentos</option><option value="csv">Colar planilha de unidades</option></select><//>
    ${g.modo === 'gerador'
      ? html`<div class="edicao-anuncio">
          <${Campo} rotulo="Blocos" dica="Ex.: A, B. Deixe vazio se não houver"><input id="impl-blocos" value=${g.blocos} onInput=${campo('blocos')} /><//>
          <${Campo} rotulo="Andares"><input id="impl-andares" type="number" min="1" max="40" value=${g.andares} onInput=${campo('andares')} /><//>
          <${Campo} rotulo="Apartamentos por andar"><input id="impl-por-andar" type="number" min="1" max="20" value=${g.porAndar} onInput=${campo('porAndar')} /><//>
          <${Campo} rotulo="Somar a cada andar" dica="Ex.: 10 (11 → 21 → 31) ou 100 (101 → 201)"><input id="impl-somar" type="number" min="1" value=${g.somar} onInput=${mudarSomar} /><//>
        </div>
        <fieldset class="primeiro-andar"><legend>Números do 1º andar (ou térreo)</legend>
          <div class="lista-unidades">${g.primeiro.map((p, i) => html`<input key=${i} id=${`impl-primeiro-${i}`} aria-label=${`Apartamento ${i + 1} do 1º andar`} inputmode="numeric" value=${p} onInput=${mudarPrimeiro(i)} />`)}</div>
          <small class="sub">Os demais andares somam ${g.somar || '?'} a cada andar. O bloco vai depois do número: ${g.primeiro[0] || '11'}A, ${g.primeiro[0] || '11'}B.</small>
        </fieldset>
        <label class="check"><input id="impl-cobertura" type="checkbox" checked=${g.coberturaUltimo} onChange=${campo('coberturaUltimo')} /><span>O último andar é de coberturas</span></label>`
      : html`<${Campo} rotulo="Planilha de unidades" dica="Colunas: unidade;bloco;tipo (padrão ou cobertura);andar (opcional). Com bloco, a unidade vira 11A, 11B"><textarea id="impl-csv-unidades" rows="6" value=${g.csv} onInput=${campo('csv')} placeholder="unidade;bloco;tipo\n11;A;padrão\n11;B;padrão"></textarea><//>`}
    <button type="button" class="btn secundario" data-acao="gerar-unidades" onClick=${gerar}>${g.modo === 'gerador' ? 'Gerar unidades' : 'Ler planilha'}</button>
    <${Erro} texto=${erro} />
    ${r.unidades.length > 0 && html`<div class="cartao pilha">
      <strong>${r.unidades.length} unidades${coberturas ? ` · ${coberturas} coberturas` : ''}</strong>
      <${GradeUnidades} unidades=${r.unidades} />
    </div>`}
  </div>`;
}

function PassoMoradores({ r, mudar }) {
  const ids = r.unidades.map((u) => u.id);
  const leitura = lerCsvMoradores(r.csvMoradores, ids);
  useEffect(() => {
    const iguais = JSON.stringify(leitura.validas) === JSON.stringify(r.moradores);
    if (!iguais && !leitura.totalErros) mudar({ moradores: leitura.validas });
  }, [r.csvMoradores, r.unidades.length]);
  return html`<div class="pilha formulario">
    <p class="sub">Cole a planilha dos moradores (pode ser exportada do Excel ou do Google Planilhas). Este passo é opcional: quem não estiver na lista pode entrar pelo QR Code do convite.</p>
    <details class="composicao"><summary>Modelo da planilha</summary><pre class="modelo-csv">${MODELO_CSV_MORADORES}</pre><small class="sub">vinculo: titular, inquilino ou proprietario · responsavel: sim ou não (quem recebe a cobrança) · cpf: do responsável, exigido pelo Asaas para emitir a cobrança real.</small></details>
    <${Campo} rotulo="Planilha de moradores"><textarea id="impl-csv-moradores" rows="8" value=${r.csvMoradores} onInput=${(ev) => mudar({ csvMoradores: ev.target.value })} placeholder=${MODELO_CSV_MORADORES}></textarea><//>
    ${leitura.linhas.length > 0 && html`<div class="cartao pilha">
      <strong>${leitura.validas.length} de ${leitura.linhas.length} linhas prontas${leitura.totalErros ? ` · ${leitura.totalErros} com erro` : ''}</strong>
      <div class="tabela-rolagem"><table class="tabela">
        <thead><tr><th>Linha</th><th>Unidade</th><th>Nome</th><th>Vínculo</th><th>Responsável</th><th>CPF</th><th>Situação</th></tr></thead>
        <tbody>${leitura.linhas.map((l) => html`<tr key=${l.numero}>
          <td>${l.numero}</td><td>${l.dados.unidade}</td><td>${l.dados.nome}</td><td>${NOMES_VINCULO_MORADOR[l.dados.vinculo]}</td><td>${l.dados.responsavel ? 'Sim' : '—'}</td><td>${l.dados.cpf ? fmtCpf(l.dados.cpf) : '—'}</td>
          <td>${l.erros.length ? html`<span class="erro-linha">${l.erros.join(' · ')}</span>` : html`<${Etiqueta} tipo="ok">OK<//>`}</td>
        </tr>`)}</tbody>
      </table></div>
    </div>`}
  </div>`;
}

function PassoCobranca({ r, mudar }) {
  const c = r.cobranca;
  const campo = (chave) => (ev) => mudar({ cobranca: { ...c, [chave]: ev.target.value } });
  const temCobertura = r.unidades.some((u) => u.tipo === 'cobertura');
  const cfg = configDoRascunho(r).cobranca;
  const fracoes = cfg.valores.A > 0 ? fracoesDasUnidades(r.unidades, cfg.valores) : null;
  const exemplo = (tipo) => r.unidades.find((u) => u.tipo === tipo);
  const mensal = cfg.modo === 'fracao' && fracoes && cfg.orcamento > 0 ? (u) => Math.round(cfg.orcamento * fracoes[u.id]) : (u) => (u.tipo === 'cobertura' ? cfg.valores.cobertura : cfg.valores.A);
  return html`<div class="pilha formulario">
    <div class="edicao-anuncio">
      <${Campo} rotulo="Dia do vencimento"><input id="impl-vencimento" type="number" min="1" max="28" value=${c.diaVencimento} onInput=${campo('diaVencimento')} /><//>
      <${Campo} rotulo="Multa por atraso (%)" dica="Máximo de 2% (Código Civil)"><input id="impl-multa" inputmode="decimal" value=${c.multaPct} onInput=${campo('multaPct')} /><//>
      <${Campo} rotulo="Juros ao mês (%)"><input id="impl-juros" inputmode="decimal" value=${c.jurosPct} onInput=${campo('jurosPct')} /><//>
      <${Campo} rotulo="Fundo de reserva (%)"><input id="impl-fundo" inputmode="decimal" value=${c.fundoPct} onInput=${campo('fundoPct')} /><//>
      <${Campo} rotulo="Como calcular a taxa"><select id="impl-modo-taxa" value=${c.modo} onChange=${campo('modo')}><option value="fixo">Valor fixo por tipo</option><option value="fracao">Orçamento rateado por fração ideal</option></select><//>
    </div>
    <div class="edicao-anuncio">
      <${Campo} rotulo=${c.modo === 'fracao' ? 'Peso do apto padrão (R$)' : 'Taxa do apto padrão (R$)'} dica=${c.modo === 'fracao' ? 'Usado para calcular as frações' : 'Sem o fundo de reserva'}><input id="impl-taxa-a" inputmode="decimal" value=${c.A} onInput=${campo('A')} placeholder="Ex.: 650,00" /><//>
      ${temCobertura && html`<${Campo} rotulo=${c.modo === 'fracao' ? 'Peso da cobertura (R$)' : 'Taxa da cobertura (R$)'}><input id="impl-taxa-cobertura" inputmode="decimal" value=${c.cobertura} onInput=${campo('cobertura')} placeholder="Ex.: 980,00" /><//>`}
      ${c.modo === 'fracao' && html`<${Campo} rotulo="Orçamento mensal (R$)"><input id="impl-orcamento" inputmode="decimal" value=${c.orcamento} onInput=${campo('orcamento')} placeholder="Ex.: 22.120,00" /><//>`}
    </div>
    ${cfg.valores.A > 0 && html`<div class="cartao simulacao"><strong>Prévia da taxa</strong><dl class="resumo">
      ${['A', 'cobertura'].map((tipo) => exemplo(tipo) && html`<dt key=${`t${tipo}`}>${tipo === 'A' ? 'Apto padrão' : 'Cobertura'}${fracoes ? ` · fração ${(fracoes[exemplo(tipo).id] * 100).toFixed(4).replace('.', ',')}%` : ''}</dt><dd key=${`v${tipo}`}>${fmtReais(Math.round(mensal(exemplo(tipo)) * (1 + (cfg.fundoPct || 0) / 100)))} por mês com fundo</dd>`)}
      <dt>Arrecadação mensal</dt><dd>${fmtReais(arrecadacaoPrevista(r))}</dd>
    </dl></div>`}
  </div>`;
}

// Soma das taxas do mês com o fundo de reserva; vai como faturamento estimado na subconta do Asaas.
function arrecadacaoPrevista(r) {
  const cfg = configDoRascunho(r).cobranca;
  if (!(cfg.valores.A > 0)) return 0;
  const fracoes = fracoesDasUnidades(r.unidades, cfg.valores);
  const mensal = cfg.modo === 'fracao' && cfg.orcamento > 0 ? (u) => Math.round(cfg.orcamento * fracoes[u.id]) : (u) => (u.tipo === 'cobertura' ? cfg.valores.cobertura : cfg.valores.A);
  return r.unidades.reduce((s, u) => s + Math.round(mensal(u) * (1 + (cfg.fundoPct || 0) / 100)), 0);
}

function SubcontaReal({ r, mudar }) {
  const a = r.asaas;
  const c = r.condominio;
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const campo = (chave) => (ev) => mudar({ asaas: { ...a, [chave]: ev.target.value } });

  async function criar() {
    const cnpj = apenasDigitos(a.cnpj || c.cnpj);
    if (cnpj.length !== 14) { setErro('Informe o CNPJ do condomínio (14 dígitos)'); return; }
    if (!c.cep || !c.endereco || !a.numero || !a.bairro) { setErro('Preencha CEP e endereço (passo Condomínio), número e bairro'); return; }
    // Protege contra colar a chave da API (ou outro texto longo) no campo do número do endereço.
    if (!/^[0-9A-Za-z\s\-/]{1,10}$/.test(String(a.numero).trim())) { setErro('Em Número, informe só o número do endereço do prédio (ex.: 1000). A chave do Asaas não vai aqui: ela fica no painel da Hostinger'); return; }
    if (!c.sindico.email || !c.sindico.celular) { setErro('Informe o e-mail e o celular do síndico no passo Condomínio'); return; }
    const id = r.idCondominio || `cond-${identificadorCondominio(c.nome)}-${Date.now().toString(36)}`;
    setEnviando(true);
    setErro(null);
    try {
      const resp = await chamarApi('POST', '/api/condominios', { id, nome: c.nome, cnpj, email: c.sindico.email, celular: apenasDigitos(c.sindico.celular), cep: apenasDigitos(c.cep), endereco: c.endereco, numero: a.numero, bairro: a.bairro, rendaMensal: arrecadacaoPrevista(r) || 100000 });
      mudar({ idCondominio: id, asaas: { ...a, cnpj, situacao: 'aprovada', ambiente: 'sandbox', real: true, walletId: resp.walletId, contaPrincipal: resp.situacao === 'conta-principal' } });
    } catch (e) {
      setErro(e.message);
    }
    setEnviando(false);
  }

  return html`<div class="pilha formulario">
    <p class="sub">Asaas sandbox conectado: a subconta é criada de verdade no ambiente de testes (dinheiro de mentira).</p>
    <div class="edicao-anuncio">
      <${Campo} rotulo="CNPJ do condomínio"><input id="impl-asaas-cnpj" inputmode="numeric" value=${a.cnpj || c.cnpj} onInput=${campo('cnpj')} /><//>
      <${Campo} rotulo="Número" dica="Do endereço do prédio"><input id="impl-numero" inputmode="numeric" maxlength="10" value=${a.numero || ''} onInput=${campo('numero')} placeholder="Ex.: 1000" /><//>
      <${Campo} rotulo="Bairro"><input id="impl-bairro" value=${a.bairro || ''} onInput=${campo('bairro')} placeholder="Ex.: Centro" /><//>
    </div>
    ${a.real
      ? a.contaPrincipal
        ? html`<p class="sucesso">Asaas sandbox pronto. A conta Asaas é de pessoa física e não cria subcontas, então as cobranças deste condomínio vão sair pela conta principal do sandbox.</p>`
        : html`<p class="sucesso">Subconta aprovada no Asaas sandbox (carteira ${a.walletId}). As cobranças vão sair por ela.</p>`
      : html`<button type="button" class="btn primario" data-acao="criar-subconta" disabled=${enviando} onClick=${criar}>${enviando ? 'Criando no Asaas…' : 'Criar subconta no Asaas sandbox'}</button>`}
    <${Erro} texto=${erro} />
  </div>`;
}

function PassoAsaas({ r, mudar }) {
  if (CONEXAO.ativa && CONEXAO.codigo) return html`<${SubcontaReal} r=${r} mudar=${mudar} />`;
  const a = r.asaas;
  const campo = (chave) => (ev) => mudar({ asaas: { ...a, [chave]: ev.target.value } });
  const etiqueta = { pendente: ['neutro', 'Não criada'], analise: ['alerta', 'Em análise'], aprovada: ['ok', 'Aprovada'] }[a.situacao];
  return html`<div class="pilha formulario">
    <p class="sub">Cada condomínio tem a própria subconta no Asaas: o dinheiro cai direto na conta do condomínio. No protótipo, a criação e a aprovação são simuladas.</p>
    <div class="edicao-anuncio">
      <${Campo} rotulo="Ambiente"><select id="impl-ambiente" value=${a.ambiente} onChange=${campo('ambiente')}><option value="sandbox">Sandbox (testes, dinheiro de mentira)</option><option value="producao">Produção</option></select><//>
      <${Campo} rotulo="CNPJ do condomínio"><input id="impl-asaas-cnpj" value=${a.cnpj || r.condominio.cnpj} onInput=${campo('cnpj')} /><//>
      <${Campo} rotulo="Banco"><input id="impl-banco" value=${a.banco} onInput=${campo('banco')} placeholder="Ex.: 341 Itaú" /><//>
      <${Campo} rotulo="Agência"><input id="impl-agencia" value=${a.agencia} onInput=${campo('agencia')} /><//>
      <${Campo} rotulo="Conta"><input id="impl-conta" value=${a.conta} onInput=${campo('conta')} /><//>
    </div>
    <div class="linha-entre"><span>Subconta: <${Etiqueta} tipo=${etiqueta[0]}>${etiqueta[1]}<//></span>
      <span class="acoes">
        ${a.situacao === 'pendente' && html`<button type="button" class="btn secundario" data-acao="criar-subconta" onClick=${() => mudar({ asaas: { ...a, situacao: 'analise' } })}>Criar subconta</button>`}
        ${a.situacao === 'analise' && html`<button type="button" class="btn secundario" data-acao="aprovar-subconta" onClick=${() => mudar({ asaas: { ...a, situacao: 'aprovada', walletId: `wal_${identificadorCondominio(r.condominio.nome).slice(0, 12)}` } })}>Simular aprovação do Asaas</button>`}
      </span>
    </div>
    ${a.situacao === 'aprovada' && html`<p class="sucesso">Subconta aprovada (${a.ambiente === 'sandbox' ? 'sandbox' : 'produção'}). As cobranças vão sair por ela.</p>`}
    ${a.situacao !== 'aprovada' && html`<small class="sub">Dá para seguir e terminar depois: até a aprovação, a emissão fica em modo de teste.</small>`}
  </div>`;
}

function PassoAreas({ r, mudar }) {
  const alternar = (id) => mudar({ areas: r.areas.includes(id) ? r.areas.filter((x) => x !== id) : [...r.areas, id] });
  return html`<div class="pilha formulario">
    <p class="sub">Escolha as áreas que os moradores podem reservar. Regras, taxas e horários podem ser ajustados depois.</p>
    ${Object.values(AREAS_MODELO).map((a) => html`<label key=${a.id} class="check area-modelo"><input id=${`impl-area-${a.id}`} type="checkbox" checked=${r.areas.includes(a.id)} onChange=${() => alternar(a.id)} /><span><strong>${a.nome}</strong> · ${a.taxa ? `taxa R$ ${a.taxa},00` : 'sem taxa'} · ${a.aprovacao === 'manual' ? 'síndico aprova' : 'aprovação automática'} · ${a.tipo === 'periodo' ? 'por período' : `por hora, ${a.horaInicio}h–${a.horaFim}h`}</span></label>`)}
  </div>`;
}

function PassoDivulgacao({ r }) {
  const nome = r.condominio.nome || 'Seu condomínio';
  const link = linkConvite(identificadorCondominio(nome));
  const mensagem = mensagemWhatsAppConvite(nome, link);
  const [copiado, setCopiado] = useState(null);
  function copiar(texto, rotulo) {
    const feito = () => setCopiado(rotulo);
    if (navigator.clipboard) navigator.clipboard.writeText(texto).then(feito).catch(feito);
    else feito();
  }
  return html`<div class="pilha">
    <div class="grade-divulgacao">
      <div class="cartaz-implantacao" id="cartaz-implantacao">
        <p class="cartaz-marca"><${Icone} nome="predio" tamanho=${22} /> CondoFácil</p>
        <h2 class="cartaz-titulo">${nome} agora tem app!</h2>
        <p class="cartaz-sub">Reservas, avisos, encomendas, boletos e ocorrências pelo celular.</p>
        <${QrCodeReal} texto=${link} />
        <p class="cartaz-passos">1. Aponte a câmera para o QR Code<br />2. Escolha a sua unidade<br />3. Confirme com o código que chega no celular</p>
        <p class="cartaz-link">${link}</p>
        <p class="cartaz-contato">Dúvidas: ${CONTATO_COMERCIAL.email} · WhatsApp ${CONTATO_COMERCIAL.whatsapp}</p>
      </div>
      <div class="pilha">
        <strong>Link do convite</strong>
        <code class="link-convite">${link}</code>
        <div class="acoes">
          <button type="button" class="btn secundario" onClick=${() => copiar(link, 'Link copiado.')}>Copiar link</button>
          <button type="button" class="btn secundario" data-acao="imprimir-cartaz" onClick=${() => window.print()}>Imprimir cartaz</button>
        </div>
        <strong>Mensagem para o grupo do WhatsApp</strong>
        <pre class="modelo-csv">${mensagem}</pre>
        <button type="button" class="btn secundario" onClick=${() => copiar(mensagem, 'Mensagem copiada.')}>Copiar mensagem</button>
        <${Sucesso} texto=${copiado} />
        <small class="sub">O endereço ${CONTATO_COMERCIAL.site} ainda não está publicado: o QR mostra o link certo, que passa a abrir quando o site estiver no ar.</small>
      </div>
    </div>
  </div>`;
}

const PASSOS_UI = { condominio: PassoCondominio, unidades: PassoUnidades, moradores: PassoMoradores, cobranca: PassoCobranca, asaas: PassoAsaas, areas: PassoAreas, divulgacao: PassoDivulgacao };

export function TelaImplantacao({ rota, rascunho, aoSalvarRascunho, aoAtivar }) {
  const [r, setR] = useState(() => rascunho || rascunhoPadrao());
  const [erro, setErro] = useState(null);
  const passo = PASSOS_UI[rota.tela] ? rota.tela : 'condominio';
  const indice = PASSOS_IMPLANTACAO.findIndex(([id]) => id === passo);
  const Passo = PASSOS_UI[passo];
  const mudar = (mudanca) => setR((atual) => ({ ...atual, ...mudanca }));

  function avancar() {
    const falha = validarPasso(passo, r);
    setErro(falha);
    if (falha) return;
    const salvo = { ...r, concluidos: [...new Set([...r.concluidos, passo])] };
    setR(salvo);
    aoSalvarRascunho(salvo);
    if (passo === 'divulgacao') { aoAtivar(condominioNovo(configDoRascunho(salvo), new Date())); return; }
    ir('implantacao', PASSOS_IMPLANTACAO[indice + 1][0]);
  }

  function voltar() {
    setErro(null);
    aoSalvarRascunho(r);
    if (indice > 0) ir('implantacao', PASSOS_IMPLANTACAO[indice - 1][0]);
    else ir('sindico', 'inicio');
  }

  const total = configDoRascunho(r).cobranca.valores.A > 0 ? mensalidade(r.condominio.plano, Math.max(1, r.unidades.length)) : null;
  return html`<section class="implantacao">
    <header class="linha-entre">
      <div><p class="protocolo">Implantação · passo ${indice + 1} de ${PASSOS_IMPLANTACAO.length}</p><h1>${PASSOS_IMPLANTACAO[indice][1]}</h1></div>
      ${r.unidades.length > 0 && total !== null && html`<small class="sub">${r.unidades.length} unidades · plano ${PLANOS.find((p) => p.id === r.condominio.plano).nome}: ${fmtReais(total)}/mês</small>`}
    </header>
    <ol class="passos-implantacao">${PASSOS_IMPLANTACAO.map(([id, nome], i) => html`<li key=${id} class=${`${i === indice ? 'atual' : ''} ${r.concluidos.includes(id) ? 'feito' : ''}`}><a href=${`#implantacao.${id}`} aria-current=${i === indice ? 'step' : undefined}>${i + 1}. ${nome}</a></li>`)}</ol>
    <div class="cartao implantacao-corpo"><${Passo} r=${r} mudar=${mudar} /></div>
    <${Erro} texto=${erro} />
    <div class="acoes implantacao-rodape">
      <button type="button" class="btn secundario" onClick=${voltar}>${indice > 0 ? 'Voltar' : 'Cancelar'}</button>
      <button type="button" class="btn primario" data-acao="avancar-implantacao" onClick=${avancar}>${passo === 'divulgacao' ? 'Ativar condomínio' : 'Salvar e continuar'}</button>
    </div>
  </section>`;
}
