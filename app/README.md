# Protótipo: cardápio interativo

Protótipo do lado do cliente, feito em React, Vite e TypeScript. A base de referência é o cardápio oficial da Starbucks Brasil (PDF), só para uso interno.

```bash
npm install
cp .env.example .env    # e coloque sua OPENAI_API_KEY
npm run dev -- --host   # abre no celular pela rede local
```

Para produção: `npm run build && npm start` (o servidor em `server/index.mjs` serve o build e a rota da IA).

## IA (OpenAI)

- Toda a IA do app usa o modelo **`gpt-6-luna`** com `reasoning.effort: "high"`, pela Responses API. Os dois ficam fixos em `server/ai.mjs`, e a única variável de ambiente é `OPENAI_API_KEY`.
- A chave fica **só no servidor**: o React chama `POST /api/recommend`, e o servidor (`server/ai.mjs`) fala com a OpenAI. O `.env` está no `.gitignore`.
- A resposta vem em JSON estruturado (até 3 ids do cardápio, cada um com uma frase de motivo), e ids que não existem são descartados.
- Sem servidor (por exemplo, no link estático do claude.ai) ou se a IA falhar, o quiz usa as regras de `src/lib/recommend.ts` e avisa "Sugestão rápida".
- No modo `high`, cada sugestão leva de 4 a 5 segundos; no `max` levava de 9 a 19.

## O que tem

- **Feed em tela cheia**, um produto por tela, no estilo Reels, com as categorias em pílulas no topo.
- **"Ver tudo"**: o botão de grade mostra todas as opções de uma vez, separadas por seção.
- **Detalhe do produto**: "com o que se parece" (tradução para leigos), ingredientes, tamanhos e preços, alérgenos e "de onde vem" (história da bebida ou do ingrediente, a partir de conhecimento geral e não de informação oficial).
- **"Me ajuda a escolher"**: três perguntas (vontade, paladar e o que evitar), mais um campo opcional de texto livre. A IA devolve até três sugestões, cada uma com o motivo.
- **"Quero provar"**: o coração guarda o item numa lista para mostrar no balcão.
- **Eventos de interesse** (tempo em cada produto, detalhes abertos, favoritos, resultado do quiz) são salvos no `localStorage` com a chave `cm.events`. Eles vão alimentar o painel do dono.

## Dados

- `src/data/menu.json`: categorias, itens, preços, alérgenos, o texto de "com o que se parece" e as etiquetas de sabor.
- `public/menu/`: as fotos recortadas do PDF.
