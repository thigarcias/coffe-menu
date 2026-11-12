# CLAUDE.md

Guia para as próximas sessões do Claude neste repositório. Leia antes de mexer em qualquer coisa.

## O projeto

Cardápio interativo para cafeterias: o cliente abre pelo QR, vê os produtos num feed de tela cheia (estilo Reels), entende cada item ("com o que se parece"), recebe sugestão da IA em 3 perguntas e guarda o que quer provar. Do outro lado, o dono vai ter um painel com o que despertou interesse. Quem vê o MVP primeiro são **donos de cafeteria**: é uma demo de venda.

- Visão, mercado e plano: `docs/01-core.md`
- Buscas de discovery: `docs/02-discovery-notas.md`
- Decisões das entrevistas e pendências: `docs/03-entrevista-mvp.md`
- Escopo e estado do MVP: `docs/04-mvp.md`
- Código: `app/` (React + Vite + TypeScript). Deploy na Vercel (raiz do projeto: `app/`).

## Como trabalhar com o usuário

- **Português do Brasil** em tudo: conversa, textos do app, commits e documentação.
- **Commits vão direto na `main`** (pedido do usuário). Mantenha a branch `claude/…` da sessão em sincronia: `git push origin HEAD:main HEAD:<branch-da-sessao>`.
- O usuário valida **pelo celular**, no deploy da Vercel. Depois de subir, avise que a Vercel precisa terminar o deploy. Se um print vier com coisa antiga, primeiro desconfie de deploy pendente ou cache.
- **Não aprove o próprio visual.** Olhe o print com olho crítico antes de dizer que ficou bom. Já aconteceu de eu chamar de "bem melhor" algo que o usuário achou horrível.
- Quando ele pedir um efeito que CSS não entrega (ex.: "preenchimento generativo do Photoshop"), diga isso cedo e ofereça os caminhos reais, em vez de entregar uma aproximação como se fosse a coisa pedida.
- Pode usar subagentes com o modelo **Sonnet** para tarefas pesadas e mecânicas (extrair dados, preencher conteúdo), para economizar.

## Regras do app

### Mobile first
- O alvo é celular, de **320px a 430px** de largura. Tudo precisa caber em 320px.
- O `.app` fica **preso à janela** (`position: fixed; inset: 0`) e com `overflow: clip`. Isso evita a faixa vazia sob a barra do Safari no iPhone e impede o app de rolar para o lado. Não troque por `100dvh`/`100vh`.
- O slide do feed é uma **grade**: `[espaço do topo][foto 1fr][texto auto][espaço do dock]`. A foto ocupa só o espaço livre e nunca invade o texto. Use `subgrid`, não porcentagens fixas.
- Alvos de toque com pelo menos 44px.

### Design
- **Soft de cafeteria gourmet + Liquid Glass claro.** Os tokens ficam no `:root` de `app/src/index.css`: leite de aveia (`--bg`), espresso (`--ink`), sálvia (`--sage`), névoa de matcha (`--matcha`), rosa-chá (`--blush`), caramelo (`--caramel`). Use os tokens; não espalhe cores soltas.
- O vidro (`.glass`) fica **só na camada de controles** (categorias, dock, painéis), nunca no conteúdo. O reflexo (`::before`) fica **atrás** do texto (`isolation: isolate` + `z-index: -1`).
- O fundo de cada produto é a **versão pastel da própria foto** (a foto desfocada com `opacity` sobre `--bg`).
- Títulos com fonte arredondada (`--font-display`: SF Rounded no iPhone, Nunito nos demais). Texto com a fonte do sistema.
- Categorias no topo são **gerais** (Novidades, Cafés, Gelados, Bebidas, Salgados, Doces). A subcategoria original do cardápio (`item.subcategory`) é só o rótulo do produto.
- Minimalista e "encaixadinho": nada de botão solto pela tela; as ações ficam no dock ou na linha do produto.

