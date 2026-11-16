# Pendências

Tudo aqui depende de você. Em cada item eu escolhi a opção mais segura e segui em frente.

## 1. Publicação: feita em 16/11

O site está no ar em **https://tafnerdev.github.io/recicla-app/**, no repositório público https://github.com/tafnerdev/recicla-app (conta que já estava logada no Git deste PC). A branch `redesign` foi juntada na `main` antes de enviar.

| Tela | Endereço |
|---|---|
| Site | https://tafnerdev.github.io/recicla-app/ |
| App | https://tafnerdev.github.io/recicla-app/app/?andar=7 |
| Telão | https://tafnerdev.github.io/recicla-app/telao/ |
| Telão para TV que pisca | https://tafnerdev.github.io/recicla-app/telao/?estavel=1 |
| Painel | https://tafnerdev.github.io/recicla-app/demo/ |

Conferido no endereço publicado: o service worker ativa, guarda 34 arquivos e as quatro telas abrem sem internet (com o prédio em 3D).

**Para publicar mudanças depois:** aumente `VERSAO` no `sw.js` (por exemplo `recicla-v5`), faça o commit e rode `git push`. O GitHub Pages republica sozinho em 1 ou 2 minutos.

**Histórico:** antes de tornar o repositório público, o caminho com o nome de usuário do Windows foi trocado por um caminho genérico em todo o histórico. As etiquetas `backup-antes-publicar` e `backup-main-antes-publicar` guardam a versão antiga só neste PC (não foram enviadas).

## 2. Identidade dos commits

O git deste PC não tem nome nem e-mail configurados. Para não expor dados pessoais num repositório público, os commits saíram como `Recicla Slide <recicla-slide@users.noreply.github.com>`, configurado só nesta pasta. Se quiser seu nome nos **próximos** commits, rode `git config user.name "Seu Nome"` e `git config user.email "seu-email"` dentro da pasta. Os commits já feitos continuam com a identidade neutra.

## 3. Decisões para confirmar

1. **Descarte no próprio nome não soma para o andar.**
   O contador pessoal do /app conta só para a pessoa. Quem soma os pontos do andar é o sensor da lixeira, então somar nos dois contaria o mesmo descarte duas vezes. Para mudar, é uma linha em `js/dados.js` (`registrarDescartePessoal`).

2. **Contato de exemplo.**
   A página inicial mostra `contato@example.com` com a etiqueta "Contato de exemplo". Troque em `index.html` (procure por `CONTATO DE EXEMPLO`, são três lugares no mesmo bloco) e apague a etiqueta.

3. **Prêmio do mês de exemplo.**
   "Noite da pizza no salão de festas" está em `data/edificio-exemplo.json`, marcado como exemplo. Troque pelo prêmio que vocês quiserem mostrar. Se mudar o JSON, aumente `versaoDados` nele.

4. **Textos que fazem promessas.**
   Escrevi só o que o briefing permite, sem números, clientes nem depoimentos. Mesmo assim, confiram estas frases da página inicial com o grupo:
   - "Shafts dos tubos e centrais do térreo previstos desde o projeto" e "App do morador e telão prontos na entrega das chaves" (Para quem é)
   - "Em prédio pronto, a adaptação depende de uma avaliação de cada caso" (Perguntas)
   - "A lixeira tem um sensor que percebe cada descarte e por qual boca ele passou" (o briefing diz "um sensor por lixeira"; o exemplo do ESP32 usa um sensor por boca)

5. **Virada do mês.**
   O placar não zera sozinho no dia 1º. Fiz assim de propósito: o demo day é em 1º de dezembro, e um placar zerado sozinho naquela manhã apagaria a demonstração. Para fechar o mês, use **Zerar placar** no painel. Com um banco online, quem fecha o mês é o servidor.

6. **Imagem de compartilhamento (WhatsApp, LinkedIn).** Feito: o `og:image` aponta para o endereço completo publicado.

7. **Prédio com mais de 10 andares.**
   O telão mostra os 10 primeiros colocados, que é o que cabe legível a distância. O app e o painel mostram todos.

