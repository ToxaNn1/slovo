import { vitestReports } from '@slovo/config/test-reports';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react' }), react()],
  test: {
    ...vitestReports,
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost:5173/admin/' } },
    setupFiles: ['src/test-setup.ts'],
  },
});
