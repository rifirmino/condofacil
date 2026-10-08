// Abre cada rota no Chrome headless e confere textos do DOM. Com --capturas, salva PNGs em capturas/.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acharChrome, urlPagina, raiz } from './navegador.mjs';

// [sufixo da URL, textos esperados]; "!" no início = o texto não pode aparecer
const CHECAGENS = [
  ['?teste=1', ['falhas: 0']],
  ['#sindico.inicio', ['Ver como', 'Reiniciar demonstração', 'Residencial Ipê Amarelo']],
  ['#portaria.registrar', ['Ler etiqueta', 'Registrar encomenda', 'Mercado Livre', 'Seu José']],
  ['#portaria.entregar', ['Buscar por código ou unidade', 'Apto 302', 'Parada']],
  ['#portaria.hoje', ['Churrasqueira', 'João Pereira', 'Apto 603']],
  ['#morador.inicio', ['Olá, Ana', '481203', '730915', 'Retire em breve', 'Fixado pelo síndico', 'Quadra']],
  ['#morador.reservas', ['Salão de festas', 'Academia', 'Minhas reservas']],
  ['#morador.avisos', ['Falta de água', 'não lido']],
  ['#morador.avisos.c1', ['Li e estou ciente', 'Útil · 3']],
  ['#morador.ocorrencias', ['Vaga ocupada', 'Públicas do condomínio', 'eu também']],
  ['#morador.ocorrencias.OC-0042', ['Protocolo OC-0042', 'Ocorrência aberta']],
  ['#morador.documentos', ['Regimento interno', '!Balancete']],
  ['#morador.encomendas', ['Retirada por Ana Souza']],
];

const CAPTURAS = [
  ['sindico-inicio', '#sindico.inicio', '1366,900'],
  ['sindico-reservas', '#sindico.reservas', '1366,1100'],
  ['sindico-comunicado', '#sindico.comunicados.c1', '1366,900'],
  ['sindico-ocorrencias', '#sindico.ocorrencias', '1366,900'],
  ['morador-inicio', '#morador.inicio', '1366,900'],
  ['morador-reservas', '#morador.reservas', '1366,900'],
  ['portaria-registrar', '#portaria.registrar', '1366,900'],
  ['portaria-entregar', '#portaria.entregar', '1366,900'],
  ['celular-morador', '#morador.inicio', '390,844'],
  ['celular-sindico', '#sindico.inicio', '390,844'],
];

const chrome = acharChrome();

function abrir(sufixo, extras) {
  const perfil = mkdtempSync(join(tmpdir(), 'condofacil-chrome-'));
  try {
    const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${perfil}`, '--virtual-time-budget=5000', ...extras, urlPagina + sufixo], { encoding: 'utf8', timeout: 90000 });
    return r.stdout || '';
  } finally {
    try { rmSync(perfil, { recursive: true, force: true }); } catch { /* o Windows pode segurar o perfil por um instante */ }
  }
}

let falhas = 0;
for (const [sufixo, textos] of CHECAGENS) {
  // Só o DOM renderizado conta: o código-fonte embutido não pode satisfazer a checagem.
  const dom = abrir(sufixo, ['--dump-dom']).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
  for (const texto of textos) {
    const negar = texto.startsWith('!');
    const alvo = negar ? texto.slice(1) : texto;
    const passou = dom.includes(alvo) !== negar;
    if (!passou) falhas += 1;
    console.log(`${passou ? 'ok   ' : 'FALHA'} ${sufixo} ${negar ? 'sem' : 'com'} "${alvo}"`);
  }
}

if (process.argv.includes('--capturas')) {
  const pasta = join(raiz, 'capturas');
  mkdirSync(pasta, { recursive: true });
  for (const [nome, sufixo, tamanho] of CAPTURAS) {
    abrir(sufixo, [`--screenshot=${join(pasta, `${nome}.png`)}`, `--window-size=${tamanho}`, '--hide-scrollbars']);
    console.log(`captura capturas/${nome}.png`);
  }
}

process.exit(falhas ? 1 : 0);
