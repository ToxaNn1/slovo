import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type Correction } from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  systemRandom,
  type Composition,
  type EntryFeedCard,
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { EditionProvider, HideButton, HideChoiceSheet, UndoToastProvider } from '@slovo/ui';
import { Link, Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import config from 'slovo-edition/config';

import HiddenScreen from '../app/settings/hidden';
import { edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, testShell } from '../shell/test-support';
import { useHide } from './hiding';

/** The Ukrainian Edition as its config file gives it, every Feature Switch as it ships. */
const mockEdition = loadEdition(config);

/** The composition the card and the Hidden screen read, opened afresh for each test. */
let composition: Composition;

jest.mock('../edition/remote-switches', () => ({ useEditionInEffect: () => mockEdition }));

/** The Language Pack's Categories of Corrections, in its order. */
const work = { id: 'work', displayName: 'На роботі' };
const shop = { id: 'shop', displayName: 'У магазині' };

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

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

beforeEach(async () => {
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа' }],
      correctionCategories: [work, shop],
      corrections: [correction('c_work', work.id), correction('c_shop', shop.id)],
    }),
    edition: mockEdition,
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
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

/** The hide button of a card and the hide choice it opens, as on the Entry card's action row. */
function CardHide({ card }: { card: EntryFeedCard }) {
  const hide = useHide(card);
  return (
    <>
      <HideButton onPress={hide.open} />
      <HideChoiceSheet {...hide.choice} />
    </>
  );
}

/** A stand-in for the Feed: the card's hide, under the screen's toasts, and a link to Settings › Приховане. */
function CardScreen({ card }: { card: EntryFeedCard }) {
  return (
    <UndoToastProvider>
      <CardHide card={card} />
      <Link href="/settings/hidden">
        <Text>Приховане</Text>
      </Link>
    </UndoToastProvider>
  );
}

/** The app with the card of the Entry as its first screen and the Hidden screen a push away. */
async function openHideChoice(entryId: string) {
  const card = await cardOf(entryId);
  const shell = testShell({ composition: opened(composition) });
  const app = renderRouter(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <ShellProvider shell={shell}>
            <EditionProvider edition={edition} strings={editionStrings}>
              <Stack screenOptions={{ headerShown: false }} />
            </EditionProvider>
          </ShellProvider>
        </SafeAreaProvider>
      ),
      index: () => <CardScreen card={card} />,
      'settings/hidden': HiddenScreen,
    },
    { initialUrl: '/' },
  );
  await app;
  await settle();
  await fireEvent.press(screen.getByTestId('hide-button'));
  await settle();
  return { pathname: () => app.getPathname() };
}

describe('a Category of Corrections hidden from its card', () => {
  it('is offered on the Correction card, hides there, and shows on the Hidden screen until it is put back', async () => {
    const app = await openHideChoice('c_work');
    expect(screen.getByTestId('hide-choice-category')).toHaveTextContent(
      `Не показувати категорію «${work.displayName}»`,
    );

    await fireEvent.press(screen.getByTestId('hide-choice-category'));
    await settle();
    expect(composition.mix.state.correctionCategories.categoryIds).toEqual([shop.id]);
    expect(screen.getByText(`Категорію «${work.displayName}» приховано`)).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Приховане'));
    await settle();
    expect(app.pathname()).toBe('/settings/hidden');
    expect(screen.getByTestId(`hidden-correction-category-${work.id}`)).toHaveTextContent(
      `Виправлення: ${work.displayName}`,
      { exact: false },
    );

    await fireEvent.press(screen.getByTestId(`hidden-correction-category-${work.id}-turn-on`));
    await waitFor(() => {
      expect(screen.queryByTestId(`hidden-correction-category-${work.id}`)).toBeNull();
    });
    expect(composition.mix.state.correctionCategories.categoryIds).toEqual([work.id, shop.id]);
    expect(screen.getByText(editionStrings.hidden.empty)).toBeOnTheScreen();
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
