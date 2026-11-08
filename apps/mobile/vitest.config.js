import { vitestReports } from '@slovo/config/test-reports';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // React Native's build flag, as Metro and jest-expo set it for a development build.
  define: { __DEV__: 'true' },
  test: {
    ...vitestReports,
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**'],
  },
});
