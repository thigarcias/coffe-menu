# Painel do dono (`/admin`)

14/11/2026 · **números com dados de exemplo; cardápio, login e equipe são de verdade (equipe ainda é demonstração).** O painel de dados serve para aprovar a cara e a estrutura; o editor de cardápio já grava no Supabase.

## O que é

Uma dashboard numa rota do mesmo app (`/admin`), pensada para a dona ou o dono da cafeteria entender, sem jargão, **o que está vendendo e por quê**. Mobile first (320px) e com versão de desktop em grade de 12 colunas, que é onde deve ser mais usada. Visual: o mesmo Liquid Glass do cardápio, mas sobre branco.

## Como está organizado

- **Topo fixo (vidro):** a marca, o botão **Perguntar à IA** e, no celular, o botão **Menu**. O filtro de tempo **não fica no topo**.
- **Menu lateral:** fixo à esquerda no desktop (a partir de 1024px) e **gaveta** no celular (abre pelo botão Menu; fecha ao escolher, com Esc ou tocando fora). Grupo **Dashboard** (clica e abre: Visão geral, Vendas, Produtos, IA e Parecidos, Tráfego) e, soltos, **Personalizar cardápio**, **Equipe** e **Sessões**. "Ver cardápio" e "Sair" ficam no rodapé do menu. Cada item mostra **só a sua seção** (a página não é uma rolagem única). A seção fica no endereço (`/admin#vendas`), então recarregar ou mandar o link abre no mesmo lugar.
- **Filtros:** uma linha no começo da página, igual em todas as abas, com o **Período** (Hoje, 7 dias, 30 dias) e a data de referência. O que se escolhe vale para todas as abas. É onde entram novos filtros.
- **Cinco seções de dados** no grupo Dashboard, cada uma com título e cabendo em pouco mais de uma tela no desktop: Visão geral, Vendas, Produtos, IA e Parecidos, Tráfego.

## O que mostra

| Seção | Bloco | Pergunta que responde |
| --- | --- | --- |
| Visão geral | Indicadores (vendas, pedidos, ticket médio, conversão, pedidos com a IA) | Como está o período, e melhor ou pior que o anterior? |
| Visão geral | Por que vendeu | O que mais explica os números, em três frases |
| Vendas | Vendas no período | Quando vendi, comparado com o período anterior (com tabela alternativa) |
| Vendas | Do cardápio ao pedido (funil) | Onde as pessoas desistem pelo caminho |
| Produtos | Mais vendidos | Qual produto puxa as vendas |
| IA e Parecidos | Recomendação da IA | Quantos pedem ajuda, quantos clicam na sugestão, quantos pedem; o que a IA mais sugere |
| IA e Parecidos | Parecidos | Quantos abrem "Parecidos" e para qual produto vão (de → para, com pedidos gerados) |
| Produtos | Vendas por categoria | Onde está o dinheiro |
| Tráfego | Horários de pico | Quais dias e horas concentram pedidos (mapa de calor) |
| Tráfego | Como chegaram | De onde vêm as visitas (QR da mesa, balcão, Instagram, link) e quais convertem |
| Produtos | Vitrine: visto × pedido | O que reorganizar: estrelas, vitrine que não converte, escondidos, pouca atenção |

## Personalizar cardápio (editor da cafeteria)

`app/src/admin/MenuEditor.tsx` (estilos em `menu-editor.css`). Só vale para a cafeteria vinculada à conta; os dados ficam no Supabase (ver `04-mvp.md`, seção C).

- **Barra única** no topo: nome do rascunho, "No ar · vN" ou "Ainda não publicado", Abrir prévia, Salvar rascunho e Publicar cardápio. Trocar de cafeteria ou de rascunho, criar, renomear e excluir rascunho ficam recolhidos em "Cafeteria e rascunhos".
- **Abas internas:** Produtos, Marca, Disponibilidade, Avançado (opções de personalização e histórico de versões).
- **Produtos:** agrupados por categoria, que **recolhem e expandem** (uma ou todas); busca; "Nova categoria"; "Editar categoria" (renomear, subir, descer, remover).
- **Diálogo do produto:** começa pela **foto** (tamanho médio, com Trocar/Remover), depois nome e categoria, o cartão **Preencher com IA**, descrição e preços. "Detalhes para o cliente", "Alérgenos" e "Etiquetas e características" ficam recolhidos, cada um com um resumo do que já está preenchido.
- **Preencher com IA:** a pessoa escreve uma frase; `POST /api/menu-suggest` com `mode: "fill"` (`fillProductDetails` em `server/menuSuggestions.mjs`, GPT-6 Luna). Só preenche campos **vazios**, tem **Desfazer**, e **alérgenos nunca são aplicados sozinhos** (a pessoa marca e confirma que conferiu). Preço e foto nunca são inventados.
- **Etiquetas flexíveis:** além do catálogo, a cafeteria cria etiquetas novas (a IA também sugere). Elas entram na família "Minhas etiquetas" ao salvar o produto.
- **Disponibilidade e estoque:** só lista produtos do cardápio **publicado**. Por produto: **miniatura da foto**, quantidade (−, campo, +) e Disponível/Indisponível. **Filtros:** busca, situação (Todos, Perto de acabar, Indisponíveis, Disponíveis, Sem controle), categoria e ordem (nome, menos ou mais estoque primeiro); "Perto de acabar" usa um limite que a pessoa ajusta (padrão: até 5 unidades). Quantidade 0 = Esgotado (indisponível). Quantidade vazia = sem controle. O cardápio público só recebe `available`; a quantidade é visível só para o dono. O estoque **não é descontado por pedidos** (o checkout é simulado).
- **Mídia:** fotos novas vão para o bucket privado. As fotos e vídeos da biblioteca de referência (`menu/*.jpg`, `video/*.mp4`, arquivos do app) também podem ser publicados.

