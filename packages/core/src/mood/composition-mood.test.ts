import { describe, expect, it } from 'vitest';

import { openComposition } from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, testEdition, word, type TestEditionOverrides } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

const moods = [
  { id: 'calm', name: 'Calm', emoji: '😌' },
  { id: 'sad', name: 'Sad', emoji: '😢' },
];

/** The Core composition of one app run over a calm Word and a Word without moods. */
async function run({ edition = {} }: { edition?: TestEditionOverrides } = {}) {
  return openComposition({
    content: createMemoryContentPort({
      words: [word('w_quiet', { moods: ['calm'] }), word('w_plain')],
    }),
    edition: testEdition({
      isFeatureEnabled: (feature) => feature === 'moods',
      userSettingDefaults: {
        mix: {
          categoryIds: 'all',
          corrections: false,
          idioms: false,
          synonymRows: false,
          tips: false,
        },
      },
      ...edition,
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: fakeClock().clock,
    random: { next: () => 0.25 },
  });
}

describe('the composition’s mood draw', () => {
  it('offers the Edition’s moods, a mood with no Eligible Word refused, and lands on a Word of the mood', async () => {
    const app = await run({ edition: { moods } });

    expect(await app.moodDraw.moods()).toEqual([
      { mood: moods[0], refusal: undefined },
      { mood: moods[1], refusal: 'no-eligible-word' },
    ]);
    expect((await app.moodDraw.draw('calm'))?.wordId).toBe('w_quiet');
  });

  it('offers no mood for an Edition that lists none', async () => {
    const app = await run();

    expect(await app.moodDraw.moods()).toEqual([]);
  });
});
