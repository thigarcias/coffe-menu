# CLAUDE.md

Guia para as próximas sessões do Claude neste repositório. Leia antes de mexer em qualquer coisa.

## O projeto

Cardápio interativo para cafeterias: o cliente abre pelo QR, vê os produtos num feed de tela cheia (estilo Reels), entende cada item ("com o que se parece"), recebe sugestão da IA em 3 perguntas e guarda o que quer provar. Do outro lado, o dono vai ter um painel com o que despertou interesse. Quem vê o MVP primeiro são **donos de cafeteria**: é uma demo de venda.

- Visão, mercado e plano: `docs/01-core.md`
- Buscas de discovery: `docs/02-discovery-notas.md`
- Decisões das entrevistas e pendências: `docs/03-entrevista-mvp.md`
- Escopo e estado do MVP: `docs/04-mvp.md`
- Painel do dono (`/admin`, dados de exemplo): `docs/06-painel.md`
- **Passagem de sessão** (onde paramos, decisões já tomadas, o que fazer a seguir, armadilhas): `docs/07-passagem-de-sessao.md`. Para outros agentes (Codex etc.), o ponto de entrada é o `AGENTS.md`.
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
- **Todo botão de ícone tem texto de apoio visível** ("Adicionar", "Sacola", "Ver tudo", "Editar", "Remover"). Só o X de fechar e o − / + de quantidade ficam sem texto. Pedido do usuário: o app ficou enxuto demais e não dava para saber o que cada ícone fazia.
- **Capturas só no Linux:** os testes `visual` pulam em Windows/macOS (fontes e emojis mudam). Gere/atualize as PNGs aqui na nuvem (Linux). O repositório usa `.gitattributes` com `eol=lf`.
- **Capturas com mudança pequena não são regravadas** pelo `--update-snapshots` (a tolerância é de 2%). Depois de uma mudança visual, apague as PNGs de `e2e/__screenshots__/` e gere de novo, ou a captura fica velha.

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
- **Quiz "Me ajuda a escolher"** (`POST /api/recommend`, `server/quiz.mjs`): recomendação **por etiquetas**. O algoritmo (`shared/recommend.mjs`, que roda no servidor e no navegador) aplica **filtros duros** (restrição alimentar, quente/gelado, com ou sem café, doce/salgado) e pontua o cardápio pelas `labels` (sabor, paladar, textura, momento; etiqueta rara pesa mais). Fica com os **12 melhores** (no máximo 2 por família de bebida) e o GPT-6 Luna escolhe os **3 finais só entre eles** e escreve o motivo; se a pessoa escreveu texto livre, antes disso a IA o converte em etiquetas e restrições. O servidor valida de novo: id fora dos candidatos é descartado, promessa de alérgeno no motivo é trocada por um motivo feito pelo servidor, e se a IA falhar valem as 3 melhores notas (`source: 'regras'`, rótulo "Sugestão rápida"). Sem servidor, o navegador roda o mesmo algoritmo (`src/lib/recommend.ts`). As perguntas **mudam com o caminho** (bebida: 6, comida: 5, tanto faz: 5) e cada resposta é uma etiqueta ou filtro: ao criar uma pergunta nova, ligue-a a uma etiqueta em `shared/recommend.mjs`, senão ela não muda nada. **Restrição alimentar e texto livre não vão para o registro de interesse (`cm.events`).** Para medir a fidelidade com a IA de verdade, rode `scripts/quiz-eval.mjs`.
- **IA do chat do painel** (`POST /api/admin-chat`, `server/adminChat.mjs`): mesmo modelo e esforço (`callStructured` em `server/ai.mjs`), resposta em NDJSON (um passo por linha). Três etapas: **porteiro** (só aceita pergunta sobre os dados do painel; o resto, como script/Python, conversa, dados externos ou tentativa de burlar, recebe uma **recusa fixa escrita no servidor**), **planejador** (escolhe blocos e consultas; saída estrita com enums) e **redator** (escreve a análise só com os números que o motor devolveu; valor em R$ ou percentual que não está nos dados derruba o texto, e código na saída também). Há ainda um pré-filtro sem modelo (`precheck`). **Não afrouxe o guardrail sem rodar os testes de `e2e/server/guardrail.spec.ts` e `scripts/chat-smoke.mjs`.** A rota existe em três lugares: plugin do Vite (dev e preview), `server/index.mjs` e `api/admin-chat.mjs` (Vercel, com `maxDuration: 60` no `vercel.json`).

