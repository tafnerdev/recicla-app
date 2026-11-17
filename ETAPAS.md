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

---

## Etapa 1 · A lixeira no centro (16/11/2026)

### O que mudou

**Abertura do site.** A lixeira (o render de parede verde) ocupa a dobra.
- No computador ela fica à direita e o título à esquerda; no celular, ela fica no alto e o texto embaixo.
- Na entrada, a foto faz um zoom lento (de 1,06 para 1 em 1,6 s) e o texto sobe logo depois. Ao rolar, a foto desce mais devagar que a página (paralaxe leve).
- Ficaram só o título, uma linha e os dois botões. O selo "Para prédios novos" e o prédio saíram da abertura.
- O cabeçalho de vidro agora flutua por cima da foto.

**Anel de LED vivo.** Um brilho verde suave fica exatamente em cima do anel de LED da foto. Medi a curva do anel em capturas ampliadas da imagem, e ele acompanha qualquer tamanho de tela.
- O anel respira devagar.
- A cada descarte, ele dá um pulso: verde no reciclável, laranja no orgânico. Na abertura do site, o pulso vem de um descarte de demonstração a cada 4 a 6 segundos. No app, vem dos descartes de verdade do seu andar e do seu toque pela etiqueta.

**Espaço para o vídeo do giro.** Se existir `assets/lixeira/giro.mp4`, a abertura usa o vídeo: mudo, em laço, `playsinline` e com a foto como capa. Enquanto o arquivo não existir, fica a foto. É só salvar o arquivo com esse nome e publicar.

**App, aba Início.** O topo agora é a "Lixeira do 7º andar":
- a foto recortada com o anel de LED;
- o estado: "Conectada", com a marca "Simulado", ou "Sem sinal" quando o celular está sem internet;
- "Último descarte há 2 min", tirado dos descartes registrados.

O prédio (SVG ou 3D) foi para a aba Ranking, menor, como contexto da lista.

**Vídeo de lançamento.** Nova seção no site, "O Recicla Slide em 26 segundos", com o vídeo da apresentação (baixado para `assets/video/`) e o quadro final como capa.
- O vídeo só baixa quando a pessoa aperta o play.
- Ele fica fora do cache offline.

**Prédio de exemplo igual ao do pitch.** Agora tem 20 andares e 80 apartamentos (4 por andar), e `versaoDados` subiu para 2: o placar antigo do aparelho é trocado pelo novo na primeira visita.
- Os andares 1 a 10 mantiveram os mesmos números, então o roteiro do palco continua igual: o 7º passa o 2º depois de 5 descartes, e o 8º vira líder depois de 3.
- Os andares 11 a 20 entram abaixo do 7º.
- No painel, dois números seguidos escolhem os andares de cima: "1" e "5" levam ao 15º.
- O telão continua mostrando os 10 primeiros; a troca de páginas é da Etapa 3.

**Outras mudanças.**
- O servidor local passou a aceitar pedidos parciais de arquivo, que o iPhone exige para tocar vídeo.
- A imagem de compartilhamento (WhatsApp) agora mostra a lixeira.

### Links para testar

- Abertura do site: https://tafnerdev.github.io/recicla-app/
- Vídeo de lançamento: https://tafnerdev.github.io/recicla-app/#video
- App com a lixeira do 7º andar: https://tafnerdev.github.io/recicla-app/app/?andar=7
- Prédio menor na aba Ranking: https://tafnerdev.github.io/recicla-app/app/#ranking
- Para ver o anel pulsar ao vivo, abra no mesmo navegador o painel https://tafnerdev.github.io/recicla-app/demo/ e toque em "Reciclável" ou "Orgânico" no 7º andar.

### Três coisas para conferir no celular

1. **Abertura.** Abra o site: a lixeira aparece grande, com um zoom lento. Espere alguns segundos: o anel de LED respira e dá um pulso, às vezes verde, às vezes laranja. Role a página: a foto desce mais devagar que o texto.
2. **Lixeira no app.** Abra `app/?andar=7`: no topo aparecem a foto com o anel, "Lixeira do 7º andar", "Conectada · Simulado" e "Nenhum descarte recente". Toque em "Pontuar agora" e depois em "Reciclável": o anel pulsa e a linha muda para "Último descarte agora". Ponha o celular em modo avião: o estado muda para "Sem sinal".
3. **Vídeo e prédio.** No site, toque no play da seção "O Recicla Slide em 26 segundos". No app, abra a aba Ranking: o prédio menor tem 20 andares, com o 7º aceso.

### Testes

