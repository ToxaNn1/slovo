import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import oxlint from 'eslint-plugin-oxlint';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * The shared ESLint config. Every workspace part re-exports it from its own
 * `eslint.config.js`, adding rules only where its boundary needs them.
 *
 * Oxlint runs first and owns the syntactic rules; the plugin reads the root
 * `.oxlintrc.json` and turns off in ESLint every rule that is on there.
 */
export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/.turbo/**'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    files: ['**/*.{js,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // Tools that only load CommonJS config files, such as Metro.
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  prettier,
  ...oxlint.buildFromOxlintConfigFile(
    fileURLToPath(new URL('../../.oxlintrc.json', import.meta.url)),
  ),
);
