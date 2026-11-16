# Recicla Slide

Site e app web (PWA) do Recicla Slide, para o demo day de 1º de dezembro de 2026.

O Recicla Slide é um sistema para prédios novos. Em cada andar há duas lixeiras, a verde de recicláveis e a marrom de orgânicos, cada uma ligada pelo seu tubo-tobogã à sua central no térreo. Um sensor em cada lixeira conta os descartes. Cada descarte vale 10 pontos para o andar, e o andar campeão do mês ganha um prêmio.

**Visual:** vidro, luz e letra fina. Fundo quase preto, letra Geist fina e grande, vidro só no que flutua e a cor aparecendo só como luz e como dado (verde = reciclável, laranja = orgânico). No centro de tudo está o prédio com os dois tubos de luz, em 3D onde o aparelho aguenta. As regras estão em [`DESIGN.md`](DESIGN.md) e o que mudou no redesign em [`RESUMO-REDESIGN.md`](RESUMO-REDESIGN.md).

| Tela | Endereço | Para quê |
|---|---|---|
| Site | `/` | Apresentação: o que é, como funciona, ranking ao vivo, para quem é, perguntas e contato |
| App do morador | `/app/?andar=7` | Abas Início (`#inicio`) e Ranking (`#ranking`) e a folha Pontuar (`#pontuar`). O `?andar=7` é o link da etiqueta NFC: o Início mostra o aviso "Pontuar agora", que abre a folha |
| Telão | `/telao/` | Prédio com o líder aceso e o ranking em tela cheia, para projetor ou TV. `?estavel=1` para TV que pisca |
| Painel | `/demo/` | Registrar descartes à mão, desfazer, zerar e voltar ao exemplo. É o plano B do palco |

Tudo é HTML, CSS e JavaScript puros, sem etapa de build. Os números do "Edifício Exemplo" são fictícios.

## Rodar no computador

