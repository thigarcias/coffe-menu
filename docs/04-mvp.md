# MVP: cardápio interativo

13/11/2026 · estado do que está construído, do que falta e das decisões tomadas.

O MVP é uma **demo de venda para donos de cafeteria**: um cardápio que o cliente abre pelo QR, entende e escolhe com ajuda de IA, e que registra o que despertou interesse. O lado do cliente está pronto e no ar na Vercel. O painel do lojista já existe em `/admin` (ver `06-painel.md`), com um chat de IA que monta gráficos sob pedido, mas **tudo com dados fictícios**. Hoje nada fica guardado num banco: o cardápio vive num arquivo, os eventos e as sessões do chat ficam no navegador de cada pessoa. A próxima fase é o banco de dados (**Supabase**), a separação entre front-end e back-end e um painel para o **dono do produto** (veja "Próxima fase").

## Para quem e para quê

| Pergunta | Decisão | De onde veio |
| --- | --- | --- |
| Quem vê primeiro | Donos de cafeteria. O pitch: "um cardápio interativo com IA e recomendação para os seus clientes". | Entrevista, rodada 1 |
| O que vem primeiro | O cardápio do cliente. O painel do dono entra no MVP, mas depois. | Entrevista, rodada 1 |
| Primeira tela | O cardápio geral, num feed estilo Reels, com as categorias em cima. A IA é opcional, num botão. | Entrevista, rodada 1 |
| Ver tudo | O cliente precisa conseguir ver todas as opções de uma vez: além do feed, há a grade "ver tudo". | Entrevista, rodada 2 |
| Cardápio de referência | O da Starbucks Brasil (PDF oficial), por ter fotos. Só uso interno; depois, cafeterias locais com autorização. | Entrevista, rodadas 1 e 2 |
| IA | `gpt-6-luna` com esforço `high`, para tudo que for IA. | Pedido do usuário |
| Visual | Soft de cafeteria gourmet (pastéis) com Liquid Glass claro por cima. Mobile first. | Pedido do usuário |
| Stack | React (+ Vite e TypeScript), na Vercel. | Pedido do usuário |
| Banco de dados | **Supabase** (Postgres). Ainda não integrado. | Pedido do usuário, 13/11/2026 |

## O que está pronto

| Funcionalidade | Como funciona |
| --- | --- |
| Feed em tela cheia | Um produto por tela com rolagem que encaixa (estilo Reels). Foto inteira sobre o fundo pastel da própria foto. |
| Categorias gerais | Novidades, Cafés, Gelados, Bebidas, Salgados e Doces, numa cápsula de vidro com seletor deslizante. Tocar numa pula para a seção. |
| Dica de deslizar | Um "deslize ↓" discreto no primeiro produto. |
| Ver tudo | Uma grade de 2 colunas com todas as opções, separada por categoria. Tocar num item abre ele no feed. |
| Detalhe do produto | "Com o que se parece" (tradução para leigos), ingredientes, tamanhos e preços, alérgenos e "De onde vem" (história). |
| Me ajuda a escolher | 3 perguntas (vontade, paladar, o que evitar) mais texto livre opcional. A IA devolve até 3 itens, cada um com o motivo. Se ela falhar, entram as regras. |
| Quero provar | O coração guarda o item numa lista para mostrar no balcão. |
| Coleta de interesse | Tempo em cada produto, detalhes abertos, favoritos, categorias e resultado do quiz, salvos no `localStorage` (`cm.events`). |
| Testes | 662 testes: 5 tamanhos de celular (320px a 430px) para layout, fluxos e capturas de referência, e testes de servidor (motor de consulta e guardrail da IA) que rodam só no Node. |

## Dados do cardápio