## Personalizar o painel (Dashboard)

14/11/2026 · o dono ajusta cada seção do Dashboard do jeito que enxerga, à mão ou pedindo à IA, e pode voltar ao padrão. **Estado:** código e testes prontos; **a migração ainda não foi aplicada no Supabase `catalogo`**. Até lá o painel segue no padrão e o botão **Personalizar** nem aparece (o painel nunca quebra por falta do servidor).

### Como funciona

- **O padrão mora no código** (`DEFAULT_LAYOUT` em `app/src/admin/layout/model.ts`): cada seção é uma lista de cartões. Os 15 cartões do padrão estão em `widgets.tsx` (mesmo HTML de antes da refatoração).
- **O que o dono muda vira uma versão por seção**, salva por cafeteria e **compartilhada com a equipe**. Só há versão nova ao tocar em Salvar. `items` nulo na versão mais alta = "voltar ao padrão". O histórico nunca é apagado.
- **Botão Personalizar** no cabeçalho de cada seção abre o modo editar: subir/descer, esconder, **Cartões escondidos** (primeiro os da própria seção; os de outras seções ficam recolhidos em "Trazer cartões de outras seções"), largura (metade/inteira) dos blocos criados pela IA, **Desfazer a última mudança salva** e **Voltar ao padrão** (em dois toques, sem diálogo do navegador). **Salvar e Cancelar ficam numa doca fixa no rodapé**, com o aviso "Mudanças não salvas".
- **Peça à IA** (dentro do modo editar): caixa de texto e pedidos prontos. A IA devolve **operações** (`add_block`, `replace_block`, `add_builtin`, `remove`, `move`, `set_span`), nunca texto livre nem código. O servidor valida e aplica sobre o layout atual; a **proposta vira o rascunho na tela**, com a lista de mudanças **escrita pelo servidor**, e "Desfazer proposta". Só grava ao Salvar (versão marcada como `ia`).
- **Bloco criado pela IA guarda só a receita** (tipo, métrica, agrupamento, período, filtros), nunca números: o motor calcula a cada abertura (`SpecCard.tsx` + `shared/blocks.mjs`), então acompanha o período e nunca fica velho. Receita que o motor não entende vira o aviso "Este bloco não está disponível agora".
- Uma `line` com agrupamento por hora, dia da semana etc. é **corrigida para `bars`** (a linha só mostra dias). Foi um erro real da IA no teste com o modelo de verdade.

### Onde está

| O quê | Onde |
| --- | --- |
| Modelo, padrão, cartões, edição | `app/src/admin/layout/` (`model.ts`, `widgets.tsx`, `edit.ts`, `SectionView.tsx`, `SpecCard.tsx`, `layout.css`) |
| Salvar, carregar, desfazer | `layout/api.ts`, `layout/useLayouts.ts`; RPCs liberadas em `server/menuData.mjs` (`get/save/restore_dashboard_layout`) |
| Banco | `app/supabase/migrations/20261114220000_coffe_menu_dashboard_layout.sql` (versões append-only, RLS por dono, versão esperada com conflito 40001 → 409) |
| IA | `server/adminPersonalize.mjs`, rota `POST /api/admin-personalize` (mesmo login de admin do chat; registrada nos três lugares), cliente em `layout/personalizeApi.ts` |
| Catálogo compartilhado | `shared/layout.mjs` (cartões, seções, larguras) e `shared/blocks.mjs` (receita → bloco, também no navegador) |

**Cuidado com o CSS:** `.adm-btn*` é do chat (`chat.css`). Os botões do modo editar usam `.adm-lb*` de propósito; não reutilize o nome antigo.

