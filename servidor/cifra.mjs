import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM para guardar a apiKey de cada subconta no banco.
function chaveDe(base64) {
  const chave = Buffer.from(base64 || '', 'base64');
  if (chave.length !== 32) throw new Error('CHAVE_CRIPTO deve ter 32 bytes em base64');
  return chave;
}

export function cifrar(texto, chaveBase64) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chaveDe(chaveBase64), iv);
  const dados = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), dados].map((b) => b.toString('base64url')).join('.');
}

export function decifrar(cifrado, chaveBase64) {
  const [iv, tag, dados] = String(cifrado).split('.').map((p) => Buffer.from(p, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', chaveDe(chaveBase64), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(dados), d.final()]).toString('utf8');
}
