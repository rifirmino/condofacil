import { test } from 'node:test';
import { CASOS_DADOS } from '../src/casos/dados.js';

for (const caso of [...CASOS_DADOS]) test(caso.nome, () => caso.rodar());