| Item | Situação |
| --- | --- |
| Produtos | 162 itens do site da Starbucks Brasil (cardápio de uma loja, extraído em 12/11/2026), em 6 categorias e 13 subcategorias. Ficaram de fora brindes, pacotes de café, combos e as cópias da promoção de Black Friday. |
| Fotos | Todos os itens têm a foto oficial do site (720 px, JPEG). As fotos vêm em fundo branco ou transparente; o `mix-blend-mode: multiply` funde o branco no fundo pastel, sem recorte. As 8 bebidas da coleção de Natal vêm com fundo vermelho e o selo "Novo" na própria foto. |
| Preços | Todos os itens têm preço real. Os tamanhos (Short, Tall, Grande, Venti) vêm da página de cada bebida; em 62 itens o site parou de responder (frappuccinos, chás, refreshers), e esses usam o padrão do site: Tall, Grande +R$ 2 e Venti +R$ 4. Os adicionais (leites, essências, dose extra) também têm preço. |
| Textos | Todos os itens têm "com o que se parece", ingredientes, história e etiquetas de sabor (doce, amargo, leite, gelado, cafeína, fome). |
| Fonte das histórias | Conhecimento geral, com aviso no app; nenhum fato inventado sobre a Starbucks. |

## Arquitetura (hoje)

```
celular ──► React (Vite) ──► POST /api/recommend ──► servidor ──► OpenAI (gpt-6-luna, high)
              │                                        │
              │                                        ├─ dev: plugin no vite.config.ts
              │                                        ├─ Vercel: app/api/*.mjs
              │                                        └─ Node: app/server/index.mjs
              ├─ eventos de interesse → localStorage (cm.events)
              └─ /admin (lojista) ──► POST /api/admin-chat ──► porteiro → planejador → redator
                    │                                           (consulta shared/analytics.mjs)
                    ├─ sessões do chat → localStorage
                    └─ números do painel ← shared/analytics.mjs (tabela FICTÍCIA, também no navegador)
```

- A chave da OpenAI só existe no servidor (`OPENAI_API_KEY`). O modelo e o esforço estão fixos em `app/server/ai.mjs`.
- A resposta da IA vem em JSON estruturado, e o servidor descarta ids que não existem no cardápio.
- Plano B: sem servidor ou com erro, o quiz usa as regras de `app/src/lib/recommend.ts`.
- Front-end e back-end estão **misturados** na mesma pasta `app/` (`src/`, `server/`, `api/`, `shared/`), e o `shared/analytics.mjs` roda no navegador. Isso muda na próxima fase.

## O que falta para fechar o MVP

| # | Item | Por que importa | Próximo passo |
| --- | --- | --- | --- |
| 1 | **Banco de dados (Supabase)** | Hoje nada é guardado de verdade: cardápio num arquivo, eventos e sessões do chat no navegador, painel com dados fictícios | Ver "Próxima fase", seções A e C |
| 2 | **Separar back-end e front-end** | O código de servidor e o do navegador estão na mesma pasta e se importam; com banco, o front não pode falar com ele direto | Ver "Próxima fase", seção B |
| 3 | **Painel do dono do produto** | É como o dono da plataforma faz o check-up: quantas cafeterias, uso, custo e saúde da IA, erros | Ver "Próxima fase", seção D |
| 4 | **Painel do lojista com dados reais** | O `/admin` existe (abas, chat de IA, gráficos), mas lê uma tabela fictícia | Trocar a fonte de dados pelo banco, mantendo o motor de consulta (`runQuery`) |
| 5 | **Eventos num servidor** | Hoje ficam só no celular de cada cliente; o painel precisa juntar todos | Uma rota `/api/events` que grava no banco (parte do item 1) |
| 6 | **Fotos da coleção de Natal** | As 8 fotos vêm com fundo vermelho e selo "Novo" embutido; destoam do resto | Decidir se ficam, vão para o fim de Novidades ou trocam de foto |
| 7 | **Cardápio impresso em PDF** | A lei já exige em SC, Juiz de Fora e Taubaté (doc core) | Uma página de impressão A4 gerada do mesmo `menu.json` |
| 8 | **Cafeteria real** | Transforma a demo em convite para piloto | Montar o cardápio de uma cafeteria local, com autorização |

Ficam **fora do MVP** (doc core): pagamento, PDV e NFC. **Atenção:** a doc core também deixava de fora login, várias cafeterias e cadastro de produtos pelo dono, mas o banco, o painel do dono do produto e o `/admin` real passam a exigir **login e mais de uma cafeteria** (veja "Próxima fase"). O pedido existe só como simulação (`05-checkout.md`).

## Próxima fase: banco de dados, back-end separado e painel do dono do produto

Registrado em 13/11/2026, **ainda não começou**. Os itens abaixo são o que precisa ser feito e as decisões em aberto, nada disso está construído.

### A. Banco de dados: o que precisa ser guardado

