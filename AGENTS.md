# AGENTS.md

Instruções para agentes de código (Codex e outros). O projeto é um cardápio interativo para cafeterias (React + Vite + TypeScript, em `app/`, deploy na Vercel).

**Leia nesta ordem antes de mexer em qualquer coisa:**

1. [`CLAUDE.md`](./CLAUDE.md): regras do projeto, do app, da IA e dos testes. **Vale para qualquer agente**, não só para o Claude.
2. [`docs/07-passagem-de-sessao.md`](./docs/07-passagem-de-sessao.md): onde o trabalho parou, decisões já tomadas e o que fazer a seguir.
3. [`docs/04-mvp.md`](./docs/04-mvp.md): escopo do MVP e a próxima fase (Supabase, back-end separado do front-end, painel do dono do produto).

## O essencial

- **Português do Brasil** em tudo: conversa, textos do app, commits e documentação.
- **Commits vão direto na `main`**. Ignore a branch `claude/…` (era da sessão do Claude).
- **Rode `cd app && npm run test:e2e` e só commite se todos os testes passarem.** Eles não chamam a OpenAI.
- Mobile first (320px a 430px), alvos de toque de 44px, botão de ícone com texto de apoio.
- Toda IA usa `gpt-6-luna` com `reasoning.effort: "high"` (fixos em `app/server/openai.mjs`). A chave `OPENAI_API_KEY` **nunca** vai ao navegador.
- **Não afrouxe o guardrail do chat** (`app/server/adminChat.mjs`) sem rodar `e2e/server/guardrail.spec.ts`.
- Depois de uma mudança visual, apague as capturas afetadas em `app/e2e/__screenshots__/`, gere de novo e **olhe as imagens**. Não aprove o próprio visual sem olhar.
- Depois de publicar, avise que a Vercel precisa terminar o deploy: o usuário valida pelo celular.
