import { type Category } from '@slovo/contracts';
import { openComposition, type Clock, type Composition, type UserStateFacts } from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { UndoToastProvider } from '@slovo/ui';
import { act } from '@testing-library/react-native';

import { edition } from '../edition/edition';
import { renderHookInApp } from '../shell/test-app';
import { opened, testShell } from '../shell/test-support';

// Helpers of the app's hook tests. No screen or module of the app imports them.

/** The two Categories of the test Language Pack, each with Words. */
export const nature: Category = {
  id: 'nature-weather',
  displayName: 'Природа і погода',
  description: 'Природа і погода.',
  tone: 'loud',
};
export const crafts: Category = {
  id: 'household-crafts',
  displayName: 'Побут і ремесла',
  description: 'Побут і ремесла.',
  tone: 'loud',
};

/** The Words of the test Language Pack: `w_one` in nature, the rest in crafts. */
export const wordIds = ['w_one', 'w_two', 'w_three'] as const;

/** Each Word with a meaning of its own, so the Due Quiz can ask it. */
const content = createMemoryContentPort({
  categories: [nature, crafts],
  words: wordIds.map((id, index) => ({
    kind: 'word' as const,
    id,
    lemma: id.slice(2),
    stress: [],
    partOfSpeech: 'adverb' as const,
    primaryDefinition: `The meaning of ${id.slice(2)}.`,
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

/**
 * Renders `hook` in a test Shell over a composition of the test Language Pack
 * and the user state `facts` give, under the Edition and an undo toast. Gives
 * back the composition, so a test reads what the hook changed, and `reopen`,
 * which opens the composition again over the same user state and closes the
 * one before, as a sync does (ADR 0018): the Shell's opening gives the new
 * one from then on, while what is drawn keeps the one it was drawn with.
 */
export async function renderOverComposition<T>(hook: () => T, facts: UserStateFacts = {}) {
  const clock: Clock = {
    now: () => new Date('2026-10-13T09:00:00Z'),
    timeZone: () => 'Europe/Kyiv',
  };
  const userState = await seedUserState(facts, { clock });
  const open = (): Promise<Composition> =>
    openComposition({ content, edition, userState, clock, random: { next: () => 0.25 } });
  const composition = await open();
  let current = opened(composition);
  const shell = testShell({
    composition: {
      get state() {
        return current.state;
      },
      opened: () => current.opened(),
      reopen: () => Promise.resolve(),
      subscribe: () => () => undefined,
    },
  });
  const rendered = await renderHookInApp(hook, { shell, Screen: UndoToastProvider });
  return {
    composition,
    hook: rendered,
    reopen: async (): Promise<Composition> => {
      const before = await current.opened();
      const after = await open();
      current = opened(after);
      await before.close();
      return after;
    },
  };
}

/** Runs `change` and lets the writes it fires and the renders after them finish. */
export async function settled(change: () => unknown): Promise<void> {
  await act(async () => {
    await change();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
