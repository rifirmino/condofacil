import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { montar, envolverLocal } from './montagem.mjs';

const raiz = dirname(fileURLToPath(import.meta.url));
const pagina = montar();
writeFileSync(join(raiz, 'condofacil.html'), pagina);
writeFileSync(join(raiz, 'condofacil-local.html'), envolverLocal(pagina));
// O servidor da Hostinger entrega esta cópia (a publicação lê só a pasta servidor/).
mkdirSync(join(raiz, '../servidor/publico'), { recursive: true });
writeFileSync(join(raiz, '../servidor/publico/index.html'), envolverLocal(pagina));
console.log('prototipo/condofacil.html (publicação), condofacil-local.html (testes) e servidor/publico/index.html gerados');
