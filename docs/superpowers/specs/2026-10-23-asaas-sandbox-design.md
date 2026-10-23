# Integração real com o Asaas sandbox (design)

O objetivo é rodar o ciclo de cobrança de verdade no sandbox do Asaas (dinheiro de mentira):
1. a implantação cria a subconta do condomínio;
2. a emissão gera boleto e Pix reais;
3. o morador paga;
4. o webhook dá a baixa no app.

O protótipo do claude.ai continua simulado, como está hoje.

## Decisões

- **Caminho escolhido:** o mesmo protótipo ganha um "modo conectado". Não é o app inteiro no servidor, nem um servidor sem banco.
- **Fora do escopo:**
  - split;
  - produção;
  - cancelamento e segunda via reais;
  - acordos parcelados reais;
  - cartão.
- **O que continua simulado no app:** a régua de cobrança, os acordos e todo o resto (reservas, encomendas etc.).
- **Exigência do Asaas:** o CPF ou CNPJ de quem recebe a cobrança. A planilha de moradores ganha a coluna `cpf`.

## Onde roda

- **Endereço:** um único app Node.js 22 na hospedagem Business da Hostinger, em `https://app.condofacil.cloud`.
  - `GET /` entrega `condofacil.html`, o mesmo arquivo do protótipo.
  - `/api/...` responde à API.
  - Como é o mesmo endereço, não há CORS.
- **Código:** a pasta `servidor/` no repositório `rifirmino/condofacil`. A Hostinger publica a partir do GitHub (pasta `servidor`, branch `master`).
- **Dependências:** só o Node e `mysql2`.
- **Arquivos:**
  - `servidor/index.mjs`: sobe o HTTP e as rotas;
  - `servidor/asaas.mjs`: o cliente da API v3, com URL base configurável;
  - `servidor/banco.mjs`: a interface de dados, com uma implementação MySQL e outra em memória;
  - `servidor/cifra.mjs`: AES-256-GCM;
  - `servidor/rotas.mjs`: os handlers, que são funções puras de `(pedido, dependências)` e podem ser testadas sem rede;
  - `servidor/testes/`.

## Segredos (variáveis de ambiente no hPanel, nunca no repositório nem no chat)

| Variável | Uso |
|---|---|
| `ASAAS_API_KEY` | chave da conta raiz do sandbox, colada pelo Ricardo |
| `ASAAS_URL` | `https://api-sandbox.asaas.com/v3` (nos testes aponta para o Asaas falso) |
| `ASAAS_WEBHOOK_TOKEN` | senha enviada pelo Asaas no cabeçalho `asaas-access-token`; webhook sem ela recebe 401 |
| `CHAVE_CRIPTO` | 32 bytes em base64; cifra a `apiKey` de cada subconta no banco |
| `CODIGO_PILOTO` | código de acesso do piloto, enviado pelo app no cabeçalho `x-codigo-piloto` |
| `MYSQL_HOST`, `MYSQL_USUARIO`, `MYSQL_SENHA`, `MYSQL_BANCO` | banco da Hostinger |

- **Ambiente:** o servidor só sobe se `ASAAS_URL` apontar para o sandbox ou para um endereço local. Produção fica bloqueada até uma nova decisão.
- **Acesso:** toda rota `/api` exige `x-codigo-piloto` correto, exceto `GET /api/saude` e o webhook.
- **Limite:** 60 chamadas por minuto por IP; acima disso a resposta é 429.
- **Registros de log:** não guardam CPF, chaves nem o payload completo do Asaas.

## Banco (as tabelas são criadas sozinhas na primeira vez que o servidor sobe)

- **condominios:**
  - `id` (o mesmo do app) e `nome`;
  - `cnpj`, `wallet_id` e `api_key_cifrada`;
  - `situacao` e `criado_em`.
- **clientes:** `condominio_id`, `unidade`, `cpf`, `asaas_id`. A chave única é (condomínio, unidade, cpf).
- **cobrancas:**
  - `referencia` (única, `<condominio>:<competencia>:<unidade>`);
  - `condominio_id`, `competencia`, `unidade` e `asaas_id`;
  - `valor` (centavos), `vencimento` e `situacao` (`pendente`, `paga`, `vencida`);
  - `pago_em`, `forma`;
  - `fatura_url`, `boleto_url`, `pix_copia_cola`, `pix_imagem`.
- **eventos:** `id` (o id do evento do Asaas, único), `tipo`, `asaas_pagamento`, `recebido_em`. Um evento repetido é ignorado.

## API

