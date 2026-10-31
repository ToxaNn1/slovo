import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  trackChanges,
  type Composition,
  type Edition,
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import config from 'slovo-edition/config';

import { edition, editionStrings } from '../edition/edition';
import { screenSettled } from '../entries/use-open-screen';
import { SettingsProvider } from '../settings/settings';
import { ShellProvider } from '../shell-value';
import { opened, testShell } from '../shell/test-support';
import { MoodButtonAndSheet } from './mood';

/** The Ukrainian Edition with the Account off, and moods on or off. */
function editionWith({ moods }: { moods: boolean }): Edition {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, boolean> };
  return loadEdition({
    ...rest,
    featureSwitches: { ...featureSwitches, account: false, moods },
  });
}

/** The Edition the shell reads, as it ships unless a test turns moods off. */
let mockEdition: Edition;

/** The user state the settings and the composition keep, one for the whole file. */
let userState: Awaited<ReturnType<typeof openUserState>>;

/** The clock of the test. */
const clock = { now: () => new Date('2026-10-27T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

/** The composition the shell reads, opened afresh for each test. */
let composition: Composition;

/** A random source that steps through fixed values, so each test draws the same roulettes. */
function steppingRandom() {
  const values = [0.1, 0.6, 0.3, 0.8, 0.5];
  let next = 0;
  return { next: () => values[next++ % values.length] ?? 0 };
}

/** The screens the shell opens. */
const mockPush = jest.fn<(href: string) => void>();

jest.mock('../edition/remote-switches', () => ({ useEditionInEffect: () => mockEdition }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  // No stack of links holds anything yet, so the card opens on top.
  useNavigationContainerRef: () => ({ getRootState: () => undefined }),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const strings = editionStrings.mood;
const [joyful, sad] = edition.moods;

/** A Word of the Edition's first Category, carrying the moods given. */
function word(id: string, lemma: string, moods: readonly string[]): Word {
  return {
    kind: 'word',
    id,
    lemma,
    stress: [0],
    partOfSpeech: 'noun',
    primaryDefinition: `Значення слова ${lemma}.`,
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId: 'emotions-character',
    rarity: 3,
    sources: [{ title: 'Словник' }],
    correctionIds: [],
    retired: false,
    moods: [...moods],
  };
}

/** Two Words of the first mood, and none of any other. */
const words = [
  word('w_veselyk', 'веселик', [joyful?.id ?? '']),
  word('w_radist', 'радісник', [joyful?.id ?? '']),
];

beforeAll(async () => {
  userState = await openUserState({ port: createMemoryUserStatePort(new Map()) });
});

beforeEach(async () => {
  jest.useFakeTimers();
  mockPush.mockClear();
  mockEdition = editionWith({ moods: true });
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'emotions-character', displayName: 'Емоції' }],
      words,
    }),
    edition: mockEdition,
    userState,
    clock,
    random: steppingRandom(),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  // Each test opens a screen; the next one may open its own straight away.
  screenSettled();
});

/**
 * Moves time on by `ms`, a step at a time, each in its own `act`, so the sheet
 * starts sliding away in the step after the roulette asks it to, as on a device.
 */
async function settle(ms = 0) {
  const STEP_MS = 50;
  let passed = 0;
  do {
    const step = Math.min(STEP_MS, ms - passed);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(step);
    });
    passed += step;
  } while (passed < ms);
}

async function renderHeader() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider
        shell={testShell({
          userState: opened(trackChanges({ userState, clock })),
          composition: opened(composition),
        })}
      >
        <EditionProvider edition={edition} strings={editionStrings}>
          <SettingsProvider>
            <MoodButtonAndSheet />
          </SettingsProvider>
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
  await settle();
}

async function openChips() {
  await renderHeader();
  await fireEvent.press(screen.getByRole('button', { name: strings.title }));
  await settle();
}

/** The roulette and the hints under disabled chips are hidden from VoiceOver, not from the eye. */
const hidden = { includeHiddenElements: true };

/** The Lemmas the roulette can show and land on. */
const lemmas = words.map(({ lemma }) => lemma);

describe('«Слово під настрій»', () => {
  it('opens the six moods of the Edition as chips', async () => {
    await openChips();

    expect(edition.moods).toHaveLength(6);
    for (const mood of edition.moods) {
      expect(screen.getByRole('button', { name: mood.name })).toBeOnTheScreen();
    }
  });

  it('runs a roulette of Lemmas for a chip, then opens the card of a Word of that mood', async () => {
    await openChips();

    await fireEvent.press(screen.getByRole('button', { name: joyful?.name ?? '' }));
    await settle(500);

    expect(screen.getByTestId('mood-roulette', hidden)).toBeOnTheScreen();
    expect(lemmas).toContain(screen.getByTestId('mood-roulette-lemma', hidden).props['children']);
    expect(mockPush).not.toHaveBeenCalled();

    await settle(2000);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(['/mood/w_veselyk', '/mood/w_radist']).toContain(mockPush.mock.calls[0]?.[0]);
  });

  it('keeps the roulette between 1 and 2 seconds', async () => {
    await openChips();

    await fireEvent.press(screen.getByRole('button', { name: joyful?.name ?? '' }));
    await settle(1000);
    expect(mockPush).not.toHaveBeenCalled();

    await settle(1000);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('disables a mood with no Eligible Word and says why', async () => {
    await openChips();

    const chip = screen.getByRole('button', { name: sad?.name ?? '' });
    expect(chip).toBeDisabled();
    expect(chip.props['accessibilityHint']).toBe(strings.noEligibleWord);
    expect(screen.getAllByText(strings.noEligibleWord, hidden)).toHaveLength(
      edition.moods.length - 1,
    );

    await fireEvent.press(chip);
    await settle(3000);

    expect(screen.queryByTestId('mood-roulette', hidden)).not.toBeOnTheScreen();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('opens the card straight away under Reduce Motion, with no roulette', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await openChips();

    await fireEvent.press(screen.getByRole('button', { name: joyful?.name ?? '' }));
    await settle();

    expect(screen.queryByTestId('mood-roulette', hidden)).not.toBeOnTheScreen();

    // Only the sheet's fade out is left before the card opens.
    await settle(300);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(['/mood/w_veselyk', '/mood/w_radist']).toContain(mockPush.mock.calls[0]?.[0]);
  });

  it('shows no 🎲 while moods are off in effect', async () => {
    mockEdition = editionWith({ moods: false });
    await renderHeader();

    expect(screen.queryByRole('button', { name: strings.title })).not.toBeOnTheScreen();
  });

  it('starts one roulette when a chip is tapped twice before the draw answers', async () => {
    await openChips();
    const draw = jest.spyOn(composition.moodDraw, 'draw');

    const chip = screen.getByRole('button', { name: joyful?.name ?? '' });
    await act(async () => {
      void fireEvent.press(chip);
      void fireEvent.press(chip);
      await Promise.resolve();
    });
    await settle(2500);

    expect(draw).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('logs a failed draw and a failed list of moods instead of leaving them unhandled', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await openChips();
    jest.spyOn(composition.moodDraw, 'draw').mockRejectedValue(new Error('draw failed'));

    await fireEvent.press(screen.getByRole('button', { name: joyful?.name ?? '' }));
    await settle();
    expect(logged).toHaveBeenCalledTimes(1);

    jest.spyOn(composition.moodDraw, 'moods').mockRejectedValue(new Error('moods failed'));
    await fireEvent.press(screen.getByRole('button', { name: strings.title }));
    await settle();
    expect(logged).toHaveBeenCalledTimes(2);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