53 testes passando (eram 41). Os 12 novos:
- abertura em 1440 e 390 px (a foto carregada, o prédio fora, só título, uma linha e dois botões, o anel desenhado);
- vídeo do giro: sem o arquivo fica a foto; com ele, entra o vídeo mudo, em laço e com a foto de capa;
- pulso verde no reciclável e laranja no orgânico;
- vídeo de lançamento só carrega ao tocar e o servidor responde a pedido parcial;
- card da lixeira com o estado (inclusive "Sem sinal" sem internet) e o último descarte;
- pontuar pela etiqueta acende o anel;
- prédio na aba Ranking;
- 20 andares e 80 apartamentos;
- telão com 10 linhas e painel com 20 andares;
- dois números seguidos no painel;
- vídeo fora do cache e foto dentro.

A auditoria de acessibilidade não apontou nada.

### Ainda da Etapa 0

O resultado do `?diag=1` veio sem preencher na sua resposta ("(MODELO)" e "(O QUE APARECEU)"). Como o prédio agora fica na aba Ranking, o link para conferir passou a ser https://tafnerdev.github.io/recicla-app/app/?diag=1#ranking.

---

## Ajustes antes da Etapa 2 (16/11/2026)

### 1. Atualização automática

**O que acontecia:** o service worker novo ficava esperando até todas as abas do app fecharem, e a tela só recarregava se a pessoa tocasse em "Atualizar". Por isso o seu celular ficou na versão antiga.

**Agora:**
- **Na hora:** a versão nova assume assim que é baixada.
- **Uma recarga só:** cada tela recarrega sozinha uma vez, assim que estiver parada: sem folha aberta, sem campo sendo digitado e sem animação curta rodando. Não aparece aviso nenhum.
- **Telão:** espera a celebração de novo líder terminar e 2,5 s depois do último descarte, para não cortar a luz descendo nem os números contando.
- **Telão em tela cheia:** ele também espera sair da tela cheia ativada pelo botão "Tela cheia" (ou pela tecla F), porque recarregar tiraria o telão da tela cheia no meio da apresentação. Com a tela cheia do próprio navegador (F11), recarrega normalmente.
- **Quando procura versão nova:** ao abrir, ao voltar para a aba, quando a internet volta e a cada 10 minutos.
- **Páginas abertas com o código antigo** (como a do seu celular agora): elas não sabem recarregar sozinhas, então o próprio service worker recarrega cada uma uma vez, menos o telão. Daqui para frente, isso não depende mais de nada.

### 2. Duas lixeiras por andar

Agora o produto é sempre descrito como duas lixeiras por andar: a verde, de recicláveis, e a marrom, de orgânicos, cada uma com seu tubo.
- **Site:** os textos dizem isso na descrição da página, na abertura, em "O que é", nos passos de "Como funciona" (incluindo "passe o pé embaixo e a tampa abre sozinha", como nos slides) e nas perguntas.
- **App:** a folha virou "Qual lixeira você usou?".
- **Telão e guias:** o telão fala na "etiqueta das lixeiras"; o guia da etiqueta NFC e o exemplo do ESP32 também foram corrigidos.
- **Topo do app:** passou a mostrar "Lixeiras do 7º andar" com as duas lado a lado, cada uma com o anel de LED e o seu último descarte. O pulso cai na lixeira certa: o reciclável na verde, o orgânico na marrom.
- **A lixeira marrom:** é a mesma foto com a tampa pintada de marrom (luz e sombra mantidas), porque só existe render da verde. Quando houver render da marrom, é só trocar.

### Links para testar

- https://tafnerdev.github.io/recicla-app/app/?andar=7 (as duas lixeiras no topo)
- https://tafnerdev.github.io/recicla-app/#como-funciona (os passos com as duas lixeiras)

### Três coisas para conferir no celular

1. **Atualização:** abra o app como você usa e espere alguns segundos. Ele deve recarregar sozinho uma vez e mostrar as duas lixeiras no topo, sem você tocar em nada. Se ainda aparecer a versão antiga, feche e abra uma última vez; daí em diante é automático.
2. **Duas lixeiras:** toque em "Pontuar agora" e depois em "Orgânico". A folha deve dizer "Qual lixeira você usou?", e o anel da lixeira marrom deve pulsar em laranja.
3. **Textos do site:** em "Como funciona", o primeiro passo deve falar na lixeira verde e na marrom e em "passe o pé embaixo".

### Testes

58 testes passando (eram 53). Os novos:
- recarga sozinha com a tela parada;
- espera com uma folha aberta;
- telão sem recarregar no meio da celebração;
- uma atualização de verdade do service worker, numa cópia do site, que assume sozinha e recarrega uma vez só;
- site e app sem "boca", falando em duas lixeiras.

A auditoria de acessibilidade não apontou nada.

---

## Etapa 2 · Online de verdade, com Supabase (16/11/2026)

