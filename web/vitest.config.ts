import { defineConfig } from 'vitest/config'

// Separada de vite.config.ts para no cargar los plugins de PWA y HTTPS al testear.
// Los tests usan pdf-lib y pdf.js reales en Node (sin DOM): prueban la lógica de PDF y geometría.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
