# DESIGN.md: vidro, luz e letra fina

Fonte da verdade visual do Recicla Slide desde o redesign de 16/11/2026. Substitui o design anterior (Rubik em tudo, botões cheios de verde e laranja), que foi rejeitado por parecer um jogo.

**A ideia:** um instrumento calmo e preciso de um prédio do futuro, na linha dos apps Saúde e Casa da Apple e do app da Tesla. Fundo quase preto, letra fina e grande, vidro só no que flutua, e a cor aparecendo apenas como luz e como dado.

As telas aprovadas estão em `referencia/` (fora do git). Todos os valores abaixo estão em `css/base.css` como variáveis, e as telas usam só essas variáveis.

## 1. Cores

| Variável | Valor | Uso |
|---|---|---|
| `--fundo` | `#050807` | Fundo de todas as telas |
| `--fundo-2` | `#0A100E` | Faixas alternadas do site, se precisar |
| `--texto` | `#F5F2EA` | Texto principal e números |
| `--texto-2` | `rgba(245,242,234,0.66)` | Texto secundário sobre o fundo |
| `--texto-vidro` | `rgba(245,242,234,0.72)` | Texto secundário sobre vidro |
| `--linha` | `rgba(255,255,255,0.09)` | Divisórias de 1 px |
| `--trilho` | `rgba(255,255,255,0.08)` | Trilho das barras |
| `--vidro` | `rgba(255,255,255,0.07)` | Preenchimento do vidro |
| `--vidro-forte` | `rgba(255,255,255,0.11)` | Item ativo dentro de um vidro |
| `--vidro-borda` | `rgba(255,255,255,0.16)` | Borda do vidro |
| `--verde` | `#8BD17C` | Reciclável |
| `--verde-claro` | `#B6EAA8` | Aresta do andar aceso, rótulo "você" |
| `--laranja` | `#F2A541` | Orgânico |
| `--claro` | `#F5F2EA` | Preenchimento do botão principal |
| `--sobre-claro` | `#050807` | Texto do botão principal |
| `--erro` | `#F28B7D` | Erros e ação destrutiva |

- **Verde e laranja são sinal, nunca decoração.** Aparecem só em barras, pontos coloridos, luz dos tubos, andar aceso do prédio e o rótulo "você". No máximo um destaque colorido por tela além dos dados.
- Posições, títulos, prêmio e botões são brancos ou neutros. Nada de laranja em texto.
- Não existe cartão verde. Superfície é o próprio fundo, ou vidro.
- A cor nunca é o único sinal: todo ponto colorido tem o nome ao lado.
- Um tema só, escuro.

## 2. Luz ambiente

Atrás de toda tela há duas manchas de luz paradas, para o vidro ter o que desfocar: verde `radial-gradient(circle, rgba(139,209,124,0.24), rgba(139,209,124,0) 65%)` e laranja `radial-gradient(circle, rgba(242,165,65,0.15), rgba(242,165,65,0) 65%)`. São `div` absolutos (`.luz`), `aria-hidden`, sem ponteiro, maiores que a tela e em parte para fora dela. No site e no app derivam devagar (até 30 px em 20 s, com `transform`). No telão ficam paradas.

## 3. Tipografia

- **Geist** variável (300 a 600) em tudo, salva em `fonts/` com a licença OFL.
- **Rubik 800 só no logo** "Recicla Slide".
- Todo número usa `font-variant-numeric: tabular-nums`.
- Nada de rótulo em caixa alta espaçada, nada de peso 700 ou 800 fora do logo, nada de travessão.

| Papel | App (390 px) | Telão (1080 px) |
|---|---|---|
| Número de destaque | 84 / 1 / 300 / -0.045em | 84 / 1 / 300 / -0.04em |
| Número médio | 36 / 40 / 300 / -0.04em | 64 / 72 / 300 / -0.04em |
| Título da tela | 30 / 36 / 500 / -0.03em | 40 / 46 / 500 / -0.03em |
| Título de folha | 28 / 34 / 500 / -0.03em | |
| Nome do andar | 15 / 18 / 500 | 52 / 56 / 400 (top 3), 30 / 400 |
| Pontos na lista | 17 / 18 / 400 | 84 (top 3), 34 |
| Texto | 17 / 24 / 400 | 28 |
| Texto pequeno | 15 / 22 / 400 | 26 |
| Rótulo | 13 / 18 / 400 | 26 |
| Barra de navegação | 11 / 500 | |

