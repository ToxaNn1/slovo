import { vitestReports } from '@slovo/config/test-reports';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    ...vitestReports,
    include: ['src/**/*.test.ts'],
    // Each test runs the CLI as a process through tsx.
    testTimeout: 60_000,
  },
});
