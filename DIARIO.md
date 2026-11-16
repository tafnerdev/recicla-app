# Diário

Uma linha por tarefa concluída, com data e hora (horário de Brasília).

| Quando | O que foi feito |
|---|---|
| 16/11 01:07 | 25 skills copiadas de `agencia` para `.claude/skills` (sessão anterior). |
| 16/11 01:12 | Dados de exemplo (`data/edificio-exemplo.json`) e módulo de dados (`js/dados.js`) (sessão anterior). |
| 16/11 06:52 | Repositório git local criado, com identidade neutra "Recicla Slide" só nesta pasta. |
| 16/11 06:57 | Base: fontes Rubik e Nunito Sans e GSAP salvos no projeto, `css/base.css` com os tokens, `js/comum.js`, simulação no módulo de dados e script de capturas. |
| 16/11 07:02 | /app pronto: ranking, destaque do andar, prêmio, contador pessoal, seletor de andar e estados de carregamento, vazio e erro. |
| 16/11 07:11 | /telao pronto: palco 16:9 (e vertical), animação de pontos e de subida, celebração de novo líder, tela cheia, estados e sensor serial com `?sensor=1`. |
| 16/11 07:14 | /demo pronto: descarte por andar, desfazer, automático, restaurar, zerar com confirmação, atalhos de teclado e últimos descartes. |
| 16/11 07:27 | Página inicial pronta: tobogã animado, o que é, 4 passos, ranking funcionando na página, para quem é, perguntas e contato de exemplo. |
| 16/11 07:29 | PWA: manifest, ícones gerados do SVG, service worker com uso offline, aviso de versão nova, botão de instalar e página 404. |
| 16/11 07:30 | Testes automatizados: 22 testes passando (fluxos principais, sensor, página inicial, offline, manifest, 404). |
| 16/11 07:32 | Hardware em docs/: protocolo e uso do sensor serial, exemplo para ESP32 e guia da etiqueta NFC. |
| 16/11 07:32 | README.md com como rodar, testar, roteiro do palco, atalhos, plano B e organização do código. |
| 16/11 07:38 | Polimento ciclo 1: auditoria automática (contraste, foco, nomes, títulos: tudo ok), alvos de toque de 44 px, quebra das perguntas, botões do celular com largura igual, seletor de andar 5+5 e painel em 2 colunas no tablet. |
| 16/11 07:41 | Polimento ciclo 2: concordância (falta/faltam), telão sem avisos no projetor, destaque parado com movimento reduzido, limite de 10 linhas no telão, menu com seção atual, imagem de compartilhamento e ajustes de acessibilidade. |
| 16/11 07:43 | Polimento ciclo 3: revisão quadro a quadro das animações do telão; corrigida a curva das animações com vários quadros (selo "subiu" sumia cedo); texto do histórico vazio do painel. |
| 16/11 07:45 | Polimento ciclo 4: diálogo de confirmação centralizado no celular (bug do reset de margem), texto do diálogo de zerar, texto do app depois de pontuar, capturas de estados e conferência do caminho dos itens no tobogã. |
| 16/11 07:45 | Polimento ciclo 5: revisão de código (sem imports sobrando nem console.log), nome acessível "Trocar de andar", teste dos descartes automáticos (23 testes) e peso das páginas (165 a 342 KB sem compressão). |
| 16/11 07:47 | Polimento ciclo 6: telão em TV em pé (1080x1920) com líder, feed e totais empilhados e feed de altura fixa para o ranking não pular; seções do site conferidas no tablet. |
| 16/11 07:48 | Polimento ciclo 7: validação de ids, referências ARIA, âncoras e links internos (sem problemas); tirado o "sem pontos" repetido nos cartões do painel zerado. |
| 16/11 07:48 | Polimento ciclo 8: texto conferido contra o briefing; "1 sensor por boca" virou "1 sensor em cada lixeira" (o briefing não diz quantos sensores; o exemplo do ESP32 explica a escolha). |
| 16/11 07:52 | Polimento ciclo 9: rodada completa (auditoria, capturas, testes); o "+10" do telão virou um selo com fundo próprio para não se misturar à barra; "Subiu!" virou "Subiu de posição." |
| 16/11 07:55 | Polimento ciclo 10: dois defeitos sérios na página inicial corrigidos (links do menu não rolavam no computador; blocos revelados ficavam 28 px fora do lugar) e teste novo para isso. 24 testes. |
| 16/11 07:56 | Polimento ciclo 11: nenhum defeito novo; testes de navegação (menu do celular, botões da abertura) e de troca de andar no app. 26 testes. Primeiro ciclo limpo. |
| 16/11 08:01 | Polimento ciclo 12: revelação na rolagem também ao voltar para cima (quem rolava rápido podia ver blocos vazios); teste de que nada fica invisível. 27 testes. Contagem de ciclos limpos recomeça. |
| 16/11 08:02 | Polimento ciclos 13 e 14: estresse do telão com 40 descartes rápidos (ordem, pontos e animações corretos, sem erros: ciclo limpo); hover protegido para não ficar preso no toque do celular (ciclo 14, correção pequena). |
| 16/11 08:03 | Polimento ciclo 15: foco do teclado conferido em execução (diálogos abrem em Cancelar e devolvem o foco; escolha de andar leva o foco ao destaque). Nada a corrigir. |
| 16/11 08:04 | Polimento ciclo 16: todo o texto visível relido; rótulo do nome sem gênero e aspas tipográficas. |
