# Protótipo: cardápio interativo

Protótipo do lado do cliente, feito em React, Vite e TypeScript. A base de referência é o cardápio oficial da Starbucks Brasil (PDF), só para uso interno.

```bash
npm install
npm run dev -- --host   # abre no celular pela rede local
```

## O que tem

- **Feed em tela cheia**, um produto por tela, no estilo Reels, com as categorias em pílulas no topo.
- **"Ver tudo"**: o botão de grade mostra todas as opções de uma vez, separadas por seção.
- **"Com o que se parece?"**: um painel com a tradução para leigos, os tamanhos e preços e os alérgenos.
- **"Ainda não sei, me ajuda a escolher"**: três perguntas (vontade, paladar e o que evitar) que devolvem três sugestões. Por enquanto a sugestão sai de regras sobre as etiquetas dos itens, em `src/lib/recommend.ts`.
- **"Quero provar"**: o coração guarda o item numa lista para mostrar no balcão.
- **Eventos de interesse** (tempo em cada produto, detalhes abertos, favoritos, resultado do quiz) são salvos no `localStorage` com a chave `cm.events`. Eles vão alimentar o painel do dono.

## Dados

- `src/data/menu.json`: categorias, itens, preços, alérgenos, o texto de "com o que se parece" e as etiquetas de sabor.
- `public/menu/`: as fotos recortadas do PDF.