### O que mudou

**Banco pronto para colar.** O arquivo `supabase/schema.sql` cria tudo no Supabase:
- **Tabelas:**
  - `predios` (código de 6 caracteres, nome, andares, apartamentos por andar, prêmio e patrocinador, PIN do síndico guardado só como hash);
  - `descartes` (prédio, andar, tipo, origem, aparelho, data e hora);
  - `participantes` (prédio, aparelho, andar);
  - mais os campeões de cada mês e um registro de eventos do síndico.
- **Escrita só por funções que conferem tudo no servidor.** Ninguém escreve direto nas tabelas.
  - `criar_predio` devolve o código do prédio.
  - `entrar` põe o celular no andar com menos gente; o mesmo celular recebe sempre o mesmo andar.
  - `registrar_descarte` exige 2 segundos entre toques do mesmo celular.
  - As funções do síndico pedem o PIN, com bloqueio depois de 10 erros: `definir_premio`, `desfazer_ultimo` e `fechar_mes`, que guarda o campeão e zera.
- **Leitura pública por views sem o hash do PIN**, e Realtime ligado para os descartes, as entradas e os avisos do síndico.
- Sem e-mail, sem senha, sem dado pessoal: o "aparelho" é um número aleatório criado pelo navegador.

**Dois modos, as mesmas telas.**
- **Modo local:** com o `js/config.js` vazio (como está agora), tudo funciona igual a antes.
- **Modo online:** preenchido o `config.js`, as telas abertas com `?predio=CODIGO` passam a usar o Supabase. Só o `js/dados.js` sabe disso, então as telas não mudaram de funcionamento.
- **Código lembrado:** o código do prédio fica guardado no aparelho (o app instalado abre no mesmo prédio). `?predio=exemplo` volta ao exemplo.
- **Página inicial:** a demonstração dela continua sempre no prédio de exemplo.

**Sem internet.**
- O toque fica numa fila e aparece um chip discreto: "Sem conexão · 1 toque guardado". Quando a conexão volta, os toques vão em ordem, respeitando os 2 segundos.
- O telão mostra "Sem conexão" no selo e mantém o último placar.

**Modo palco.**
- **Telão:** `telao/?predio=CODIGO&palco=1` troca o prédio por um QR code grande, com "Aponte a câmera e entre no prédio", o contador "3 pessoas no prédio" e o endereço escrito.
  - O QR fica num cartão claro, para a câmera ler bem.
  - Com a plateia tocando, o líder troca toda hora, então no palco a celebração de novo líder aparece no máximo a cada 15 s.
- **Celular:** abre pelo QR, entra no prédio e mostra "Você mora no 12º andar" numa animação curta. Depois cai numa tela com as duas lixeiras e dois botões grandes de vidro.
  - Cada toque faz o anel pulsar, vibra e envia. Os botões esperam 2 s, com uma linha fina que se enche.
  - Embaixo, a frase "No palco, o botão faz o papel do sensor da lixeira".
- **Sem o placar online:** o telão no palco explica o que falta em vez de mostrar um QR inútil, e o celular avisa e fica no app normal.
- **Plano B sem internet:** `telao/?simular=1` faz uma demonstração automática no prédio de exemplo.

**Painel no prédio online.**
- Mostra o nome e o código do prédio.
- "Zerar" vira "Fechar o mês".
- Desfazer e fechar o mês pedem o PIN do síndico.
- O "Voltar ao exemplo" some.

**Dependências.**
- supabase-js 2.118 (arquivo único, só carregado no modo online) e o gerador de QR code uqr 0.1.3 (MIT), copiados em `js/vendor/`.
- O `config.js` é buscado primeiro na rede, então a chave nova vale na hora em todos os aparelhos.

### O que falta para ficar online (com você)

O passo a passo exato está no item 8 do `PENDENCIAS.md`:
1. criar o projeto no Supabase (na conta do seu pai) e colar o `schema.sql`;
2. criar o prédio do demo day com uma linha de SQL;
3. copiar a URL e a chave `anon` para o `js/config.js`;
4. fazer commit e push.

Enquanto isso não acontece, nada quebra: tudo segue em modo local.

### Links para testar agora (modo local)

- Plano B, demonstração automática: https://tafnerdev.github.io/recicla-app/telao/?simular=1
- Telão no modo palco (explica o que falta enquanto o Supabase não está ligado): https://tafnerdev.github.io/recicla-app/telao/?palco=1
- O app normal continua igual: https://tafnerdev.github.io/recicla-app/app/?andar=7

### Três coisas para conferir

