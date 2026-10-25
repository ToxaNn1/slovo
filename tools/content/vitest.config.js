import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Each test runs the CLI as a process through tsx.
    testTimeout: 60_000,
  },
});
