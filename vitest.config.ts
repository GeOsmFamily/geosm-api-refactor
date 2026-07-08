import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration-db/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/**/*.d.ts'],
      // Seuil réel basé sur la couverture mesurée (~33/31/28/33 au 2026-07-06), avec une petite
      // marge pour absorber le bruit - pas un objectif arbitraire à 80%. Doit remonter au fur et
      // à mesure que la couverture des routes/repositories s'étoffe (aujourd'hui concentrée sur
      // les use-cases), jamais redescendre.
      thresholds: {
        statements: 30,
        branches: 28,
        functions: 25,
        lines: 30,
      },
    },
  },
  resolve: {
    alias: {
      '@domain': '/src/domain',
      '@application': '/src/application',
      '@infrastructure': '/src/infrastructure',
      '@presentation': '/src/presentation',
      '@config': '/src/config',
      '@': '/src',
    },
  },
});
