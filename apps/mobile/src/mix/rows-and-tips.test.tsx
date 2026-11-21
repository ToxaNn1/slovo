import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SynonymRow, Tip } from '@slovo/contracts';
import { openComposition, systemRandom, type Composition, type Edition } from '@slovo/core';
import { createMemoryContentPort, seedUserState, loadEdition } from '@slovo/core/testing';
import { Pressable } from 'react-native';
import { HideChoiceSheet, UndoToastProvider } from '@slovo/ui';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import HiddenScreen from '../app/settings/hidden';
import { activeEditionFiles, editionStrings } from '../edition/edition';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { renderApp } from '../shell/test-app';
import { useHide } from './hiding';
import { MixChoices } from './mix-choices';

const { config } = activeEditionFiles;

const stateOf = (on: boolean) => (on ? 'on' : 'off');

/** The UA Edition with Synonym Rows and Tips, and the Mix kind weights, turned on or off. */
function editionWith(on: boolean, mixKindWeights = true): Edition {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, string> };
  return loadEdition({
    ...rest,
    featureSwitches: {
      ...featureSwitches,
      synonymRows: stateOf(on),
      tips: stateOf(on),
      mixKindWeights: stateOf(mixKindWeights),
    },
  });
}

/** The Edition the screens read, as it ships unless a test turns the kinds off. */
let editionInEffect: Edition;

/** The composition the screens read, opened afresh for each test. */
let composition: Composition;

jest.mock('expo-router', () => ({
  ...jest.requireActual<object>('expo-router'),
  useRouter: () => ({ back: () => undefined }),
}));

const row: SynonymRow = {
  kind: 'synonymRow',
  id: 'r_walk',
  dominant: { text: 'іти', stress: [2] },
  meaning: 'Рухатися пішки.',
  members: ['простувати', 'чимчикувати', 'шкандибати', 'дибати', 'чалапати'].map((text) => ({
    text,
    stress: [0],
  })),
  sources: [{ title: 'Словник синонімів' }],
  retired: false,
};

const tip: Tip = {
  kind: 'tip',
  id: 't_hour',
  title: 'Котра година?',
  nonStandardForm: 'Скільки часу?',
  standardForm: 'Котра година?',
  explanation: 'Час не рахують, а питають, котра година.',
  sources: [{ title: 'Антоненко-Давидович. Як ми говоримо' }],
  gameQuestion: {
    prompt: 'Як спитати?',
    rightAnswer: 'Котра година?',
    wrongAnswers: ['A', 'B', 'C'],
  },
  retired: false,
};

async function open(on: boolean, mixKindWeights = true) {
  editionInEffect = editionWith(on, mixKindWeights);
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа', description: 'Природа.', tone: 'loud' }],
      synonymRows: [row],
      tips: [tip],
    }),
    edition: editionInEffect,
    userState: await seedUserState(),
    clock: { now: () => new Date('2026-10-26T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
  });
}

beforeEach(async () => {
  await open(true);
});

/** Lets the composition's writes and the renders after them finish. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderInApp(children: React.ReactNode) {
  await renderApp(<UndoToastProvider>{children}</UndoToastProvider>, {
    shell: testShell({
      composition: opened(composition),
      remoteSwitches: switchedTo(editionInEffect),
    }),
  });
  await settle();
}

/** The hide button of the Entry's card and the hide choice it opens, as on the card's action row. */
function CardHide({ card }: { card: Parameters<typeof useHide>[0] }) {
  const hide = useHide(card);
  return (
    <>
      <Pressable accessibilityRole="button" testID="hide-button" onPress={hide.open} />
      <HideChoiceSheet {...hide.choice} />
    </>
  );
}

async function hideFromCard(entryId: string, option: 'entry' | 'whole-kind') {
  const card = await composition.entryCard(entryId);
  if (card === undefined) throw new Error(`No card for ${entryId}`);
  await renderInApp(<CardHide card={card} />);
  await fireEvent.press(screen.getByTestId('hide-button'));
  await settle();
  await fireEvent.press(screen.getByTestId(`hide-choice-${option}`));
  await settle();
}

const kinds = [
  {
    name: 'Synonym Rows',
    kind: 'synonymRow',
    feature: 'synonymRows',
    entry: row,
    title: 'Синонімічні ряди',
    subtitle: 'Різні слова для одного значення',
  },
  {
    name: 'Tips',
    kind: 'tip',
    feature: 'tips',
    entry: tip,
    title: 'Поради',
    subtitle: 'Як говорити й писати по-українському',
  },
] as const;

/** Opens the sheet a setting tile of the Мій Мікс screen opens. */
async function openSheet(tile: 'kinds' | 'quickQuestion') {
  await fireEvent.press(screen.getByTestId(`mix-tile-${tile}`));
  await settle();
}

/** Taps a segment or a choice of the open sheet and lets the Mix keep the change. */
async function choose(id: string) {
  await fireEvent.press(screen.getByTestId(id));
  await settle();
}

