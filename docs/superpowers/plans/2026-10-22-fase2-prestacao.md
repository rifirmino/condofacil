# Prestação de contas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** menu Financeiro com contas a pagar, prestação de contas com o ciclo do conselho, fluxo de caixa de 90 dias e o resumo para os moradores.

**Architecture:**
- **Regras puras:** `src/financeiro/contas.js`, `balancete.js` e `fluxo.js`.
- **Ações:** `src/financeiro/acoes.js`, que vem depois de `cobranca/acoes-orcamento.js` e de `manutencao/acoes.js` na ORDEM.
- **Telas:** `ui/financeiro.js` (síndico), `ui/conselho.js` (perfil novo) e o resumo em `ui/morador.js`.
- **Semente:** fica em `financeiroInicial` (contas e balancetes) e num invólucro, `comPrestacaoInicial`, que renomeia o d5 e cria o documento do resumo de agosto.

**Tech Stack:** ES modules, Preact + htm, node:test, Chrome headless.

## Global Constraints

- Nomes de topo únicos; imports locais numa linha.
- Dinheiro em centavos; armazenamento na versão 10.
- Fornecedores fictícios ou genéricos.
- Gráfico pelas regras da skill dataviz: uma série, sem legenda, camada de hover, tabela equivalente e cores em tokens com tema escuro.
- Commits com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Task 1: contas a pagar

- Semente, `contas.js`, as ações `novaConta` e `pagarConta`, os casos e o menu Financeiro com as abas Contas e Auditoria.
- Alertas no Início.
- Commit.

### Task 2: prestação de contas e conselho

- Semente dos balancetes e `balancete.js`.
- As ações de fechamento, do conselho, de ajuste e de resumo, com os casos.
- A aba Prestação, o perfil Conselho e o resumo do morador.
- Commit.

### Task 3: fluxo de caixa

- `fluxo.js` com os casos e a aba Fluxo com o gráfico.
- Commit.

### Task 4: verificar, e2e e publicação

- Checagens, os roteiros `contaPagar`, `prestacaoConselho` e `fluxoCaixa`, e a largura de celular.
- Publicar e perguntar sobre o merge.