1. **Plano B:** abra `telao/?simular=1` no computador e deixe rodando. A cada 3 segundos entra um descarte, a luz desce no prédio e as linhas trocam de lugar. Ponha o computador sem internet: continua rodando.
2. **Palco sem Supabase:** abra `telao/?palco=1`. Deve aparecer "O modo palco precisa do placar online", com o que falta, em vez do QR code.
3. **Depois de ligar o Supabase** (item 8 do PENDENCIAS): abra `telao/?predio=SEUCODIGO&palco=1`, aponte a câmera de dois celulares diferentes e confira três coisas:
   - cada um cai num andar diferente;
   - o contador sobe para 2;
   - um toque em "Reciclável" muda o telão em menos de um segundo.

### Testes

67 testes passando (eram 58). Os 9 novos usam um servidor falso que segue as regras do `schema.sql`, com cada celular num contexto separado do navegador:
- dois celulares entram pelo QR e caem em andares diferentes, e o telão muda em menos de um segundo;
- trava de 2 s no servidor;
- fila sem internet com o chip;
- PIN do síndico no painel;
- sem o `config.js`, o telão no palco explica e o app avisa;
- o `?simular=1` funciona sem internet;
- a página inicial continua no exemplo;
- e um teste com o supabase-js de verdade falando com uma imitação da API REST do Supabase, para garantir que a biblioteca carrega e faz as chamadas certas.

A auditoria de acessibilidade não apontou nada.

**O que não deu para testar daqui:** o Supabase de verdade (não há conta aqui, e criar conta é com vocês). O `schema.sql` traz, no fim, umas linhas de conferência para rodar no SQL Editor logo depois de colar.

## Ajustes do Safari do iPhone, antes da Etapa 3 (16/11/2026)

### O que mudou

- **Cabeçalho perto do topo.** No navegador, o cabeçalho do site e o topo do app ficam a 10 px do alto da área visível. O recorte da câmera (`env(safe-area-inset-top)`) só entra no app instalado na tela de início, e uma vez só: o CSS usa sempre a variável `--topo-seguro`, que vale 0 no navegador.
- **Degradê atrás do cabeçalho.** Um degradê escuro vai do alto da tela até um pouco abaixo da cápsula do site e do topo do app, e o conteúdo não aparece cru atrás deles. No app instalado, uma faixa escura fica atrás do relógio e da bateria.
- **Cabeçalho que some.** Ao rolar para baixo, o cabeçalho sai da tela, junto com o degradê. Ao rolar para cima, ele volta. Perto do topo ele sempre aparece, e também quando recebe o foco do teclado. O topo do app passou a flutuar do mesmo jeito.
- **Embaixo.**
  - A barra do app, os avisos e o rodapé continuam somando a barrinha de início do iPhone (`env(safe-area-inset-bottom)`).
  - Conferi com a área segura do iPhone simulada: a barra fica 20 px acima da barrinha, e os avisos e o fim do conteúdo acima da barra.
- **Fim da faixa preta.**
  - As camadas de fundo fixas passaram a ter `100lvh` mais 40% da tela, e cobrem a tela inteira, inclusive atrás das barras do Safari. São elas as luzes, o fundo da entrada "Você mora no…" e o fundo escurecido das folhas.
  - A foto da abertura terminava numa linha reta atrás do título. Agora as bordas de cima e de baixo somem num degradê.
- No app instalado, o link "Pular para o conteúdo" aparecia no alto da tela. Agora ele fica escondido e só aparece com o teclado.

### Links

- Site: https://tafnerdev.github.io/recicla-app/
- App: https://tafnerdev.github.io/recicla-app/app/?andar=7

### Três coisas para conferir no iPhone

1. **No Safari (sem instalar):** abra o site. A cápsula deve ficar a uns 10 px do alto, sem o vão grande de antes. Role para baixo e ela some. Role um pouco para cima e ela volta.
2. **Fim da tela:** role o site até o rodapé, com a barra do Safari embaixo e depois em cima (Ajustes > Apps > Safari > Abas). Não deve aparecer faixa preta de borda reta, e a foto da abertura não termina numa linha reta.
3. **No app instalado:** o topo fica logo abaixo do relógio, uma vez só, sem vão duplo. A barra de Início, Ranking e Pontuar fica acima da barrinha do iPhone.

### Testes

74 testes passando (eram 67). Os 7 novos simulam a área segura do iPhone no Chrome (59 px em cima, 34 embaixo), com e sem o app instalado:
- o cabeçalho a 10 px no navegador e a 69 px no app instalado;
- o degradê;
- some e volta;
- volta com o foco do teclado;
- barra, avisos e rodapé;
- fundos maiores que a tela.

A auditoria de acessibilidade não apontou nada.

**O que não deu para testar daqui:** o Safari de verdade no iOS 26. O Chrome simula a área segura, mas não as barras flutuantes do Safari.
