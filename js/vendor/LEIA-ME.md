# Bibliotecas de terceiros

Copiadas para dentro do projeto para funcionar offline, sem CDN.

| Arquivo | Origem | Versão | Licença |
|---|---|---|---|
| `gsap.min.js` | GSAP (pacote npm `gsap`, pasta `dist/`) | 3.15.0 | GSAP Standard "No Charge" License, https://gsap.com/standard-license |
| `ScrollTrigger.min.js` | GSAP | 3.15.0 | Mesma licença |
| `three.module.min.js` e `three.core.min.js` | Three.js (pacote npm `three`, pasta `build/`) | 0.180.0 | MIT, `LICENSE-three.txt` |
| `supabase.esm.js` | supabase-js (pacote npm `@supabase/supabase-js`, arquivo `dist/umd/supabase.js` com uma linha de `export` no fim) | 2.118.0 | MIT, `LICENSE-supabase.txt` |
| `uqr.mjs` | uqr, gerador de QR code (pacote npm `uqr`, `dist/index.mjs`) | 0.1.3 | MIT, `LICENSE-uqr.txt` |

O GSAP é gratuito, inclusive para uso comercial, nos termos da licença acima. O cabeçalho de cada arquivo traz o aviso de direitos autorais original, que deve ser mantido.

O Three.js está fixo na versão 0.180.0 porque as versões mais novas (0.187 em diante) não trazem mais os arquivos minificados na pasta `build/`.

As fontes ficam em `fonts/`, com as licenças SIL Open Font License 1.1 de cada família (`OFL-Geist.txt` e `OFL-Rubik.txt`).

O supabase-js só é carregado quando o `js/config.js` está preenchido e a tela abre um prédio online. O pacote ESM oficial depende de outros pacotes e precisaria de uma etapa de build; o arquivo único (UMD) já traz tudo, e a linha de `export` no fim faz ele funcionar com `import`. Usei a versão 2.118.0, de um mês antes desta etapa, em vez da 2.119.0, que tinha só 12 dias.