Precisa do [Node.js](https://nodejs.org) 18 ou mais novo (este PC tem o 24).

```bash
npm run servir
```

Abra `http://localhost:8080/`. O terminal mostra os endereços das quatro telas. `Ctrl+C` para parar.

- Abrir os arquivos com duplo clique (`file://`) **não funciona**: o navegador bloqueia os dados e o modo offline.
- Para simular o endereço do GitHub Pages: `npm run servir:pages` e abra `http://localhost:8080/recicla-app/`.
- Para abrir no celular na mesma rede Wi-Fi, use o IP do computador (`http://192.168.x.x:8080/`). Se o Windows perguntar, permita o Node na rede privada. Fora de `https`, o celular não instala o app.

## Testar

```bash
npm install     # só na primeira vez: instala o Playwright (dependência de desenvolvimento)
npm test        # 67 testes, usando o Chrome já instalado
npm run capturas  # capturas de todas as telas em capturas/ (fora do git)
```

Os testes cobrem: registrar descarte, desfazer, atalhos de teclado e descartes automáticos no painel; placar atualizando em outra aba (telão e app), subida na lista e novo líder; zerar e cancelar, voltar ao exemplo; abrir com `?andar=7` (e a folha Pontuar abrindo sozinha), abas pelo endereço, folha abrindo e fechando (Esc, Concluir, voltar), escolher e trocar de andar, andar inexistente, contador pessoal e erro de carregamento no app; prédio em SVG sem WebGL e em 3D com WebGL; telão em `?estavel=1` sem desfoque, sem canvas e sem animação; linhas do sensor; demonstração, menu, links e revelação na rolagem da página inicial; rolagem horizontal; uso sem internet, manifest e página 404.

Outras ferramentas: `node tools/auditoria.mjs` (contraste, foco, nomes e alvos de toque), `node tools/og.mjs` (imagem de compartilhamento), `npm run icones` (ícones da PWA) e `node tools/capturas-referencia.mjs` (capturas das telas aprovadas da pasta `referencia/`, que fica fora do git).

## Placar online e modo palco (Supabase)

Sem configuração, tudo funciona em **modo local**: o prédio de exemplo, com o placar guardado no navegador. Com o `js/config.js` preenchido (passo a passo no item 8 do `PENDENCIAS.md`), as telas abertas com `?predio=CODIGO` ficam **online**: o placar vive no Supabase e chega a todos os aparelhos em menos de um segundo pelo Realtime.

| Endereço | O que faz |
|---|---|
| `app/?predio=CODIGO` | App do morador no prédio online. O código fica guardado: o app instalado abre no mesmo prédio |
| `app/?predio=CODIGO&entrar=1` | Modo palco: o celular entra no prédio, recebe o andar com menos gente e vira o sensor (dois botões grandes) |
| `telao/?predio=CODIGO&palco=1` | Telão com o QR code para a plateia entrar e o contador "37 pessoas no prédio" |
| `telao/?simular=1` | Plano B sem internet: demonstração automática no prédio de exemplo |
| `demo/?predio=CODIGO` | Painel do prédio online. Desfazer e fechar o mês pedem o PIN do síndico |
| qualquer tela com `?predio=exemplo` | Volta este aparelho ao prédio de exemplo |

- **Banco:** `supabase/schema.sql` (tabelas, funções e Realtime). Ninguém escreve direto nas tabelas: toda escrita passa por funções que conferem tudo no servidor, inclusive 2 segundos entre toques do mesmo celular.
- **Código:** só o `js/dados.js` sabe que existe o Supabase (por meio do `js/remoto.js`). As telas usam as mesmas funções nos dois modos.
- **Sem internet:** os toques esperam numa fila, o app mostra um chip discreto "Sem conexão" e manda tudo quando a conexão volta. O telão fica com o último placar.

## A lixeira e o anel de LED

A abertura do site e o Início do app mostram a lixeira (os renders de `assets/lixeira/`). Por cima da foto há um brilho verde desenhado exatamente sobre o anel de LED (`js/lixeira.js`): ele respira devagar e dá um pulso a cada descarte, verde no reciclável e laranja no orgânico.

**Vídeo do giro:** quando existir `assets/lixeira/giro.mp4`, a abertura do site troca a foto pelo vídeo (mudo, em laço, com a foto como capa). Basta colocar o arquivo na pasta e publicar. Com "reduzir movimento" ou economia de dados, fica a foto.

## O prédio: 3D ou SVG

O prédio é montado por `js/predio.js`. Primeiro aparece sempre o desenho em SVG, gerado para o número de andares dos dados. Depois, quando o prédio entra na tela, ele troca sozinho pelo 3D (`js/predio3d.js`, com Three.js) **somente se** todas estas condições valerem:

- o navegador tem WebGL;
- "reduzir movimento" está desligado no sistema;
- a tela não está no modo estável (`?estavel=1`);
- o 3D carregou sem erro e desenha pelo menos 24 quadros por segundo (medidos depois do aquecimento, só enquanto o prédio está na tela; telas limitadas a 30 Hz passam).

Qualquer falha volta para o SVG, sem mensagem. Para saber o que aconteceu num aparelho, abra a tela com `?diag=1` (por exemplo `.../app/?diag=1`): embaixo do prédio aparece "3D · 60 quadros/s" ou "SVG · " e o motivo. Os dois mostram a mesma coisa: o andar do morador (no app) ou o líder (no telão e no site) aceso, e um ponto de luz descendo pelo tubo certo a cada descarte. No app e no site dá para arrastar o prédio 3D para girar. Para ver o SVG de propósito, abra qualquer tela com `?svg=1`.

## Modo estável do telão (`?estavel=1`)

Para TVs que piscam com animação contínua (como a da escola): abra `.../telao/?estavel=1`. Nesse modo não há desfoque (o vidro vira cinza escuro opaco), não há WebGL (o prédio fica em SVG), a luz ambiente fica parada e os números trocam direto, sem contagem. As posições trocam com um corte seco, e a linha que pontuou fica 2 segundos um pouco mais clara. Combina com o sensor: `.../telao/?estavel=1&sensor=1`.

## Apresentar no dia

### Antes de subir no palco (10 minutos)

1. Abra o **telão** no Chrome do computador ligado ao projetor: `.../telao/`.
2. No **mesmo navegador**, abra o **painel**: `.../demo/` (o placar é local, então as janelas precisam ser do mesmo navegador e do mesmo perfil).
3. No painel, clique em **Voltar aos dados de exemplo**.
4. Arraste a janela do telão para o projetor e aperte **F** (ou o botão "Tela cheia"). Depois de 3 segundos parado, o cursor e os botões somem.
5. Abra as quatro telas uma vez com internet. Depois disso tudo funciona offline.
6. Se for usar o sensor: abra o telão com `?sensor=1` e siga o [guia do sensor](docs/sensor-serial.md).

### Roteiro sugerido (2 minutos)

1. **Site**: mostre o prédio da abertura (os pontos de luz descendo pelos tubos) e role até "Escolha um andar e faça um descarte".
2. **Telão**: registre 5 descartes no 7º andar (pelo sensor ou pelo painel). A cada um, o ponto de luz desce pelo tubo, o número conta e aparece um "+10" discreto. No quinto, o 7º andar (340 pontos) desliza para o 3º lugar.
3. Registre 3 descartes no 8º andar: ele chega a 420 pontos, passa o 4º andar, acende no prédio e entra a folha de **novo líder** por 4 segundos.
4. **App**: no celular, encoste na etiqueta NFC (ou abra `.../app/?andar=7`). No topo aparece "Você está no 7º andar. Pontuar agora"; toque nele para abrir "Qual lixeira você usou?". Depois mostre as abas Início e Ranking.
5. Se a TV piscar: troque para `.../telao/?estavel=1`.

### Atalhos do painel

| Tecla | Ação |
|---|---|
| `1` a `9`, `0` | escolhe o andar (`0` é o 10º; dois números seguidos escolhem os de cima: `1` e `5` = 15º) |
| `R` / `O` | reciclável / orgânico no andar escolhido |
| `Z` | desfaz o último descarte |

O botão **Descartes automáticos** faz um descarte aleatório a cada 4 segundos, para o telão não ficar parado durante a conversa.

### Se algo der errado

| Problema | Saída |
|---|---|
| O sensor falhou | Use o painel `/demo/` no mesmo navegador. |
| Sem internet | As telas já abertas uma vez funcionam offline. |
| Placar bagunçado | Painel > **Voltar aos dados de exemplo**. |
| Descarte errado | Painel > **Desfazer** (ou tecla `Z`). |
| O telão não atualiza | Confira se o telão e o painel estão no mesmo navegador. Recarregar o telão não perde nada. |
| A TV pisca ou o computador está lento | Abra o telão com `?estavel=1`. |

## Como o código está organizado

```
index.html            site
app/ telao/ demo/     as três telas do sistema (cada uma com index.html)
404.html              página de endereço inexistente
css/base.css          variáveis do DESIGN.md e componentes compartilhados (vidro, botões, barra, linha do ranking)
css/*.css             estilos de cada tela
js/dados.js           módulo ÚNICO de dados (toda leitura e escrita passa por aqui)
js/comum.js           peças de interface compartilhadas (formatação, ícones, avisos, animação FLIP, linha do ranking)
js/lixeira.js         a lixeira (foto) com o anel de LED que respira e pulsa a cada descarte
js/predio.js          o prédio em SVG e a escolha entre SVG e 3D
js/predio3d.js        o prédio em 3D (Three.js)
js/app.js telao.js demo.js site.js   uma por tela
js/serial.js          leitura do sensor pela Web Serial
js/config.js          endereço e chave pública do Supabase (vazio = modo local)
js/remoto.js          a conversa com o Supabase (só o dados.js usa)
supabase/schema.sql   o banco do placar online, para colar no SQL Editor
js/pwa.js  sw.js      instalação e uso offline
js/vendor/            GSAP 3.15, Three.js 0.180, supabase-js 2.118 e uqr (QR code), copiados para dentro do projeto
fonts/                Geist (texto) e Rubik (só o logo), woff2 com licença OFL
data/edificio-exemplo.json   prédio (20 andares, 4 apartamentos por andar), prêmio e contagens de exemplo
assets/lixeira/       renders da lixeira; se existir giro.mp4 aqui, a abertura do site usa o vídeo
assets/video/         vídeo de lançamento de 26 s (fica fora do cache offline)
docs/                 sensor, ESP32, etiqueta NFC e capturas do redesign (docs/redesign/)
tests/                testes Playwright
tools/                servidor local, capturas e gerador de ícones
```

### Trocar por um banco de dados online depois

Hoje o placar fica no `localStorage` do navegador, e as abas se avisam pelo `BroadcastChannel`. Para usar um banco online, reescreva só o `js/dados.js` mantendo as mesmas funções (`obterPlacar`, `registrarDescarte`, `zerarPlacar`, `aoMudar` etc.) e o formato do que elas devolvem. As telas não precisam mudar. O comentário no topo do arquivo descreve o formato.

### Mudar dados de exemplo, prêmio ou pontos por descarte

Edite `data/edificio-exemplo.json` e aumente `versaoDados` para os navegadores descartarem o placar antigo. Se mudar arquivos depois de publicado, aumente também `VERSAO` no `sw.js` para os aparelhos pegarem a versão nova.

## Publicar no GitHub Pages

Veja `PENDENCIAS.md` para os comandos exatos. Depois de publicado:

- Site: `https://tafnerdev.github.io/recicla-app/`
- App: `https://tafnerdev.github.io/recicla-app/app/?andar=7`
- Telão: `https://tafnerdev.github.io/recicla-app/telao/`
- Painel: `https://tafnerdev.github.io/recicla-app/demo/`

## Créditos e licenças

- Fontes [Geist](https://vercel.com/font) e [Rubik](https://fonts.google.com/specimen/Rubik), licença SIL Open Font License 1.1 (`fonts/`).
- [GSAP](https://gsap.com) 3.15, licença "Standard No Charge", e [Three.js](https://threejs.org) 0.180, licença MIT (`js/vendor/LEIA-ME.md`).
- Identidade visual: `DESIGN.md`. O logo é provisório: o ponto verde antes do nome.
