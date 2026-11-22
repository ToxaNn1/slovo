import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { openComposition, systemRandom, type Composition, type Edition } from '@slovo/core';
import { createMemoryContentPort, seedUserState, loadEdition } from '@slovo/core/testing';
import { fill, type Category } from '@slovo/contracts';
import { minTouchTarget } from '@slovo/ui/tokens';
import { StyleSheet, Text } from 'react-native';
import { Stack } from 'expo-router';
import { renderApp } from '../shell/test-app';
import { act, fireEvent, screen, within } from 'expo-router/testing-library';

import MixTabScreen from '../app/mix';
import MixScreen from '../app/settings/mix';
import HiddenScreen from '../app/settings/hidden';
import { activeEditionFiles, editionStrings } from '../edition/edition';
import { opened, settingsAt, switchedTo, testShell } from '../shell/test-support';
import { screenSettled } from '../use-open-screen';

const { config } = activeEditionFiles;

const strings = editionStrings.mix.corrections;

/** The UA Edition as its config file gives it, every Feature Switch as it ships. */
const shippedEdition = loadEdition(config);

/** The composition the Mix screen reads, opened afresh for each test. */
let composition: Composition;

/** The Language Pack's Categories of Corrections, in its order. */
const correctionCategories: Category[] = [
  { id: 'work', displayName: 'На роботі', description: 'На роботі.', tone: 'loud' },
  { id: 'shop', displayName: 'У магазині', description: 'У магазині.', tone: 'loud' },
];

/** Lets the Mix's writes and the renders after them finish. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

/** Taps a tile, a cover or a chip and lets the Mix keep the change. */
async function press(id: string) {
  await fireEvent.press(screen.getByTestId(id, { includeHiddenElements: true }));
  await settle();
}

/** Opens the kinds' sheet and, from it, the sheet of the Categories of Corrections. */
async function openCorrectionCategories() {
  await press('mix-tile-kinds');
  await press('mix-correction-categories');
}

beforeEach(async () => {
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [
        {
          id: 'human-body',
          displayName: 'Людина і тіло',
          description: 'Людина.',
          tone: 'loud',
        },
        {
          id: 'emotions-character',
          displayName: 'Емоції та характер',
          description: 'Емоції.',
          tone: 'loud',
        },
      ],
      correctionCategories,
    }),
    edition: shippedEdition,
    userState: await seedUserState(),
    clock: { now: () => new Date('2026-10-25T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
  });
});

/** Settings › Мій Мікс as the app routes to it, or the tab «Мікс» opened on `url`. */
async function renderChoices(url = '/settings/mix', editionInEffect: Edition = shippedEdition) {
  const shell = testShell({
    composition: opened(composition),
    settings: await settingsAt({}),
    remoteSwitches: switchedTo(editionInEffect),
  });
  await renderApp(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false }} />,
      'settings/mix': MixScreen,
      'mix/index': MixTabScreen,
      'category/[categoryId]': () => <Text>Category</Text>,
      'settings/rarity-test': () => <Text>Rarity Test</Text>,
      'settings/hidden': HiddenScreen,
    },
    { shell, initialUrl: url },
  );
  await settle();
}

const mixStrings = editionStrings.mix;

/** «N з 2» beside the title. */
const selected = (count: number) => fill(mixStrings.count, { selected: String(count), total: '2' });

const hidden = { includeHiddenElements: true };
const cover = (id: string) => screen.getByTestId(`mix-chip-${id}`, hidden);

