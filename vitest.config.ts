import { defineConfig } from 'vitest/config';

// NodeNext source imports use explicit .js extensions; map them back to .ts for tests.
export default defineConfig({
  resolve: { extensionAlias: { '.js': ['.ts', '.js'] } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
