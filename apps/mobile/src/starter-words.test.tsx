import { describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import { createFakeBackend, createMemoryContentPort, seedUserState } from '@slovo/core/testing';

import { compositionOpening } from './composition';
import { edition } from './edition/edition';
import { opened, packWithMedia } from './shell/test-support';

/** The Word whose media the app bundles, the only Starter Word of the Edition. */
const STARTER = 'w_starter';

// The bundled UA Edition, with one Starter Word, as Metro writes it for an
// Edition whose Starter Media holds that Word's Recording and Illustration.
jest.mock('slovo-editions', () => {
  const bundled = jest.requireActual<{
    defaultId: string;
    editions: Record<string, object>;
  }>('slovo-editions');
  return {
    ...bundled,
    editions: { uk: { ...bundled.editions['uk'], starterWords: ['w_starter'] } },
  };
});

// A phone that never answered the notification prompt, so the composition plans nothing on the device.
jest.mock('./notifications/device-notifications', () => {
  const { createNotificationScheduler } = jest.requireActual<
    typeof import('./notifications/notification-scheduler')
  >('./notifications/notification-scheduler');
  return {
    deviceNotificationScheduler: createNotificationScheduler(undefined, { inExpoGo: false }),
  };
});

const categoryId = 'nature';

function word(id: string): Word {
  return {
    kind: 'word',
    id,
    lemma: id,
    stress: [],
    partOfSpeech: 'noun',
    primaryDefinition: 'A meaning.',
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId,
    rarity: 3,
    sources: [{ title: 'Test source' }],
    correctionIds: [],
    retired: false,
  };
}

/** Many Words besides the Starter Word, so a Cycle that ignores it opens on another. */
const others = Array.from({ length: 30 }, (_, index) => word(`w_${String(index)}`));

describe('the composition of a new phone', () => {
  it("opens the Feed on the Edition's Starter Word", async () => {
    const clock = {
      now: () => new Date('2026-10-13T09:00:00Z'),
      timeZone: () => 'Europe/Kyiv',
    };
    const pack = packWithMedia();
    const content = createMemoryContentPort({
      categories: [
        { id: categoryId, displayName: 'Природа', description: 'Природа.', tone: 'loud' },
      ],
      // The Starter Word last, where a Cycle that orders every Word alike rarely puts it first.
      words: [...others, word(STARTER)],
    });
    const bundled = await pack.opened();

    const composition = await compositionOpening({
      languagePack: opened({ ...bundled, reader: { ...bundled.reader, ...content } }),
      ports: opened({
        backend: createFakeBackend().backend,
        clock,
        schedule: () => () => undefined,
        random: { next: () => 0.5 },
        userState: await seedUserState({}, { clock }),
        edition,
      }),
      account: undefined,
    }).opened();

    const { feed } = composition;
    expect(feed.cards[feed.startPosition]?.entryId).toBe(STARTER);
    await composition.close();
  });
});
