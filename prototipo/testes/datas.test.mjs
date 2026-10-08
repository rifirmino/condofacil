import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoDia, somarDias, somarMes, diferencaDias, diasDoMes, fmtDia, fmtDataHora, fmtDataCurta, haQuanto, nomeMes, fmtHora } from '../src/datas.js';

test('isoDia usa o fuso local', () => {
  assert.equal(isoDia(new Date(2026, 9, 8, 23, 30)), '2026-10-08');
});

test('somarDias atravessa o mês', () => {
  assert.equal(somarDias('2026-10-30', 3), '2026-11-02');
  assert.equal(somarDias('2026-10-08', -3), '2026-10-05');
});

test('somarMes atravessa o ano', () => {
  assert.equal(somarMes('2026-12', 1), '2027-01');
  assert.equal(somarMes('2026-01', -1), '2025-12');
});

test('diferencaDias', () => {
  assert.equal(diferencaDias('2026-10-11', '2026-10-08'), 3);
  assert.equal(diferencaDias('2026-10-05', '2026-10-08'), -3);
});

test('diasDoMes', () => {
  const dias = diasDoMes('2026-02');
  assert.equal(dias.length, 28);
  assert.equal(dias[0], '2026-02-01');
  assert.equal(dias[27], '2026-02-28');
});

test('formatos', () => {
  assert.equal(fmtDia('2026-10-08'), 'qui, 8 out');
  assert.equal(nomeMes('2026-10'), 'outubro de 2026');
  assert.equal(fmtDataCurta('2024-05-20'), '20/05/2024');
  assert.equal(fmtDataHora(new Date(2026, 9, 8, 9, 5)), '08/10 09:05');
  assert.equal(fmtHora(9), '09h');
});

test('haQuanto', () => {
  const agora = new Date(2026, 9, 8, 12);
  assert.equal(haQuanto(new Date(2026, 9, 8, 11, 30), agora), 'agora há pouco');
  assert.equal(haQuanto(new Date(2026, 9, 8, 9), agora), 'há 3 h');
  assert.equal(haQuanto(new Date(2026, 9, 7, 11), agora), 'há 1 dia');
  assert.equal(haQuanto(new Date(2026, 9, 4, 12), agora), 'há 4 dias');
});
