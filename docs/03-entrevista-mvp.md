# Entrevista do MVP

Registro das decisões tiradas das rodadas de perguntas. Vira a base do `04-mvp.md` e do backlog.

## Rodada 1 (12/11/2026)

| # | Pergunta | Resposta | Decisão |
| --- | --- | --- | --- |
| 1 | Quem vê o MVP primeiro? | Donos de cafeteria. O pitch é "um cardápio interativo com IA e algoritmo de recomendação para os seus clientes". | O MVP é uma demo de venda, feita para impressionar o dono em poucos minutos. |
| 2 | Cliente na mesa ou dono? | O painel entra no MVP, mas o cardápio vem primeiro, porque é o que mais agrega valor. | Ordem de construção: 1) cardápio; 2) painel. |
| 3 | Qual cafeteria e onde mostrar? | Ainda não sabe. Vai começar conversando com cafeterias locais. O que mais importa no protótipo são as imagens; o cardápio da Starbucks é a referência porque tem imagens. | Itens da Starbucks como referência; a decisão sobre a origem das fotos fica para a rodada 2. |
| 4 | Primeira tela? | O cardápio geral, num formato tipo Reels do Instagram, com as seções em cima, moderno e minimalista. IA e recomendação são opcionais para o cliente. | Abre direto no feed. As funções de ajuda ficam num botão, nunca no caminho. |
| 5 | Grade ou swipe? | Ainda indefinido. Referência: [reel do SipFlow](https://www.instagram.com/reel/DeM7dU4tePO/) (conta drielydiniz, 07/10/2026): "um cardápio que funciona como uma rede social". | Experiência a discutir na rodada 2. |
| 6 | Tom do "Com o que se parece" | Apontou o mesmo reel. | Pendente: o reel não mostra esse texto. |
| 7 | Prazo e mão de obra | Sem prazo. | Seguir em frente. |

## Pendências do protótipo (12/11/2026)

| Pendência | Situação | Próximo passo |
| --- | --- | --- |
| Fotos em 9:16 com fundo estendido ("Generative Expand") | A foto inteira sobre fundo desfocado foi reprovada: parece um recorte seco. Os métodos clássicos de preenchimento (espelho, OpenCV FSR, shift-map, esticar a borda) também não ficaram bons. | Recortar de novo do PDF com mais margem e estender o fundo com o LaMa local (precisa liberar a execução do modelo), uma API generativa ou o Photoshop do Victor. |
| Preços | Só 10 dos 93 itens têm preço no PDF. | Decidir entre preços ilustrativos ou preços reais. |
| Fotos de salgados e sanduíches | 15 itens sem foto. | Banco de imagem (Pexels) ou outra fonte. |
| IA de verdade no quiz | Hoje a sugestão sai de regras. | Escolher o provedor e a chave de API. |
