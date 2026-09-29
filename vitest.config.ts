import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // tsconfig sets jsx: 'preserve' for Next — tell the transformer to compile it
  // so tests can import .tsx modules.
  // @ts-expect-error — `oxc` is a Vite 7 option newer than the bundled types; it works at runtime
  oxc: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