Tudo que hoje está em arquivo, no navegador ou fictício passa para o banco (Supabase/Postgres).

| Grupo | O que guardar | Hoje fica em |
| --- | --- | --- |
| **Sessões do chat da IA** | Cada sessão (ID, título, estado, datas) e cada mensagem, com os blocos e o plano da resposta | `localStorage` de cada guia |
| **Cardápio** | Cafeteria, categorias e subcategorias, produtos, tamanhos e preços, adicionais, grupos de tags e tags, textos ("com o que se parece", ingredientes, história, alérgenos), fotos e vídeos | `app/src/data/menu.json` e `app/public/` |
| **Estatística de uso** | Visitas (com a origem: QR da mesa, balcão, Instagram, link), produto visto e por quanto tempo, detalhes abertos, favoritos, uso da ajuda da IA, sugestões feitas e clicadas, trocas em "Parecidos", itens na sacola | `localStorage` (`cm.events`) e a tabela fictícia `app/shared/analytics.mjs` |
| **Pedidos** | Pedido, itens, valores, estado, origem | Simulado no navegador (`cm.order`) |
| **Operação da plataforma** | Chamadas à IA (modelo, tempo, tokens, erro), recusas do guardrail, falhas | Só no log do servidor |

**Rascunho de tabelas** (nomes e colunas a validar antes de criar):

| Tabela | Para quê |
| --- | --- |
| `cafes` | Cada cafeteria (nome, endereço, plano, ativa). A base de tudo: toda tabela abaixo leva `cafe_id` |
| `categories`, `products`, `product_sizes`, `addons`, `tag_groups`, `tags`, `product_tags`, `product_media` | O cardápio |
| `visits` | Uma linha por pessoa que abriu o cardápio (origem, horário, passos do funil) |
| `events` | Cada ação (produto visto, detalhe aberto, favorito, quiz, "Parecidos", sacola), ligada à visita |
| `ai_suggestions` | O que a IA do cardápio sugeriu, o que foi clicado e o que virou pedido |
| `orders`, `order_items` | Pedidos e itens |
| `chat_sessions`, `chat_messages` | As sessões do chat do painel e o histórico |
| `ai_calls` | Cada chamada à OpenAI (etapa, tempo, tokens, erro, recusa do guardrail), para o custo e o check-up |
| `users`, `cafe_members` | Quem entra: papel de dono do produto, dono da cafeteria, equipe |

Decisões em aberto:
- **Multi-cafeteria desde já** (`cafe_id` em tudo, com as regras de acesso do Supabase): o painel do dono do produto precisa disso. É uma mudança em relação à doc core.
- **Alergia é dado sensível:** hoje o quiz **não guarda** as respostas. No banco, gravar só o que o cliente aceitar ver registrado e nunca as restrições de alergia (LGPD). Decidir antes de criar `ai_suggestions`.
- **A IA do chat não escreve SQL:** ela continua só pedindo consultas ao motor (métrica, agrupamento, filtro, período). Com banco, o motor passa a montar a consulta ao banco com parâmetros, mantendo o mesmo contrato (`runQuery`). O guardrail e os testes continuam valendo.
- **Retenção:** por quanto tempo guardar eventos e mensagens do chat.

### B. Separar back-end e front-end

Hoje `app/` mistura tudo: `src/` (React), `server/` e `api/` (servidor) e `shared/` (dados e motor de consulta, que **o navegador importa**). Com banco isso não pode continuar: o navegador não deve conhecer a lógica de dados nem ter chave do servidor.

- **Front-end** (React): só desenha e chama a API. Nada de `getFacts()` nem de acesso direto ao banco com poderes de servidor.
- **Back-end** (API): rotas, IA e guardrail, motor de consulta, acesso ao Supabase, gravação de eventos, sessões do chat.
- **Contrato entre os dois:** tipos compartilhados (formato dos blocos, eventos, respostas) num pacote pequeno, sem lógica.
- Estrutura sugerida (a decidir): pastas lado a lado dentro do mesmo repositório, por exemplo `web/` e `api/`, mais `contracts/`. Decidir também se vão como **um** projeto na Vercel ou dois.
- O painel passa a **buscar os números pela API** em vez de ler `shared/analytics.mjs`. Os testes de motor e de guardrail (`e2e/server/`) vão para o back-end.