describe.each(kinds)('$name', ({ kind, feature, entry, title, subtitle }) => {
  it('have a choice on the kinds sheet of the Мій Мікс screen that takes them out of the Mix and puts them back', async () => {
    await renderInApp(<MixChoices />);
    await openSheet('kinds');
    expect(screen.getByText(title)).toBeOnTheScreen();
    expect(screen.getByText(subtitle)).toBeOnTheScreen();

    await choose(`mix-${feature}-off`);
    expect(composition.mix.state.kinds[kind]).toBe(false);
    expect(screen.getByTestId(`mix-${feature}-off`)).toBeSelected();

    await choose(`mix-${feature}-normal`);
    expect(composition.mix.state.kinds[kind]).toBe(true);
  });

  it('have a Mix kind weight that sets how often they come in the Feed', async () => {
    await renderInApp(<MixChoices />);
    await openSheet('kinds');
    const normal = screen.getByTestId(`mix-${feature}-normal`);
    expect(normal).toHaveAccessibleName(`${title} у Стрічці: Помірно`);
    expect(normal).toBeSelected();

    await choose(`mix-${feature}-more`);
    expect(composition.mix.state.kindWeights[kind]).toBe('more');
    expect(screen.getByTestId(`mix-${feature}-more`)).toBeSelected();

    await choose(`mix-${feature}-less`);
    expect(composition.mix.state.kindWeights[kind]).toBe('less');
  });

  it('come back in at the weight chosen while they are out of the Mix', async () => {
    await composition.mix.setKind(kind, false);
    await renderInApp(<MixChoices />);
    await openSheet('kinds');

    await choose(`mix-${feature}-more`);
    expect(composition.mix.state.kinds[kind]).toBe(true);
    expect(composition.mix.state.kindWeights[kind]).toBe('more');
    expect(screen.getByTestId(`mix-${feature}-more`)).toBeSelected();
  });

  it('have only «Вимк» and «Увімк» while the Edition turns the weights off', async () => {
    await open(true, false);
    await renderInApp(<MixChoices />);
    await openSheet('kinds');
    expect(screen.getByTestId(`mix-${feature}-on`)).toBeSelected();
    expect(screen.queryByTestId(`mix-${feature}-normal`)).toBeNull();
  });

  it('show a hidden one as an Entry on the Hidden screen until it is shown again', async () => {
    await hideFromCard(entry.id, 'entry');
    expect(composition.hiddenEntries.has(entry.id)).toBe(true);

    await renderInApp(<HiddenScreen />);
    expect(screen.getByTestId(`hidden-entry-${entry.id}`)).toHaveTextContent(
      editionStrings.hidden.kinds.entry,
      { exact: false },
    );

    await fireEvent.press(screen.getByTestId(`hidden-entry-${entry.id}-show`));
    await waitFor(() => {
      expect(screen.queryByTestId(`hidden-entry-${entry.id}`)).toBeNull();
    });
    expect(composition.hiddenEntries.has(entry.id)).toBe(false);
    expect(screen.getByText(editionStrings.hidden.empty)).toBeOnTheScreen();
  });

  it('as a whole, hidden from a card, wait on the Hidden screen to be shown', async () => {
    await hideFromCard(entry.id, 'whole-kind');
    expect(composition.mix.state.kinds[kind]).toBe(false);
    expect(screen.getByText(`${title} приховано`)).toBeOnTheScreen();

    await renderInApp(<HiddenScreen />);
    expect(screen.getByTestId(`hidden-${feature}`)).toHaveTextContent(
      editionStrings.hidden.kinds.kind,
      { exact: false },
    );
    const show = screen.getByTestId(`hidden-${feature}-show`);
    expect(show).toHaveAccessibleName(`Показати «${title}»`);

    await fireEvent.press(show);
    await waitFor(() => {
      expect(screen.queryByTestId(`hidden-${feature}`)).toBeNull();
    });
    expect(composition.mix.state.kinds[kind]).toBe(true);
  });

  it('show nothing while the Edition turns them off', async () => {
    await open(false);
    await composition.hide({ kind: 'entry', entryId: entry.id });
    await composition.mix.setKind(kind, false);

    await renderInApp(<MixChoices />);
    await openSheet('kinds');
    expect(screen.queryByTestId(`mix-${feature}-off`)).toBeNull();

    await renderInApp(<HiddenScreen />);
    expect(screen.queryByTestId(`hidden-${feature}`)).toBeNull();
    expect(screen.queryByTestId(`hidden-entry-${entry.id}`)).toBeNull();
  });
});

// Spec #1358, ticket #1374: how often the Feed asks a Quick Question.
describe('the Quick Question frequency on the Мій Мікс screen', () => {
  it('starts at every 10th card and keeps the frequency chosen', async () => {
    await renderInApp(<MixChoices />);
    await openSheet('quickQuestion');
    expect(screen.getByText(editionStrings.mix.sheets.quickQuestion)).toBeOnTheScreen();
    expect(composition.mix.state.quickQuestionEvery).toBe(10);
    expect(screen.getByTestId('mix-quick-question-normal')).toBeSelected();

    await choose('mix-quick-question-often');
    expect(composition.mix.state.quickQuestionEvery).toBe(6);
    expect(screen.getByTestId('mix-quick-question-often')).toBeSelected();

    await choose('mix-quick-question-off');
    expect(composition.mix.state.quickQuestionEvery).toBe('off');
  });
});
