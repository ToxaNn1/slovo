import { vitestReports } from '@slovo/config/test-reports';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    ...vitestReports,
    // No coverage here: its suites build real Language Packs, and V8 block
    // coverage makes that build about eight times slower (53 s to 445 s for
    // crossword-days.test.ts), past the hooks' 120 s. The JUnit report stays.
    coverage: { ...vitestReports.coverage, enabled: false },
    include: ['src/**/*.test.ts'],
  },
});
