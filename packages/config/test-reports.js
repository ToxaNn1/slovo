import { createRequire } from 'node:module';

// In CI every test run also writes a JUnit report and a coverage summary to
// the package's coverage/ folder, which .github/workflows/ci.yml keeps as an
// artifact; a run on a machine prints what it always did.
const ci = Boolean(process.env.CI);

/** The Vitest `test` options that write the reports in CI. */
export const vitestReports = {
  ...(ci && {
    reporters: ['default', 'junit'],
    outputFile: { junit: 'coverage/vitest/junit.xml' },
  }),
  // The provider is named off CI too, so Knip sees the package it loads.
  coverage: {
    enabled: ci,
    provider: 'v8',
    reporter: ['json-summary'],
    reportsDirectory: 'coverage/vitest',
    // A red run keeps its summary too.
    reportOnFailure: true,
  },
};

/** The Jest options that write the reports in CI. */
export const jestReports = ci
  ? {
      reporters: [
        'default',
        [
          createRequire(import.meta.url).resolve('jest-junit'),
          { outputDirectory: '<rootDir>/coverage/jest', outputName: 'junit.xml' },
        ],
      ],
      collectCoverage: true,
      coverageProvider: 'v8',
      coverageReporters: ['json-summary'],
      coverageDirectory: '<rootDir>/coverage/jest',
    }
  : {};
