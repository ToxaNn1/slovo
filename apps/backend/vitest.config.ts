import { vitestReports } from '@slovo/config/test-reports';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    ...vitestReports,
    include: ['src/**/*.test.ts'],
    // Gives each test file a fresh database of its own and each test a clock
    // of its own (src/test-support.ts), so the files run side by side.
    setupFiles: ['./src/test-support.ts'],
    // Writes and records the UA Edition from the seed snapshot once for every file.
    globalSetup: ['./src/seed-setup.ts'],
    // Side by side the files share the machine, so a test that builds a
    // Language Pack and sends dozens of requests may take a few seconds.
    testTimeout: 15_000,
  },
});
