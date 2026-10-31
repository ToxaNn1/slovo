import shared from '@slovo/config/eslint';

export default [
  ...shared,
  {
    // The server Core is pure TypeScript rules; the runtime (Node, HTTP, SQL)
    // stays in the backend, behind ports. Its imports are checked by
    // dependency-cruiser (`pnpm deps`).
    files: ['**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', 'process', 'Buffer', 'require', '__dirname', '__filename'],
    },
  },
  {
    // Language-specific text comes from the Edition, never from server Core
    // code. Cyrillic text is the tripwire for the UA Edition leaking in.
    files: ['**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'Literal[value=/[\\u0400-\\u04FF]/], TemplateElement[value.raw=/[\\u0400-\\u04FF]/]',
          message:
            'The server Core must not contain language-specific text; read it from the Edition.',
        },
      ],
    },
  },
];
