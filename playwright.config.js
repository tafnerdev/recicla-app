// Testes automatizados do Recicla Slide (npm test).
// Usam o Chrome já instalado no computador: nada de baixar navegador.
import { defineConfig } from '@playwright/test';

const PORTA = 4318;
const BASE = `http://localhost:${PORTA}/recicla-app/`;

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  expect: { timeout: 6_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: BASE,
    channel: 'chrome',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: {
    // Simula o endereço do GitHub Pages (/recicla-app/) para testar os caminhos relativos.
    command: `node tools/servidor.mjs --porta ${PORTA} --base /recicla-app/`,
    url: BASE,
    reuseExistingServer: true,
  },
});
