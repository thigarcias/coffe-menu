# Discovery: notas das buscas

12/11/2026. Buscas rápidas para alimentar a entrevista do MVP. A maior parte das fontes é blog de fornecedor, então os números são de marketing e não de pesquisa.

## 1. Cardápio de uma cafeteria famosa para o protótipo

- **Starbucks Brasil** tem o cardápio oficial em PDF, com ofertas válidas a partir de 04/11/2025 ([PDF](https://cdn-cms-sbux.zamp.com.br//cardapio_starbucks_brasil_d88eb4df22/cardapio_starbucks_brasil_d88eb4df22.pdf)). Os preços que aparecem em notícias são antigos (de 2019 em diante) e não servem.
- As **cafeterias de especialidade** de SP mais citadas são Coffee Lab, Sofá Café, KOF e Futuro Refeitório ([Forbes](https://forbes.com.br/forbeslife/2024/04/10-cafeterias-especiais-para-conhecer-em-sao-paulo/)). A busca não achou cardápio online com preço de nenhuma delas, nem de The Coffee, Santo Grão ou Octavio Café. É preciso olhar o site ou o iFood de cada uma.
- **Ponto de atenção:** pela doc core, nome, logo e fotos de marca famosa não entram numa demonstração mostrada a terceiros. Dá para usar a estrutura e os itens como base e trocar a marca, ou montar com autorização do dono.

## 2. Painel do dono: o padrão do mercado

- O padrão é a **matriz de engenharia de cardápio**, que cruza popularidade com margem e divide os itens em quatro grupos ([Toast](https://pos.toasttab.com/blog/on-the-line/menu-engineering-matrix), [Meez](https://www.getmeez.com/blog/menu-engineering-matrix), [SpotOn](https://www.spoton.com/blog/menu-engineering/)):

| Grupo | Popularidade | Margem | O que fazer |
| --- | --- | --- | --- |
| Estrela | Alta | Alta | Manter e destacar |
| Burro de carga | Alta | Baixa | Reajustar o preço ou cortar o custo |
| Quebra-cabeça | Baixa | Alta | Reposicionar e promover |
| Cachorro | Baixa | Baixa | Tirar ou refazer |

- O corte entre os grupos costuma ser a média do próprio cardápio, e a análise é refeita de 6 a 8 semanas depois de uma mudança.
- **Para o MVP:** sem PDV, a gente não tem venda nem margem. Uma versão com o que o MVP mede seria **visto x sugerido x favoritado**. Por exemplo, "muito visto e pouco escolhido" vira o nosso "quebra-cabeça", que é justamente a pergunta "por que X não vende?".

## 3. UX de cardápio por QR

- O padrão é uma página única e rápida, com âncoras por categoria (`/menu#gelados`), e não um PDF ([Adobe](https://www.adobe.com/express/learn/blog/how-to-make-qr-code-menu)).
- As categorias seguem a cabeça do cliente: quentes, gelados, especiais, sem café, comidas e doces ([GitNexa](https://www.gitnexa.com/blogs/qr-code-menus)).
- Imagem comprimida, porque cardápio lento perde cliente. E um link curto impresso embaixo do QR, para quem não consegue escanear.
- Um estudo de caso de fluxo completo: escanear, categoria, personalizar (tamanho, açúcar, temperatura), revisar ([UXcel](https://app.uxcel.com/showcase/qr-digital-menu-for-cafe-579)).

## 4. Questionário de recomendação

Os quizzes de café do e-commerce repetem os mesmos eixos ([Trade](https://www.drinktrade.com/blog/education/coffee-quiz-answers-explained), [Coffee Bros](https://coffeebros.com/pages/coffee-match-quiz), [Partners](https://help.partnerscoffee.com/en-US/choosing-a-coffee-4944485)):

- **Sabor:** chocolate e caramelo, ou frutado e ácido.
- **Leite:** com leite, sem leite ou vegetal.
- **Força:** suave ou intenso.
- **Formato:** o que a pessoa costuma pedir (espresso, latte, coado, gelado).

Os quizzes de e-commerce têm de 5 a 7 perguntas. Na mesa, a doc core pede 3, então vale juntar eixos.

## 5. SipFlow

A busca não achou o SipFlow nem o slogan "Not another digital menu". Falta o link da página oficial que foi lida para a doc core.
