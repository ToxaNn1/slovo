import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import { openComposition, SEEN_DWELL_MS, type Composition, type UserStateFact } from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider, RouteProvider } from '@slovo/ui';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderInGestureRoot } from '../shell/test-render';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { edition, editionStrings } from '../edition/edition';
import { fill } from '@slovo/contracts';
import { SettingsProvider } from '../settings/settings';
import { ShellProvider } from '../shell-value';
import { opened, settingsAt, switchedTo, testShell } from '../shell/test-support';
import { CELEBRATION_MS, MascotCelebrations } from './mascot';

const { mascot } = edition;

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** The one Word in the Feed, which a dwell makes Seen. */
const word: Word = {
  kind: 'word',
  id: 'w_test',
  lemma: 'test',
  stress: [0],
  partOfSpeech: 'noun',
  primaryDefinition: 'The meaning of test.',
  extraDefinitions: [],
  examples: [],
  synonyms: [],
  antonyms: [],
  registers: [],
  categoryId: 'test',
  rarity: 3,
  sources: [{ title: 'Test source' }],
  correctionIds: [],
  retired: false,
};

/** The celebrations over a Core composition with one Word, whose clock moves with the fake timers, with the Mascot and the new Level screen on or off in effect and the counters hidden or not. */
async function renderCelebrations({
  on = true,
  levelScreen = false,
  noCounters = false,
  badgeToast = false,
  crosswordStamp = false,
  crosswordDays = 0,
  route = '/feed',
} = {}) {
  const composition = await openComposition({
    content: createMemoryContentPort({ words: [word] }),
    edition,
    userState: await seedUserState({ xpLog: crosswordsSolved(crosswordDays) }),
    clock: { now: () => new Date(), timeZone: () => 'Europe/Kyiv' },
    random: { next: () => 0.5 },
  });
  const shell = testShell({
    composition: opened(composition),
    remoteSwitches: switchedTo({
      ...edition,
      isFeatureEnabled: (feature) =>
        feature === 'mascot'
          ? on
          : feature === 'newLevelScreen'
            ? levelScreen
            : feature === 'badgeToast'
              ? badgeToast
              : feature === 'crosswordBadgeStamp'
                ? crosswordStamp
                : edition.isFeatureEnabled(feature),
    }),
    settings: await settingsAt({ noCounters }),
  });
  await renderInGestureRoot(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider shell={shell}>
        <EditionProvider edition={edition} strings={editionStrings}>
          <SettingsProvider>
            <RouteProvider route={route}>
              <MascotCelebrations />
            </RouteProvider>
          </SettingsProvider>
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
  return composition;
}

/** The day `days` before today in Kyiv, as `YYYY-MM-DD`. */
const dayBefore = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toLocaleDateString('sv-SE', {
    timeZone: 'Europe/Kyiv',
  });

/**
 * The XP records of the Daily Crossword solved on each of the `days` days
 * before today, with the week's Streak Badge earned before them, as a reader
 * on a Streak has it.
 */
function crosswordsSolved(days: number): UserStateFact<'xpLog'> {
  if (days === 0) return {};
  const records: Record<string, UserStateFact<'xpLog'>[string]> = {
    'badge-streak-7': {
      kind: 'badge',
      date: dayBefore(30),
      at: `${dayBefore(30)}T09:00:00.000Z`,
      badge: 'streak-7',
    },
  };
  for (let day = 1; day <= days; day += 1) {
    const date = dayBefore(day);
    records[`seeded-crossword-${date}`] = {
      kind: 'xp',
      date,
      at: `${date}T09:00:00.000Z`,
      source: 'daily-crossword',
      amount: 15,
    };
  }
  return records;
}

/** Solves today's Daily Crossword, as the crossword screen does. */
async function solveCrossword(composition: Composition) {
  await act(async () => {
    composition.xpLog.award({ source: 'daily-crossword', date: dayBefore(0) }).commit();
    // Settles the writes without running the celebration's timer out.
    await jest.advanceTimersByTimeAsync(0);
  });
}

/** Wins a Game for the first time, which earns a Badge. */
async function winGame(composition: Composition) {
  await act(async () => {
    composition.xpLog
      .award({ source: 'game-finished', mode: 'guess-word', right: 10, played: 10 })
      .commit();
    // Settles the writes without running the celebration's timer out.
    await jest.advanceTimersByTimeAsync(0);
  });
}

/** Awards XP for `rounds` right Game Rounds, as the Game does. */
async function playRounds(composition: Composition, rounds: number) {
  await act(async () => {
    for (let round = 0; round < rounds; round += 1) {
      composition.xpLog
        .award({ source: 'game-round', mode: 'guess-word', rarity: undefined })
        .commit();
    }
    // Settles the writes without running the celebration's timer out.
    await jest.advanceTimersByTimeAsync(0);
  });
}

/** The Mascot on screen; VoiceOver skips the celebration, so the query looks past what it hides. */
const shownMascot = () => screen.queryByTestId(/^mascot-/, { includeHiddenElements: true });
const celebration = (state: string) =>
  screen.getByTestId(`mascot-${state}`, { includeHiddenElements: true });

beforeEach(() => {
  jest.useFakeTimers({ advanceTimers: true });
});

afterEach(() => {
  jest.useRealTimers();
});

// Ticket #1386: the Mascot's celebrations, which never interrupt the Feed.
describe('the Mascot’s celebrations', () => {
  it('celebrates the first Streak day, the Daily Goal met and a new Level, each for a while', async () => {
    const composition = await renderCelebrations();
    expect(shownMascot()).toBeNull();

    // The 5th XP makes today an Active Day, the first day of the Streak.
    await playRounds(composition, 5);
    expect(celebration('streakMilestone')).toHaveTextContent(mascot.streakMilestone);
    // VoiceOver skips the line, which takes no touch either.
    expect(screen.queryByText(mascot.streakMilestone)).toBeNull();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(CELEBRATION_MS);
    });
    expect(shownMascot()).toBeNull();

    // The first Word Seen meets a Daily Goal of 1 Word (ADR 0074).
    await act(async () => {
      await composition.xpLog.setDailyGoal(1);
      await composition.feed.show(0);
      await jest.advanceTimersByTimeAsync(SEEN_DWELL_MS);
      await composition.feed.show(undefined);
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(celebration('dailyGoal')).toHaveTextContent(mascot.dailyGoal);

    // The 50th XP reaches Level 1.
    await playRounds(composition, 45);
    expect(celebration('newLevel')).toHaveTextContent(mascot.newLevel);
  });

  it('celebrates a Badge earned by the first win in a Game Mode group', async () => {
    const composition = await renderCelebrations();

    await act(async () => {
      composition.xpLog
        .award({ source: 'game-finished', mode: 'guess-word', right: 10, played: 10 })
        .commit();
      // Settles the writes without running the celebration's timer out.
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(celebration('badge')).toHaveTextContent(mascot.badge);
  });

  it('celebrates nothing while the reader hides the counters («Без лічильників», ADR 0066)', async () => {
    const composition = await renderCelebrations({ noCounters: true });

    // The 50th XP reaches Level 1, past the first Streak day and the Daily Goal.
    await playRounds(composition, 50);

    expect(shownMascot()).toBeNull();
  });

  it('celebrates nothing with its Feature Switch off, as in 0.9', async () => {
    const composition = await renderCelebrations({ on: false });

    await playRounds(composition, 50);

    expect(shownMascot()).toBeNull();
  });
});

// Ticket #1649: the new Level screen (p6) replaces the Mascot's overlay for a new Level.
// Ticket #1647: a Badge earned during a Game toasts; elsewhere it is stamped (board 10.7).
describe('a Badge earned with the badge toast on', () => {
  const stamp = editionStrings.settings.profile.badgeStamp;
  const hidden = { includeHiddenElements: true };

  it('toasts in a Game, with the line, and goes after a while', async () => {
    const composition = await renderCelebrations({ badgeToast: true, route: '/game/guess-word' });

    await winGame(composition);

    expect(screen.getByTestId('badge-toast', hidden)).toBeOnTheScreen();
    expect(screen.getByText(stamp.line, hidden)).toBeOnTheScreen();
    expect(screen.queryByText(stamp.kicker, hidden)).toBeNull();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(CELEBRATION_MS);
    });
    expect(screen.queryByTestId('badge-toast', hidden)).toBeNull();
  });

  it('is stamped outside a Game, and «ГОТОВО» closes the stamp', async () => {
    const composition = await renderCelebrations({ badgeToast: true });

    await winGame(composition);

    expect(screen.getByText(stamp.kicker)).toBeOnTheScreen();
    expect(screen.queryByTestId('badge-toast', hidden)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: stamp.done }));
    expect(screen.queryByText(stamp.kicker)).toBeNull();
  });

  it('only celebrates with the Mascot with the badge toast off, in a Game too', async () => {
    const composition = await renderCelebrations({ route: '/game/guess-word' });

    await winGame(composition);

    expect(celebration('badge')).toHaveTextContent(mascot.badge);
    expect(screen.queryByTestId('badge-toast', hidden)).toBeNull();
    expect(screen.queryByText(stamp.kicker, hidden)).toBeNull();
  });
});