### IA
- Toda IA usa **`gpt-6-luna` com `reasoning.effort: "high"`** pela Responses API. Os dois estão **fixos no código** (`app/server/ai.mjs`), por pedido do usuário. No `max` as respostas levavam de 9 a 19 s; no `high`, de 4 a 5 s.
- A chave **nunca vai para o navegador.** O React chama `POST /api/recommend` e só o servidor fala com a OpenAI. A única variável de ambiente é **`OPENAI_API_KEY`**.
- A rota existe em três lugares, todos usando `handleRecommend` de `server/ai.mjs`: o plugin no `vite.config.ts` (dev), `api/recommend.mjs` (Vercel) e `server/index.mjs` (Node próprio).
- A saída é JSON estruturado (até 3 ids, cada um com um motivo), e ids que não existem no cardápio são descartados. Se a IA falhar ou não houver servidor, o quiz cai nas **regras** de `src/lib/recommend.ts` e mostra "Sugestão rápida".

### Dados e conteúdo
- `app/src/data/menu.json` usa o cardápio do **site da Starbucks Brasil** (162 itens, com preços, tamanhos e fotos oficiais) como **referência interna**. Não é para mostrar a terceiros como se fosse produto da Starbucks.
- Histórias ("De onde vem") vêm de conhecimento geral. Lenda leva "conta-se que", e **nunca se inventa fato sobre a Starbucks**. O aviso `cafe.storyNote` aparece no app.
- Foto de produto é sempre a **foto real**; nunca gerar produto com IA. Estender só o **fundo** está ok.
- Alergia é dado sensível: o quiz não guarda as respostas e sempre avisa para confirmar com a equipe.

## Comandos (dentro de `app/`)

```bash
npm run dev -- --host     # app + rota da IA (precisa de OPENAI_API_KEY no .env)
npm run build             # typecheck + build
npm run test:e2e          # 125 testes em 5 celulares (layout + capturas)
npm run test:e2e:update   # aceita uma mudança visual feita de propósito
npm run artifact          # gera app/artifact/ para publicar como Artifact do claude.ai
```

## Testes: obrigatórios antes de cada commit

- Rode `npm run test:e2e` e **só commite se todos passarem**. Não encadeie `commit` depois de `| tail`: o pipe engole o erro. Já subiu um commit com teste vermelho por causa disso.
- Os testes (`app/e2e/layout.spec.ts`) rodam no Chromium com os tamanhos de iPhone SE, iPhone 15, iPhone 15 Pro Max, Pixel 7 e Galaxy S9+. Toda correção de layout ganha um teste que reprova o bug antigo.
- Mudou o visual de propósito? Atualize as capturas (`test:e2e:update`) e **olhe as imagens** de `e2e/__screenshots__/` antes de commitar.
- A IA é simulada nos testes (`page.route('**/api/recommend')`), então eles não gastam a chave.

## Ambiente de nuvem (sessões do Claude Code)

- A sessão roda no ambiente pessoal **coffe-menu**. A chave da OpenAI está salva como segredo do ambiente e é injetada pelo proxy em `api.openai.com`; ninguém vê o valor.
- Para o Node passar pelo proxy aqui: `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt OPENAI_API_KEY=proxy-injected`. Na máquina do usuário e na Vercel isso não é necessário.
- O Playwright e o Chromium já vêm instalados (versão 1.63.0); o `@playwright/test` do projeto está fixo nessa versão. Não rode `playwright install`.
- A Vercel (`*.vercel.app`) e o site da Starbucks não são acessíveis daqui. O cardápio foi extraído no PC do usuário, pelo Chrome dele: o site só mostra o cardápio depois de escolher uma loja (precisa de geolocalização) e bloqueia quem abre muitas páginas seguidas.
- Rodar modelo de IA baixado da internet (ex.: LaMa para estender fotos) foi **bloqueado** pelo sistema de permissões. Não contorne: peça ao usuário.

## Pendências conhecidas

Ver a tabela em `docs/03-entrevista-mvp.md` e o estado em `docs/04-mvp.md`. Resumo: carrinho/checkout, fotos da coleção de Natal (fundo vermelho) e o painel do dono.
