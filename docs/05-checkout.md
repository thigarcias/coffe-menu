# Checkout (sacola e pedido simulado)

Plano da experiência de pedido do cliente. Decidido com o usuário em 12/11/2026. O painel do dono vem depois e vai ler os eventos daqui.

## Decisões

| # | Pergunta | Decisão |
| --- | --- | --- |
| 1 | Para onde vai o pedido? | **Simulado.** Na história, vai para a cafeteria; no app, nada sai do celular. Sem servidor, sem pagamento. Combina com o `01-core.md`: o produto não é PDV. |
| 2 | E o "Quero provar"? | **Vira a sacola.** O coração e a lista de favoritos saem do app. |
| 3 | Foco agora | O fluxo do cliente. O painel do dono vem depois. |
| 4 | Personalização | **Tudo o que o site tem:** tamanho, café, leite, adicionais e "sem chantilly". |
| 5 | Adicionar com um toque? | Item **sem opções** (salgado, doce, água) vai direto. **Bebida** entra com o padrão e o aviso oferece "Usar o padrão" ou "Personalizar". Se a pessoa ignorar, fica o padrão. |
| 6 | Opções dos 62 itens sem página de detalhe | **Conjuntos de opções por tipo de bebida**, montados com o que veio do site. |
| 7 | Identificação | **Nome** por padrão (como no balcão da Starbucks). O `menu.json` ganha `cafe.orderBy: "nome" \| "mesa" \| "ambos"`, que o dono vai escolher no painel. A mesa vem do QR (`?mesa=7`). |
| 8 | Depois de enviar | **Andamento simulado:** Recebido → Preparando → Pronto, com temporizador. |
| 9 | Mesmo item com personalizações diferentes | **Linhas separadas** na sacola. |
| 10 | Quiz | Cada sugestão ganha o botão de sacola. |
| 11 | Ícone | **Sacola com "+"** no feed, na grade e no quiz. O botão do detalhe vira "Adicionar · R$ 19,90". |
| 12 | Onde fica a sacola | O botão de **lista do dock vira a sacola**, com a quantidade de itens e o total. |
| 13 | Observação | **Campo livre opcional por item** ("sem gelo", "bem quente"). |
| 14 | Recarregar a página | Sacola e pedido em andamento **ficam guardados no celular**. Depois do "Pronto", a sacola esvazia e aparece "Pedir mais alguma coisa?". *(Sugestão minha, sem objeção.)* |

## Fluxo

1. **Adicionar.** Toque na sacola (feed, grade, detalhe ou quiz).
   - Sem opções: entra direto. Aviso "Adicionado à sacola" com "Desfazer".
   - Bebida: entra com o padrão (Tall, café padrão, leite integral, sem adicionais). Aviso "Adicionado · Usar o padrão / Personalizar". "Personalizar" abre o painel de opções daquela linha.
   - O ícone do produto mostra um número enquanto o item estiver na sacola.
