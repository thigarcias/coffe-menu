# Painel do dono (`/admin`)

13/11/2026 · **versão de design com dados de exemplo.** Serve para aprovar a cara e a estrutura; ainda não lê dado nenhum de verdade.

## O que é

Uma dashboard numa rota do mesmo app (`/admin`), pensada para a dona ou o dono da cafeteria entender, sem jargão, **o que está vendendo e por quê**. Mobile first (320px) e com versão de desktop em grade de 12 colunas, que é onde deve ser mais usada. Visual: o mesmo Liquid Glass do cardápio, mas sobre branco.

## Como está organizado

- **Topo fixo (vidro):** a marca e as **abas** das seções. Cada aba mostra **só a sua seção** (a página não é uma rolagem única): clicou, mudou. A aba fica no endereço (`/admin#vendas`), então recarregar ou mandar o link abre na mesma aba; setas, Home e End do teclado trocam de aba. No celular as abas rolam de lado e mantêm a ativa à vista. O filtro de tempo **não fica no topo**.
- **Filtros:** uma linha no começo da página, igual em todas as abas, com o **Período** (Hoje, 7 dias, 30 dias) e a data de referência. O que se escolhe vale para todas as abas. É onde entram novos filtros.
- **Cinco abas**, cada uma com título e cabendo em pouco mais de uma tela no desktop: Visão geral, Vendas, Produtos, IA e Parecidos, Tráfego.

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

## Chat com a IA

O dono conversa com a IA do painel, que **monta gráficos, tabelas e análises sob pedido** com os dados do painel. A IA é o **GPT-6 Luna** (esforço `high`), chamada só pelo servidor.

### Interface e sessões

- **Painel lateral** por cima da dashboard (botão **Perguntar à IA**, no topo). Dele dá para ir para a **tela cheia** ou para uma **guia só com o chat** (`/admin?chat=ID`).
- **Sessões com ID e histórico**, guardadas no navegador. Todas as formas de ver a mesma conversa (lateral, tela cheia, outra guia) mostram **a mesma sessão em tempo real**. A aba **Sessões** lista todas, com o estado (Rodando, Concluída, Interrompida, Erro) e abre qualquer uma.
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
2. **Fixar** painéis gerados e uma aba "Meus painéis".
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
3. **Login** (hoje `/admin` é aberta; com dados reais precisa de senha) e escolha da cafeteria.
4. Trocar `mock.ts` por uma leitura desses dados.