describe('the Category covers on the Мій Мікс screen', () => {
  it('shows a cover for each Category, every one chosen, in its group, under «N з M»', async () => {
    await renderChoices();
    expect(screen.getByRole('button', { name: 'Людина і тіло' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Емоції та характер' })).toBeSelected();
    expect(screen.getByTestId('mix-selected')).toHaveTextContent(selected(2));
    expect(screen.getByRole('header', { name: 'Про людину' })).toBeOnTheScreen();
    expect(screen.getByTestId('mix-group-0')).toHaveTextContent(
      fill(mixStrings.group.toggle, { selected: '2', total: '2', action: mixStrings.group.none }),
    );
  });

  it('counts the choice as a cover turns off and on', async () => {
    await renderChoices();
    await press('mix-chip-emotions-character');
    expect(screen.getByRole('button', { name: 'Емоції та характер' })).not.toBeSelected();
    expect(screen.getByTestId('mix-selected')).toHaveTextContent(selected(1));
    await press('mix-chip-emotions-character');
    expect(screen.getByTestId('mix-selected')).toHaveTextContent(selected(2));
  });

  it('keeps the last Category in the Mix and says why', async () => {
    await renderChoices();
    await press('mix-chip-emotions-character');
    const last = screen.getByRole('button', { name: 'Людина і тіло' });
    expect(last).toBeDisabled();
    expect(screen.getByTestId('mix-last-category-hint', hidden)).toHaveTextContent(
      mixStrings.lastCategoryHint,
    );
    await press('mix-chip-human-body');
    expect(last).toBeSelected();
    expect(screen.getByTestId('mix-selected')).toHaveTextContent(selected(1));
  });

  it('puts every Category of a group back in with «усі»', async () => {
    await renderChoices();
    await press('mix-chip-emotions-character');
    expect(screen.getByTestId('mix-group-0')).toHaveTextContent(
      fill(mixStrings.group.toggle, { selected: '1', total: '2', action: mixStrings.group.all }),
    );
    await press('mix-group-0');
    expect(screen.getByTestId('mix-selected')).toHaveTextContent(selected(2));
  });

  it('keeps one cover lit at once when «зняти» takes out a group that holds the last Categories', async () => {
    await renderChoices();
    const write = composition.mix.setCategories.bind(composition.mix);
    let written: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      written = resolve;
    });
    // The write is held, so the screen shows what it chose before the Mix keeps it.
    jest
      .spyOn(composition.mix, 'setCategories')
      .mockImplementation((ids, inMix, of) => held.then(() => write(ids, inMix, of)));

    await press('mix-group-0');

    expect(cover('emotions-character')).toBeSelected();
    expect(cover('human-body')).not.toBeSelected();
    written();
    await settle();
    expect(cover('emotions-character')).toBeSelected();
    expect(cover('human-body')).not.toBeSelected();
  });

  it('opens a Category’s screen on a long press of its cover, and leaves it in the Mix', async () => {
    await renderChoices('/mix');
    screenSettled();

    await fireEvent(cover('emotions-character'), 'longPress');
    await settle();

    expect(screen).toHavePathname('/category/emotions-character');
    expect(composition.mix.state.categoryIds).toContain('emotions-character');
  });

  it('opens the last Category’s screen on a long press, though its cover takes no tap', async () => {
    await renderChoices('/mix');
    await press('mix-chip-emotions-character');
    screenSettled();

    await fireEvent(cover('human-body'), 'longPress');
    await settle();

    expect(screen).toHavePathname('/category/human-body');
  });

  it('has VoiceOver read «N з M» as the Categories in the Mix', async () => {
    await renderChoices();
    await press('mix-chip-emotions-character');

    expect(screen.getByTestId('mix-selected')).toHaveAccessibleName('Вибрано 1 з 2 тем');
  });

  it('gives a group’s «усі» / «зняти» a tap area of the full touch target', async () => {
    await renderChoices();

    expect(StyleSheet.flatten(screen.getByTestId('mix-group-0').props['style'])).toHaveProperty(
      'minHeight',
      minTouchTarget,
    );
  });
});

const chipOf = (id: string) => screen.getByTestId(`mix-correction-chip-${id}`, hidden);

describe('the Categories of Corrections on the Мій Мікс screen', () => {
  it('shows a chip for each, all on, that VoiceOver reads as a Category of Corrections', async () => {
    await renderChoices();
    await openCorrectionCategories();

    for (const { id, displayName } of correctionCategories) {
      expect(chipOf(id)).toHaveAccessibleName(fill(strings.category, { category: displayName }));
      expect(chipOf(id)).toHaveTextContent(displayName);
      expect(chipOf(id)).toBeSelected();
    }
  });

  it('takes one out of the Mix and puts it back, leaving the others and the Words’ Categories as they are', async () => {
    await renderChoices();
    await openCorrectionCategories();

    await press('mix-correction-chip-work');
    expect(chipOf('work')).not.toBeSelected();
    expect(chipOf('shop')).toBeSelected();
    expect(cover('human-body')).toBeSelected();
    expect(composition.mix.state.correctionCategories.categoryIds).toEqual(['shop']);

    await press('mix-correction-chip-work');
    expect(chipOf('work')).toBeSelected();
  });

  it('disables the last one in the Mix and says why', async () => {
    await renderChoices();
    await openCorrectionCategories();

    await press('mix-correction-chip-work');

    expect(chipOf('shop')).toBeDisabled();
    expect(chipOf('shop')).toHaveProp('accessibilityHint', strings.lastCategoryHint);
    // The line is hidden from VoiceOver, which reads it as the chip's hint instead.
    expect(screen.getByTestId('mix-correction-last-category-hint', hidden)).toHaveTextContent(
      strings.lastCategoryHint,
    );
    expect(screen.queryByTestId('mix-last-category-hint', hidden)).toBeNull();
  });

  it('follows the «Виправлення» choice: gone while it is off, back as they were when it is on', async () => {
    await renderChoices();
    await openCorrectionCategories();
    await press('mix-correction-chip-work');
    await press('mix-correction-categories-back');

    await press('mix-corrections-off');
    expect(screen.queryByTestId('mix-correction-categories', hidden)).toBeNull();

    await press('mix-corrections-normal');
    await press('mix-correction-categories');
    expect(chipOf('work')).not.toBeSelected();
    expect(chipOf('shop')).toBeSelected();
  });
});

describe('the Мій Мікс screen', () => {
  it('keeps its back header above the list, so it stays put while the list scrolls (D-8)', async () => {
    await renderChoices();

    expect(screen.getByRole('header', { name: mixStrings.title })).toBeOnTheScreen();
    expect(screen.getByTestId('mix-back')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('mix-scroll')).queryByRole('header', { name: mixStrings.title }),
    ).toBeNull();
  });

  it('sets «Рідкість», the same Rarity Range as Settings (ADR 0156)', async () => {
    await renderChoices();
    await press('mix-tile-rarity');
    expect(screen.getByTestId('mix-rarity-bar-5')).toBeSelected();

    await press('mix-rarity-bar-3');

    expect(composition.rarityRange.state).toEqual({ from: 1, to: 3 });
    expect(screen.getByTestId('mix-rarity-bar-3')).toBeSelected();
  });

  it('reads the kinds tile as «Типи карток: 3 з 4» to VoiceOver, not «3/4»', async () => {
    await renderChoices();

    const kinds = screen.getByTestId('mix-tile-kinds');
    const value: unknown = screen.getByTestId('mix-tile-kinds-value').props['children'];
    const [selected, total] = String(value).split('/');
    expect(kinds).toHaveAccessibleName(
      fill(mixStrings.tiles.kindsLabel, { selected: selected ?? '', total: total ?? '' }),
    );
  });

  it('opens the Hidden screen from «Приховане» at its foot, with the way back to «Теми»', async () => {
    await renderChoices('/mix');
    screenSettled();

    await press('mix-hidden');

    expect(screen).toHavePathname('/settings/hidden');
    expect(screen.getByTestId('hidden-back')).toHaveAccessibleName(editionStrings.tabs.mix);
  });

  it('opens the Rarity Test from the «Рідкість» sheet', async () => {
    await renderChoices('/mix');
    await press('mix-tile-rarity');
    screenSettled();

    await press('mix-rarity-test');

    expect(screen).toHavePathname('/settings/rarity-test');
  });

  it('offers no Rarity Test in the «Рідкість» sheet while the rarityTest switch is off', async () => {
    await renderChoices('/mix', {
      ...shippedEdition,
      isFeatureEnabled: (feature) =>
        feature !== 'rarityTest' && shippedEdition.isFeatureEnabled(feature),
    });
    await press('mix-tile-rarity');

    expect(screen.getByTestId('mix-rarity-bar-3')).toBeOnTheScreen();
    expect(screen.queryByTestId('mix-rarity-test')).toBeNull();
  });

  it('shows no «Рідкість» while the rarityCeiling switch is off', async () => {
    await renderChoices('/settings/mix', {
      ...shippedEdition,
      isFeatureEnabled: (feature) =>
        feature !== 'rarityCeiling' && shippedEdition.isFeatureEnabled(feature),
    });

    expect(screen.queryByTestId('mix-tile-rarity')).toBeNull();
    expect(screen.getByTestId('mix-tile-kinds')).toBeOnTheScreen();
    expect(screen.getByTestId('mix-selected')).toBeOnTheScreen();
  });

  it('opens as the root of the tab «Мікс», with its choices and no way back (ADR 0201)', async () => {
    await renderChoices('/mix');

    expect(screen.getByRole('header', { name: mixStrings.title })).toBeOnTheScreen();
    expect(screen.queryByTestId('mix-back')).toBeNull();
    expect(screen.getByTestId('mix-tile-rarity')).toBeOnTheScreen();
    expect(screen.getByTestId('mix-selected')).toHaveTextContent(selected(2));
  });
});
