// Implantação de um condomínio novo: unidades, moradores por planilha, frações e divulgação.
export const CONTATO_COMERCIAL = { email: 'comercial@condofacil.cloud', whatsapp: '+55 11 92591-3118', site: 'condofacil.cloud' };
export const PASSOS_IMPLANTACAO = [['condominio', 'Condomínio'], ['unidades', 'Unidades'], ['moradores', 'Moradores'], ['cobranca', 'Cobrança'], ['asaas', 'Conta Asaas'], ['areas', 'Áreas comuns'], ['divulgacao', 'Divulgação']];
export const NOMES_VINCULO_MORADOR = { titular: 'Titular', inquilino: 'Inquilino', proprietario: 'Proprietário' };
export const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
export const MODELO_CSV_MORADORES = 'unidade;nome;email;celular;vinculo;responsavel\n101;Maria Silva;maria@email.com;11987654321;titular;sim\n102;João Souza;joao@email.com;11912345678;inquilino;nao';
const LIMITE_UNIDADES = 1000;

export const AREAS_MODELO = {
  salao: { id: 'salao', nome: 'Salão de festas', tipo: 'periodo', periodos: [{ id: 'tarde', nome: 'Tarde', inicio: 13, fim: 18 }, { id: 'noite', nome: 'Noite', inicio: 18, fim: 23 }], taxa: 150, aprovacao: 'manual', antecedenciaMin: 2, antecedenciaMax: 60, limiteMes: 2, vinculadas: [], capacidade: 80, itens: 'Mesas e cadeiras', regulamento: 'Som até as 22h. Limpeza por conta do morador.' },
  churrasqueira: { id: 'churrasqueira', nome: 'Churrasqueira', tipo: 'periodo', periodos: [{ id: 'tarde', nome: 'Tarde', inicio: 13, fim: 18 }, { id: 'noite', nome: 'Noite', inicio: 18, fim: 23 }], taxa: 50, aprovacao: 'automatica', antecedenciaMin: 1, antecedenciaMax: 60, limiteMes: 2, vinculadas: [], capacidade: 25, itens: 'Grelha, mesas e pia', regulamento: 'Deixe a grelha limpa.' },
  quadra: { id: 'quadra', nome: 'Quadra', tipo: 'hora', horaInicio: 8, horaFim: 22, taxa: 0, aprovacao: 'automatica', antecedenciaMin: 0, antecedenciaMax: 15, limiteMes: 4, vinculadas: [], capacidade: 12, itens: 'Rede e traves', regulamento: 'Uma hora por reserva.' },
  academia: { id: 'academia', nome: 'Academia', tipo: 'hora', horaInicio: 6, horaFim: 23, taxa: 0, aprovacao: 'automatica', antecedenciaMin: 0, antecedenciaMax: 7, limiteMes: null, vinculadas: [], capacidade: 6, itens: 'Aparelhos de musculação', regulamento: 'Uso a partir de 14 anos.' },
  piscina: { id: 'piscina', nome: 'Piscina', tipo: 'hora', horaInicio: 8, horaFim: 20, taxa: 0, aprovacao: 'automatica', antecedenciaMin: 0, antecedenciaMax: 7, limiteMes: null, vinculadas: [], capacidade: 20, itens: 'Espreguiçadeiras', regulamento: 'Proibido vidro na área da piscina.' },
};

export function identificadorCondominio(nome) {
  return String(nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'condominio';
}

export function linkConvite(identificador) {
  return `https://${CONTATO_COMERCIAL.site}/c/${identificador}`;
}

export function apenasDigitos(texto) {
  return String(texto || '').replace(/\D/g, '');
}

export function validarCondominio(dados) {
  if (!String(dados.nome || '').trim()) return 'Informe o nome do condomínio';
  const cnpj = apenasDigitos(dados.cnpj);
  if (cnpj && cnpj.length !== 14) return 'O CNPJ deve ter 14 dígitos';
  const cep = apenasDigitos(dados.cep);
  if (cep && cep.length !== 8) return 'O CEP deve ter 8 dígitos';
  if (dados.uf && !UFS.includes(dados.uf)) return 'Escolha a UF';
  const s = dados.sindico || {};
  if (!String(s.nome || '').trim()) return 'Informe o nome do síndico';
  if (s.email && !emailValido(s.email)) return 'E-mail do síndico inválido';
  if (s.celular && !celularValido(s.celular)) return 'Celular do síndico inválido';
  return null;
}

export function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function celularValido(celular) {
  const n = apenasDigitos(celular).length;
  return n >= 10 && n <= 13;
}

// Unidades como "101", "102"… e, com blocos, "A101". O último andar pode ser todo de coberturas.
export function gerarUnidades({ blocos = [], andares, porAndar, coberturaUltimo = false }) {
  const a = Number(andares);
  const p = Number(porAndar);
  if (!Number.isInteger(a) || a < 1 || a > 40) return { erro: 'Informe de 1 a 40 andares' };
  if (!Number.isInteger(p) || p < 1 || p > 20) return { erro: 'Informe de 1 a 20 apartamentos por andar' };
  const nomes = blocos.map((b) => String(b).trim().toUpperCase()).filter(Boolean);
  if (new Set(nomes).size !== nomes.length) return { erro: 'Blocos repetidos' };
  const listaBlocos = nomes.length ? nomes : [''];
  if (listaBlocos.length * a * p > LIMITE_UNIDADES) return { erro: `No máximo ${LIMITE_UNIDADES} unidades` };
  const unidades = [];
  for (const bloco of listaBlocos) {
    for (let andar = 1; andar <= a; andar++) {
      for (let n = 1; n <= p; n++) unidades.push({ id: `${bloco}${andar}${String(n).padStart(2, '0')}`, bloco: bloco || null, andar, tipo: coberturaUltimo && andar === a && a > 1 ? 'cobertura' : 'A' });
    }
  }
  return { unidades };
}

function dividirLinha(linha, sep) {
  const campos = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas;
    } else if (c === sep && !aspas) { campos.push(atual.trim()); atual = ''; } else atual += c;
  }
  campos.push(atual.trim());
  return campos;
}

