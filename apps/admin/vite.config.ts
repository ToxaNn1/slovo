import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { mockAdminApi } from './src/mock/vite-plugin';

// `pnpm dev:admin` (scripts/dev-admin.mjs) names the local backend; it refuses
// a Deployment before Vite starts. `--mock` is the mode `mock`, with no proxy.
const backend = process.env['SLOVO_ADMIN_API_URL'] ?? 'http://localhost:8787';

export default defineConfig(({ mode }) => ({
  base: '/admin/',
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    ...(mode === 'mock' ? [mockAdminApi()] : []),
  ],
  server:
    mode === 'mock' ? {} : { proxy: { '/admin/api': backend, '/v1': backend, '/health': backend } },
}));