### Defesas da IA de personalização

Pré-filtro sem modelo (tamanho, "ignore as instruções", pedir o prompt, pedido de código) que **nem chama o modelo**; o pedido vai ao modelo só como dado entre `<pedido>`; saída estrita revalidada (`sanitizeLayout` e `normalizePlan` descartam id, tipo, filtro ou largura inventados); até 6 operações, 14 cartões e 8 blocos da IA por seção; recusas com texto **fixo** do servidor; erro interno vira mensagem amigável e o texto do erro não vai à tela.

### Como testar

```bash
cd app
npx playwright test e2e/admin-layout.spec.ts      # navegador: edição, IA (simulada), celular (5 aparelhos)
npx playwright test e2e/server/personalize.spec.ts --project=server   # servidor com modelo falso + deriva do catálogo (TS, JS e SQL)
npm run test:menu-db                                # migração no PGlite (versões, reset, desfazer, conflito, isolamento)
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt OPENAI_API_KEY=proxy-injected \
  node scripts/personalize-smoke.mjs vendas "Só os gelados, por hora"   # IA de verdade
```

### O que falta

1. **Aplicar a migração no `catalogo`** (compartilhado com outros apps: só há tabelas novas do coffe-menu). Depois conferir com um login real.
2. **Agrupamentos** ("novas categorias" para analisar, como regra viva: categoria + etiquetas + faixa de preço, usados como filtro e como agrupamento nos blocos). Pede tabela própria e uma extensão do `runQuery`.
3. **Fixar no painel** um bloco que o chat gerou (hoje só dá para pedir à IA do modo editar).
4. Escolher a cafeteria quando a conta tiver mais de uma (hoje usa a primeira, como os números do painel).
5. A equipe ainda é demonstração: hoje todos que têm acesso editam. Quando houver papéis, decidir quem pode personalizar.

## Chat com a IA

O dono conversa com a IA do painel, que **monta gráficos, tabelas e análises sob pedido** com os dados do painel. A IA é o **GPT-6 Luna** (esforço `high`), chamada só pelo servidor.

### Interface e sessões

- **Painel lateral** por cima da dashboard (botão **Perguntar à IA**, no topo). Dele dá para ir para a **tela cheia** ou para uma **guia só com o chat** (`/admin?chat=ID`).
- **Sessões com ID e histórico**, guardadas no navegador. Todas as formas de ver a mesma conversa (lateral, tela cheia, outra guia) mostram **a mesma sessão em tempo real**. O item **Sessões** do menu lista todas, com o estado (Rodando, Concluída, Interrompida, Erro) e abre qualquer uma.
- **Fechar o chat não para a resposta.** O executor (`chat/runner.ts`) mora no módulo, não num componente. Limite do "plano A": a resposta roda **na guia do navegador** que a começou; se ela for fechada no meio, a sessão fica **Interrompida** e há um botão **Retomar**. Rodar de verdade em segundo plano pede um servidor com banco (não foi feito).
- Respostas em **blocos** (`chat/types.ts`): texto, indicadores, linha, barras, funil, mapa de calor, tabela e perguntas sugeridas (tocar numa envia a pergunta). Quem desenha é o nosso código, com os componentes do painel.

### Como a IA responde (`server/adminChat.mjs`)

A IA **nunca escreve número nem código de interface**. Em 3 etapas, com a resposta em streaming (NDJSON):

1. **Porteiro.** Classifica a mensagem: `dados`, `ajuda_painel`, `saudacao`, `fora_do_escopo` ou `tentativa_de_burlar`. Só `dados` segue. **Todo o resto recebe uma resposta fixa escrita no servidor** (o modelo não escreve a recusa) e nada é gerado. Antes dele há um **pré-filtro sem modelo** (`precheck`): mensagem grande demais (500 caracteres), "ignore as instruções", pedir o prompt do sistema, trocar de papel, e pedido de código (linguagem + "script/código/programa").
2. **Planejador.** Escolhe até 4 blocos e as consultas, com saída estrita (só métricas, agrupamentos, filtros e períodos que existem). O servidor valida de novo (`normalizePlan`) e descarta o que não existe. Tipos: indicadores, linha, barras, funil, mapa de calor, tabela, Parecidos, sugestões da IA e vitrine visto × pedido. Se o dado não existe (lucro, custo, estoque), ele diz qual falta.
3. **Redator.** Escreve a análise em cima dos números que o **motor de consulta** devolveu. O texto passa por uma checagem: **valor em R$ ou percentual que não existe nos dados**, código, links e HTML derrubam o texto da IA, e entra um resumo feito pelo servidor.

