import { defineConfig } from 'vitest/config';

export default defineConfig({
  // React Native's build flag, as Metro and jest-expo set it for a development build.
  define: { __DEV__: 'true' },
  test: {
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**'],
  },
});
