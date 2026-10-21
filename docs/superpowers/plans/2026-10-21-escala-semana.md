# Escala da semana Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** grade semanal porteiro × dia (Dia, Noite, Manhã, Tarde, Folga, Férias, Falta e Atestado) no síndico e na portaria.

**Architecture:**
- **Regras puras** em `src/escala/regras.js`: `inicioDaSemana`, `tipoDoTurno`, `celulaEscala` e `semanaDaEscala`.
- **Componente compartilhado** `src/ui/escala-semana.js` (`SemanaEscala`), usado por `escala-sindico.js` e `escala-portaria.js`.

**Tech Stack:** ES modules, Preact + htm, node:test, Chrome headless.

## Global Constraints

- Nomes de topo únicos entre arquivos; imports locais numa linha.
- Sem mudança de dados (o armazenamento continua na versão 7).
- Cores definidas como tokens no `:root` e redefinidas nos dois blocos de tema escuro.
- Commits com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Task 1: regras e casos

- `semanaDaEscala(estado, segunda)` devolve `{ dias, linhas: [{ porteiro, celulas: [[{ tipo, turno?, posto?, trocado? }]] }], descobertos: [[{ posto, inicio, fim }]] }`.
- `semanasComEscala(estado)` devolve as segundas-feiras navegáveis.
- Casos em `src/casos/escala.js`, conforme a spec.
- Commit `feat(escala): montagem da semana por porteiro`.

### Task 2: telas

- Criar `SemanaEscala({ estado, agora, executar, editavel })`, a aba "Semana" (padrão) no síndico e a seção na portaria.
- Acrescentar o CSS `.semana-escala`, `.etq-turno` e `.t-*`.
- Fazer as capturas a 1366 e a 390 px.
- Commit `feat(escala): grade da semana no síndico e na portaria`.

### Task 3: verificar, e2e e publicação

- Checagens e o roteiro `escalaSemana`.
- Rodar `npm test`, `verificar` e `e2e`, publicar no Artifact e perguntar sobre o merge.
