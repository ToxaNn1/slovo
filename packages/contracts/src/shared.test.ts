import { describe, expect, it } from 'vitest';

import { EntryTextSchema } from './shared';

describe('an Entry text', () => {
  it('accepts text with no space at either end', () => {
    expect(EntryTextSchema.safeParse('захід').success).toBe(true);
  });

  it('keeps inner spaces', () => {
    expect(EntryTextSchema.parse('рано-вранці на захід')).toBe('рано-вранці на захід');
  });

  it.each(['', ' ', '\t\n'])('refuses the blank text %j', (text) => {
    expect(EntryTextSchema.safeParse(text).success).toBe(false);
  });

  it.each([' захід', 'захід ', ' захід', 'захід\n'])(
    'refuses the padded text %j with a message, never trimming it',
    (text) => {
      const result = EntryTextSchema.safeParse(text);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toMatch(/space/i);
    },
  );
});
