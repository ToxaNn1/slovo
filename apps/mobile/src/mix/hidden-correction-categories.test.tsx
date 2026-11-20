import { beforeEach, describe, expect, it } from '@jest/globals';
import { type Correction, type Category } from '@slovo/contracts';
import { openComposition, systemRandom, type Composition, type EntryFeedCard } from '@slovo/core';
import { createMemoryContentPort, seedUserState, loadEdition } from '@slovo/core/testing';
import { HideChoiceSheet, UndoToastProvider } from '@slovo/ui';
import { Link, Stack } from 'expo-router';
import { renderApp } from '../shell/test-app';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { Pressable, Text } from 'react-native';

import HiddenScreen from '../app/settings/hidden';
import { activeEditionFiles, editionStrings } from '../edition/edition';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { useHide } from './hiding';

const { config } = activeEditionFiles;

/** The UA Edition as its config file gives it, every Feature Switch as it ships. */
const shippedEdition = loadEdition(config);

/** The composition the card and the Hidden screen read, opened afresh for each test. */
let composition: Composition;

/** The Language Pack's Categories of Corrections, in its order. */
const work: Category = {
  id: 'work',
  displayName: 'На роботі',
  description: 'На роботі.',
  tone: 'loud',
};
const shop: Category = {
  id: 'shop',
  displayName: 'У магазині',
  description: 'У магазині.',
  tone: 'loud',
};

function correction(id: string, categoryId: string): Correction {
  return {
    kind: 'correction',
    id,
    nonStandardForm: 'приймати участь',
    correctionType: 'calque',
    standardEquivalents: ['брати участь'],
    explanation: 'Калька.',
    examplePair: { nonStandard: 'Приймати участь.', standard: 'Брати участь.' },
    categoryId,
    literaryUses: [],
    sources: [{ title: 'Test source' }],
    retired: false,
  };
}

beforeEach(async () => {
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа', description: 'Природа.', tone: 'loud' }],
      correctionCategories: [work, shop],
      corrections: [correction('c_work', work.id), correction('c_shop', shop.id)],
    }),
    edition: shippedEdition,
    userState: await seedUserState(),
    clock: { now: () => new Date('2026-10-25T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
  });
});

/** Lets the Mix's writes and the renders after them finish. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function cardOf(entryId: string): Promise<EntryFeedCard> {
  const card = await composition.entryCard(entryId);
  if (card === undefined || card.kind === 'synonymRow' || card.kind === 'tip')
    throw new Error(`No card of a Word, a Correction or an Idiom for ${entryId}`);
  return card;
}

/** The hide button of a card and the hide choice it opens, as from the Entry card's menu. */
function CardHide({ card }: { card: EntryFeedCard }) {
  const hide = useHide(card);
  return (
    <>
      <Pressable accessibilityRole="button" testID="hide-button" onPress={hide.open} />
      <HideChoiceSheet {...hide.choice} />
    </>
  );
}

/** A stand-in for the Feed: the card's hide, under the screen's toasts, and a link to Settings › Приховані записи. */
function CardScreen({ card }: { card: EntryFeedCard }) {
  return (
    <UndoToastProvider>
      <CardHide card={card} />
      <Link href="/settings/hidden">
        <Text>Приховані записи</Text>
      </Link>
    </UndoToastProvider>
  );
}

/** The app with the card of the Entry as its first screen and the Hidden screen a push away. */
async function openHideChoice(entryId: string) {
  const card = await cardOf(entryId);
  const shell = testShell({
    composition: opened(composition),
    remoteSwitches: switchedTo(shippedEdition),
  });
  const app = await renderApp(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false }} />,
      index: () => <CardScreen card={card} />,
      'settings/hidden': HiddenScreen,
    },
    { shell },
  );
  await settle();
  await fireEvent.press(screen.getByTestId('hide-button'));
  await settle();
  return { pathname: () => app.getPathname() };
}

describe('a Category of Corrections hidden from its card', () => {
  it('is offered on the Correction card, hides there, and shows on the Hidden screen until «Показати», which its undo toast takes back', async () => {
    const app = await openHideChoice('c_work');
    expect(screen.getByTestId('hide-choice-category')).toHaveTextContent(
      `Не показувати категорію «${work.displayName}»`,
    );

    await fireEvent.press(screen.getByTestId('hide-choice-category'));
    await settle();
    expect(composition.mix.state.correctionCategories.categoryIds).toEqual([shop.id]);
    expect(screen.getByText(`Категорію «${work.displayName}» приховано`)).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Приховані записи'));
    await settle();
    expect(app.pathname()).toBe('/settings/hidden');
    expect(screen.getByTestId(`hidden-correction-category-${work.id}`)).toHaveTextContent(
      `Виправлення: ${work.displayName}`,
      { exact: false },
    );

    await fireEvent.press(screen.getByTestId(`hidden-correction-category-${work.id}-show`));
    await waitFor(() => {
      expect(screen.queryByTestId(`hidden-correction-category-${work.id}`)).toBeNull();
    });
    expect(composition.mix.state.correctionCategories.categoryIds).toEqual([work.id, shop.id]);
    expect(screen.getByText(editionStrings.hidden.empty)).toBeOnTheScreen();

    // The undo toast takes «Показати» back: the Category is out of the Mix and listed again.
    expect(
      screen.getByText(`«Виправлення: ${work.displayName}» знову в Стрічці`),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByText(editionStrings.hidden.undo));
    await waitFor(() => {
      expect(screen.getByTestId(`hidden-correction-category-${work.id}`)).toBeOnTheScreen();
    });
    expect(composition.mix.state.correctionCategories.categoryIds).toEqual([shop.id]);
  });

  it('is offered disabled, saying why, while it is the last Category of Corrections in the Mix', async () => {
    await composition.mix.takeOut(shop.id, 'correction');

    await openHideChoice('c_work');

    const category = screen.getByTestId('hide-choice-category');
    expect(category).toBeDisabled();
    expect(category).toHaveProp(
      'accessibilityHint',
      editionStrings.mix.corrections.lastCategoryHint,
    );
    expect(screen.getByTestId('hide-choice-whole-kind')).toBeEnabled();
  });
});
