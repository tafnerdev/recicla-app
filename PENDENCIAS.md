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

**Para publicar mudanças depois:** aumente `VERSAO` no `sw.js` (por exemplo `recicla-v5`), faça o commit e rode `git push`. O GitHub Pages republica sozinho em 1 ou 2 minutos. Os celulares e o telão pegam a versão nova sozinhos: o service worker novo assume na hora e a tela recarrega uma vez, quando estiver parada (o telão espera a celebração terminar e a saída da tela cheia do botão).

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
   - "Cada lixeira tem um sensor que percebe cada descarte" (Perguntas): agora são duas lixeiras por andar, uma por tipo, como na apresentação

5. **Virada do mês.**
   O placar não zera sozinho no dia 1º. Fiz assim de propósito: o demo day é em 1º de dezembro, e um placar zerado sozinho naquela manhã apagaria a demonstração. Para fechar o mês, use **Zerar placar** no painel. Com um banco online, quem fecha o mês é o servidor.

6. **Imagem de compartilhamento (WhatsApp, LinkedIn).** Feito: o `og:image` aponta para o endereço completo publicado.

7. **Prédio com mais de 10 andares: feito na Etapa 3.**
   O telão mostra 10 por vez (o que cabe legível a distância) e alterna as páginas a cada 8 a 12 segundos. O app, o site, o painel de demonstração e o painel do síndico mostram todos os andares, até 60. No painel, dois números seguidos escolhem os andares acima do 10º.

## 4. Materiais que só vocês têm

- **Logo definitivo.** Hoje o logo é o ponto verde antes do nome. Quando houver logo, troque o desenho em `tools/icones.mjs` e rode `npm run icones` para gerar todos os ícones de novo.
- **Fotos e vídeo da lixeira.** A abertura e o app usam os renders que vocês mandaram (`assets/lixeira/`). O render com parede de concreto ainda não aparece em nenhuma tela. Quando o vídeo do giro existir, salve como `assets/lixeira/giro.mp4` e publique: a abertura troca a foto por ele sozinha.
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

0. **Ligar o placar online (Etapa 2).** Passo a passo no item 8, logo abaixo.
1. **Conferir o prédio 3D no seu celular** (Etapa 0). Na resposta da Etapa 0, o modelo e o resultado vieram como "(MODELO)" e "(O QUE APARECEU)", sem preencher. Como o prédio agora fica na aba Ranking, abra `https://tafnerdev.github.io/recicla-app/app/?diag=1#ranking` e me diga o que aparece embaixo do prédio e o modelo do celular.
2. **Duas lixeiras por andar: decidido e feito.** Como na apresentação, cada andar tem a lixeira verde (recicláveis) e a marrom (orgânicos), cada uma com seu tubo. Os textos do site, do app e dos guias já dizem isso. A tampa marrom do app é a foto da lixeira verde com a tampa pintada (só existe render da verde); quando houver render da marrom, troque em `js/lixeira.js`.
3. **"Conectadas" é simulado.** Ainda não há sensor de verdade ligado ao app, então o estado das lixeiras aparece com a marca "Simulado"; "Sem sinal" aparece quando o celular está sem internet. "Último descarte" é verdadeiro: vem dos descartes registrados (painel, sensor ou a etiqueta neste celular).
4. **Painel do síndico (Etapa 3).**
   - **Se você já tinha colado o `schema.sql` antes,** cole de novo o arquivo inteiro. Ele acrescenta as colunas, a tabela de alertas e as funções novas sem apagar nada. Testei rodar o arquivo duas vezes seguidas num Postgres de verdade (PGlite).
   - **Prédio cadastrado sem o placar online** fica só no navegador em que foi criado. No iPhone, o Safari e o app instalado guardam coisas separadas. Para o demo day, cadastre depois de ligar o Supabase.
   - **Entupimento de verdade** precisa de um sensor na central do térreo, que avise quando o descarte chega. Hoje o alerta vem do botão "Simular entupimento" do painel de demonstração, e o banco já tem a tabela `alertas` pronta para o sensor.
   - **Estado e pilhas das lixeiras são simulados** (marcados "Simulado") até os sensores existirem. O último descarte é real.
   - **Prêmio:** fica marcado "Exemplo" no app e no telão até o síndico desmarcar "Ainda é exemplo". Desmarque só com o patrocinador confirmado.

## 8. Ligar o placar online (Supabase), Etapa 2

Enquanto isto não for feito, tudo continua funcionando em modo local (cada navegador com o seu placar). Leva uns 15 minutos.

1. **Criar o projeto.** Entre em https://supabase.com com a conta do seu pai e clique em **New project**.
   - Name: `recicla-slide`.
   - Database Password: clique em "Generate", guarde com ele. Essa senha **não** vai para o site.
   - Region: **South America (São Paulo)**. Plano: Free.
   - Espere 1 ou 2 minutos até o projeto ficar pronto.
2. **Criar o banco.** Menu **SQL Editor** > **New query**. Cole o conteúdo inteiro do arquivo `supabase/schema.sql` e clique em **Run**. Deve aparecer "Success. No rows returned".
3. **Conferir o Realtime.** Menu **Database** > **Publications** > `supabase_realtime`. As tabelas `descartes`, `participantes` e `eventos_predio` devem estar ligadas (o `schema.sql` já liga; se alguma estiver desligada, ligue).
4. **Criar o prédio do demo day.** No **SQL Editor**, numa query nova, rode (troque o nome e o PIN; o PIN tem de 4 a 6 números e só vocês sabem):
   ```sql
   select criar_predio('Edifício Demo Day', 20, 4, '123456');
   ```
   O resultado é o **código do prédio**, por exemplo `K7M2QX`. Anote. Depois do passo 7, também dá para cadastrar pelo formulário do painel do síndico (`/sindico`).
5. **Copiar a URL e a chave pública.** Menu **Project Settings** > **API** (em algumas versões, "Data API" e "API Keys"). Copie a **Project URL** e a chave **anon public**. **Não** copie a `service_role`: ela nunca entra no site.
6. **Preencher o `js/config.js`:**
   ```js
   export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJ...';
   ```
7. **Publicar.** Aumente a `VERSAO` no `sw.js` (se estiver `recicla-v10`, troque para `recicla-v11`) e rode no PowerShell, na pasta do projeto:
   ```powershell
   git add js/config.js sw.js
   git commit -m "Liga o placar online"
   git push
   ```
8. **Testar.** Depois de 1 ou 2 minutos:
   - abra no computador `https://tafnerdev.github.io/recicla-app/telao/?predio=K7M2QX&palco=1` (com o seu código);
   - aponte a câmera do celular para o QR code: ele entra no prédio e mostra "Você mora no Xº andar";
   - toque em "Reciclável": o telão muda em menos de um segundo.

**O que vale saber:**
- A chave `anon` é pública por natureza: qualquer pessoa com ela pode criar prédios e registrar descartes pelo painel (`demo`). O servidor confere tudo (andar válido, tipo válido, 2 segundos entre toques do mesmo celular), mas não sabe quem é quem. Para o demo day isso basta. Se o sistema for usado de verdade, vale pôr um limite de prédios por dia e proteger o painel.
- O "aparelho" é um número aleatório que o navegador cria. Não há e-mail, nome nem senha de morador no banco.
- Para voltar um aparelho ao prédio de exemplo, abra qualquer tela com `?predio=exemplo`.
- Na plateia, os celulares precisam de internet (Wi-Fi do local ou 4G). Se a internet do palco cair, use o plano B: `.../telao/?simular=1`, que roda uma demonstração automática sem internet.
