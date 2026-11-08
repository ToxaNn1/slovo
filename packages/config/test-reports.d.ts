/** The Vitest `test` options that write the reports in CI (test-reports.js). */
export declare const vitestReports: {
  reporters?: ('default' | 'junit')[];
  outputFile?: { junit: string };
  coverage: {
    enabled: boolean;
    provider: 'v8';
    reporter: 'json-summary'[];
    reportsDirectory: string;
    reportOnFailure: boolean;
  };
};

/** The Jest options that write the reports in CI (test-reports.js). */
export declare const jestReports: Record<string, unknown>;