// Ticket #1683: a Badge earned by a crossword solve is stamped full screen (board 08.2).
describe('a Badge earned with the crossword Badge stamp on', () => {
  const stamp = editionStrings.settings.profile.badgeStamp;
  const hidden = { includeHiddenElements: true };

  it('stamps the 7th solve in a row with its kicker, mark, name and line, with no Mascot or ribbon', async () => {
    const composition = await renderCelebrations({
      badgeToast: true,
      crosswordStamp: true,
      crosswordDays: 6,
      route: '/game/crossword',
    });

    await solveCrossword(composition);

    expect(screen.getByText('7 ПОСПІЛЬ')).toBeOnTheScreen();
    expect(screen.getByTestId('badge-stamp-mark')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Сім кросвордів поспіль' })).toBeOnTheScreen();
    expect(screen.getByText('Нова відзнака — тепер вона твоя назавжди.')).toBeOnTheScreen();
    expect(screen.queryByText(stamp.ribbon, hidden)).toBeNull();
    expect(shownMascot()).toBeNull();
    expect(screen.queryByTestId('badge-toast', hidden)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: stamp.done }));
    expect(screen.queryByText('7 ПОСПІЛЬ')).toBeNull();
  });

  it('still toasts a Badge earned in a Game', async () => {
    const composition = await renderCelebrations({
      badgeToast: true,
      crosswordStamp: true,
      route: '/game/guess-word',
    });

    await winGame(composition);

    expect(screen.getByTestId('badge-toast', hidden)).toBeOnTheScreen();
    expect(screen.queryByTestId('badge-stamp', hidden)).toBeNull();
  });

  it('toasts a Badge of another family earned on the crossword’s screen', async () => {
    const composition = await renderCelebrations({
      badgeToast: true,
      crosswordStamp: true,
      route: '/game/crossword',
    });

    await winGame(composition);

    expect(screen.getByTestId('badge-toast', hidden)).toBeOnTheScreen();
    expect(screen.queryByTestId('badge-stamp', hidden)).toBeNull();
  });

  it('toasts the 7th solve as before with its Feature Switch off', async () => {
    const composition = await renderCelebrations({
      badgeToast: true,
      crosswordDays: 6,
      route: '/game/crossword',
    });

    await solveCrossword(composition);

    expect(screen.getByTestId('badge-toast', hidden)).toBeOnTheScreen();
    expect(screen.queryByText('7 ПОСПІЛЬ', hidden)).toBeNull();
  });
});