function separadorDe(texto) {
  const primeira = texto.split(/\r?\n/).find((l) => l.trim()) || '';
  if (primeira.includes('\t')) return '\t';
  return (primeira.match(/;/g) || []).length >= (primeira.match(/,/g) || []).length ? ';' : ',';
}

export function lerCsvUnidades(texto) {
  const linhas = String(texto || '').split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return { erro: 'Cole a planilha de unidades' };
  const sep = separadorDe(texto);
  const corpo = /unidade/i.test(linhas[0]) ? linhas.slice(1) : linhas;
  const unidades = [];
  for (const [n, linha] of corpo.entries()) {
    const [id, bloco, tipo] = dividirLinha(linha, sep);
    const limpo = String(id || '').toUpperCase().replace(/\s+/g, '');
    if (!limpo) return { erro: `Linha ${n + 1}: informe a unidade` };
    if (unidades.some((u) => u.id === limpo)) return { erro: `Linha ${n + 1}: unidade ${limpo} repetida` };
    const andar = Number((limpo.match(/(\d+)\d\d$/) || [])[1]) || 1;
    unidades.push({ id: limpo, bloco: bloco ? bloco.toUpperCase() : null, andar, tipo: /cobertura/i.test(tipo || '') ? 'cobertura' : 'A' });
  }
  if (unidades.length > LIMITE_UNIDADES) return { erro: `No máximo ${LIMITE_UNIDADES} unidades` };
  return { unidades };
}

const VINCULOS_ACEITOS = { titular: 'titular', proprietario: 'proprietario', 'proprietário': 'proprietario', inquilino: 'inquilino', locatario: 'inquilino', 'locatário': 'inquilino' };

// Devolve todas as linhas com seus erros, para o síndico corrigir antes de importar.
export function lerCsvMoradores(texto, idsUnidades) {
  const linhasTexto = String(texto || '').split(/\r?\n/).filter((l) => l.trim());
  if (!linhasTexto.length) return { linhas: [], validas: [], totalErros: 0 };
  const sep = separadorDe(texto);
  const comCabecalho = /unidade/i.test(linhasTexto[0]) && /nome/i.test(linhasTexto[0]);
  const corpo = comCabecalho ? linhasTexto.slice(1) : linhasTexto;
  const unidades = new Set(idsUnidades);
  const responsaveis = new Set();
  const linhas = corpo.map((texto, i) => {
    const [unidade, nome, email, celular, vinculo, responsavel] = dividirLinha(texto, sep);
    const u = String(unidade || '').toUpperCase().replace(/\s+/g, '');
    const erros = [];
    if (!unidades.has(u)) erros.push(`Unidade ${u || '(vazia)'} não existe`);
    if (!String(nome || '').trim()) erros.push('Informe o nome');
    if (email && !emailValido(email)) erros.push('E-mail inválido');
    if (celular && !celularValido(celular)) erros.push('Celular inválido');
    const v = vinculo ? VINCULOS_ACEITOS[String(vinculo).toLowerCase()] : 'titular';
    if (!v) erros.push(`Vínculo "${vinculo}" desconhecido`);
    const ehResponsavel = /^(s|sim|x|1|true)$/i.test(String(responsavel || '').trim());
    if (ehResponsavel && unidades.has(u)) {
      if (responsaveis.has(u)) erros.push(`A unidade ${u} já tem responsável financeiro`);
      else responsaveis.add(u);
    }
    return { numero: i + 1 + (comCabecalho ? 1 : 0), dados: { unidade: u, nome: String(nome || '').trim(), email: String(email || '').trim(), celular: apenasDigitos(celular), vinculo: v || 'titular', responsavel: ehResponsavel }, erros };
  });
  return { linhas, validas: linhas.filter((l) => !l.erros.length).map((l) => l.dados), totalErros: linhas.filter((l) => l.erros.length).length };
}

// Frações proporcionais ao valor de cada tipo, somando exatamente 1 (o resto do arredondamento vai para a primeira unidade).
export function fracoesDasUnidades(unidades, valores) {
  const peso = (u) => (u.tipo === 'cobertura' ? valores.cobertura || valores.A : valores.A) || 1;
  const total = unidades.reduce((s, u) => s + peso(u), 0);
  const fracoes = Object.fromEntries(unidades.map((u) => [u.id, Math.round((peso(u) / total) * 1e6) / 1e6]));
  const soma = Object.values(fracoes).reduce((s, f) => s + f, 0);
  if (unidades.length) fracoes[unidades[0].id] = Math.round((fracoes[unidades[0].id] + (1 - soma)) * 1e6) / 1e6;
  return fracoes;
}

export function mensagemWhatsAppConvite(nome, link) {
  return `Olá, vizinhos! 🏢\n\nO ${nome} agora usa o CondoFácil: reservas, avisos, encomendas, boletos e ocorrências pelo celular.\n\nEntre pelo link e confirme a sua unidade:\n${link}\n\nDúvidas: ${CONTATO_COMERCIAL.email} ou WhatsApp ${CONTATO_COMERCIAL.whatsapp}.`;
}
