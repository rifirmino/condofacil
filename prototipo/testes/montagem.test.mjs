import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transformar, montar, extrairScript } from '../montagem.mjs';

test('transformar remove imports locais e a palavra export', () => {
  const entrada = [
    "import { a } from './a.js';",
    "import { b } from '../b.js';",
    "import { h } from 'https://x/y.js';",
    'export { h };',
    'export function f() {}',
    'export const B = 1;',
    '  const c = 2;',
  ].join('\n');
  assert.equal(transformar(entrada), ["import { h } from 'https://x/y.js';", 'function f() {}', 'const B = 1;', '  const c = 2;'].join('\n'));
});

test('montar gera um HTML único', () => {
  const pagina = montar();
  assert.equal((pagina.match(/<\/script>/g) || []).length, 1);
  assert.doesNotMatch(pagina, /from '\.\.?\//);
  assert.equal((pagina.match(/unpkg\.com\/htm@3\.1\.1\/preact\/standalone\.module\.js/g) || []).length, 1);
  assert.match(pagina, /<title>CondoFácil Protótipo<\/title>/);
});

test('nenhum nome de nível superior se repete entre arquivos', () => {
  const js = extrairScript(montar());
  const nomes = [...js.matchAll(/^(?:async )?(?:const|let|function|class) (\w+)/gm)].map((m) => m[1]);
  const repetidos = nomes.filter((n, i) => nomes.indexOf(n) !== i);
  assert.deepEqual(repetidos, []);
});

test('o script montado tem sintaxe válida', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'condofacil-'));
  const arquivo = join(pasta, 'script.mjs');
  writeFileSync(arquivo, extrairScript(montar()));
  const r = spawnSync(process.execPath, ['--check', arquivo], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});