2. **Personalizar** (painel). Grupos na ordem do site: Tamanho, Café, Leite, Adicionais (com quantidade), "Sem chantilly" e Observação. O preço da linha atualiza ao vivo. Botão "Salvar · R$ 24,40".
3. **Sacola** (botão do dock). Linhas com foto, nome, resumo das escolhas ("Grande · Leite de aveia · +1 dose"), observação, quantidade (− 1 +), editar e remover. Embaixo ficam o subtotal e o "Continuar".
4. **Fechar.** Campo de nome (ou mesa, ou os dois, conforme `cafe.orderBy`). Se algum item tem alérgeno, aparece um aviso: "Contém lactose, glúten. Confirme com a equipe." Botão "Enviar pedido · R$ 52,70".
5. **Acompanhar.** Tela do pedido com número (#A27), nome, itens e total, e uma linha do tempo: Recebido (na hora) → Preparando (~3 s) → Pronto (~8 s). Os tempos são curtos de propósito, para a demo. No "Pronto": "Seu pedido está pronto, Thiago" e "Pedir mais alguma coisa?".

## Dados

**`menu.json`**
- `cafe.orderBy`: `"nome"` (padrão), `"mesa"` ou `"ambos"`.
- `optionSets`: conjuntos por tipo, cada um com grupos (`id`, `name`, `required`, `max`, `options[{ id, name, add }]`, `default`). Tipos tirados do site:
  - `espresso-leite`: tamanho + café + leite + adicionais (lattes, macchiatos, mochas, cappuccinos)
  - `leite`: tamanho + leite + adicionais (chocolates, chai latte, matcha latte, proteicos sem café)
  - `cafe-simples`: tamanho + café + adicionais (americano, coado, proteicos de café)
  - `frappuccino`: tamanho + leite + adicionais + "sem chantilly"
  - `cold-brew`: tamanho + adicionais (com leite: + leite)
  - `cha` e `refresher`: tamanho + adicionais (com limonada já no nome)
  - itens sem opções (comida, água, snacks): nenhum conjunto
- Cada item ganha `options: "<id do conjunto>"`. A atribuição usa o que o site mostrou (100 itens) e, nos 62 restantes, a subcategoria.
- Preços dos adicionais: os do site (leite vegetal R$ 5,50, leite proteico R$ 9,90, essências e dose extra R$ 4,90; desnatado e zero lactose sem custo). O "volto logo" do site é ignorado na demo.

**Estado no celular** (`localStorage`, sempre com `try/catch`)
- `cm.cart`: linhas `{ key, itemId, choices, note, qty }`. A `key` junta o item e as escolhas, então o mesmo item com escolhas diferentes vira outra linha.
- `cm.order`: `{ code, name, table, lines, total, sentAt }`. O andamento é calculado por `sentAt`, então sobrevive a recarregar a página.
- Sai: `cm.favorites` (migra os favoritos atuais para a sacola, com o padrão, uma vez só).

**Eventos** (`lib/track.ts`), base do painel do dono:
- `cart_add` `{ itemId, from: feed|grid|detail|quiz, customized }`
- `cart_customize` `{ itemId, choices }`
- `cart_remove` `{ itemId }`
- `checkout_start` `{ items, total }`
- `order_sent` `{ items, total, by: nome|mesa }`
- Sai: `favorite`.

## Componentes

| Peça | O que muda |
| --- | --- |
| `lib/cart.ts` (novo) | Estado da sacola, preço da linha, chave da linha, padrão de cada conjunto, persistência. |
| `CustomizeSheet.tsx` (novo) | Painel de personalização. |
| `CartSheet.tsx` (novo, substitui `ListSheet`) | Sacola, fechamento (nome/mesa, aviso de alérgeno) e envio. |
| `OrderSheet.tsx` (novo) | Andamento simulado. |
| `Toast` (novo) | Aviso "Adicionado · Usar o padrão / Personalizar" e "Desfazer". |
| `Feed`, `GridView`, `DetailSheet`, `Quiz` | Coração vira sacola com "+"; o CTA do detalhe vira "Adicionar · preço". |
| Dock (`App.tsx`) | Botão de lista vira sacola, com quantidade e total. Com pedido em andamento, mostra o status ("Preparando…"). |
| `Icons.tsx` | Ícones de sacola, mais, menos e lixeira. |

## Testes (e2e)

- Adicionar um salgado pelo feed: vai direto, o número da sacola sobe.
- Adicionar uma bebida e personalizar: Grande + leite de aveia + 1 dose dá o preço certo.
- O mesmo item com escolhas diferentes vira duas linhas.
- Sacola, nome e enviar levam a Recebido → Pronto (com o relógio adiantado no teste).
- Recarregar no meio mantém a sacola e o pedido.
- Item com alérgeno mostra o aviso no fechamento.
- Layout: a sacola e a personalização cabem em 320 px e alvos de toque ≥ 44 px, nos 5 celulares.

## Fora deste passo

Pagamento, envio de verdade para a cafeteria, cupom, combo, sugestão de acompanhamento ("Combine com sua bebida", que o site tem) e o painel do dono.
