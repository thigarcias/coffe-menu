# Passagem de sessão

14/11/2026 · para quem continuar o trabalho (outro agente ou outra sessão). Leia o `CLAUDE.md` primeiro: ele tem as regras do projeto. Este arquivo conta **onde estamos, o que já foi decidido e o que fazer a seguir**.

## Em uma frase

Cardápio interativo para cafeterias (demo de venda para donos), com feed estilo Reels, quiz de recomendação por etiquetas com IA, sacola e pedido simulados, e um painel do lojista (`/admin`) com um chat de IA que monta gráficos sob pedido. **O cardápio da cafeteria já está no Supabase** (rascunhos, publicação, disponibilidade e estoque, fotos privadas) e o `/admin` exige login. **Os números do painel ainda vêm de uma tabela fictícia** e as sessões do chat e os eventos ficam no navegador.

- Produção para validar: `coffe-menu-app.vercel.app` (o usuário valida **pelo celular**; depois de subir, avise que a Vercel precisa terminar o deploy).
- Repositório: `thigarcias/coffe-menu`, código em `app/` (React + Vite + TypeScript). Commits vão **direto na `main`**.
- Estado dos testes: **886 passando** (`cd app && npm run test:e2e`) e `npm run test:menu-db` (migrações no PGlite). A última coisa publicada foi o editor de cardápio com estoque e Preencher com IA (14/11/2026).

## Atualização de 14/11/2026 (o que mudou desde a primeira passagem)

- **Login do `/admin`** (Supabase Auth via proxy do servidor; o navegador não recebe chave) e área **Equipe** (demonstração, nada persiste). Login por senha com limite de 10 tentativas / 5 min por IP.
- **Menu lateral** no painel (gaveta no celular, fixo no desktop): Dashboard (5 seções de dados) + Personalizar cardápio, Equipe e Sessões. Substituiu as abas do topo.
- **Editor de cardápio** simplificado (barra única, produtos por categoria recolhíveis, resto recolhido), **foto no topo do produto**, **Preencher com IA** (GPT-6 Luna, `mode: "fill"` em `/api/menu-suggest`), **etiquetas próprias** (família "Minhas etiquetas") e **estoque** por produto (`product_availability.quantity`, RPC `set_product_stock`; 0 = esgotado; o público não vê a quantidade).
- **Supabase de produção:** projeto `catalogo`, compartilhado com outros apps do usuário (não mexer nas tabelas que não são do cardápio). Migrações em `app/supabase/migrations/` (personalização, estoque, mídia de referência). Algumas foram aplicadas pelo conector Supabase do Claude: **mantenha o arquivo do repositório igual ao que foi aplicado**.
- **Cardápio de referência publicado** em `cafeteria-mock` (162 produtos da Starbucks, estoque 20 cada, só para teste): abre em `/?unidade=cafeteria-mock`. É uma referência interna, não é para mostrar a terceiros como produto da Starbucks. Para publicá-lo foi preciso liberar as fotos e vídeos da biblioteca de referência (`menu/*`, `video/*`) na validação de publicação.
- **Quebra de linha:** `.gitattributes` com `eol=lf`. **Capturas visuais** só comparam no Linux (`quiz.png` foi regerado lá).
- **Disponibilidade:** cada produto tem miniatura e há filtros (busca, situação incluindo "Perto de acabar" com limite ajustável, categoria, ordem por estoque). Testes em `e2e/menu-editor-v2.spec.ts`.
- **Testes por escopo:** mudança isolada numa tela roda só os specs dela; código compartilhado roda a suíte completa (regra no `CLAUDE.md`).
- **Pendências desta rodada:** testar o "Preencher com IA" com o modelo de verdade (os testes simulam); o estoque não desconta com pedidos (checkout simulado); limite de uso do chat por conta.

## Atualização de 14/11/2026 (tarde): personalizar o painel

- **Feito:** o Dashboard virou lista de cartões e o dono personaliza cada seção (esconder, reordenar, desfazer, voltar ao padrão) à mão ou pedindo à IA. Detalhes, arquivos e testes em `docs/06-painel.md`, seção "Personalizar o painel".
- **A migração `20261114220000_coffe_menu_dashboard_layout.sql` está no repositório e testada no PGlite, mas NÃO foi aplicada no `catalogo`.** Aplicar (conector Supabase) e **manter o arquivo igual ao que foi aplicado**. Sem ela o painel funciona no padrão e o botão Personalizar não aparece.
- **Falta:** agrupamentos (regra viva), fixar bloco do chat e escolher cafeteria com mais de uma conta.
- Decisões do usuário nesta rodada: padrão **editável no lugar** (com "voltar ao padrão"), painel **da cafeteria e compartilhado com a equipe**, salvo no **servidor** (Supabase `catalogo`), novas categorias como **agrupamentos para análise** (não mexem no cardápio do cliente), IA **monta com peças prontas** (nunca código).

