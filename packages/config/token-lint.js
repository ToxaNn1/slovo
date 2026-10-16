import { builtinRules } from 'eslint/use-at-your-own-risk';

const SIZE_PROPERTY =
  '/^(fontSize|lineHeight|gap|rowGap|columnGap|padding\\w*|margin\\w*|borderRadius|border\\w*Radius)$/';
const MESSAGE = 'Take sizes from `@slovo/ui` tokens (docs/react-native.md)';

/**
 * A warning for sizes, spacings, radii and colours written as literals instead
 * of taken from the `@slovo/ui` tokens (docs/react-native.md). `tokens.ts`
 * defines the tokens and a test may write any value, so both are left out.
 *
 * `no-restricted-syntax` holds one severity for its whole array, and the
 * Cyrillic ban of `packages/ui` stays an error. The same built-in rule is
 * therefore registered under the `tokens` plugin, which lets this one warn.
 * When the warning becomes an error, the selectors join the Cyrillic array.
 */
export default [
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/tokens.ts', '**/*.test.{ts,tsx}'],
    plugins: {
      tokens: { rules: { 'no-restricted-syntax': builtinRules.get('no-restricted-syntax') } },
    },
    rules: {
      'tokens/no-restricted-syntax': [
        'warn',
        {
          // A non-zero number: the raw text holds a digit other than 0.
          selector: `Property[key.name=${SIZE_PROPERTY}] > Literal[raw=/^[0-9.]*[1-9]/], Property[key.name=${SIZE_PROPERTY}] > UnaryExpression > Literal[raw=/^[0-9.]*[1-9]/]`,
          message: MESSAGE,
        },
        {
          selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
          message: MESSAGE,
        },
      ],
    },
  },
];