Site: título de abertura `clamp(2.6rem, 5.4vw, 4.75rem)`, entrelinha 1.02, peso 400, -0.045em. Títulos de seção `clamp(2rem, 3.4vw, 3rem)`, peso 500, -0.03em. Texto 19 / 30. No telão nenhum texto fica abaixo de 26 px.

## 4. Espaço e forma

- Escala de 4 px. Margem lateral do app 24 px; site 24 px no celular, 40 px no computador, conteúdo até 1200 px.
- Na dúvida, mais espaço. Seções do site separadas por `clamp(96px, 12vw, 160px)`.
- Agrupar por espaço e por linha fina, nunca por caixa. Sem moldura dupla, sem cartão dentro de cartão.
- Raios: cápsula (`999px`) para barra de navegação, botões e chips; 36 px nas folhas; 24 px nos botões grandes de vidro; 16 px na linha destacada do ranking; 32 px na linha do líder no telão.

## 5. Vidro

Só na camada que flutua: barra de navegação do app, cabeçalho do site, chips de ação, folhas, botões secundários, a linha do morador no ranking e a linha do líder no telão. **No máximo quatro vidros visíveis por tela** (exceção pedida: os botões do painel de operador).

```css
.vidro {
  background: var(--vidro);
  border: 1px solid var(--vidro-borda);
  backdrop-filter: blur(28px) saturate(170%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.24), 0 16px 40px rgba(0,0,0,0.5);
}
```

- Folhas: `rgba(255,255,255,0.08)`, `blur(32px)`, brilho interno `rgba(255,255,255,0.28)`.
- Sem `backdrop-filter` (ou no modo estável do telão): fundo `rgba(20,26,24,0.92)`.
- Pressionado: `scale(0.97)` e fundo `--vidro-forte`, em 140 ms.
- Texto sobre vidro passa no contraste AA.

## 6. Componentes

- **Logo:** ponto verde de 10 px com brilho + "Recicla Slide" em Rubik 800.
- **Botão principal:** cápsula `--claro` com texto `--sobre-claro`, peso 600, 52 px no app e 56 px no site. Um por tela.
- **Botão secundário:** cápsula de vidro, texto `--texto`, peso 500.
- **Botões "Reciclável" e "Orgânico":** dois vidros idênticos, raio 24 px, ponto de 14 px da cor com brilho, nome em 18 px peso 500 e "+10 no seu nome" embaixo. Nunca preenchidos de verde ou laranja.
- **Ponto colorido:** círculo de 8 px (12 px no telão) + nome. Substitui as antigas fichas R e O.
- **Barra de proporção:** trilho de 4 px (6 px no telão) em `--trilho`, um trecho verde e um laranja com 2 px de intervalo e cantos de 2 px. No ranking, largura = descartes do tipo / total de descartes do líder; no Início do app, a proporção do próprio andar. Cresce com `scaleX`.
- **Linha fina:** 1 px em `--linha`.
- **Chip "Exemplo":** cápsula com borda `rgba(255,255,255,0.22)`, texto `rgba(245,242,234,0.7)`, 12 px. Neutro. Colado a todo dado fictício.
- **Aviso:** cápsula de vidro perto da base, `aria-live="polite"`, some em 4 s.
- **Diálogo de confirmação:** folha de vidro centralizada; ação destrutiva com texto em `--erro`.
- **Esqueleto:** blocos em `--trilho` no formato final, com variação suave de opacidade.
- **Foco:** contorno de 2 px `--texto`, 3 px de afastamento.
- **Ícones:** SVG de traço 1.6 px, cantos arredondados, sempre com texto ou `aria-label`. Sem emoji e sem biblioteca.
- **Alvos de toque:** no mínimo 44 px.

