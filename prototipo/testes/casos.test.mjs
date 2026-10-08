import { test } from 'node:test';
import { CASOS_DADOS } from '../src/casos/dados.js';
import { CASOS_REGRAS } from '../src/casos/regras.js';
import { CASOS_ACOES } from '../src/casos/acoes.js';

for (const caso of [...CASOS_DADOS, ...CASOS_REGRAS, ...CASOS_ACOES]) test(caso.nome, () => caso.rodar());
