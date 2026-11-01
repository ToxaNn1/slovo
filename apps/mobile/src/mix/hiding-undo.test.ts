import { openComposition, type Clock, type Composition, type TrackedUserState } from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { describe, expect, it } from 'vitest';

import { undoHide, undoRestore } from './hiding-undo';
import { fakeClock, ukrainian } from '../test-support';

const nature = { id: 'nature-weather', displayName: 'Природа і погода' };
const crafts = { id: 'household-crafts', displayName: 'Побут і ремесла' };

const content = createMemoryContentPort({
  categories: [nature, crafts],
  words: ['w_one', 'w_two', 'w_three'].map((id, index) => ({
    kind: 'word' as const,
    id,
    lemma: id.slice(2),
    stress: [],
    partOfSpeech: 'adverb' as const,
    primaryDefinition: 'A meaning.',
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId: index === 0 ? nature.id : crafts.id,
    rarity: 3,
    sources: [{ title: 'Test source' }],
    correctionIds: [],
    retired: false,
  })),
});

/** Opens the composition over the user state, as the launch and each reopen do. */
async function open(userState: TrackedUserState, clock: Clock): Promise<Composition> {
  return openComposition({
    content,
    edition: ukrainian,
    userState,
    clock,
    random: { next: () => 0.25 },
  });
}

/** The composition the reader hid with, and the one a reopen opened over the same user state, the first closed. */
async function reopened() {
  const time = fakeClock();
  const userState = await seedUserState();
  const before = await open(userState, time.clock);
  return {
    time,
    before,
    async reopen() {
      const after = await open(userState, time.clock);
      await before.close();
      return after;
    },
    /** The composition of the next app run, which reads only what was kept. */
    nextRun: () => open(userState, time.clock),
  };
}

describe('the undo of a hide, after a reopen', () => {
  it('restores the Entry in the composition open now, and keeps it restored', async () => {
    const app = await reopened();
    const hidden = await app.before.hide({ kind: 'entry', entryId: 'w_two' });
    if (hidden === undefined) throw new Error('Nothing was hidden');
    const after = await app.reopen();

    await undoHide(after, hidden.changed);

    expect(after.hiddenEntries.list).toEqual([]);
    expect((await app.nextRun()).hiddenEntries.list).toEqual([]);
  });

  it('puts the Category back in the Mix of the composition open now', async () => {
    const app = await reopened();
    const hidden = await app.before.hide({ kind: 'category', categoryId: crafts.id });
    if (hidden === undefined) throw new Error('Nothing was hidden');
    const after = await app.reopen();

    await undoHide(after, hidden.changed);

    expect(after.mix.state.hiddenCategories).toEqual([]);
    expect((await app.nextRun()).mix.state.hiddenCategories).toEqual([]);
  });
});

describe('the undo of a restore, after a reopen', () => {
  it('hides the Entry again at its old place in the Hidden list of the composition open now', async () => {
    const app = await reopened();
    await app.before.hide({ kind: 'entry', entryId: 'w_one' });
    app.time.advance(60_000);
    await app.before.hide({ kind: 'entry', entryId: 'w_two' });
    app.time.advance(60_000);
    await app.before.hide({ kind: 'entry', entryId: 'w_three' });
    const hiddenList = app.before.hiddenEntries.list;
    const restored = await app.before.unhide({ kind: 'entry', entryId: 'w_two' });
    if (restored?.hiddenAt === undefined) throw new Error('Nothing was restored');
    const after = await app.reopen();
    app.time.advance(60_000);

    await undoRestore(after, 'w_two', restored.hiddenAt);

    expect(after.hiddenEntries.list).toEqual(hiddenList);
    expect((await app.nextRun()).hiddenEntries.list).toEqual(hiddenList);
  });
});
