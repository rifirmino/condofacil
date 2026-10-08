// Junta os módulos de src/ num único HTML, sem dependências.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = dirname(fileURLToPath(import.meta.url));

// Ordem de dependência: cada arquivo usa apenas nomes dos anteriores.
export const ORDEM = [
  'src/vendor.js',
  'src/datas.js',
  'src/ui/app.js',
];

export function transformar(codigo) {
  return codigo
    .split(/\r?\n/)
    .filter((linha) => !/^import .* from '\.\.?\//.test(linha))
    .filter((linha) => !/^export \{.*\};?\s*$/.test(linha))
    .map((linha) => linha.replace(/^export (async function|function|const|let|class) /, '$1 '))
    .join('\n');
}

export function montar() {
  const js = ORDEM.map((arquivo) => `// ---- ${arquivo} ----\n${transformar(readFileSync(join(raiz, arquivo), 'utf8'))}`).join('\n');
  const css = readFileSync(join(raiz, 'src/estilos.css'), 'utf8');
  const base = readFileSync(join(raiz, 'src/base.html'), 'utf8');
  return base.replace('/*CSS*/', () => css).replace('/*JS*/', () => js);
}

export function extrairScript(pagina) {
  const inicio = pagina.indexOf('<script type="module">') + '<script type="module">'.length;
  return pagina.slice(inicio, pagina.indexOf('</script>', inicio));
}
