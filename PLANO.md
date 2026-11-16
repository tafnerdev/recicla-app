# Plano do Recicla Slide

Site e app web (PWA) para o demo day de 1/12/2026. Tudo estático, em HTML, CSS e JavaScript puros, sem etapa de build.
Marque `[x]` quando a tarefa estiver pronta e anote a hora no `DIARIO.md`.

## 0. Organização
- [ ] Repositório git local, `.gitignore`, `.nojekyll` e `package.json` (Playwright como dependência de desenvolvimento)
- [ ] `PLANO.md`, `DIARIO.md`, `PENDENCIAS.md` e `DESIGN.md`
- [ ] Servidor local sem dependência (`tools/servidor.mjs`)

## 1. Base
- [ ] Fontes Rubik e Nunito Sans salvas em `fonts/`, com a licença OFL
- [ ] GSAP salvo em `js/vendor/`, com a licença
- [ ] `css/base.css` com os tokens do `DESIGN.md`, reset e componentes (botão, cartão, etiqueta, aviso, esqueleto, diálogo)
- [ ] `js/comum.js` com formatação (ordinal, pontos, mês), avisos, estados de erro e animação FLIP
- [ ] Revisar `js/dados.js`: simulação em memória para a página inicial e eventos usados pelas telas

## 2. Telas
- [ ] `/app`: ranking, destaque do andar, pontos do mês, prêmio, contador pessoal, `?andar=7`, seletor de andar e estados de carregamento, vazio e erro
- [ ] `/telao`: ranking 16:9, animação de pontos e de subida na lista, novo líder, tela cheia e estados de carregamento, vazio e erro
- [ ] `/telao`: leitura do sensor pela porta serial (Web Serial), desligada por padrão e ligada com `?sensor=1`
- [ ] `/demo`: descarte por andar e tipo, desfazer, zerar com confirmação, restaurar exemplo, modo automático, atalhos de teclado e últimos descartes
- [ ] `/`: abertura com o tobogã animado, como funciona em 4 passos, demonstração do ranking, para quem é, perguntas frequentes e contato de exemplo

## 3. PWA
- [ ] `manifest.webmanifest`, ícones PNG (192, 512, maskable, apple-touch) gerados do SVG
- [ ] `sw.js` com cache de tudo para uso offline e `js/pwa.js` com aviso de nova versão e botão de instalar

## 4. Hardware
- [ ] `docs/sensor-serial.md`: protocolo `R,7` / `O,7` e como ligar no telão
- [ ] `docs/esp32/recicla_sensor.ino`: exemplo para ESP32
- [ ] `docs/etiqueta-nfc.md`: como gravar a etiqueta NFC

## 5. Testes
- [ ] Playwright com o Chrome já instalado no PC (sem baixar navegador)
- [ ] Registrar descarte, placar atualizar em outra aba, zerar, abrir com `?andar=7`
- [ ] Extras: leitura de linhas do sensor, contador pessoal, funcionamento offline

## 6. Documentação
- [ ] `README.md`: como rodar, testar e apresentar no dia

## 7. Polimento (repetir até três ciclos seguidos sem nada relevante)
Capturas em 390x844, 768x1024 e 1440x900 (e 1920x1080 no telão), crítica, correção e nova captura.
Conferir teclado, foco visível, "reduzir movimento", contraste AA, rolagem horizontal, animações só com transform e opacity, português.
- [ ] Ciclo 1
- [ ] Ciclo 2
- [ ] Ciclo 3

## 8. Publicação
- [ ] Conferir `gh auth status`
- [ ] Publicar no GitHub Pages ou deixar os comandos em `PENDENCIAS.md`
- [ ] `RESUMO.md`
