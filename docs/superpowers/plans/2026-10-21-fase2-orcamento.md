# Previsão orçamentária Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** aba Orçamento com simulador de taxa, previsões salvas, comparação e documento para a AGO.

**Architecture:**
- `linhasDoOrcado` fica em `cobranca/dados.js`, para servir à semente.
- As regras ficam em `cobranca/orcamento.js`, depois de `composicao.js`, e as ações em `cobranca/acoes-orcamento.js`.
- A tela fica em `ui/orcamento.js` e reaproveita `FormReajuste` e `TabelaSimulacao` de `ui/composicao.js`.

**Tech Stack:** ES modules, Preact + htm, node:test, Chrome headless.

## Global Constraints

- Nomes de topo únicos; imports locais numa linha.
- Dinheiro em centavos; armazenamento na versão 9.
- Commits com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Task 1: regras, ações, semente e casos

- Escrever `linhasDoOrcado` e a semente em `financeiroInicial`.
- Criar `orcamento.js`, `acoes-orcamento.js` e `casos/orcamento.js`, e acrescentar `simuladorTaxa` em `planos.js`.
- Atualizar a versão para 9 e a ORDEM.
- Commit.

### Task 2: tela

- Criar `ui/orcamento.js`, registrar a aba em `financeiro-sindico.js` e dar a `FormReajuste` a prop `inicial`.
- Tirar as capturas e fazer o commit.

### Task 3: verificar, e2e e publicação

- Escrever as checagens e o roteiro `orcamentoPrevisao`.
- Rodar a suíte completa, publicar e perguntar sobre o merge.
