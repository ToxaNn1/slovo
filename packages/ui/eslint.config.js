import shared from '@slovo/config/eslint';
import { tokenScope, tokenSelectors } from '@slovo/config/token-lint';
import reactHooks from 'eslint-plugin-react-hooks';

const cyrillicBan = {
  selector:
    'Literal[value=/[\\u0400-\\u04FF]/], TemplateElement[value.raw=/[\\u0400-\\u04FF]/], JSXText[value=/[\\u0400-\\u04FF]/]',
  message: 'The UI must not contain language-specific text; read it from the Edition.',
};

export default [
  ...shared,
  {
    // Text and token values come from the Edition, never from the UI code.
    // Cyrillic text is the tripwire for the Ukrainian Edition leaking in.
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', cyrillicBan],
    },
  },
  {
    // The same array again with the token selectors, for every file the token
    // rule covers: a later declaration replaces the earlier one.
    ...tokenScope,
    rules: {
      'no-restricted-syntax': ['error', cyrillicBan, ...tokenSelectors],
    },
  },
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
];