## 7. O prédio

A imagem central do produto: um prédio isométrico com dois tubos de luz (verde para recicláveis, laranja para orgânicos). Aparece no topo do app, à esquerda no telão e na abertura do site.

**SVG (`js/predio.js`, base e plano B).** `viewBox 0 0 350 320`. Face esquerda `95,70 175,100 175,290 95,260`, direita `175,100 255,70 255,260 175,290`, topo `95,70 175,40 255,70 175,100`. Altura útil 190: com N andares, cada um tem `190/N`; o andar `n` ocupa de `d0 = (N-n)·190/N` a `d0 + 190/N`. Tubos de 9 de largura em x = 264 e 280, filetes de luz, pontos de luz e as duas centrais no térreo copiados da referência.
- **Andar aceso:** faces verdes (opacidade 0.5 e 0.3), aresta `--verde-claro` e brilho desfocado atrás. No app é o andar do morador; no telão e no site, o líder.
- No app, o líder (quando não é o morador) ganha realce branco discreto (0.10 e 0.06).
- Rótulos no app: "7º · você" em `--verde-claro`, "4º · líder" em branco a 66%, ou "7º · você, líder".
- `role="img"` e `aria-label` com o andar aceso.

**3D (`js/predio3d.js`, melhoria progressiva).** Three.js com câmera ortográfica isométrica (azimute 45°, elevação ~30°), mesmas proporções e cores do SVG. Andares em caixas escuras translúcidas com arestas brancas a 22%; emissão verde fraca proporcional aos pontos e forte no andar aceso; tubos de vidro com filete emissivo; brilho com `Sprite` aditivo, sem pós-processamento. Um ponto de luz desce pelo tubo certo a cada descarte real. Balanço de ±10° em 16 s; no app e no site dá para arrastar com inércia, sem zoom; no telão não há interação. Só entra com WebGL, sem "reduzir movimento", fora do modo estável e se o primeiro segundo passar de 30 quadros por segundo; qualquer falha volta ao SVG sem aviso.

## 8. Movimento

- Curva padrão `cubic-bezier(0.22, 1, 0.36, 1)`; troca de posição `cubic-bezier(0.65, 0, 0.35, 1)`.
- Durações: 140 ms toque, 220 ms mudança de estado, 480 ms entrada de conteúdo e folhas, 900 ms troca de posição no telão.
- Sem mola, sem confete, nada que pule. Só `transform` e `opacity`.
- **Novo descarte:** o número conta até o valor novo em 600 ms, a linha ganha um brilho branco suave que some em 1,2 s e um "+10" pequeno em texto secundário aparece ao lado do número e some.
- **Troca de posição:** as linhas deslizam para o novo lugar (FLIP), sem piscar.
- **Novo líder no telão:** o ranking escurece para 30%, entra uma folha de vidro com "Novo líder", o andar em 160 px peso 300 e "assumiu a liderança com N pontos". Um feixe de luz branca atravessa a folha uma vez. Fica 4 s.
- **Entrada das telas:** blocos sobem 12 px com opacidade, 60 ms entre eles.
- **Folhas:** sobem da base com opacidade; o fundo escurece para `rgba(5,8,7,0.35)`.
- **Vibração:** `navigator.vibrate(10)` ao registrar descarte no app.
- **Reduzir movimento:** sem deslocamento, sem contagem, sem feixe, prédio em SVG parado.
- **Modo estável do telão (`?estavel=1`):** sem desfoque, sem WebGL, sem luz em movimento, sem contagem; posições trocam com corte seco e a linha que pontuou fica 2 s mais clara.
- Nenhum laço infinito decorativo, fora o balanço do prédio 3D e a deriva da luz ambiente.

## 9. Camadas (z-index)

`--z-cabecalho: 10`, `--z-barra: 15`, `--z-aviso: 20`, `--z-folha: 30`, `--z-celebracao: 40`. Dentro de uma lista, `1` para a linha em movimento.
