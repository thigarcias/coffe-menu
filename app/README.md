# Protótipo: cardápio interativo

Protótipo do lado do cliente, feito em React, Vite e TypeScript. A base de referência é o cardápio oficial da Starbucks Brasil (PDF), só para uso interno.

```bash
npm install
cp .env.example .env    # e coloque sua OPENAI_API_KEY
npm run dev -- --host   # abre no celular pela rede local
```

Para produção:
- **Vercel:** a rota da IA é a função `api/recommend.mjs`. Configure só `OPENAI_API_KEY` em Settings → Environment Variables.
- **Node próprio:** `npm run build && npm start` (o servidor em `server/index.mjs` serve o build e a rota da IA).

## Testes (mobile first)

```bash
npm run test:e2e          # layout + capturas em 5 celulares (320px a 430px)
npm run test:e2e:update   # aceita uma mudança visual feita de propósito
```

Os testes ficam em `e2e/layout.spec.ts` e rodam no Chromium com os tamanhos de iPhone SE, iPhone 15, iPhone 15 Pro Max, Pixel 7 e Galaxy S9+. Eles conferem:
- o app preenche a tela, fica preso à janela (sem a faixa vazia do Safari) e nunca rola para o lado;
- nenhum botão sai da tela, e a pílula da categoria cobre a categoria ativa, mesmo quando a fonte carrega depois;
- a foto não invade o texto nem as categorias, o texto do dock não é cortado e os alvos de toque têm pelo menos 44px;
- o detalhe, o quiz (com a IA simulada e com o plano B por regras) e a grade funcionam;
- as capturas de referência em `e2e/__screenshots__/` não mudaram sem querer.

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

## Acesso ao painel /admin

Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no .env e na Vercel.
No Supabase Auth, mantenha o provedor de e-mail ativo e desative o autocadastro
e o login anônimo em Authentication → Sign In / Providers.

Após a venda, crie o usuário com e-mail e senha em Authentication → Users.
Confirme o e-mail após validar o endereço com o cliente. No SQL Editor do
Supabase, substitua o UUID pelo ID do usuário criado para liberar o painel:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) ||
  '{"coffe_admin": true}'::jsonb
where id = '00000000-0000-0000-0000-000000000000';
```

O cliente acessa /admin com as credenciais cadastradas. Se já tiver entrado
antes da liberação, deve sair e entrar novamente. O painel usa dados de exemplo.

## Editor de cardápio por unidade

O editor em `/admin#cardapio` requer o esquema de `supabase/migrations/20261114015222_coffe_menu_personalizacao.sql` e uma unidade vinculada ao usuário. A migração foi aplicada ao projeto Supabase configurado e validada com rascunho temporário em transação revertida; valide também o envio e a leitura de imagens com uma unidade de teste. Não exponha o schema `coffe_menu_private` na Data API. Execute os advisors de segurança após a aplicação.

Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `OPENAI_API_KEY`. Uma política de Storage libera ao público apenas imagens referenciadas pela versão publicada; as demais permanecem privadas. A equipe provisiona unidades pelo SQL administrativo, vinculando `owner_id` ao usuário já criado em `auth.users` e usando slug único (letras minúsculas, números e hífens simples). A conta também precisa da liberação existente para `/admin` (`coffe_admin` em `app_metadata`). Nenhum cadastro público de unidades ou funcionário é habilitado.

O link de cada unidade é `/?unidade=<slug>`; o painel gera o QR. O arquivo de referência permanece na raiz sem o parâmetro. Publicações e rascunhos são separados, e o estoque é independente. A recomendação do quiz em unidades usa regras locais: a API de IA atual conhece apenas o menu de referência. Quando o cliente informa restrições ou texto livre, nenhuma sugestão automática é apresentada; é necessário consultar a equipe. Os pedidos continuam simulados no navegador.
`nExecute `npm run test:menu-db` para verificar a migração e fluxos de isolamento em PostgreSQL local isolado (PGlite). Esse teste não substitui a validação no Supabase com Storage e Auth reais.

