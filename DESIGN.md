# DESIGN.md: identidade do Recicla Slide

Este arquivo é a fonte da verdade visual. Todas as telas usam os tokens de `css/base.css`, que repetem os valores daqui.
A identidade do Recicla vale mais que qualquer sugestão de skill.

**Leitura do projeto:** site de apresentação para construtoras e condomínios de médio e alto padrão, mais um app de uso diário para moradores e um telão de palco. Linguagem escura de "floresta à noite", sóbria e tátil, com verde e laranja como sinais de reciclável e orgânico. HTML, CSS e JS puros, GSAP só onde há coreografia.

**Ajustes de intensidade** (escala de 1 a 10 da skill design-taste-frontend):
- Site (`/`): variação 6, movimento 6, densidade 4.
- App (`/app`): variação 3, movimento 4, densidade 5. É uma ferramenta de toque rápido.
- Telão (`/telao`): variação 3, movimento 7, densidade 4. Precisa ser lido a 10 metros.
- Demo (`/demo`): variação 2, movimento 3, densidade 6. Painel de operador.

## Cores

| Token | Valor | Uso |
|---|---|---|
| `--fundo` | `#071B16` | Fundo da página |
| `--fundo-2` | `#0F2C25` | Faixas e seções alternadas, cabeçalho fixo |
| `--cartao` | `#12352C` | Cartões |
| `--borda` | `#24493E` | Borda de cartão e divisória (decorativa) |
| `--borda-forte` | `#628C7E` | Borda de campo de texto e de botão fantasma (3,5:1 no cartão) |
| `--verde` | `#8BD17C` | Cor principal e **reciclável** |
| `--verde-claro` | `#B6EAA8` | Foco, realce de texto, brilho do líder |
| `--verde-escuro` | `#256B42` | Preenchimento com texto claro (5,8:1), nunca como texto |
| `--laranja` | `#F2A541` | **Orgânico** e destaques (prêmio, "+10") |
| `--texto` | `#F5F2EA` | Texto principal (12:1 no cartão) |
| `--texto-2` | `#A9C2B8` | Texto secundário (7:1 no cartão) |
| `--texto-3` | `#8FAA9F` | Metadados pequenos (5,4:1 no cartão). Não usar sobre `#18402F` |
| `--erro` | `#F28B7D` | Mensagens de erro (5,6:1 no cartão) |

Regras:
- Texto sobre verde ou laranja é sempre `--fundo` (`#071B16`), com contraste de 9,8:1 e 8,7:1.
- Reciclável é sempre verde e orgânico é sempre laranja, em todas as telas, inclusive ícones, barras e etiquetas. A cor nunca é o único sinal: sempre há texto ("Reciclável", "Orgânico") ou a letra R / O.
- Um tema só: escuro. Não há modo claro, porque a marca é escura.
- Sombras tingidas de verde-noite (`rgba(2, 12, 9, …)`), nunca preto puro.

## Tipografia

Fontes salvas no projeto (`fonts/`), sem CDN.

| Papel | Fonte | Peso | Tamanho |
|---|---|---|---|
| Título de abertura | Rubik | 800 | `clamp(2.6rem, 1.4rem + 4.6vw, 5rem)`, entrelinha 1,02, espaçamento -0,025em |
| Título de seção (h2) | Rubik | 800 | `clamp(2rem, 1.3rem + 2.6vw, 3.25rem)`, entrelinha 1,06 |
| Subtítulo (h3) | Rubik | 800 | `1.375rem`, entrelinha 1,2 |
| Números do placar | Rubik | 800 | algarismos tabulares (`font-variant-numeric: tabular-nums`) |
| Texto | Nunito Sans | 400 | `1.0625rem` (17 px), entrelinha 1,6, até 62 caracteres por linha |
| Texto forte e botões | Nunito Sans | 700 e 800 | `1rem` |
| Legenda | Nunito Sans | 600 | `0.875rem` |

- No telão, nenhum texto fica abaixo de 26 px numa tela de 1080 px de altura.
- Nada de rótulos em caixa alta com espaçamento largo acima de cada título. No máximo um a cada três seções.
- Sem travessão (—) nem meia-risca (–) em texto visível. Use ponto, vírgula, dois-pontos ou parênteses.

## Espaço

Escala de 4 px: `--e-1` 4, `--e-2` 8, `--e-3` 12, `--e-4` 16, `--e-5` 24, `--e-6` 32, `--e-7` 48, `--e-8` 64, `--e-9` 96, `--e-10` 128.
- Margem lateral: 16 px no celular, 24 px no tablet, 40 px no computador. Largura máxima do conteúdo: 1200 px.
- Seções do site: `clamp(72px, 10vw, 136px)` em cima e embaixo.

## Forma

Um sistema só, aplicado em tudo:
- Cartões: raio 20 px (`--r-cartao`). Elementos dentro de cartão: 12 px (`--r-interno`).
- Botões, etiquetas e chips: pílula (`--r-pilula: 999px`).
- Campos de texto: 12 px.
- Cartões principais usam a moldura dupla: casca externa com 6 px de respiro e o miolo com raio interno `calc(20px - 6px)`.

## Componentes

- **Botão principal:** pílula verde, texto `--fundo`, altura mínima 48 px (56 px no /demo), Nunito Sans 800.
- **Botão orgânico:** pílula laranja, texto `--fundo`.
- **Botão fantasma:** fundo transparente, borda `--borda-forte`, texto `--texto`.
- **Foco:** contorno de 3 px `--verde-claro` com 3 px de afastamento, em todos os elementos que recebem foco.
- **Etiqueta "Exemplo":** pílula com borda laranja e texto laranja, colada a todo dado fictício.
- **Aviso (toast):** cartão no rodapé, `aria-live="polite"`, some em 4 s.
- **Esqueleto de carregamento:** blocos `--cartao` com o mesmo formato do conteúdo final e brilho suave (só opacidade).
- **Logo provisório:** ponto verde (círculo `--verde`) + "Recicla Slide" em Rubik 800.

## Movimento

Uma linguagem só, em todas as telas:

| Token | Valor | Uso |
|---|---|---|
| `--t-toque` | 140 ms | Resposta de botão pressionado |
| `--t-ui` | 220 ms | Mudança de estado de interface |
| `--t-entrada` | 640 ms | Entrada de conteúdo, revelação na rolagem |
| `--t-ranking` | 900 ms | Andar mudando de posição no telão |
| `--ease-saida` | `cubic-bezier(0.22, 1, 0.36, 1)` | Padrão para quase tudo |
| `--ease-mola` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | "+10" e destaque do líder (leve passada do ponto) |
| `--ease-troca` | `cubic-bezier(0.65, 0, 0.35, 1)` | Troca de posição na lista |

- Só `transform` e `opacity`. Barras crescem com `scaleX`, nunca com `width`.
- Botões: `scale(0.97)` ao pressionar.
- Com "reduzir movimento" ligado, as trocas de posição acontecem sem deslocamento, o "+10" aparece sem subir e o tobogã da abertura fica parado, mostrando o caminho completo.
- Nada de laço infinito decorativo, exceto o tobogã da abertura (que conta a história do produto e para quando sai da tela).

## Camadas (z-index)

`--z-cabecalho: 10`, `--z-aviso: 20`, `--z-dialogo: 30`, `--z-celebracao: 40`. Nenhum outro valor.

## Ícones

Sem biblioteca de ícones (seria uma dependência nova). Os poucos ícones são formas geométricas simples desenhadas em SVG no próprio HTML, com traço de 2 px e cantos arredondados, e sempre acompanhados de texto.
