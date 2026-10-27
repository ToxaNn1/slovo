import shared from '@slovo/config/eslint';
import tokenLint from '@slovo/config/token-lint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  ...shared,
  ...tokenLint,
  { ignores: ['.expo/**', 'ios/**', 'android/**', 'expo-env.d.ts'] },
  {
    // The rules of hooks, effect dependencies and the React Compiler's rules.
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.flat['recommended-latest'].rules,
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    // A release build keeps the device's log where anyone with the unlocked
    // phone and a Mac can read it, so the app writes to it only through its
    // logger, which scrubs personal data the way crash reports do (#661).
    rules: { 'no-console': 'error' },
  },
  { files: ['src/diagnostics/log.ts'], rules: { 'no-console': 'off' } },
];
