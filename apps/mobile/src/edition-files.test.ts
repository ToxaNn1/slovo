import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { EditionStringsSchema } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

const editionsDir = fileURLToPath(new URL('../../../editions/', import.meta.url));
const editions = readdirSync(editionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

// The Language Pack build doesn't read the UI strings, so the shell checks them here.
describe('Edition UI strings', () => {
  it.each(editions)('the %s Edition has every UI string the shell needs', (edition) => {
    const strings: unknown = JSON.parse(
      readFileSync(`${editionsDir}${edition}/strings.json`, 'utf8'),
    );

    expect(EditionStringsSchema.safeParse(strings).error).toBeUndefined();
  });
});
