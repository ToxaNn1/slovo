import { describe, expect, it } from 'vitest';

import { buildIdiomCard } from '../index';
import { idiom } from '../test-support';

describe('the Idiom card', () => {
  it('shows the expression, the Idiom Type, the Definitions, the Examples, the etymology and the sources', () => {
    const card = buildIdiomCard(
      idiom('i_baidyky', {
        expression: 'бити байдики',
        primaryDefinition: 'Ледарювати.',
        extraDefinitions: ['Марнувати час.'],
        examples: [{ text: 'Годі бити байдики!', author: 'Test author' }],
        etymology: 'Байдики — цурки для дитячих ігор.',
        sources: [{ title: 'СУМ-11' }, { title: 'Фразеологічний словник' }],
      }),
    );

    expect(card).toEqual({
      kind: 'idiom',
      idiomId: 'i_baidyky',
      expression: 'бити байдики',
      idiomType: 'idiom',
      primaryDefinition: 'Ледарювати.',
      extraDefinitions: ['Марнувати час.'],
      examples: [{ text: 'Годі бити байдики!', author: 'Test author' }],
      etymology: 'Байдики — цурки для дитячих ігор.',
      sourceTitles: ['СУМ-11', 'Фразеологічний словник'],
    });
  });

  it('carries the place name type and leaves the etymology out when an idiom has none', () => {
    expect(
      buildIdiomCard(
        idiom('i_place', { idiomType: 'placeName', etymology: 'Named after Berdych.' }),
      ),
    ).toMatchObject({
      idiomType: 'placeName',
      etymology: 'Named after Berdych.',
    });
    expect(buildIdiomCard(idiom('i_plain'))).toMatchObject({
      idiomType: 'idiom',
      etymology: undefined,
      extraDefinitions: [],
      examples: [],
    });
  });
});
