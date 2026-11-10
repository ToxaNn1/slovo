// Mutation testing over the Core (ADR 0097): Stryker changes the Core's code
// one mutant at a time and runs the Vitest tests that cover it, so a mutant
// that survives is a wrong result no test catches. `pnpm mutation` runs it;
// .github/workflows/mutation.yml runs it weekly. No score fails the run until
// the owner sets a floor.
/** @type {import('@stryker-mutator/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.js' },
  plugins: ['@stryker-mutator/vitest-runner'],
  // The Core's code; the tests, their support modules and the fakes of its
  // ports are what the mutants are checked against, not mutated themselves.
  mutate: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.test-support.ts',
    '!src/test-support.ts',
    '!src/testing.ts',
    '!src/fakes/**',
    '!src/**/*.d.ts',
  ],
  // A static mutant (a module-level value) reruns every test, about half of
  // a full run's time for one mutant in eight; they are left out.
  ignoreStatic: true,
  // Only mutants of code or tests changed since the last run are tested again.
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
  reporters: ['html', 'clear-text', 'json', 'progress'],
  htmlReporter: { fileName: 'reports/mutation/mutation.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  thresholds: { high: 80, low: 60, break: null },
};
