import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Correction } from '@slovo/contracts';
import {
  loadEdition,
  openComposition,
  type Composition,
  type Edition,
  type Haptics,
} from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider, HapticsProvider, TokensProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { act, fireEvent, screen, within } from 'expo-router/testing-library';
import { renderRoutes } from '../shell/test-render';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import CorrectionCategoryScreen from '../app/correction-category/[categoryId]';
import EntryFromSearchScreen from '../app/search/[entryId]';
import { activeEditionFiles, edition, editionStrings, editionTokens } from '../edition/edition';
import { SettingsProvider } from '../settings/settings';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { screenSettled } from '../use-open-screen';

const clock = { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function correction(
  id: string,
  nonStandardForm: string,
  standardEquivalents: readonly [string, ...string[]],
  categoryId: string,
  retired = false,
): Correction {
  return {
    kind: 'correction',
    id,
    nonStandardForm,
    correctionType: 'surzhyk',
    standardEquivalents: [...standardEquivalents],
    explanation: `Чому не «${nonStandardForm}».`,
    examplePair: {
      nonStandard: `Кажуть ${nonStandardForm}.`,
      standard: `Кажи ${standardEquivalents[0]}.`,
    },
    categoryId,
    sources: [{ title: 'Словник' }],
    literaryUses: [],
    retired,
  };
}

let editionInEffect: Edition;
let composition: Composition;
let shellOf: () => ReturnType<typeof testShell>;

/**
 * Opens the composition over three Categories of Corrections: «Щоденне» with
 * five live Corrections and a Retired one, «Робота» with one, «Порожня» with none.
 */
async function open() {
  const shipped = loadEdition(activeEditionFiles.config);
  editionInEffect = {
    ...shipped,
    isFeatureEnabled: (feature) =>
      feature === 'dashboard' ||
      feature === 'corrections' ||
      feature === 'correctionCategoryScreens' ||
      shipped.isFeatureEnabled(feature),
  };
  const userState = await seedUserState(
    { onboardingFinished: '2026-09-01T09:00:00.000Z' },
    { clock },
  );
  composition = await openComposition({
    content: createMemoryContentPort({
      correctionCategories: [
        { id: 'everyday', displayName: 'Щоденне', description: 'Як кажуть щодня.', tone: 'loud' },
        { id: 'work', displayName: 'Робота', description: 'На роботі.', tone: 'loud' },
        { id: 'empty', displayName: 'Порожня', description: 'Тут ще нічого.', tone: 'loud' },
      ],
      corrections: [
        correction('c_shoby', 'шоби', ['щоб', 'аби'], 'everyday'),
        correction('c_old', 'старе', ['нове'], 'everyday', true),
        correction('c_protiahom', 'на протязі', ['протягом'], 'everyday'),
        correction('c_vybachte', 'вибачаюсь', ['вибачте', 'перепрошую'], 'everyday'),
        correction('c_dyakuyu', 'дякую вам', ['дякую'], 'everyday'),
        correction('c_pryimaty', 'приймати участь', ['брати участь'], 'everyday'),
        correction('c_sluzhba', 'службова записка', ['доповідна записка'], 'work'),
      ],
    }),
    edition: editionInEffect,
    userState,
    clock,
    random: { next: () => 0 },
  });
  shellOf = () =>
    testShell({
      userState: opened(userState),
      remoteSwitches: switchedTo(editionInEffect),
      composition: opened(composition),
    });
}

beforeEach(() => {
  jest.useFakeTimers({ now: clock.now() });
});

afterEach(() => {
  jest.useRealTimers();
  screenSettled();
});

async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await jest.runAllTimersAsync();
  });
}

/** The app on a Category of Corrections' screen, with the Search route its cards open. */
async function renderCategory(categoryId: string) {
  await renderRoutes(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <TokensProvider tokens={editionTokens} colorScheme="light">
            <ShellProvider shell={shellOf()}>
              <EditionProvider edition={edition} strings={editionStrings}>
                <HapticsProvider haptics={haptics}>
                  <SettingsProvider>
                    <Slot />
                  </SettingsProvider>
                </HapticsProvider>
              </EditionProvider>
            </ShellProvider>
          </TokensProvider>
        </SafeAreaProvider>
      ),
      index: () => null,
      'correction-category/[categoryId]': CorrectionCategoryScreen,
      'search/[entryId]': EntryFromSearchScreen,
    },
    { initialUrl: `/correction-category/${categoryId}` },
  );
  await settle();
}

const hiddenIds = () =>
  composition.mix.state.correctionCategories.hiddenCategories.map(({ id }) => id);

