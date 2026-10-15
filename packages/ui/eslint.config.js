import shared from '@slovo/config/eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  ...shared,
  {
    // Text and token values come from the Edition, never from the UI code.
    // Cyrillic text is the tripwire for the Ukrainian Edition leaking in.
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'Literal[value=/[\\u0400-\\u04FF]/], TemplateElement[value.raw=/[\\u0400-\\u04FF]/], JSXText[value=/[\\u0400-\\u04FF]/]',
          message: 'The UI must not contain language-specific text; read it from the Edition.',
        },
      ],
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
