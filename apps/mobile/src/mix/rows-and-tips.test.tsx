import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SynonymRow, Tip } from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  systemRandom,
  type Composition,
  type Edition,
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { EditionProvider, HideButton, HideChoiceSheet, UndoToastProvider } from '@slovo/ui';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import config from 'slovo-edition/config';

import HiddenScreen from '../app/settings/hidden';
import { edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { useHide } from './hiding';
import { MixChoices } from './mix-choices';

/** The UA Edition with Synonym Rows and Tips, and the Mix kind weights, turned on or off. */
function editionWith(on: boolean, mixKindWeights = true): Edition {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, boolean> };
  return loadEdition({
    ...rest,
    featureSwitches: { ...featureSwitches, synonymRows: on, tips: on, mixKindWeights },
  });
}

/** The Edition the screens read, as it ships unless a test turns the kinds off. */
let editionInEffect: Edition;

/** The composition the screens read, opened afresh for each test. */
let composition: Composition;

jest.mock('expo-router', () => ({ useRouter: () => ({ back: () => undefined }) }));

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

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

async function open(on: boolean, mixKindWeights = true) {
  editionInEffect = editionWith(on, mixKindWeights);
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа' }],
      synonymRows: [row],
      tips: [tip],
    }),
    edition: editionInEffect,
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
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
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider
        shell={testShell({
          composition: opened(composition),
          remoteSwitches: switchedTo(editionInEffect),
        })}
      >
        <EditionProvider edition={edition} strings={editionStrings}>
          <UndoToastProvider>{children}</UndoToastProvider>
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
  await settle();
}

/** The hide button of the Entry's card and the hide choice it opens, as on the card's action row. */
function CardHide({ card }: { card: Parameters<typeof useHide>[0] }) {
  const hide = useHide(card);
  return (
    <>
      <HideButton onPress={hide.open} />
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

describe.each(kinds)('$name', ({ kind, feature, entry, title, subtitle }) => {
  it('have a switch on the Мій Мікс screen that takes them out of the Mix and puts them back', async () => {
    await renderInApp(<MixChoices />);
    const toggle = screen.getByTestId(`mix-${feature}`);
    expect(toggle).toHaveAccessibleName(title);
    expect(screen.getByHintText(subtitle)).toBe(toggle);

    await fireEvent(toggle, 'valueChange', false);
    await settle();
    expect(composition.mix.state.kinds[kind]).toBe(false);

    await fireEvent(toggle, 'valueChange', true);
    await settle();
    expect(composition.mix.state.kinds[kind]).toBe(true);
  });

  it('have a Mix kind weight under their switch that sets how often they come in the Feed', async () => {
    await renderInApp(<MixChoices />);
    const normal = screen.getByTestId(`mix-${feature}-weight-normal`);
    expect(normal).toHaveAccessibleName(`${title} у Стрічці: Звичайно`);
    expect(normal).toBeSelected();

    await fireEvent.press(screen.getByTestId(`mix-${feature}-weight-more`));
    await settle();
    expect(composition.mix.state.kindWeights[kind]).toBe('more');
    expect(screen.getByTestId(`mix-${feature}-weight-more`)).toBeSelected();

    await fireEvent.press(screen.getByTestId(`mix-${feature}-weight-less`));
    await settle();
    expect(composition.mix.state.kindWeights[kind]).toBe('less');
  });

  it('have no Mix kind weight while they are out of the Mix or the Edition turns the weights off', async () => {
    await composition.mix.setKind(kind, false);
    await renderInApp(<MixChoices />);
    expect(screen.queryByTestId(`mix-${feature}-weight-normal`)).toBeNull();

    await open(true, false);
    await renderInApp(<MixChoices />);
    expect(screen.getByTestId(`mix-${feature}`)).toBeOnTheScreen();
    expect(screen.queryByTestId(`mix-${feature}-weight-normal`)).toBeNull();
  });

  it('show a hidden one in their own section of the Hidden screen until it is put back', async () => {
    await hideFromCard(entry.id, 'entry');
    expect(composition.hiddenEntries.has(entry.id)).toBe(true);

    await renderInApp(<HiddenScreen />);
    expect(screen.getByTestId(`hidden-section-${feature}`)).toHaveTextContent(title, {
      exact: false,
    });
    expect(screen.queryByTestId('hidden-entries')).toBeNull();

    await fireEvent.press(screen.getByTestId(`hidden-entry-${entry.id}-restore`));
    await waitFor(() => {
      expect(screen.queryByTestId(`hidden-entry-${entry.id}`)).toBeNull();
    });
    expect(composition.hiddenEntries.has(entry.id)).toBe(false);
    expect(screen.queryByTestId(`hidden-section-${feature}`)).toBeNull();
    expect(screen.getByText(editionStrings.hidden.empty)).toBeOnTheScreen();
  });

  it('as a whole, hidden from a card, wait on the Hidden screen to be turned on', async () => {
    await hideFromCard(entry.id, 'whole-kind');
    expect(composition.mix.state.kinds[kind]).toBe(false);
    expect(screen.getByText(`${title} приховано`)).toBeOnTheScreen();

    await renderInApp(<HiddenScreen />);
    const turnOn = screen.getByTestId(`hidden-${feature}-turn-on`);
    expect(turnOn).toHaveAccessibleName(`Увімкнути ${title}`);

    await fireEvent.press(turnOn);
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
    expect(screen.queryByTestId(`mix-${feature}`)).toBeNull();

    await renderInApp(<HiddenScreen />);
    expect(screen.queryByTestId(`hidden-section-${feature}`)).toBeNull();
    expect(screen.queryByTestId(`hidden-${feature}`)).toBeNull();
    expect(screen.queryByTestId(`hidden-entry-${entry.id}`)).toBeNull();
  });
});
