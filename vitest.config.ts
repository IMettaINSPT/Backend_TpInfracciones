// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./test/setup.ts'],
    hookTimeout: 60000,
    testTimeout: 30000,
    fileParallelism: false, // Evita levantar 9 MongoMemoryServer simultáneos en Windows
  },
});