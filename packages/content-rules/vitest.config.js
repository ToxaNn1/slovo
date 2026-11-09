import { vitestReports } from '@slovo/config/test-reports';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    ...vitestReports,
    include: ['src/**/*.test.ts'],
  },
});
