/**
 * Recicla Slide: QR code em SVG (biblioteca uqr, licença MIT, em js/vendor).
 * Módulos escuros sobre o fundo claro do cartão onde o QR é desenhado.
 */
export async function svgDoQr(texto, { cor = '#050807', ecc = 'M' } = {}) {
  const { encode } = await import('./vendor/uqr.mjs');
  const { data, size } = encode(texto, { ecc, border: 0 });
  let caminho = '';
  data.forEach((linha, y) =>
    linha.forEach((escuro, x) => {
      if (escuro) caminho += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return `<svg viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path d="${caminho}" fill="${cor}"/></svg>`;
}
