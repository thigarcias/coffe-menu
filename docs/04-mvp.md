# MVP: cardápio interativo

12/11/2026 · estado do que está construído, do que falta e das decisões tomadas.

O MVP é uma **demo de venda para donos de cafeteria**: um cardápio que o cliente abre pelo QR, entende e escolhe com ajuda de IA, e que registra o que despertou interesse. O lado do cliente está pronto e no ar na Vercel. O painel do dono ainda não foi construído, mas os dados que ele vai usar já estão sendo coletados.

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
| Testes | 110 testes em 5 tamanhos de celular (320px a 430px): layout, fluxos e capturas de referência. |

## Dados do cardápio

| Item | Situação |
| --- | --- |
| Produtos | 162 itens do site da Starbucks Brasil (cardápio de uma loja, extraído em 12/11/2026), em 6 categorias e 13 subcategorias. Ficaram de fora brindes, pacotes de café, combos e as cópias da promoção de Black Friday. |
| Fotos | Todos os itens têm a foto oficial do site (720 px, JPEG). As fotos vêm em fundo branco ou transparente; o `mix-blend-mode: multiply` funde o branco no fundo pastel, sem recorte. As 8 bebidas da coleção de Natal vêm com fundo vermelho e o selo "Novo" na própria foto. |
| Preços | Todos os itens têm preço real. Os tamanhos (Short, Tall, Grande, Venti) vêm da página de cada bebida; em 62 itens o site parou de responder (frappuccinos, chás, refreshers), e esses usam o padrão do site: Tall, Grande +R$ 2 e Venti +R$ 4. Os adicionais (leites, essências, dose extra) também têm preço. |
| Textos | Todos os itens têm "com o que se parece", ingredientes, história e etiquetas de sabor (doce, amargo, leite, gelado, cafeína, fome). |
| Fonte das histórias | Conhecimento geral, com aviso no app; nenhum fato inventado sobre a Starbucks. |

## Arquitetura

```
celular ──► React (Vite) ──► POST /api/recommend ──► servidor ──► OpenAI (gpt-6-luna, high)
              │                                        │
              │                                        ├─ dev: plugin no vite.config.ts
              │                                        ├─ Vercel: app/api/recommend.mjs
              │                                        └─ Node: app/server/index.mjs
              └─ eventos de interesse → localStorage (base do painel do dono)
```

- A chave da OpenAI só existe no servidor (`OPENAI_API_KEY`). O modelo e o esforço estão fixos em `app/server/ai.mjs`.
- A resposta da IA vem em JSON estruturado, e o servidor descarta ids que não existem no cardápio.
- Plano B: sem servidor ou com erro, o quiz usa as regras de `app/src/lib/recommend.ts`.

## O que falta para fechar o MVP

| # | Item | Por que importa | Próximo passo |
| --- | --- | --- | --- |
| 1 | **Painel do dono** | É metade da proposta de valor | Uma tela com os mais vistos, o tempo de atenção, os favoritos, o uso da ajuda e o que a IA sugeriu. Uma versão da matriz de engenharia de cardápio com "visto x escolhido". |
| 2 | **Eventos num servidor** | Hoje ficam só no celular de cada cliente; o painel precisa juntar todos | Uma rota `/api/events` e um banco simples |
| 3 | **Fotos da coleção de Natal** | As 8 fotos vêm com fundo vermelho e selo "Novo" embutido; destoam do resto | Decidir se ficam, vão para o fim de Novidades ou trocam de foto |
| 4 | **Carrinho / checkout** | O cliente monta o pedido enquanto navega | Usar `prices` e `extras` do `menu.json` |
| 6 | **Cardápio impresso em PDF** | A lei já exige em SC, Juiz de Fora e Taubaté (doc core) | Uma página de impressão A4 gerada do mesmo `menu.json` |
| 7 | **Cafeteria real** | Transforma a demo em convite para piloto | Montar o cardápio de uma cafeteria local, com autorização |

Ficam **fora do MVP** (doc core): pedido, pagamento, PDV, login, várias cafeterias, cadastro de produtos pelo dono e NFC.

## Critérios de pronto

Herdados da doc core e ainda valendo:

- [x] Abre por link e QR num celular comum.
- [ ] Um leigo pede ajuda e recebe sugestão em menos de 30 segundos (a IA responde em 4 a 5 s; falta testar com pessoas).
- [ ] O painel mostra os dados dos testes.
- [ ] O PDF sai certo numa folha A4.
- [ ] 4 de 5 testadores entendem o produto sem ajuda (fase 2 da doc core).

## Decisões de design que não devem voltar atrás

- **Foto inteira, sem corte:** o produto aparece por completo. O corte em tela cheia escondia o produto ("muito na frente da tela").
- **Fundo desfocado sozinho foi reprovado:** a foto "flutuando" sobre um borrão parece um recorte seco. O fundo pastel atual é o meio-termo até o preenchimento generativo.
- **Categorias gerais**, não nomes de produto.
- **IA opcional:** o cardápio funciona inteiro sem ela; a ajuda fica num botão.
- **Foto real do produto**, nunca gerada por IA.
