import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { EditionStringsSchema, EditionTokensSchema } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

const editionsDir = fileURLToPath(new URL('../../../editions/', import.meta.url));
const editions = readdirSync(editionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

function readJson(edition: string, file: string): unknown {
  return JSON.parse(readFileSync(`${editionsDir}${edition}/${file}`, 'utf8'));
}

// The Language Pack build reads neither the UI strings nor the design tokens,
// so the shell checks them here.
describe('Edition UI strings', () => {
  it.each(editions)('the %s Edition has every UI string the shell needs', (edition) => {
    expect(EditionStringsSchema.safeParse(readJson(edition, 'strings.json')).error).toBeUndefined();
  });
});

describe('Edition design tokens', () => {
  it.each(editions.filter((edition) => existsSync(`${editionsDir}${edition}/tokens.json`)))(
    'the %s Edition supplies valid design tokens',
    (edition) => {
      expect(EditionTokensSchema.safeParse(readJson(edition, 'tokens.json')).error).toBeUndefined();
    },
  );

  it('the Ukrainian Edition supplies its own colours, type families and radii', () => {
    const tokens = EditionTokensSchema.parse(readJson('uk', 'tokens.json'));

    expect(Object.keys(tokens).sort()).toEqual(['colors', 'fontFamilies', 'radii']);
  });

  it.each([
    ['a colour that is not #RRGGBB or rgba()', { colors: { light: { ink: 'red' } } }],
    ['a missing colour in a scheme', { colors: { light: {}, dark: {} } }],
    ['a negative radius', { radii: { card: -1, chip: 2, button: 4, sheet: 22 } }],
    ['an unknown token group', { shadows: {} }],
  ])('rejects %s', (_, tokens) => {
    expect(EditionTokensSchema.safeParse(tokens).success).toBe(false);
  });
});
