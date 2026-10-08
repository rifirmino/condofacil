import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { montar } from './montagem.mjs';

const raiz = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(raiz, 'condofacil.html'), montar());
console.log('prototipo/condofacil.html gerado');
