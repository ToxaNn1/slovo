import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Makes one fresh database for the run and drops it after (src/test-support.ts).
    globalSetup: ['./src/global-setup.ts'],
  },
});
