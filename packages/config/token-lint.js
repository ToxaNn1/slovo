const SIZE_PROPERTY =
  '/^(fontSize|lineHeight|gap|rowGap|columnGap|padding\\w*|margin\\w*|borderRadius|border\\w*Radius)$/';
const MESSAGE = 'Take sizes from `@slovo/ui` tokens (docs/react-native.md)';

/**
 * The files the token rule covers: `tokens.ts` defines the tokens and a test
 * may write any value, so both are left out.
 */
export const tokenScope = {
  files: ['**/*.{ts,tsx}'],
  ignores: ['**/tokens.ts', '**/*.test.{ts,tsx}'],
};

/**
 * `no-restricted-syntax` selectors that ban sizes, spacings, radii and colours
 * written as literals instead of taken from the `@slovo/ui` tokens
 * (docs/react-native.md).
 *
 * `no-restricted-syntax` is one rule with one array, and a later declaration
 * replaces an earlier one for the same file. A workspace part that has other
 * selectors of its own, such as the Cyrillic ban of `packages/ui`, therefore
 * spreads these into that array for the files of `tokenScope`.
 */
export const tokenSelectors = [
  {
    // A non-zero number: the raw text holds a digit other than 0.
    selector: `Property[key.name=${SIZE_PROPERTY}] > Literal[raw=/^[0-9.]*[1-9]/], Property[key.name=${SIZE_PROPERTY}] > UnaryExpression > Literal[raw=/^[0-9.]*[1-9]/]`,
    message: MESSAGE,
  },
  {
    selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
    message: MESSAGE,
  },
];

/** The token rule alone, for a workspace part with no other restricted syntax. */
export default [
  {
    ...tokenScope,
    rules: { 'no-restricted-syntax': ['error', ...tokenSelectors] },
  },
];
