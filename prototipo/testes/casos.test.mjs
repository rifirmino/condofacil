import { test } from 'node:test';
import { CASOS_DADOS } from '../src/casos/dados.js';
import { CASOS_REGRAS } from '../src/casos/regras.js';

for (const caso of [...CASOS_DADOS, ...CASOS_REGRAS]) test(caso.nome, () => caso.rodar());
