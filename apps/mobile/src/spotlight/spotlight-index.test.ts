import { SpotlightSnapshotSchema, type SpotlightSnapshot } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import { createSpotlightIndex, type SpotlightItem } from './spotlight-index';

const snapshot: SpotlightSnapshot = SpotlightSnapshotSchema.parse({
  entries: [
    {
      entry: {
        kind: 'word',
        id: 'w_sumyrnyi',
        headline: 'суми́рний',
        secondLine: 'Лагідний, тихий.',
        voiceOver: 'сумирний. Лагідний, тихий.',
      },
      route: 'entry/w_sumyrnyi',
    },
  ],
  collections: [
    { id: 'c1', name: 'Осінь', secondLine: 'Колекція · 12 слів', route: 'saved/collections/c1' },
  ],
});

/** The native module as a test sees it: each list of items it was asked to index. */
function fakeModule() {
  const writes: SpotlightItem[][] = [];
  return {
    writes,
    replaceIndex(items: SpotlightItem[]) {
      writes.push(items);
      return Promise.resolve();
    },
  };
}

describe('the Spotlight index', () => {
  it('replaces the index with one item per Entry and per Collection, each opening its route', async () => {
    const native = fakeModule();

    await createSpotlightIndex(native).replace(snapshot);

    expect(native.writes).toEqual([
      [
        {
          route: 'entry/w_sumyrnyi',
          title: 'суми́рний',
          details: 'Лагідний, тихий.',
          searchText: 'сумирний. Лагідний, тихий.',
        },
        {
          route: 'saved/collections/c1',
          title: 'Осінь',
          details: 'Колекція · 12 слів',
          searchText: 'Осінь',
        },
      ],
    ]);
  });

  it('empties the index with an empty snapshot', async () => {
    const native = fakeModule();

    await createSpotlightIndex(native).replace({ entries: [], collections: [] });

    expect(native.writes).toEqual([[]]);
  });

  it('writes nothing, and does not fail, without the native module', async () => {
    await expect(createSpotlightIndex(undefined).replace(snapshot)).resolves.toBeUndefined();
  });
});
