# Etapas do `prompt-app.md`

Uma etapa por vez. No fim de cada uma: testes passando, `VERSAO` do `sw.js` aumentada, commit e push. Aqui fica o que mudou, os links para testar e o que conferir no celular. A etapa seguinte só começa com o seu "pode seguir".

> Se o app já estiver instalado no celular, feche e abra de novo (ou recarregue a página duas vezes) para pegar a versão nova.

---

## Etapa 0 · Consertos (16/11/2026)

### O que mudou

**Menu do site no celular.** Antes, os links abriam numa caixa de vidro solta por cima do texto, e a página continuava rolando por trás. Agora:
- o menu é uma folha que sobe de baixo, igual às folhas do app;
- o fundo escurece e desfoca, e a página de trás fica parada;
- fecha pelo X, por um toque fora dela ou pelo Esc do teclado;
- ao tocar numa seção, a folha fecha primeiro e só depois a página desce até a seção.

Conferi em 390 px (celular) e em 768 px (tablet). No computador, os links continuam no cabeçalho.

**App aberto pela etiqueta (`?andar=7`).**
- A folha "Pontuar" não abre mais sozinha. O Início aparece normal, com um aviso de vidro no topo: "Você está no 7º andar." e o botão "Pontuar agora", que abre a folha.
- Depois de pontuar, o aviso some. Se a pessoa trocar de andar à mão, ele também some.
- Defeito antigo corrigido: depois de pontuar vindo da etiqueta, o botão "Concluir" não fechava a folha. O motivo era o app tirar o `?andar=7` do endereço, o que confundia o botão voltar do navegador.

**Logo do app.** Agora leva ao Início do app; se você já estiver no Início, volta ao topo. O site continua no link "Como funciona o Recicla Slide", no fim da aba Ranking.

### Prédio 3D no celular: o que descobri

Testei no Chrome emulando um celular com toque (Pixel 7), inclusive com o processador 4 e 6 vezes mais lento. Nesses testes o 3D carregou, a cerca de 175 quadros por segundo. Ainda assim, achei três motivos para ele cair para o desenho em SVG num celular de verdade. Dois deles eram defeitos e já estão corrigidos:

1. **Trocar de aba ou rolar a página no primeiro segundo derrubava o 3D para sempre.** O prédio para de desenhar quando sai da tela, mas o relógio da medição continuava contando, então a pausa parecia lentidão. Reproduzi trocando para a aba Ranking logo depois de abrir: caía para SVG. **Corrigido:** a medição pausa junto com o desenho.
2. **Telas que desenham a 30 quadros por segundo caíam para SVG.** É o que acontece no iPhone em Modo de Pouca Energia e em alguns Androids na economia de bateria. A regra era "menos de 30 quadros no primeiro segundo, cai", e essas telas medem 29. Reproduzi limitando a tela a 30 Hz com o processador mais lento: caía para SVG. **Corrigido:** a medição ignora os 12 primeiros quadros (quando o celular ainda está preparando o 3D) e o mínimo passou a 24 quadros por segundo.
3. **"Reduzir movimento" ligado no celular deixa o prédio em SVG de propósito.** No iPhone fica em Ajustes > Acessibilidade > Movimento; no Android, em "Remover animações". Isso não muda: quem pediu menos movimento não recebe o prédio girando.

Também corrigi um defeito do 3D que valia para qualquer aparelho. O brilho de cada andar (mais pontos, mais luz) chegava estragado: o 3D recebia um texto no lugar dos pontos, porque duas opções tinham o mesmo nome. Agora os andares acendem de acordo com os pontos.

**Ainda falta conferir num celular de verdade.** Não tenho um aqui. Por isso, o prédio agora anota o motivo quando fica em SVG. Com `?diag=1` no endereço, aparece embaixo dele "3D · 60 quadros/s" ou "SVG ·" seguido do motivo.

### Links para testar

- Site (abra o Menu no celular): https://tafnerdev.github.io/recicla-app/
- App como quem encostou na etiqueta: https://tafnerdev.github.io/recicla-app/app/?andar=7
- Diagnóstico do prédio 3D: https://tafnerdev.github.io/recicla-app/app/?diag=1

### Três coisas para conferir no celular

1. **Menu do site.** Role um pouco e toque em "Menu". A folha deve subir de baixo, o fundo escurecer e a página atrás não rolar. Toque fora dela para fechar. Abra de novo e toque em "Perguntas": a folha fecha e a página desce até as perguntas.
2. **App pela etiqueta.** Abra `app/?andar=7`. O Início deve aparecer sem a folha, com "Você está no 7º andar." e o botão "Pontuar agora". Toque no botão, pontue e toque em "Concluir": a folha fecha e o aviso some. Depois toque no logo: você continua no app.
3. **3D.** Abra `app/?diag=1` e me diga o que aparece embaixo do prédio ("3D · …" ou "SVG · …") e o modelo do celular. Se aparecer SVG, o texto diz o motivo.

### Testes

41 testes passando (eram 33). Os 8 novos:
- menu do celular em 390 e em 768 px (folha inteira na tela, fundo parado, Esc e toque fora fecham, o foco volta ao botão);
- no computador, os links ficam no cabeçalho;
- aviso "Pontuar agora" com a folha só abrindo ao toque, e o "Concluir" depois de pontuar;
- sem a etiqueta, o aviso não aparece;
- logo do app;
- trocar de aba logo depois de abrir não derruba o 3D;
- tela a 30 Hz continua em 3D, e a 12 Hz volta ao SVG dizendo "lento";
- "reduzir movimento" registra o motivo.

A auditoria de acessibilidade não apontou nada.
