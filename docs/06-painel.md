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

## Onde está o código

- `app/src/admin/Admin.tsx`: a página. `charts.tsx`: gráficos (linha, minigráfico, barras, funil, mapa de calor). `admin.css`: estilos (tudo sob `.adm`).
- `app/src/admin/mock.ts`: **os dados de exemplo**. Os números nascem de poucas premissas (visitas, conversão, ticket) e o resto é derivado, então funil, vendas e rankings concordam. É o único arquivo a trocar quando houver dados reais.
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