## 4. Materiais que só vocês têm

- **Logo definitivo.** Hoje o logo é o ponto verde antes do nome. Quando houver logo, troque o desenho em `tools/icones.mjs` e rode `npm run icones` para gerar todos os ícones de novo.
- **Fotos reais.** O site não usa fotos de banco de imagem nem imagens geradas (seria dado inventado ou serviço externo). Se houver fotos do protótipo ou da maquete, elas podem entrar na abertura e em "Para quem é".
- **QR Code para o palco.** Um QR Code com o endereço publicado no slide ajuda os investidores a abrirem o app no celular. Qualquer gerador de QR serve, depois de publicar.

## 5. Observações

- **Refração do vidro (bônus do redesign): testada e desligada.** Com o filtro SVG no `backdrop-filter`, o Chrome deixa de aplicar o desfoque e o conteúdo de trás aparece nítido através das folhas, o que atrapalha a leitura. Como o prompt manda, ficou só o vidro base aprovado. A captura do teste está em `docs/redesign/refracao-testada.png`.

- A skill `review-animations` citada no pedido não existe em `.claude/skills` nem entre as skills instaladas neste PC. Para revisar as animações usei a `emilkowalski-motion`, as skills de GSAP e uma revisão quadro a quadro do telão e da abertura (registrada no `DIARIO.md`).
- Dependências: só o Playwright (desenvolvimento) e o GSAP copiado para `js/vendor/`. As fontes foram baixadas uma vez do Google Fonts e ficam no projeto.

## 6. Redesign (vidro, luz e letra fina)

1. **Textos novos que a estrutura nova pediu.** Mantive todos os textos de antes. Entraram só estes, porque as telas novas precisavam deles:
   - App sem andar escolhido: "Escolha o seu andar para ver os pontos dele e pontuar no seu nome." e o botão "Escolher meu andar".
   - App: botão "Instalar o app" (antes "Instalar"), agora no fim da aba Ranking.
   - Demonstração do site: "+10 para o andar" embaixo de "Reciclável" e "Orgânico" (na folha do app é "+10 no seu nome", como na referência).
   - 404: "Esse andar não existe." (pedido no prompt), "O endereço pode ter sido digitado errado. Volte ao início ou escolha uma das telas." e "Voltar ao início".
   - Ranking do app: "279 descartes no prédio. Cada um vale 10 pontos." (da referência).
   - A folha Pontuar não mostra mais o número "Desde o início" (a referência mostra só os pontos do mês e os descartes). O dado continua guardado no aparelho.
2. **Barra de proporção no Início do app.** Lá ela mostra a divisão do próprio andar (reciclável e orgânico somando 100%), como na referência. No ranking, no telão e no site ela segue a regra do prompt (descartes do tipo divididos pelo total de descartes do líder).
3. **Painel e o limite de quatro vidros.** O painel tem 20 botões de vidro (seção 7.4 do prompt). Para respeitar o limite de vidros visíveis, os botões têm a aparência de vidro, mas sem desfoque (`backdrop-filter`).
4. **Three.js fixo na versão 0.180.0.** As versões a partir da 0.187 não trazem mais o arquivo minificado `three.module.min.js` que o prompt pede.
5. **Prédio 3D testado no Chrome deste PC** (WebGL ligado, cerca de 175 quadros por segundo). Abra o telão no computador do palco antes do dia. Se ficar lento, ele volta sozinho para o SVG, e `?estavel=1` desliga o 3D de vez.
6. **Telão sem "Últimos descartes" e sem o cartão "Na frente"**, como pedido: o prédio e a lista contam isso.

## 7. `prompt-app.md` (sistema de verdade)

1. **Conferir o prédio 3D no seu celular** (Etapa 0). Abra `https://tafnerdev.github.io/recicla-app/app/?diag=1` e me diga o que aparece embaixo do prédio e o modelo do celular. No emulador ele carrega; os detalhes estão no `ETAPAS.md`.
