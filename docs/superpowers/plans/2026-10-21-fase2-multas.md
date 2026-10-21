# Multas com direito de defesa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** processo de infração (advertência ou multa), com defesa do morador, decisão do síndico e multa lançada no próximo boleto.

**Architecture:** regras puras em `src/infracoes/regras.js` e ações em `src/infracoes/acoes.js`. As ações vêm depois de `src/acoes.js` e de `src/cobranca/composicao.js` na ORDEM. As telas ficam em `src/ui/infracoes.js` e são ligadas em `sindico.js` e `morador.js`. A semente é criada pela própria ação, como no acordo AC-001.

**Tech Stack:** ES modules, Preact + htm, node:test, Chrome headless.

## Global Constraints

- Nomes de topo únicos; imports locais numa linha; `export` só no topo.
- Ações devolvem `{ estado, notificacao?, erro?, id? }`; o armazenamento passa para a versão 8.
- O infrator nunca vê o texto original da notificação nem o nome de quem a abriu.
- Commits com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Task 1: regras, ações, semente e casos

- Criar `src/infracoes/regras.js`, `src/infracoes/acoes.js` e `src/casos/infracoes.js` (os casos da spec).
- Remover `gerarAdvertencia` e trocar `advertencia: null` por `processos: []` em `dados.js` e `acoes.js`.
- Ajustar o caso antigo de advertência para usar `abrirProcesso`.
- Fazer a semente (OC-0041 e PI-001), levar a versão para 8 nos casos e no armazenamento e incluir `multasDefesa` em `planos.js`.
- `npm test`; commit `feat(multas): processo de infração com defesa, decisão e lançamento`.

### Task 2: telas

- Criar `src/ui/infracoes.js`, com os componentes `CartaoProcessoOcorrencia`, `BlocoProcessos`, `SDetalheInfracao`, `MBlocoInfracoes`, `MDetalheInfracao` e `CartaoInfracaoInicio`.
- Fazer o roteamento por `PI-` em `SOcorrencias` e `MOcorrencias` e incluir os alertas no Início.
- Fazer as capturas; commit `feat(multas): telas do síndico e do morador`.

### Task 3: verificar, e2e e publicação

- Checagens e roteiros (`advertencia` refeito e `multaDefesa`); rodar `npm test`, `verificar` e `e2e`; commit.
- Publicar no Artifact e perguntar sobre o merge.