Camadas extras: o texto do usuário vai ao modelo só como dado, entre etiquetas (`<`/`>` removidos para ele não fechar a etiqueta); o histórico enviado pelo navegador não é confiável (só as perguntas e o plano **revalidado** chegam ao modelo); erro interno vira mensagem amigável sem vazar detalhe; sem chave, a IA diz que não está configurada.

O que o guardrail barra, de fato (testado com o modelo real): script em Python, "escreva um código", poema, tradução, piada, conta de multiplicar, receita, "você agora é um chef", "ignore as instruções anteriores", dados de concorrentes ou da Starbucks inteira, e pedidos que misturam uma pergunta de dados com um pedido fora do escopo.

### Dados

Uma única tabela fictícia (`app/shared/analytics.mjs`, 61 dias de visitas e pedidos, determinística) alimenta o painel **e** o chat, então os números nunca se contradizem. O motor `runQuery` aceita métrica (vendas, pedidos, unidades, ticket médio, visitas, conversão), agrupamento (dia, hora, dia da semana, produto, categoria, origem, com/sem IA), filtros (origem, categoria, produto, com/sem IA) e período (`today`, `yesterday`, `7d`, `30d`, `prev7d`, `prev30d`), com comparação. Só `today` é parcial (até as 16h); os demais são dias completos até ontem. Para dados reais, troque `getFacts()`.

### Como testar a IA de verdade

```bash
cd app
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt OPENAI_API_KEY=proxy-injected \
  node scripts/chat-smoke.mjs "Quais gelados vendem mais?" "Crie um script em Python"
```

Os testes automáticos **não** chamam a OpenAI: `e2e/server/` usa um modelo falso (e prova que o guardrail se defende até com um modelo enganado), e `admin-chat-ia.spec.ts` simula a rota.

### Próximas etapas

1. **Gráfico livre** com Vega-Lite e visualizações novas (fluxo/Sankey, quadrante, pequenos múltiplos), com clique no ponto virando pergunta.
2. ~~Fixar painéis gerados~~ (a personalização do Dashboard está em "Personalizar o painel"). Falta fixar um bloco **direto do chat** e os agrupamentos.
3. Rodar a resposta no servidor (segundo plano de verdade), login e dados reais. Isso depende da **próxima fase** (banco no Supabase, back-end separado e painel do dono do produto), descrita em `04-mvp.md`.

## Onde está o código

- `app/src/admin/Admin.tsx`: a página. `charts.tsx`: gráficos (linha, minigráfico, barras, funil, mapa de calor). `admin.css`: estilos (tudo sob `.adm`).
- `app/src/admin/mock.ts`: lê os dados de `app/shared/analytics.mjs` (a mesma tabela que a IA consulta). Para dados reais, troque lá.
- `app/src/admin/chat/`: o chat (`store.ts` sessões, `runner.ts` executor, `serverAssistant.ts` IA de verdade, `assistant.ts` IA de exemplo para testes, `Blocks.tsx`, `ChatPanel.tsx`, `SessionsList.tsx`, `chat.css`).
- `app/server/adminChat.mjs` (IA do chat e guardrail), `app/api/admin-chat.mjs` (Vercel), `app/shared/analytics.mjs` (dados e motor de consulta), `app/scripts/chat-smoke.mjs`.
- `app/src/main.tsx` carrega o painel sob demanda (`React.lazy`): quem abre o cardápio não baixa o painel.
- `app/vercel.json` reescreve `/admin` para o app (sem isso a Vercel responde 404).
- A rota é só `/admin` (sem barra no fim); os arquivos do app usam caminho relativo.

## Decisões de gráfico

- Um tom só (sálvia) em passos de claro a escuro para magnitude; cinza para "antes". Não há paleta categórica, então não houve o que validar contra daltonismo; os passos do funil mantêm pelo menos 2:1 de contraste com o branco.
- Alta é verde com ▲; queda é terracota com ▼. Cor nunca vai sozinha.
- Nada de eixo duplo, pizza ou rosca. Ranking é barra horizontal; parte do todo também.
- Todo gráfico tem tooltip (arrastar o dedo no celular), e o de vendas tem versão em tabela.

## O que falta para ficar de verdade

1. **Eventos num servidor** (`/api/events` e um banco): hoje o app guarda só no `localStorage` de cada cliente.
2. **Registrar o que o painel pede e o app ainda não registra**: origem da visita (QR da mesa × balcão × link), cliques em "Parecidos" com o destino, o que a IA sugeriu e o que foi pedido depois, e o pedido em si (valor e itens).
3. ~~Login~~ (feito: Supabase Auth). Falta escolher a cafeteria quando a conta tiver mais de uma nos números do painel.
4. Trocar `mock.ts` por uma leitura desses dados.
