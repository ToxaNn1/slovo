/** @type {import("prettier").Config} */
export default {
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  // Astro components in apps/site; the plugin resolves from this package.
  plugins: [import.meta.resolve('prettier-plugin-astro')],
  overrides: [{ files: '*.astro', options: { parser: 'astro' } }],
};
