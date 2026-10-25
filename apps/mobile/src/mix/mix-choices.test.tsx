import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  systemRandom,
  type Composition,
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { fill } from '@slovo/contracts';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import config from 'slovo-edition/config';

import { edition, editionStrings } from '../edition/edition';
import { MixChoices } from './mix-choices';

const strings = editionStrings.mix.corrections;

/** The Ukrainian Edition as its config file gives it, every Feature Switch as it ships. */
const mockEdition = loadEdition(config);

/** The composition the Mix choices read, opened afresh for each test. */
let mockComposition: Composition;

jest.mock('../composition', () => ({ useComposition: () => mockComposition }));
jest.mock('../edition/remote-switches', () => ({ useEditionInEffect: () => mockEdition }));

/** The Language Pack's Categories of Corrections, in its order. */
const correctionCategories = [
  { id: 'work', displayName: 'На роботі' },
  { id: 'shop', displayName: 'У магазині' },
];

/** Lets the Mix's writes and the renders after them finish. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

/** Taps a chip and lets the Mix keep the change. */
async function press(id: string) {
  await fireEvent.press(screen.getByTestId(id));
  await settle();
}

/** Turns the «Виправлення» switch and lets the Mix keep the change. */
async function turnCorrections(on: boolean) {
  await fireEvent(screen.getByTestId('mix-corrections'), 'valueChange', on);
  await settle();
}

beforeEach(async () => {
  mockComposition = await openComposition({
    content: createMemoryContentPort({
      categories: [
        { id: 'nature', displayName: 'Природа' },
        { id: 'crafts', displayName: 'Ремесла' },
      ],
      correctionCategories,
    }),
    edition: mockEdition,
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: { now: () => new Date('2026-10-25T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
  });
});

async function renderChoices() {
  await render(
    <EditionProvider edition={edition} strings={editionStrings}>
      <MixChoices />
    </EditionProvider>,
  );
  await settle();
}

const chipOf = (id: string) => screen.getByTestId(`mix-correction-chip-${id}`);

describe('the Categories of Corrections on the Мій Мікс screen', () => {
  it('shows a chip for each, all on, that VoiceOver reads as a Category of Corrections', async () => {
    await renderChoices();

    for (const { id, displayName } of correctionCategories) {
      expect(chipOf(id)).toHaveAccessibleName(fill(strings.category, { category: displayName }));
      expect(chipOf(id)).toHaveTextContent(displayName);
      expect(chipOf(id)).toBeSelected();
    }
  });

  it('takes one out of the Mix and puts it back, leaving the others and the Words’ Categories as they are', async () => {
    await renderChoices();

    await press('mix-correction-chip-work');
    expect(chipOf('work')).not.toBeSelected();
    expect(chipOf('shop')).toBeSelected();
    expect(screen.getByTestId('mix-chip-nature')).toBeSelected();
    expect(mockComposition.mix.state.correctionCategories.categoryIds).toEqual(['shop']);

    await press('mix-correction-chip-work');
    expect(chipOf('work')).toBeSelected();
  });

  it('disables the last one in the Mix and says why', async () => {
    await renderChoices();

    await press('mix-correction-chip-work');

    expect(chipOf('shop')).toBeDisabled();
    expect(chipOf('shop')).toHaveProp('accessibilityHint', strings.lastCategoryHint);
    // The line is hidden from VoiceOver, which reads it as the chip's hint instead.
    const hidden = { includeHiddenElements: true };
    expect(screen.getByTestId('mix-correction-last-category-hint', hidden)).toHaveTextContent(
      strings.lastCategoryHint,
    );
    expect(screen.queryByTestId('mix-last-category-hint', hidden)).toBeNull();
  });

  it('follows the «Виправлення» switch: gone while it is off, back as they were when it is on', async () => {
    await renderChoices();
    await press('mix-correction-chip-work');

    await turnCorrections(false);
    expect(screen.queryByTestId('mix-correction-chip-work')).toBeNull();
    expect(screen.queryByTestId('mix-correction-chip-shop')).toBeNull();

    await turnCorrections(true);
    expect(chipOf('work')).not.toBeSelected();
    expect(chipOf('shop')).toBeSelected();
  });
});
