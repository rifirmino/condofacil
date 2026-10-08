import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { montar, envolverLocal } from './montagem.mjs';

const raiz = dirname(fileURLToPath(import.meta.url));
const pagina = montar();
writeFileSync(join(raiz, 'condofacil.html'), pagina);
writeFileSync(join(raiz, 'condofacil-local.html'), envolverLocal(pagina));
console.log('prototipo/condofacil.html (publicação) e condofacil-local.html (testes) gerados');
