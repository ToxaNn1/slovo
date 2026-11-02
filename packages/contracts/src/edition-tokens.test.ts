import { describe, expect, it } from 'vitest';

import { ColorTokensSchema, EditionTokensSchema } from './edition-tokens';

/** One colour scheme with every role the Core names set to black. */
const scheme = Object.fromEntries(
  ColorTokensSchema.keyof().options.map((role) => [role, '#000000']),
);

describe('the Edition design tokens', () => {
  it('accepts a palette that sets every colour role', () => {
    expect(EditionTokensSchema.safeParse({ colors: { light: scheme, dark: scheme } }).success).toBe(
      true,
    );
  });

  it.each(['inkSecondary', 'track', 'inactiveTab'])(
    'refuses the removed colour role %s',
    (role) => {
      const withRole = { ...scheme, [role]: '#000000' };

      expect(
        EditionTokensSchema.safeParse({ colors: { light: withRole, dark: scheme } }).success,
      ).toBe(false);
    },
  );
});
