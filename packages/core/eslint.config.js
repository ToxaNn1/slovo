import { builtinModules } from 'node:module';

import shared from '@slovo/config/eslint';

const uiFrameworks = ['react', 'react-dom', 'react-native', 'expo', '@expo/*', 'expo-*'];
const nodeMessage = 'The Core must not depend on Node; put platform code behind a port.';

export default [
  ...shared,
  {
    // The Core is pure TypeScript domain logic; UI frameworks and platform APIs
    // (Node included) stay outside it, behind ports.
    files: ['**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', 'process', 'Buffer', 'require', '__dirname', '__filename'],
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: builtinModules.map((name) => ({ name, message: nodeMessage })),
          patterns: [
            {
              group: uiFrameworks.flatMap((name) => [name, `${name}/**`]),
              message: 'The Core must not depend on React, React Native or Expo.',
            },
            {
              group: ['node:*'],
              message: nodeMessage,
            },
          ],
        },
      ],
    },
  },
  {
    // Language-specific values come from the Edition, never from Core code.
    // Cyrillic text is the tripwire for the Ukrainian Edition leaking in.
    files: ['**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'Literal[value=/[\\u0400-\\u04FF]/], TemplateElement[value.raw=/[\\u0400-\\u04FF]/]',
          message: 'The Core must not contain language-specific text; read it from the Edition.',
        },
      ],
    },
  },
];