| Rota | O que faz |
|---|---|
| `GET /api/saude` | `{ ok: true, ambiente: 'sandbox' }`; o app usa para detectar o modo conectado |
| `POST /api/condominios` | cria a subconta (`POST /accounts`) com os dados da implantação, guarda a `apiKey` cifrada e o `walletId`, e cadastra o webhook da subconta (`POST /webhooks` com a chave dela, eventos `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED` e `PAYMENT_OVERDUE`, mais o `authToken`); devolve `{ walletId, situacao }`; se o condomínio já existe, devolve o que está guardado |
| `POST /api/emissoes` | recebe `{ condominio, competencia, linhas: [{ unidade, responsavel: { nome, cpf, email, celular }, valor, vencimento, descricao, multaPct, jurosPct }] }`; por linha, reaproveita ou cria o cliente (`notificationDisabled: true`), cria a cobrança (`billingType: UNDEFINED`, `externalReference` = referência) se ela ainda não existir, e busca o Pix (`GET /payments/{id}/pixQrCode`); devolve `{ resultados: [{ unidade, ok, erro?, cobranca? }] }` |
| `GET /api/cobrancas?condominio=&competencia=` | situação atual das cobranças guardadas |
| `POST /api/webhook/asaas` | confere o token, ignora eventos repetidos, atualiza a cobrança pela `externalReference` e responde 200 rápido |

- **Erros:**
  - se o Asaas falhar ou demorar mais de 10 s, a rota devolve 502 com `"Não foi possível falar com o Asaas agora. Nada foi emitido; tente de novo"`;
  - na emissão, as falhas são por linha: as linhas que deram certo valem.
- **Pagamento no sandbox:** a forma de simular o pagamento (fatura de teste ou painel do sandbox) é confirmada na implementação e documentada no passo a passo.

## App (modo conectado)

- **Detecção:** o app chama `GET /api/saude` no mesmo endereço.
  - Se a resposta for ok, ele pede o código do piloto uma vez, guarda em `localStorage` e passa a usar o servidor.
  - No claude.ai a chamada falha e tudo continua simulado. Um teste garante isso.
  - A barra mostra "Asaas sandbox conectado" quando o modo está ativo.
- **Módulo novo `src/conectado/`:**
  - um cliente da API com `fetch` e tempo limite;
  - ações que convertem as respostas do servidor nas ações puras que já existem (`emitirCompetencia` com os dados reais, `confirmarPagamentoAsaas` na baixa).
- **Implantação, passo Conta Asaas:**
  - no modo conectado, "Criar subconta" chama o servidor;
  - o botão "Simular aprovação" some e a tela mostra a situação real.
- **Planilha de moradores:**
  - nova coluna opcional `cpf`, com validação dos dígitos;
  - o CPF também pode ser editado depois, na unidade.
- **Prévia da emissão:**
  - no modo conectado, o responsável sem CPF aparece como "Sem CPF: não será emitida";
  - depois da emissão, o app lista as unidades que falharam, com o motivo, e oferece "Reenviar as que falharam".
- **Morador, tela Financeiro:**
  - Pix com o QR (`pix_imagem`) e o copia e cola reais;
  - "Boleto" e "Abrir fatura" abrem os links do Asaas.
- **Baixa:** o app consulta `GET /api/cobrancas` ao abrir Cobrança ou Financeiro, e a cada 15 s enquanto a tela está aberta. A cobrança que voltar paga recebe `confirmarPagamentoAsaas`, com o id do evento, para não dar baixa duas vezes.

## Testes

- **Servidor (`node:test`):**
  - os handlers testados com o Asaas falso e o banco em memória;
  - subconta criada uma vez só;
  - emissão sem duplicar e com falha parcial;
  - webhook sem token (401) e evento repetido;
  - cifra com ida e volta;
  - código do piloto e limite por minuto.
- **Asaas falso (`servidor/testes/asaas-falso.mjs`):** um HTTP local com `/accounts`, `/webhooks`, `/customers`, `/payments` e `/payments/{id}/pixQrCode`. Ele também dispara webhooks para o servidor quando o teste pede.
- **App:**
  - casos novos para o CPF na planilha e a prévia "Sem CPF";
  - a conversão das respostas do servidor no estado.
- **e2e, roteiro `asaasConectado`:**
  - sobe o servidor local com o Asaas falso e abre o app nele;
  - percorre a implantação conectada, a emissão e o Pix na tela do morador;
  - dispara o webhook e confere a baixa automática.
- **`npm run sandbox`:** um script manual que roda o mesmo ciclo contra o sandbox real, com a chave numa variável de ambiente do computador do Ricardo.

## Publicação

1. Ricardo cria a conta em sandbox.asaas.com (com comercial@condofacil.cloud) e gera a chave da API.
2. No hPanel:
   - cria o banco MySQL;
   - adiciona o app Node.js no subdomínio `app.condofacil.cloud`, ligado ao GitHub (pasta `servidor`, Node 22);
   - cola as variáveis. Os valores gerados (token do webhook, chave de cifra) são passados por Claude; a chave do Asaas e o código do piloto são do Ricardo.
3. O SSL é ativado pelo hPanel. O primeiro start cria as tabelas.
4. Para conferir: `GET https://app.condofacil.cloud/api/saude` e depois o ciclo completo pelo app.

## Próximos passos depois desta entrega

1. **Site em condofacil.cloud:** a página de vendas do Ricardo, com o WhatsApp 5511925913118 e o comercial@condofacil.cloud.
2. **Roteiro de entrevistas:** atualizado com a implantação e o ciclo real.
