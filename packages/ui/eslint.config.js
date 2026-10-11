import shared from '@slovo/config/eslint';

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
];