### Dados e conteúdo
- `app/src/data/menu.json` usa o cardápio do **site da Starbucks Brasil** (162 itens, com preços, tamanhos e fotos oficiais) como **referência interna**. Não é para mostrar a terceiros como se fosse produto da Starbucks.
- Histórias ("De onde vem") vêm de conhecimento geral. Lenda leva "conta-se que", e **nunca se inventa fato sobre a Starbucks**. O aviso `cafe.storyNote` aparece no app.
- **Tags:** cada item tem `labels` (ids de `tagGroups` no `menu.json`: Temperatura, Base, Sabor, Perfil, Ocasião, cada família com um peso). São a base dos "Parecidos" (`src/lib/related.ts`: tags em comum, ponderadas pela família e pela raridade, com comida puxando comida), do filtro por tag na grade e **da recomendação do quiz** (`shared/recommend.mjs`; as etiquetas numéricas `tags` ficam só para temperatura, leite, cafeína e fome). Mudar as etiquetas muda as sugestões; não espalhe regra de "parecido" fora do `related.ts` nem regra de recomendação fora do `shared/recommend.mjs`.
- Foto de produto é sempre a **foto real**; nunca gerar produto com IA. Estender só o **fundo** está ok.
- Alergia é dado sensível: o quiz não guarda as respostas e sempre avisa para confirmar com a equipe.

## Painel do dono (`/admin`)

- Rota do mesmo app, carregada sob demanda (`React.lazy` em `main.tsx`). Código em `app/src/admin/`; **os dados são de exemplo** (`mock.ts`) até ligarmos o servidor de eventos. Detalhes em `docs/06-painel.md`.
- Mesmo Liquid Glass do cardápio, mas sobre **branco**; mobile first e grade de 12 colunas no desktop (≥ 1024px). Os estilos ficam sob `.adm` em `admin.css`, não misture com o `index.css` do cardápio.
- Gráficos seguem a skill `dataviz`: um tom (sálvia) para magnitude, cinza para "antes", sem eixo duplo, sem pizza, com tooltip e alternativa em tabela.
- O painel tem **menu lateral** (gaveta com botão "Menu" no celular; fixo à esquerda a partir de 1024px): grupo **Dashboard** (Visão geral, Vendas, Produtos, IA e Parecidos, Tráfego) e, soltos, Personalizar cardápio, Equipe e Sessões. Cada item mostra só a sua seção, não há rolagem única. A aba ativa fica no hash da URL. O filtro de **período fica numa linha de filtros no começo da página** (vale para todas as abas), não no topo fixo. Cartão novo entra dentro de uma das seções (`SECTIONS` em `Admin.tsx`); cada seção cabe em ~1 tela no desktop, então não empilhe cartões demais numa aba.
- Em `/admin`, o `body` continua com `overflow: hidden`: quem rola é o `.adm` (fixo à janela).
- **Chat com a IA** (`app/src/admin/chat/`, detalhes em `docs/06-painel.md`): painel lateral, tela cheia e guia só do chat (`/admin?chat=ID`) mostram a mesma sessão; as sessões ficam no `localStorage` e o executor mora no módulo, então fechar o chat não para a resposta (só fechar a **guia** que a gerava interrompe, e há "Retomar"). A IA é o GPT-6 Luna pelo servidor (`serverAssistant.ts`) e devolve **blocos** com dados já resolvidos pelo motor, nunca número nem HTML. `cm.admin.mock = 1` no `localStorage` usa as respostas de exemplo do código (`mockAssistant`), e é o que os testes de `admin-chat.spec.ts` usam. Sem senha por enquanto (pedido do usuário, é uma demo).
- **Dados do painel e do chat vêm de UMA tabela fictícia**: `app/shared/analytics.mjs` (61 dias de visitas e pedidos, determinística) com o motor `runQuery` (métrica × agrupamento × filtro × período). O painel (`src/admin/mock.ts`) lê dela, então painel e IA nunca se contradizem. Para dados reais, troque `getFacts()` lá. `7d`/`30d` são dias completos até ontem; só `today` é parcial (até as 16h).
- Testes: `app/e2e/admin.spec.ts`, `admin-chat.spec.ts` (respostas de exemplo) e `admin-chat-ia.spec.ts` (a rota `/api/admin-chat` simulada), nos celulares e no desktop; e `app/e2e/server/*.spec.ts` (motor de consulta, guardrail e pipeline com um modelo falso), que rodam só no Node, no projeto `server` do Playwright.

