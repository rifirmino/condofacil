# Publicação do CondoFácil conectado ao Asaas sandbox

O resultado é `https://app.condofacil.cloud` com o protótipo conectado ao Asaas sandbox (dinheiro de mentira). O link do claude.ai continua sendo a demonstração simulada.

## 1. Conta no Asaas sandbox

1. Acesse **sandbox.asaas.com** e crie a conta com o e-mail **comercial@condofacil.cloud**. O sandbox é separado da conta de produção.
2. No menu do usuário, abra **Integrações → Chave da API** e gere a chave. Ela começa com `$aact_` e só aparece uma vez.
3. Guarde a chave num lugar seguro. Ela vai **só** no painel da Hostinger (passo 3): não mande por chat nem por e-mail.

## 2. Banco MySQL na Hostinger

1. No hPanel, abra **Bancos de dados → Gerenciamento** e crie um banco (por exemplo `condofacil`), com usuário e senha.
2. Anote quatro dados: o host (normalmente `localhost`), o nome do banco, o usuário e a senha.

## 3. App Node.js no subdomínio

1. No hPanel, abra **Sites → Adicionar site → App Node.js** (o nome do menu pode variar um pouco).
2. Escolha o domínio **app.condofacil.cloud**. O hPanel cria o subdomínio e o certificado SSL.
3. Ligue ao GitHub com o repositório `rifirmino/condofacil`, branch `master`.
4. Pasta da aplicação: `servidor`. Versão do Node: **22** ou mais nova. Comando de instalação: `npm install`. Comando de início: `npm start`. Arquivo de entrada: `index.mjs`.
5. Variáveis de ambiente:

| Variável | Valor |
|---|---|
| `ASAAS_API_KEY` | a chave do sandbox (passo 1) |
| `ASAAS_URL` | `https://api-sandbox.asaas.com/v3` |
| `ASAAS_WEBHOOK_TOKEN` | gerado pelo Claude na hora da publicação |
| `CHAVE_CRIPTO` | gerado pelo Claude na hora da publicação |
| `CODIGO_PILOTO` | um código que você escolhe, com pelo menos 6 caracteres; é o que o app pede para conectar |
| `URL_PUBLICA` | `https://app.condofacil.cloud` |
| `MYSQL_HOST`, `MYSQL_BANCO`, `MYSQL_USUARIO`, `MYSQL_SENHA` | os dados do passo 2 |

Os dois valores gerados saem deste comando, rodado uma vez para cada variável:
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

**Atenção:** não troque a `CHAVE_CRIPTO` depois que houver subcontas criadas. Sem ela, as chaves guardadas não podem mais ser lidas.

## 4. Conferência

1. Abra `https://app.condofacil.cloud/api/saude`. A resposta deve ser `{"ok":true,"ambiente":"sandbox"}`.
2. Abra `https://app.condofacil.cloud`, digite o código do piloto e confira o selo **Asaas sandbox conectado**.
3. Faça o ciclo completo:
   1. Crie o condomínio em **+ Novo condomínio**, com o CPF do responsável na planilha e o CNPJ, o número e o bairro no passo Conta Asaas.
   2. Emita as cobranças em Cobrança.
   3. Como morador, entre pelo convite.
   4. Em Financeiro, abra o Pix e clique em **Simular pagamento no sandbox**.
   5. Em alguns segundos, a cobrança aparece paga.
4. No painel do sandbox (sandbox.asaas.com), a subconta e a cobrança aparecem lá também.

## Quando algo dá errado

- **"Código do piloto inválido":** o código digitado é diferente do `CODIGO_PILOTO`.
- **"Não foi possível falar com o Asaas agora":** confira a `ASAAS_API_KEY` e a `ASAAS_URL`.
- **O pagamento não dá baixa:** o webhook não chega.
  - Confira a `URL_PUBLICA` e o `ASAAS_WEBHOOK_TOKEN`.
  - No sandbox, abra **Integrações → Webhooks** da subconta e veja se há envios com erro.
- **O app não pede o código:** a página não está em `app.condofacil.cloud`, ou `/api/saude` não responde.
- **Página antiga depois de uma mudança:** rode `npm run montar` em `prototipo/`, faça o commit e envie. A Hostinger publica o `servidor/publico/index.html` novo.
- **O servidor não sobe:** os logs do app no hPanel mostram `Variável <NOME> ausente ou inválida`, apontando qual variável corrigir.

## Antes de publicar (opcional, no seu computador)

Para rodar o ciclo direto no sandbox real, sem o app:
```
cd servidor
set ASAAS_API_KEY=$aact_...     (no PowerShell: $env:ASAAS_API_KEY="$aact_...")
npm run sandbox
```
