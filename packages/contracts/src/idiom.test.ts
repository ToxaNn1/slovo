import { describe, expect, it } from 'vitest';

import { IdiomOutputSchema, IdiomSchema } from './idiom';

const placeName = {
  id: 'i_1',
  expression: 'Лиса Гора',
  idiomType: 'placeName',
  primaryDefinition: 'Гора під Києвом.',
  etymology: 'За переказом, там збиралися відьми.',
  sources: [{ title: 'СУМ' }],
};

/** Where an Idiom fails to parse, and why; none when it parses. */
function issuesOf(
  idiom: object,
  schema: typeof IdiomSchema | typeof IdiomOutputSchema = IdiomSchema,
) {
  return schema
    .safeParse(idiom)
    .error?.issues.map(({ path, message }) => [path.join('.'), message]);
}

describe('an Idiom', () => {
  it('takes a place name with its etymology, and an idiom without one', () => {
    expect(issuesOf(placeName)).toBeUndefined();
    expect(issuesOf({ ...placeName, idiomType: 'idiom', etymology: undefined })).toBeUndefined();
  });

  it('refuses a place name without its etymology, as an output too', () => {
    const issues = [
      ['etymology', 'Required for a place name: its etymology tells the story of its name'],
    ];

    expect(issuesOf({ ...placeName, etymology: undefined })).toEqual(issues);
    expect(issuesOf({ ...placeName, etymology: undefined }, IdiomOutputSchema)).toEqual(issues);
  });

  it('refuses an expression that is not in Unicode NFC', () => {
    expect(issuesOf({ ...placeName, expression: 'Їжакове'.normalize('NFD') })).toEqual([
      ['expression', 'Expected the expression in Unicode NFC, with every letter composed'],
    ]);
  });
});
