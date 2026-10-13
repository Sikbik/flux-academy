import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    testTimeout: 20_000,
    // The registries are built with `import.meta.glob`; Vitest's persistent module cache would freeze
    // a folder listing (a new lesson or glossary file would not appear in tests until the cache is
    // cleared), so keep it off. Test runs are fast enough without it.
    fsModuleCache: false,
  },
});
