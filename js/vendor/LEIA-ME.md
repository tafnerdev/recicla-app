# Bibliotecas de terceiros

Copiadas para dentro do projeto para funcionar offline, sem CDN.

| Arquivo | Origem | Versão | Licença |
|---|---|---|---|
| `gsap.min.js` | GSAP (pacote npm `gsap`, pasta `dist/`) | 3.15.0 | GSAP Standard "No Charge" License, https://gsap.com/standard-license |
| `ScrollTrigger.min.js` | GSAP | 3.15.0 | Mesma licença |
| `three.module.min.js` e `three.core.min.js` | Three.js (pacote npm `three`, pasta `build/`) | 0.180.0 | MIT, `LICENSE-three.txt` |

O GSAP é gratuito, inclusive para uso comercial, nos termos da licença acima. O cabeçalho de cada arquivo traz o aviso de direitos autorais original, que deve ser mantido.

O Three.js está fixo na versão 0.180.0 porque as versões mais novas (0.187 em diante) não trazem mais os arquivos minificados na pasta `build/`.

As fontes ficam em `fonts/`, com as licenças SIL Open Font License 1.1 de cada família (`OFL-Geist.txt` e `OFL-Rubik.txt`).
