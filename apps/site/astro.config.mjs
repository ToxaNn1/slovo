// @ts-check
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// The site is static, built to dist/ and deployed by .github/workflows/pages.yml.
// SITE_BASE is the path GitHub Pages serves it under: `/slovo` at the
// github.io address, empty behind the app's own domain (ADR 0071).
export default defineConfig({
  // The address canonical links, og:image and the sitemap name (ADR 0147).
  site: 'https://slovoapp.org',
  base: `${process.env['SITE_BASE'] ?? ''}/`,
  // Pages serve uk/privacy.html at /uk/privacy, the address the app links (ADR 0049).
  build: { format: 'file' },
  // A link's page loads when the pointer rests on it or it takes focus, so the
  // next page opens at once; static pages only, no API call (ADR 0160).
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