## O que existe

| Área | O que é | Onde |
| --- | --- | --- |
| Cardápio do cliente | Feed em tela cheia, categorias, grade "Ver tudo", detalhe, "Parecidos", sacola, personalização e pedido simulado | `app/src/` (`docs/04-mvp.md`, `docs/05-checkout.md`) |
| Vídeo no feed (mockup) | Os itens 2 a 6 do feed tocam um clipe vertical em tela cheia (clipes genéricos da Pexels, **não** são o produto). Foto e vídeo usam o mesmo estilo: texto menor, colado no dock, faixa branca curta | `video` em `menu.json`, `app/public/video/`, `ProductImage.tsx`, `scripts/fetch-videos.mjs` |
| Quiz "Me ajuda a escolher" | 5 a 6 perguntas que mudam com o caminho (bebida, comida, tanto faz). Algoritmo por etiquetas + GPT-6 Luna escolhendo os 3 finais entre os 12 melhores | `app/shared/recommend.mjs`, `app/server/quiz.mjs`, `app/src/components/Quiz.tsx` |
| Painel do lojista | `/admin`, com menu lateral (Dashboard: Visão geral, Vendas, Produtos, IA e Parecidos, Tráfego; e Personalizar cardápio, Equipe, Sessões), Liquid Glass sobre branco, mobile first e desktop | `app/src/admin/`, `docs/06-painel.md` |
| Chat com a IA no painel | Painel lateral, tela cheia e guia só do chat (`/admin?chat=ID`), com sessões e histórico. IA em 3 etapas com **guardrail** (só responde sobre os dados do painel) | `app/src/admin/chat/`, `app/server/adminChat.mjs` |
| Dados do painel e do chat | **Uma única tabela fictícia** (61 dias) e um motor de consulta. O painel e a IA leem dela, então nunca se contradizem | `app/shared/analytics.mjs` |

Rotas de servidor, cada uma em **três** lugares (plugin do Vite, `server/index.mjs` e função da Vercel em `app/api/`): `POST /api/recommend` (quiz) e `POST /api/admin-chat` (chat, resposta em NDJSON, `maxDuration` de 60 s no `app/vercel.json`). O `app/vercel.json` também reescreve `/admin` para o app.

## Decisões já tomadas (não reabrir sem o usuário)

- **Toda IA usa `gpt-6-luna` com `reasoning.effort: "high"`**, fixos em `app/server/openai.mjs`. A única variável de ambiente é `OPENAI_API_KEY`, e a chave **nunca vai ao navegador**.
- **Banco de dados: Supabase.** Integrado para login e cardápio da cafeteria; falta a estatística, os pedidos e as sessões do chat (ver "O que fazer a seguir").
- **Chat, "plano A":** a resposta roda na guia do navegador que a começou; se ela fechar no meio, a sessão fica "Interrompida" e dá para retomar. Segundo plano de verdade só depois do banco.
- **Gráfico livre no chat: Vega-Lite**, aprovado pelo usuário, **ainda não feito** (instalar só quando chegar nele; carrega só no chat).
- **Login** no `/admin` e no chat (feito em 14/11, antes era sem senha). Falta limite de uso do chat por conta.
- **Dados do painel são fictícios e locais**, por pedido do usuário. Custo e latência da IA não são prioridade agora.
- **Visual:** foto de produto inteira, sem corte; **vídeo** em tela cheia; fundo pastel da própria foto; Liquid Glass só na camada de controles. Painel `/admin` com menu lateral (nada de rolagem única), com o filtro de período numa linha de filtros no começo da página (não no topo fixo).
- **Guardrail do chat:** a recusa é um texto **fixo escrito no servidor**; o modelo nunca a escreve. Não afrouxar sem rodar `e2e/server/guardrail.spec.ts` e `scripts/chat-smoke.mjs`.
- **Quiz:** restrição alimentar e texto livre **não** vão para o registro de interesse (`cm.events`). Alergia é dado sensível e a tela sempre manda confirmar com a equipe.

## O que fazer a seguir

Em ordem sugerida. O detalhamento da fase 1 está em `docs/04-mvp.md`, seção "Próxima fase".

**1. Banco de dados e arquitetura (maior item)**
1. **Separar back-end e front-end** dentro do projeto (hoje `app/` mistura `src/`, `server/`, `api/` e `shared/`, e o navegador importa o motor de dados).
2. **Integrar o Supabase**: projeto, migrações em `supabase/migrations`, *seed* do cardápio, Auth, regras de acesso por cafeteria (`cafe_id` em tudo), Storage para fotos e vídeos.
3. Guardar: sessões do chat, o cardápio, **toda a estatística** (visitas, eventos, pedidos, sugestões da IA, trocas em "Parecidos") e as chamadas à IA (custo, erros, recusas). Trocar `getFacts()` em `shared/analytics.mjs` por leitura do banco, **mantendo o contrato de `runQuery`**.
4. **Painel do dono do produto** (o usuário, não o lojista): check-up da plataforma (cafeterias, uso, custo e saúde da IA, recusas do guardrail, erros). Separado do `/admin`.
5. Login e limite de uso no `/admin` e no chat; rodar a resposta do chat em segundo plano no servidor.