### C. Integração com o Supabase

- Criar o projeto e guardar as chaves: a **chave pública (anon)** pode ir ao navegador; a **service role** só no servidor, como `OPENAI_API_KEY`. Novas variáveis: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Migrações versionadas** no repositório (`supabase/migrations`) e um *seed* a partir do `menu.json` e das fotos.
- **Auth** do Supabase para o login do lojista e do dono do produto; **regras de acesso por linha** (RLS) para cada cafeteria só ver os próprios dados.
- **Storage** para fotos e vídeos (hoje em `app/public/`).
- **Sessões do chat no banco** resolvem o limite atual ("plano A"): a resposta pode rodar **no servidor, em segundo plano**, e continuar mesmo com a guia fechada, e a mesma conversa aparece em outro aparelho. A Vercel limita o tempo de uma função, então é preciso escolher como rodar em segundo plano (função com `waitUntil`, Edge Function do Supabase ou uma fila). **A decidir.**
- Atenção ao ambiente de nuvem do Claude: o host `*.supabase.co` precisa ser liberado na rede do ambiente e a chave entra como segredo (como foi com a Pexels e a OpenAI).

### D. Painel do dono do produto (check-up da plataforma)

Um painel **separado do painel do lojista** (`/admin` é do lojista), só para o dono do produto, com acesso restrito. Serve para fazer o check-up da plataforma toda. Primeira ideia do conteúdo (a validar):

| Bloco | O que mostra |
| --- | --- |
| Cafeterias | Quantas, quais estão ativas, quando cada uma entrou, última atividade |
| Uso | Visitas, pedidos e conversão por cafeteria e no total; crescimento |
| IA | Chamadas por dia, custo estimado em tokens, tempo de resposta, taxa de erro, quanto caiu na "Sugestão rápida" |
| Guardrail | Quantas perguntas do chat foram recusadas, por motivo, e as tentativas de burlar |
| Saúde | Erros recentes, estado do banco, da OpenAI e das rotas |
| Chat do painel | Quem usa, quantas perguntas, o que mais pedem (para saber o que falta construir) |
| Gestão | Ativar ou desativar uma cafeteria, ver o cardápio dela |

Decisões em aberto: o endereço (`/plataforma`?), se é o mesmo app ou outro, e como é feito o primeiro acesso (conta do dono do produto no Supabase Auth).

### E. Ordem sugerida

1. Separar back-end e front-end (B), antes de colocar dados reais no meio.
2. Criar o projeto no Supabase, as migrações e o *seed* do cardápio (C e A).
3. Gravar eventos reais (`/api/events`) e trocar a fonte de dados do painel do lojista e do chat para o banco (A).
4. Sessões do chat no banco e resposta em segundo plano (A e C).
5. Login (Supabase Auth) e proteção do `/admin` e do chat.
6. Painel do dono do produto (D).

**Antes de ir ao ar com dados reais:** hoje `/admin` e o chat da IA **não têm senha nem limite de uso** (pedido do usuário, por ser demo). O item 5 acima precisa vir antes de a demo ser mostrada fora do círculo próximo, porque qualquer pessoa com o endereço gasta crédito da OpenAI.

## Critérios de pronto

Herdados da doc core e ainda valendo:

- [x] Abre por link e QR num celular comum.
- [ ] Um leigo pede ajuda e recebe sugestão em menos de 30 segundos (a IA responde em 4 a 5 s; falta testar com pessoas).
- [ ] O painel mostra os dados reais dos testes (hoje mostra dados fictícios; depende do banco).
- [ ] O PDF sai certo numa folha A4.
- [ ] 4 de 5 testadores entendem o produto sem ajuda (fase 2 da doc core).

## Decisões de design que não devem voltar atrás

- **Foto inteira, sem corte:** o produto aparece por completo. O corte em tela cheia escondia o produto ("muito na frente da tela").
- **Fundo desfocado sozinho foi reprovado:** a foto "flutuando" sobre um borrão parece um recorte seco. O fundo pastel atual é o meio-termo até o preenchimento generativo.
- **Categorias gerais**, não nomes de produto.
- **IA opcional:** o cardápio funciona inteiro sem ela; a ajuda fica num botão.
- **Foto real do produto**, nunca gerada por IA.
