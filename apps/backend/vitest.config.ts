import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Makes one fresh database for the run and drops it after (src/test-support.ts).
    globalSetup: ['./src/global-setup.ts'],
    // The files share that database, and a test that moves the system clock
    // makes better-auth clean up every code it then finds expired, those of
    // another file's tests included. So the files run one after another.
    fileParallelism: false,
  },
});
