import shared from '@slovo/config/eslint';
import tokenLint from '@slovo/config/token-lint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  ...shared,
  ...tokenLint,
  { ignores: ['.expo/**', 'ios/**', 'android/**', 'expo-env.d.ts'] },
  {
    // The rules of hooks and effect dependencies. The React Compiler rules of
    // the plugin's presets are left out.
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    // A release build keeps the device's log where anyone with the unlocked
    // phone and a Mac can read it, so the app writes to it only through its
    // logger, which scrubs personal data the way crash reports do (#661).
    rules: { 'no-console': 'error' },
  },
  { files: ['src/log.ts'], rules: { 'no-console': 'off' } },
];
