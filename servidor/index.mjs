import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarServidor } from './http.mjs';
import { criarRotas } from './rotas.mjs';
import { clienteAsaas } from './asaas.mjs';
import { bancoEmMemoria, bancoMysql } from './banco.mjs';

// Ponto de entrada na Hostinger: valida o ambiente sem nunca mostrar valores, prepara o banco e sobe o HTTP.
const raiz = dirname(fileURLToPath(import.meta.url));
const env = process.env;

function exigir(nome, valido = (v) => !!v) {
  if (!valido(env[nome])) {
    console.error(`Variável ${nome} ausente ou inválida`);
    process.exit(1);
  }
  return env[nome];
}

const urlAsaas = exigir('ASAAS_URL', (v) => /sandbox|127\.0\.0\.1|localhost/.test(v || ''));
const config = {
  chaveRaiz: exigir('ASAAS_API_KEY'),
  tokenWebhook: exigir('ASAAS_WEBHOOK_TOKEN', (v) => (v || '').length >= 16),
  chaveCripto: exigir('CHAVE_CRIPTO', (v) => Buffer.from(v || '', 'base64').length === 32),
  codigoPiloto: exigir('CODIGO_PILOTO', (v) => (v || '').length >= 6),
  urlPublica: exigir('URL_PUBLICA', (v) => /^https?:\/\//.test(v || '')).replace(/\/$/, ''),
};

const banco = env.MYSQL_HOST
  ? await bancoMysql({ host: env.MYSQL_HOST, user: exigir('MYSQL_USUARIO'), password: exigir('MYSQL_SENHA'), database: exigir('MYSQL_BANCO') })
  : bancoEmMemoria();
if (!env.MYSQL_HOST) console.warn('MYSQL_HOST não definido: dados só em memória (somem ao reiniciar)');
await banco.preparar();

const publico = (arquivo) => () => readFileSync(join(raiz, 'publico', arquivo));
const rotas = criarRotas({ banco, asaas: (chave) => clienteAsaas({ url: urlAsaas, chave }), config });
const porta = Number(env.PORT) || 3000;
criarServidor({ rotas, paginas: { site: publico('site.html'), app: publico('index.html') } }).listen(porta, () => {
  console.log(`CondoFácil no ar na porta ${porta} (Asaas sandbox)`);
});