describe('the Category screen of Corrections', () => {
  it('heads its Corrections with «КАТЕГОРІЯ · N виправлень», name, description and «ЗНАЮ x З n»', async () => {
    await open();
    await composition.knowledge.set('c_shoby', 'known');
    await renderCategory('everyday');

    const hero = screen.getByTestId('category-hero');
    expect(within(hero).getByText('КАТЕГОРІЯ · 5 виправлень')).toBeTruthy();
    expect(within(hero).getByText('Щоденне')).toBeTruthy();
    expect(within(hero).getByText('Як кажуть щодня.')).toBeTruthy();
    expect(within(hero).getByText('ЗНАЮ 1 З 5')).toBeTruthy();
  });

  it('counts one Correction «1 виправлення» and none «0 виправлень»', async () => {
    await open();
    await renderCategory('work');
    expect(
      within(screen.getByTestId('category-hero')).getByText('КАТЕГОРІЯ · 1 виправлення'),
    ).toBeTruthy();
  });

  it('shows the hero and no cards for an empty Category', async () => {
    await open();
    await renderCategory('empty');

    const hero = screen.getByTestId('category-hero');
    expect(within(hero).getByText('КАТЕГОРІЯ · 0 виправлень')).toBeTruthy();
    expect(screen.queryAllByTestId(/^category-entry-/)).toEqual([]);
  });

  it('lists a card per live Correction in pack order: the non-standard form, the Correction Type, the standard forms, «ЗНАЮ» once Known', async () => {
    await open();
    await composition.knowledge.set('c_shoby', 'known');
    await renderCategory('everyday');

    const cards = screen.getAllByTestId(/^category-entry-c_[a-z]+$/);
    expect(cards.map(({ props }) => (props as { testID: string }).testID)).toEqual([
      'category-entry-c_shoby',
      'category-entry-c_protiahom',
      'category-entry-c_vybachte',
      'category-entry-c_dyakuyu',
      'category-entry-c_pryimaty',
    ]);
    const shoby = within(screen.getByTestId('category-entry-c_shoby'));
    expect(shoby.getByText('шоби')).toBeTruthy();
    expect(shoby.getByText(editionStrings.correctionCard.correctionTypes.surzhyk)).toBeTruthy();
    expect(shoby.getByText('щоб · аби')).toBeTruthy();
    expect(screen.getByTestId('category-entry-c_shoby-known')).toHaveTextContent(
      editionStrings.dashboard.category.knownStamp,
    );
    expect(
      within(screen.getByTestId('category-entry-c_protiahom')).getByText('протягом'),
    ).toBeTruthy();
    expect(screen.queryByTestId('category-entry-c_protiahom-known')).toBeNull();
    expect(screen.queryAllByTestId(/-bar-/)).toEqual([]);
  });

  it('«У МІКСІ» takes the Category out of the Mix as «ДОДАТИ», and a second tap puts it back, each with its toast', async () => {
    await open();
    await renderCategory('everyday');

    await settle(() => fireEvent.press(screen.getByRole('togglebutton', { name: 'У МІКСІ' })));
    expect(hiddenIds()).toEqual(['everyday']);
    expect(screen.getByRole('togglebutton', { name: 'ДОДАТИ' })).toBeTruthy();
    expect(screen.getByText('„Щоденне“ прибрано з Міксу.')).toBeTruthy();

    await settle(() => fireEvent.press(screen.getByRole('togglebutton', { name: 'ДОДАТИ' })));
    expect(hiddenIds()).toEqual([]);
    expect(screen.getByRole('togglebutton', { name: 'У МІКСІ' })).toBeTruthy();
    expect(screen.getByText('„Щоденне“ тепер у твоєму Міксі.')).toBeTruthy();
  });

  it('keeps the last Category of Corrections in the Mix and says why, as the Mix screen does', async () => {
    await open();
    await composition.mix.setCategory('work', false, 'correction');
    await composition.mix.setCategory('empty', false, 'correction');
    await renderCategory('everyday');

    await settle(() => fireEvent.press(screen.getByRole('togglebutton', { name: 'У МІКСІ' })));
    expect(hiddenIds()).toEqual(['work', 'empty']);
    expect(screen.getByRole('togglebutton', { name: 'У МІКСІ' })).toBeTruthy();
    expect(screen.getByText(editionStrings.mix.corrections.lastCategoryHint)).toBeTruthy();
  });

  it('a tap on a card opens its Correction without a Seen', async () => {
    await open();
    await renderCategory('everyday');

    await settle(() => fireEvent.press(screen.getByTestId('category-entry-c_protiahom')));
    expect(screen.queryByTestId('category-hero')).toBeNull();
    // With `wordTabs` on, the explanation is on «Чому» (ADR 0091).
    await settle(() => fireEvent.press(screen.getByTestId('correction-tab-why')));
    expect(screen.getByText('Чому не «на протязі».')).toBeTruthy();
    expect(composition.history.list).toEqual([]);
  });
});
