import { vitestReports } from '@slovo/config/test-reports';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    ...vitestReports,
    // The tests' backend is no code of the tool.
    coverage: { ...vitestReports.coverage, exclude: ['src/test-backend.ts'] },
    include: ['src/**/*.test.ts'],
    // Each test runs the CLI as a process through tsx.
    testTimeout: 60_000,
  },
});