describe('the new Level screen', () => {
  const strings = editionStrings.settings.profile.newLevel;
  const title = fill(strings.title, { level: '1', name: edition.levels.names[0] ?? '' });

  it('shows at a new Level with its number and name and the Mascot, and «ГОТОВО» closes it', async () => {
    const composition = await renderCelebrations({ levelScreen: true });
    await playRounds(composition, 49);
    expect(screen.queryByText(title)).toBeNull();

    // The 50th XP reaches Level 1.
    await playRounds(composition, 1);
    expect(screen.getByText(strings.kicker)).toBeOnTheScreen();
    expect(screen.getByText('1')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
    expect(screen.getByText(mascot.newLevel)).toBeOnTheScreen();
    // The screen replaces the overlay: no second Mascot under it.
    expect(screen.getAllByTestId('mascot-newLevel', { includeHiddenElements: true })).toHaveLength(
      1,
    );

    // It waits for the reader, not for the celebration's timer.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(CELEBRATION_MS);
    });
    expect(screen.getByText(title)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: strings.done }));
    expect(screen.queryByText(title)).toBeNull();
    expect(shownMascot()).toBeNull();
  });

  it('shows nothing while the reader hides the counters («Без лічильників», ADR 0066)', async () => {
    const composition = await renderCelebrations({ levelScreen: true, noCounters: true });

    await playRounds(composition, 50);

    expect(screen.queryByText(title)).toBeNull();
    expect(shownMascot()).toBeNull();
  });

  it('leaves the Mascot’s overlay with its Feature Switch off', async () => {
    const composition = await renderCelebrations();

    await playRounds(composition, 50);

    expect(screen.queryByText(title)).toBeNull();
    expect(celebration('newLevel')).toHaveTextContent(mascot.newLevel);
  });
});
