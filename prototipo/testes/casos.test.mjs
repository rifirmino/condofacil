import { test } from 'node:test';
import { CASOS_DADOS } from '../src/casos/dados.js';
import { CASOS_REGRAS } from '../src/casos/regras.js';
import { CASOS_ACOES } from '../src/casos/acoes.js';
import { CASOS_VENDAS } from '../src/casos/vendas.js';
import { CASOS_COBRANCA_DADOS } from '../src/casos/cobranca-dados.js';
import { CASOS_COBRANCA_REGRAS } from '../src/casos/cobranca-regras.js';
import { CASOS_COBRANCA_ACOES } from '../src/casos/cobranca-acoes.js';
import { CASOS_ACORDOS } from '../src/casos/acordos.js';

for (const caso of [...CASOS_DADOS, ...CASOS_REGRAS, ...CASOS_ACOES, ...CASOS_VENDAS, ...CASOS_COBRANCA_DADOS, ...CASOS_COBRANCA_REGRAS, ...CASOS_COBRANCA_ACOES, ...CASOS_ACORDOS]) test(caso.nome, () => caso.rodar());
