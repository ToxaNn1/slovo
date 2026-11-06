import { type Category } from '@slovo/contracts';
import { openComposition, type Clock, type Composition, type UserStateFacts } from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider, UndoToastProvider } from '@slovo/ui';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
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

const content = createMemoryContentPort({
  categories: [nature, crafts],
  words: wordIds.map((id, index) => ({
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

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/**
 * Renders `hook` in a test Shell over a composition of the test Language Pack
 * and the user state `facts` give, under the Edition and an undo toast. Gives
 * back the composition, so a test reads what the hook changed.
 */
export async function renderOverComposition<T>(hook: () => T, facts: UserStateFacts = {}) {
  const clock: Clock = {
    now: () => new Date('2026-10-13T09:00:00Z'),
    timeZone: () => 'Europe/Kyiv',
  };
  const composition: Composition = await openComposition({
    content,
    edition,
    userState: await seedUserState(facts, { clock }),
    clock,
    random: { next: () => 0.25 },
  });
  const shell = testShell({ composition: opened(composition) });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider shell={shell}>
        <EditionProvider edition={edition} strings={editionStrings}>
          <UndoToastProvider>{children}</UndoToastProvider>
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>
  );
  const rendered = await renderHook(hook, { wrapper });
  return { composition, hook: rendered };
}

/** Runs `change` and lets the writes it fires and the renders after them finish. */
export async function settled(change: () => unknown): Promise<void> {
  await act(async () => {
    await change();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
