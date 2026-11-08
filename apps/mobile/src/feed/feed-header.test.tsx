import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import {
  loadEdition,
  openComposition,
  type Composition,
  type TrackedUserState,
  type Edition,
  type Haptics,
} from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider, feedHeader, HapticsProvider, TokensProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { act, fireEvent, screen } from 'expo-router/testing-library';
import { renderRoutes } from '../shell/test-render';
import type { ColorScheme } from '@slovo/ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '../app/feed';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { activeEditionFiles, edition, editionStrings, editionTokens } from '../edition/edition';
import { LOGO_ROW } from '../edition/feed-loading';
import { screenSettled } from '../use-open-screen';
import { SettingsProvider } from '../settings/settings';

const { config } = activeEditionFiles;

/** The UA Edition in effect. */
let editionInEffect: Edition;

/** The user state the settings and the composition keep, opened afresh for each test. */
let userState: TrackedUserState;

/** The composition the screens read, opened afresh for each test. */
let composition: Composition;

const clock = { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

// The app in the foreground, where the Feed gets its next card ready.
jest.mock('../foreground/in-foreground', () => ({ useInForeground: () => true }));

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** A Word of the Edition's first Category, with the Stress on its second letter. */
function word(id: string, lemma: string): Word {
  return {
    kind: 'word',
    id,
    lemma,
    stress: [1],
    partOfSpeech: 'adjective',
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
  };
}

/** Opens the composition over two Words. */
async function open() {
  editionInEffect = loadEdition(config);
  // Onboarding finished weeks ago: nothing covers the Feed, and its first week is over.
  // The gestures hint was shown on an earlier launch: its finger demo loops for as long as
  // the sheet is open, which settling every timer would never finish. It has its own test.
  userState = await seedUserState(
    { onboardingFinished: '2026-09-01T09:00:00.000Z', gesturesHintShown: true },
    { clock },
  );
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [
        { id: 'emotions-character', displayName: 'Емоції', description: 'Емоції.', tone: 'loud' },
      ],
      words: [word('w_sumyrnyi', 'сумирний'), word('w_lahidnyi', 'лагідний')],
    }),
    edition: editionInEffect,
    userState: userState,
    clock,
    // The first Word in each draw, so each opening shows the same Word of the Day.
    random: { next: () => 0 },
  });
}

beforeEach(() => {
  jest.useFakeTimers();
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

/** The Shell the app draws under: the settings and the composition over the test's user state. */
const shell = () =>
  testShell({
    userState: opened(userState),
    remoteSwitches: switchedTo(editionInEffect),
    composition: opened(composition),
  });

/** The app on the Feed, in the Theme `colorScheme`. */
async function renderApp(colorScheme: ColorScheme) {
  await renderRoutes(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <TokensProvider tokens={editionTokens} colorScheme={colorScheme}>
            <ShellProvider shell={shell()}>
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
      index: HomeScreen,
    },
    { initialUrl: '/' },
  );
  await settle();
  // The pager lays its pages out once it knows its height.
  await fireEvent(screen.getByTestId('feed'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
  });
  await settle();
}

/** A `#RRGGBB` colour as react-native-svg hands it to the native side: an opaque ARGB, as a signed 32-bit integer. */
function argb(color: string) {
  return parseInt(`FF${color.slice(1)}`, 16) | 0;
}

/** A drawn element: its props and what it holds. */
interface Drawn {
  props: Record<string, unknown>;
  children: readonly (Drawn | string)[];
}

/** The stops of the gradient drawn in `node`, each an offset and a colour, from the top down. */
function gradientStops(node: Drawn): unknown[] | undefined {
  const { gradient } = node.props;
  if (Array.isArray(gradient)) {
    const stops: unknown[] = gradient;
    return stops;
  }
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    const stops = gradientStops(child);
    if (stops) return stops;
  }
  return undefined;
}

describe('the Feed header', () => {
  it.each<ColorScheme>(['light', 'dark'])(
    'covers the scrolled cards with the screen background from the top edge, in the %s Theme',
    async (colorScheme) => {
      await open();
      await renderApp(colorScheme);
      // From the top of the screen, behind the status bar, down past the logo row the cards scroll under:
      // the tabbed cards' Feed has no row of the XP bar and Search under it (board p1, ADR 0091).
      expect(screen.getByTestId('feed-header')).toHaveStyle({
        top: 0,
        left: 0,
        right: 0,
        height: 47 + LOGO_ROW,
      });
      expect(
        screen.getByTestId('feed-header-backdrop', { includeHiddenElements: true }),
      ).toHaveStyle({ backgroundColor: editionTokens.colors[colorScheme].background });
    },
  );

  it.each<ColorScheme>(['light', 'dark'])(
    'fades its lower edge from the screen background to transparent, inside the top row, in the %s Theme',
    async (colorScheme) => {
      await open();
      await renderApp(colorScheme);
      const fade = screen.getByTestId('feed-header-fade', { includeHiddenElements: true });
      // The fade ends where the top row ends, so the first card at rest starts below it.
      expect(fade).toHaveProp('height', feedHeader.fade);
      expect(fade).toHaveProp('pointerEvents', 'none');
      const background = argb(editionTokens.colors[colorScheme].background);
      // Two stops, each an offset and a colour: the background, then the background fully transparent.
      const stops = gradientStops(fade);
      expect(stops).toEqual([0, background, 1, background & 0xffffff]);
    },
  );
});
