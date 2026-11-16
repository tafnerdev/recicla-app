# Pendências

Tudo aqui depende de você. Em cada item eu escolhi a opção mais segura e segui em frente.

## Decisões para confirmar

1. **Descarte no próprio nome não soma para o andar.**
   O contador pessoal do /app conta só para a pessoa. Quem soma os pontos do andar é o sensor da lixeira, então somar nos dois contaria o mesmo descarte duas vezes.
   Para mudar, é uma linha em `js/dados.js` (`registrarDescartePessoal`).

2. **Identidade dos commits.**
   O git deste PC não tem nome nem e-mail configurados. Para não expor dados pessoais num repositório público, os commits saíram como `Recicla Slide <recicla-slide@users.noreply.github.com>`, configurado só nesta pasta.
   Se quiser seu nome, rode antes de publicar: `git config user.name "Seu Nome"` e `git config user.email "seu-email"`.

3. **Contato de exemplo.**
   A página inicial mostra `contato@example.com`, marcado como exemplo. Troque em `index.html` (procure por `CONTATO DE EXEMPLO`).

4. **Prêmio do mês de exemplo.**
   "Noite da pizza no salão de festas" está em `data/edificio-exemplo.json`, marcado como exemplo. Troque pelo prêmio que vocês quiserem mostrar.
