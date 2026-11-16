# Recicla Slide

Site e app web (PWA) do Recicla Slide, para o demo day de 1º de dezembro de 2026.

O Recicla Slide é um sistema para prédios novos. Em cada andar há uma lixeira com duas bocas (reciclável e orgânico), ligadas por dois tubos-tobogã às centrais do térreo. Um sensor em cada boca conta os descartes. Cada descarte vale 10 pontos para o andar, e o andar campeão do mês ganha um prêmio.

| Tela | Endereço | Para quê |
|---|---|---|
| Site | `/` | Apresentação: o que é, como funciona, ranking ao vivo, para quem é, perguntas e contato |
| App do morador | `/app/?andar=7` | Ranking, seu andar, prêmio do mês e pontos no próprio nome. O `?andar=7` é o link da etiqueta NFC |
| Telão | `/telao/` | Ranking em tela cheia para projetor ou TV, com animação a cada descarte |
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
npm test        # 27 testes, usando o Chrome já instalado
npm run capturas  # capturas de todas as telas em capturas/ (fora do git)
```

Os testes cobrem: registrar descarte, desfazer, atalhos de teclado e descartes automáticos no painel; placar atualizando em outra aba (telão e app), subida na lista e novo líder; zerar e cancelar, voltar ao exemplo; abrir com `?andar=7`, escolher e trocar de andar, andar inexistente, contador pessoal e erro de carregamento no app; linhas do sensor; demonstração, menu, links e revelação na rolagem da página inicial; rolagem horizontal; uso sem internet, manifest e página 404.

Outras ferramentas: `node tools/auditoria.mjs` (contraste, foco, nomes e alvos de toque), `node tools/og.mjs` (imagem de compartilhamento) e `npm run icones` (ícones da PWA).

## Apresentar no dia

### Antes de subir no palco (10 minutos)

1. Abra o **telão** no Chrome do computador ligado ao projetor: `.../telao/`.
2. No **mesmo navegador**, abra o **painel**: `.../demo/` (o placar é local, então as janelas precisam ser do mesmo navegador e do mesmo perfil).
3. No painel, clique em **Voltar aos dados de exemplo**.
4. Arraste a janela do telão para o projetor e aperte **F** (ou o botão "Tela cheia"). Depois de 3 segundos parado, o cursor e os botões somem.
5. Abra as quatro telas uma vez com internet. Depois disso tudo funciona offline.
6. Se for usar o sensor: abra o telão com `?sensor=1` e siga o [guia do sensor](docs/sensor-serial.md).

### Roteiro sugerido (2 minutos)

1. **Site**: mostre o tobogã da abertura e role até "Escolha um andar e faça um descarte".
2. **Telão**: registre 5 descartes no 7º andar (pelo sensor ou pelo painel). A cada um, a linha brilha e sobe o "+10". No quinto, o 7º andar (340 pontos) passa o 2º andar e sobe para 3º lugar.
3. Registre 3 descartes no 8º andar: ele chega a 420 pontos, passa o 4º andar e aparece a celebração de **novo líder** com o prêmio do mês.
4. **App**: no celular, encoste na etiqueta NFC (ou abra `.../app/?andar=7`). Mostre o destaque do andar e o "Pontue no seu nome".

### Atalhos do painel

| Tecla | Ação |
|---|---|
| `1` a `9`, `0` | escolhe o andar (`0` é o 10º) |
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

## Como o código está organizado

```
index.html            site
app/ telao/ demo/     as três telas do sistema (cada uma com index.html)
404.html              página de endereço inexistente
css/base.css          tokens do DESIGN.md e componentes compartilhados
css/*.css             estilos de cada tela
js/dados.js           módulo ÚNICO de dados (toda leitura e escrita passa por aqui)
js/comum.js           peças de interface compartilhadas (formatação, avisos, animação FLIP, linha do ranking)
js/app.js telao.js demo.js site.js   uma por tela
js/serial.js          leitura do sensor pela Web Serial
js/pwa.js  sw.js      instalação e uso offline
js/vendor/            GSAP 3.15 copiado para dentro do projeto
fonts/                Rubik e Nunito Sans (woff2, licença OFL)
data/edificio-exemplo.json   prédio, prêmio e contagens de exemplo
docs/                 sensor, ESP32 e etiqueta NFC
tests/                testes Playwright
tools/                servidor local, capturas e gerador de ícones
```

### Trocar por um banco de dados online depois

Hoje o placar fica no `localStorage` do navegador, e as abas se avisam pelo `BroadcastChannel`. Para usar um banco online, reescreva só o `js/dados.js` mantendo as mesmas funções (`obterPlacar`, `registrarDescarte`, `zerarPlacar`, `aoMudar` etc.) e o formato do que elas devolvem. As telas não precisam mudar. O comentário no topo do arquivo descreve o formato.

### Mudar dados de exemplo, prêmio ou pontos por descarte

Edite `data/edificio-exemplo.json` e aumente `versaoDados` para os navegadores descartarem o placar antigo. Se mudar arquivos depois de publicado, aumente também `VERSAO` no `sw.js` para os aparelhos pegarem a versão nova.

## Publicar no GitHub Pages

Veja `PENDENCIAS.md` para os comandos exatos. Depois de publicado:

- Site: `https://SEU-USUARIO.github.io/recicla-app/`
- App: `https://SEU-USUARIO.github.io/recicla-app/app/?andar=7`
- Telão: `https://SEU-USUARIO.github.io/recicla-app/telao/`
- Painel: `https://SEU-USUARIO.github.io/recicla-app/demo/`

## Créditos e licenças

- Fontes [Rubik](https://fonts.google.com/specimen/Rubik) e [Nunito Sans](https://fonts.google.com/specimen/Nunito+Sans), licença SIL Open Font License 1.1 (`fonts/`).
- [GSAP](https://gsap.com) 3.15, licença "Standard No Charge" (`js/vendor/LEIA-ME.md`).
- Identidade visual: `DESIGN.md`. O logo é provisório: o ponto verde antes do nome.
