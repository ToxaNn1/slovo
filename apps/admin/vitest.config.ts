import { vitestReports } from '@slovo/config/test-reports';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    ...vitestReports,
    projects: [
      {
        plugins: [tanstackRouter({ target: 'react' }), react()],
        test: {
          name: 'screens',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          environmentOptions: { jsdom: { url: 'http://localhost:5173/admin/' } },
          setupFiles: ['src/test-setup.ts'],
        },
      },
      // `pnpm dev:admin` as a process, with no MSW in the test itself.
      { test: { name: 'scripts', include: ['scripts/**/*.test.ts'], environment: 'node' } },
    ],
  },
});