**2. Chat e painel**
- **Gráfico livre com Vega-Lite** e visualizações novas (fluxo/Sankey, quadrante interativo, pequenos múltiplos), com clique no ponto virando pergunta.
- Agrupamentos e fixar bloco do chat (a personalização do Dashboard já existe: ver `docs/06-painel.md`).

**3. Quiz**
- **Revisar a qualidade das etiquetas**: 10 bebidas não têm etiqueta de temperatura (o filtro usa o número `iced`, então não quebra), e "quente + sem café" fica com poucos itens (cerca de 9). Etiqueta errada vira recomendação errada.
- Perguntas que ficaram de fora para o quiz não ficar longo: acompanhar com comida, tamanho, fome.
- Com texto livre o quiz leva até ~18 s (duas chamadas ao modelo). Se incomodar, dá para paralelizar ou simplificar.

**4. Conteúdo e produto**
- Fotos da coleção de Natal (fundo vermelho), PDF A4 do cardápio, cafeteria real (com autorização). Os vídeos de hoje são só mockup.

## Como rodar e testar

```bash
cd app
npm ci
npm run dev -- --host        # app + rotas da IA (precisa de OPENAI_API_KEY no .env)
npm run build                # typecheck + build
npm run test:e2e             # 886 testes; só commite se TODOS passarem
npm run test:menu-db         # migrações do Supabase no PGlite
node scripts/chat-smoke.mjs "pergunta"   # chama o GPT-6 Luna de verdade (pipeline do chat)
node scripts/quiz-eval.mjs               # 14 perfis no quiz com a IA real
```

- Os testes **nunca** chamam a OpenAI: o navegador usa `page.route(...)`, e os testes de `e2e/server/` (rodam só no Node, projeto `server`) usam um modelo falso. Para validar a IA de verdade, use os dois scripts acima.
- `cm.admin.mock = 1` no `localStorage` faz o chat usar respostas de exemplo do código (é o que `e2e/admin-chat.spec.ts` usa); `cm.admin.fast = 1` encolhe as pausas dessas respostas.
- **Capturas de tela (`e2e/__screenshots__`)** (só no Linux; em Windows/macOS os testes visuais pulam): o `--update-snapshots` não regrava diferença pequena (tolerância de 2%). Depois de mudar o visual, **apague** as PNGs afetadas e gere de novo, e **olhe as imagens** antes de commitar.
- Não encadeie `git commit` depois de `| tail`: o pipe engole o erro dos testes.

## Armadilhas que já custaram tempo

- O `.app` é fixo à janela (`position: fixed; inset: 0`). Não troque por `100vh`.
- O painel `/admin` rola dentro do `.adm` (o `body` continua com `overflow: hidden`). Aliás, a rota é só `/admin`, **sem barra no fim** (os arquivos usam caminho relativo).
- `7d` e `30d` no motor de consulta são **dias completos até ontem**; só `today` é parcial (até as 16h). Comparar o dia de hoje com um dia inteiro fazia as vendas parecerem cair.
- Regex com `\b` não funciona depois de letra acentuada ("é", "ê"). Já deixou passar "você agora é" no guardrail.
- Ao criar pergunta nova no quiz, ligue-a a uma etiqueta ou filtro em `shared/recommend.mjs`; senão ela não muda o resultado.
- Alvos de toque de **44px** em tudo (o teste reprova). Botão de ícone precisa de **texto** de apoio.
- Teste que olha só o código e não a tela deixa passar defeito visual (já aconteceu: "Tanto faz" aparecendo marcado antes de responder). **Olhe os prints.**

## Ambiente de nuvem do Claude (para outros agentes: ignore ou adapte)

- A sessão do Claude roda no ambiente pessoal `coffe-menu`, com a chave da OpenAI como segredo injetado pelo proxy e uma lista de hosts liberados (OpenAI, Pexels, `developers.openai.com`, `openai.github.io`). A Vercel e o site da Starbucks **não** são acessíveis de lá. Para o Node passar pelo proxy lá: `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt OPENAI_API_KEY=proxy-injected`. Em outra máquina isso não é necessário.
- A chave da **Pexels** (usada só por `scripts/fetch-videos.mjs`) existe só nesse ambiente. Quem quiser baixar outros vídeos precisa de uma chave própria.
- A branch `claude/peaceful-noether-kml13b` era da sessão do Claude e está igual à `main`. Outro agente deve trabalhar e publicar na `main` (pedido do usuário).
- **Supabase e o ambiente do Claude:** o host `*.supabase.co` precisa ser liberado na rede do ambiente, e as chaves entram como segredo (nunca no código).
