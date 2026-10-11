import shared from '@slovo/config/eslint';

const uiFrameworks = ['react', 'react-dom', 'react-native', 'expo', '@expo/*', 'expo-*'];

export default [
  ...shared,
  {
    // The Core is pure TypeScript domain logic; UI frameworks stay outside it.
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: uiFrameworks.flatMap((name) => [name, `${name}/**`]),
              message: 'The Core must not depend on React, React Native or Expo.',
            },
          ],
        },
      ],
    },
  },
];
