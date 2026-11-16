# Resumo do trabalho

Site e app web (PWA) do Recicla Slide, prontos para o demo day de 1º de dezembro de 2026. Tudo em HTML, CSS e JavaScript puros, sem etapa de build, com 27 testes automatizados passando.

## Endereço publicado

**Publicado em 16/11** (veja o item 1 do PENDENCIAS.md). Na época deste resumo ainda não estava: O GitHub CLI (`gh`) não está instalado neste PC, então não há login no GitHub. Como combinado, não tentei autenticar. Os comandos exatos estão no item 1 do [PENDENCIAS.md](PENDENCIAS.md) e levam uns 5 minutos.

Depois de publicado, os endereços serão:

| Tela | Endereço |
|---|---|
| Site | `https://tafnerdev.github.io/recicla-app/` |
| App do morador | `https://tafnerdev.github.io/recicla-app/app/?andar=7` |
| Telão | `https://tafnerdev.github.io/recicla-app/telao/` |
| Painel | `https://tafnerdev.github.io/recicla-app/demo/` |

## O que foi feito

**Telas**
- **Site (`/`):** abertura com o corte do prédio e o tobogã animado. Os itens saem da lixeira do andar, descem pelos tubos até as centrais do térreo e o andar ganha "+10". Depois vêm o que é, como funciona em 4 passos, uma demonstração do ranking que funciona na própria página (sem mexer no placar real), para quem é, perguntas frequentes e contato de exemplo.
- **App do morador (`/app`):** seu andar com posição, pontos do mês e quantos descartes faltam para subir. Também tem o prêmio do mês, o ranking completo e "Pontue no seu nome", com contador guardado só no celular e nome opcional. O andar vem de `?andar=7` (link da etiqueta NFC) ou fica guardado no aparelho.
- **Telão (`/telao`):** ranking 16:9 legível a distância. A cada descarte, a linha brilha, sobe o "+10" e o andar sobe na lista se passou alguém. Um novo líder ganha celebração com o prêmio. Também tem tela cheia (tecla F) e um modo para TV em pé.
- **Painel (`/demo`):** botões de reciclável e orgânico por andar, desfazer, descartes automáticos, voltar ao exemplo e zerar (com confirmação), atalhos de teclado e últimos descartes.
- Estados de carregamento, de placar zerado e de erro em todas as telas, mais uma página 404.

**Base e PWA**
- Um único módulo de dados (`js/dados.js`). Para trocar por um banco online, só ele muda.
- As abas se sincronizam por `BroadcastChannel` e `localStorage`.
- Fontes Rubik e Nunito Sans e o GSAP ficam salvos no projeto, sem CDN.
- Manifest, ícones e service worker: as telas funcionam sem internet depois da primeira visita e podem ser instaladas no celular. Há aviso de versão nova, que o telão nunca mostra no projetor.
- `DESIGN.md` com os tokens da marca, seguidos em todas as telas.

**Hardware (`docs/`)**
- Leitura do sensor pela porta serial no telão (`?sensor=1`, linhas `R,7` / `O,7`), desligada por padrão, com reconexão automática e campo para testar linhas.
- Exemplo para ESP32 com dois sensores, filtro de ruído, bloqueio contra contagem dupla e botão de teste.
- Guia para gravar a etiqueta NFC.

**Qualidade**
- 27 testes Playwright com o Chrome já instalado: fluxos do painel, sincronização entre abas, zerar, `?andar=7`, contador pessoal, sensor, página inicial, uso offline, manifest e 404.
- Auditoria automática (`tools/auditoria.mjs`): contraste AA, foco visível, nomes acessíveis e títulos sem apontamentos. Alvos de toque de 44 px.
- **20 ciclos de polimento**, com capturas em 390, 768, 1440 e 1920 px. Os três últimos não acharam nada relevante. Os achados mais importantes:
  - os links do menu da página inicial não rolavam no computador;
  - os blocos revelados na rolagem ficavam 28 px fora do lugar;
  - o diálogo de confirmação ficava grudado no topo no celular;
  - o selo "subiu" do telão sumia cedo demais;
  - "Faltam 1 descarte".

  Cada ciclo está registrado no [DIARIO.md](DIARIO.md).

## O que ficou em PENDENCIAS.md

1. **Publicar no GitHub Pages:** instalar o `gh`, fazer login e rodar 3 comandos. Há também o caminho sem `gh`.
2. **Identidade dos commits:** os commits saíram com nome neutro para não expor dados pessoais.
3. **Decisões para confirmar:**
   - o descarte no próprio nome não soma para o andar;
   - trocar o contato e o prêmio de exemplo;
   - revisar três frases que fazem promessas;
   - a virada do mês é manual;
   - o `og:image` precisa de endereço completo depois de publicar;
   - o telão mostra no máximo 10 andares.
4. **Materiais que só vocês têm:** logo definitivo, fotos reais do protótipo e um QR Code para o slide.

## Como testar cada tela em 2 minutos

No terminal, dentro da pasta: `npm run servir` e abra `http://localhost:8080/` no Chrome.

**Site (`/`)**
1. Veja os itens descendo pelo tobogã e o cartão "ganhou 10 pontos" mudando.
2. Clique em **Ver o ranking**. Com o 7º andar escolhido, clique 5 vezes em **Reciclável**: no 4º clique ele empata com o 2º andar ("Subiu de posição") e no 5º passa à frente, com a linha subindo na lista.
3. No celular (ou com a janela estreita), abra o **Menu** e toque em **Perguntas**.

**App (`/app/?andar=7`)**
1. Confira "7º andar, 4º lugar, 290 pontos" e "Faltam 5 descartes".
2. Toque em **Reciclável** em "Pontue no seu nome": seus pontos vão para 10 e os do andar continuam 290.
3. Toque em **Trocar**, escolha outro andar e recarregue: o app lembra.
4. Abra `/app/?andar=42` para ver o aviso de andar inexistente.

**Telão (`/telao/`) junto com o Painel (`/demo/`)**
1. Abra os dois em abas (ou janelas) do mesmo navegador.
2. No painel, clique 5 vezes em **Reciclável** no 7º andar: no telão, a linha brilha, o "+10" sobe e o 7º andar passa o 2º.
3. Clique 3 vezes em **Orgânico** no 8º andar: o telão mostra **Novo líder: 8º andar**.
4. Teste **Desfazer**, a tecla `Z`, **Descartes automáticos** e **Zerar placar** (o telão mostra "Placar zerado"). Termine com **Voltar aos dados de exemplo**.
5. No telão, aperte **F** para tela cheia. Abra `/telao/?sensor=1`, digite `R,7` em **Testar uma linha** e tecle Enter.

**Sem internet:** com as telas abertas uma vez, desligue o Wi-Fi e recarregue `/app/?andar=7`. A tela continua funcionando.

**Testes automáticos:** `npm test` (27 testes, cerca de 15 segundos).

O roteiro do palco, os atalhos e o plano B estão no [README.md](README.md).
