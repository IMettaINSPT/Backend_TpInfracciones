// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./test/setup.ts'],
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'], // 'text' para la terminal y 'html' para abrirlo en el navegador
      include: ['src/**/*.ts'], // Mide todo el código dentro de src
      exclude: [
        'src/index.ts',         // Excluye el arranque del servidor físico
        'src/database/seeder.ts' // Excluye la migración/seeder si no se testea directamente
      ],
    },
  },
});