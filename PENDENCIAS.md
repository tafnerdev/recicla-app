# Pendências

Tudo aqui depende de você. Em cada item eu escolhi a opção mais segura e segui em frente.

## 1. Publicar no GitHub Pages (não foi feito)

Conferi com `gh auth status`: o **GitHub CLI (`gh`) não está instalado** neste PC, então não há login no GitHub. Como combinado, não tentei autenticar nem publicar. O código está pronto, testado e com todos os commits no ramo `main` desta pasta.

Rode no **PowerShell**, um bloco de cada vez:

```powershell
# 1. Instalar o GitHub CLI (só na primeira vez). Depois feche e abra o PowerShell.
winget install --id GitHub.cli -e

# 2. Entrar na sua conta do GitHub (abre o navegador; escolha GitHub.com e HTTPS)
gh auth login

# 3. Criar o repositório público "recicla-app" e enviar o código
cd "C:\caminho\da\pasta\Recicla Slide"
gh repo create recicla-app --public --source . --remote origin --push

# 4. Ligar o GitHub Pages no ramo main, pasta raiz
gh api --method POST "repos/{owner}/{repo}/pages" -f "source[branch]=main" -f "source[path]=/"

# 5. Ver o endereço publicado (leva 1 a 2 minutos para ficar no ar)
gh api "repos/{owner}/{repo}/pages" --jq .html_url
```

Depois, abra e confira as quatro telas: `.../recicla-app/`, `.../recicla-app/app/?andar=7`, `.../recicla-app/telao/` e `.../recicla-app/demo/`.

**Sem instalar o `gh`:** crie em github.com um repositório público chamado `recicla-app`, **sem** README. Depois rode:

```powershell
cd "C:\caminho\da\pasta\Recicla Slide"
git remote add origin https://github.com/SEU-USUARIO/recicla-app.git
git push -u origin main
```

Em seguida, no GitHub: **Settings > Pages > Build and deployment > Source: Deploy from a branch > Branch: `main`, pasta `/ (root)` > Save**.

**Depois de publicar:**
- Grave as etiquetas NFC com o endereço publicado ([docs/etiqueta-nfc.md](docs/etiqueta-nfc.md)).
- Troque o `og:image` do `index.html` por um endereço completo (item 6 abaixo).
- Se mudar qualquer arquivo depois, aumente `VERSAO` no `sw.js` (por exemplo `recicla-v2`) antes de enviar, para os celulares pegarem a versão nova.

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

6. **Imagem de compartilhamento (WhatsApp, LinkedIn).**
   A imagem `icons/og-imagem.png` já existe. Depois de publicar, troque em `index.html` o `og:image` por um endereço completo, por exemplo `https://SEU-USUARIO.github.io/recicla-app/icons/og-imagem.png`. Sem `https://` no começo, o WhatsApp não mostra a imagem.

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
