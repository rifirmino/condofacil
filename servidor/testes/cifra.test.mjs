import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cifrar, decifrar } from '../cifra.mjs';

const CHAVE = Buffer.alloc(32, 7).toString('base64');

test('cifra e decifra a chave da subconta', () => {
  const c = cifrar('$aact_chave_da_subconta', CHAVE);
  assert.notEqual(c, '$aact_chave_da_subconta');
  assert.equal(decifrar(c, CHAVE), '$aact_chave_da_subconta');
  assert.notEqual(cifrar('x', CHAVE), cifrar('x', CHAVE));
});

test('recusa chave de tamanho errado e texto adulterado', () => {
  assert.throws(() => cifrar('x', Buffer.alloc(16).toString('base64')), /32 bytes/);
  const c = cifrar('segredo', CHAVE);
  const partes = c.split('.');
  partes[2] = Buffer.from('outro texto').toString('base64url');
  assert.throws(() => decifrar(partes.join('.'), CHAVE));
});