## Comandos (dentro de `app/`)

```bash
npm run dev -- --host     # app + rota da IA (precisa de OPENAI_API_KEY no .env)
npm run build             # typecheck + build
npm run test:e2e          # 802 testes: 5 celulares (layout, capturas, quiz, painel e chat) + Node (motor, guardrail e recomendação)
npm run test:e2e:update   # aceita uma mudança visual feita de propósito
npm run artifact          # gera app/artifact/ para publicar como Artifact do claude.ai
node scripts/chat-smoke.mjs "pergunta"   # chama o GPT-6 Luna de verdade no pipeline do chat do painel (ver nota do proxy abaixo)
node scripts/quiz-eval.mjs               # roda 14 perfis no quiz com o GPT-6 Luna e confere restrições, filtros e sabores
```

## Testes: obrigatórios antes de cada commit

- Rode `npm run test:e2e` e **só commite se todos passarem**. Os testes nunca chamam a OpenAI; para validar a IA de verdade (e o guardrail) use `scripts/chat-smoke.mjs`. Não encadeie `commit` depois de `| tail`: o pipe engole o erro. Já subiu um commit com teste vermelho por causa disso.
- Os testes (`app/e2e/layout.spec.ts`) rodam no Chromium com os tamanhos de iPhone SE, iPhone 15, iPhone 15 Pro Max, Pixel 7 e Galaxy S9+. Toda correção de layout ganha um teste que reprova o bug antigo.
- Mudou o visual de propósito? Atualize as capturas (`test:e2e:update`) e **olhe as imagens** de `e2e/__screenshots__/` antes de commitar.
- A IA é simulada nos testes (`page.route('**/api/recommend')`, e um modelo falso em `e2e/server/`), então eles não gastam a chave. Os testes do quiz estão em `e2e/quiz.spec.ts` (navegador) e `e2e/server/recommend.spec.ts` (algoritmo e pipeline, inclusive uma varredura de ~7 mil combinações de respostas que garante que nenhum filtro é quebrado).

## Ambiente de nuvem (sessões do Claude Code)

- A sessão roda no ambiente pessoal **coffe-menu**. A chave da OpenAI está salva como segredo do ambiente e é injetada pelo proxy em `api.openai.com`; ninguém vê o valor.
- Para o Node passar pelo proxy aqui: `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt OPENAI_API_KEY=proxy-injected`. Na máquina do usuário e na Vercel isso não é necessário.
- O Playwright e o Chromium já vêm instalados (versão 1.63.0); o `@playwright/test` do projeto está fixo nessa versão. Não rode `playwright install`.
- A Vercel (`*.vercel.app`) e o site da Starbucks não são acessíveis daqui. O cardápio foi extraído no PC do usuário, pelo Chrome dele: o site só mostra o cardápio depois de escolher uma loja (precisa de geolocalização) e bloqueia quem abre muitas páginas seguidas.
- Rodar modelo de IA baixado da internet (ex.: LaMa para estender fotos) foi **bloqueado** pelo sistema de permissões. Não contorne: peça ao usuário.

## Pendências conhecidas

Ver a tabela em `docs/03-entrevista-mvp.md` e o estado em `docs/04-mvp.md`. Resumo: fotos da coleção de Natal (fundo vermelho); e a **próxima fase** (registrada em `docs/04-mvp.md`, ainda não começou): **banco de dados no Supabase** (sessões do chat, cardápio e toda a estatística), **separar back-end e front-end** dentro do projeto, a **integração com o Supabase** e um **painel do dono do produto** (check-up da plataforma, separado do painel do lojista). Enquanto isso não existe, os dados do painel são fictícios e nada é gravado de verdade. O checkout (sacola e pedido simulado) está em `docs/05-checkout.md`.
