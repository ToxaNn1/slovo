import { describe, expect, it, jest } from '@jest/globals';
import {
  createMemorySessionStore,
  openAccount,
  systemRandom,
  type FeatureSwitch,
  type Word,
} from '@slovo/core';
import {
  createFakeAppleSignInSheet,
  createFakeBackend,
  createFakeGoogleSignInSheet,
  createMemoryContentPort,
  seedUserState,
} from '@slovo/core/testing';
import { EditionProvider, fill } from '@slovo/ui';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { edition, editionStrings } from '../edition/edition';
import { openOnce } from '../opening';
import { SettingsProvider } from '../settings/settings';
import { ShellProvider, type ShareCard } from '../shell-value';
import { opened, settingsAt, switchedTo, testShell } from '../shell/test-support';
import { ProfileScreen } from './profile-screen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  // The screen comes into view as it renders.
  useFocusEffect: (effect: () => () => void) => {
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]);
  },
}));

const strings = editionStrings.settings.profile;

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** An Account no one is signed in to, opened. */
async function signedOutAccount() {
  const opening = openOnce(
    async () =>
      openAccount({
        backend: createFakeBackend().backend,
        edition: { id: 'uk', isFeatureEnabled: () => false },
        googleSheet: createFakeGoogleSignInSheet(),
        appleSheet: createFakeAppleSignInSheet(),
        sessions: createMemorySessionStore(),
        userState: await seedUserState(),
        clock: { now: () => new Date('2026-10-24T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
        schedule: (run) => {
          run();
          return () => undefined;
        },
        random: systemRandom,
      }),
    { onError: jest.fn() },
  );
  await opening.opened();
  return opening;
}

/** A Share Card capture whose share sheet the reader always sends. */
const sendingShareCard: ShareCard = (_view, _cardId, _format, onShared) => {
  onShared();
  return Promise.resolve('closed');
};

/** «сумирний», a Word of the test Language Pack. */
const sumyrnyi: Word = {
  kind: 'word',
  id: 'w_sumyrnyi',
  lemma: 'сумирний',
  stress: [1],
  partOfSpeech: 'adjective',
  primaryDefinition: 'Тихий, лагідний.',
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

/** The facts of the user state a test seeds: yesterday's XP and today's Word of the Day. */
type Seed = Parameters<typeof seedUserState>[0];

/**
 * The Profile over the Core's composition of a test Shell, as the UA Edition
 * ships it unless a switch is turned off or on, after `rounds` right Game
 * Rounds of 1 XP each, with the counters hidden or not, over the user state
 * `seed` and a Language Pack of «сумирний».
 */
async function renderScreen({
  withAccount = false,
  rounds = 0,
  noCounters = false,
  switchedOff,
  switchedOn,
  seed = {},
  shareCard,
}: {
  withAccount?: boolean;
  rounds?: number;
  noCounters?: boolean;
  switchedOff?: FeatureSwitch;
  switchedOn?: FeatureSwitch;
  seed?: Seed;
  shareCard?: ShareCard;
} = {}) {
  const userState = opened(
    await seedUserState(seed, {
      clock: { now: () => new Date('2026-10-13T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    }),
  );
  const languagePack = opened({
    reader: {
      ...createMemoryContentPort({
        categories: [
          { id: 'emotions-character', displayName: 'Емоції', description: 'Емоції.', tone: 'loud' },
        ],
        words: [sumyrnyi],
      }),
      metadata: () => Promise.reject(new Error('A test pack has no metadata')),
      crosswordDay: () => Promise.resolve(undefined),
    },
    version: { contentVersion: 1, packFormat: 1 },
    contentUpdate: undefined,
  });
  const composition = await testShell({ userState, languagePack }).composition.opened();
  for (let round = 0; round < rounds; round += 1) {
    composition.xpLog
      .award({ source: 'game-round', mode: 'guess-word', rarity: undefined })
      .commit();
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  const account = withAccount ? await signedOutAccount() : undefined;
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider
        shell={testShell({
          userState,
          composition: opened(composition),
          remoteSwitches: switchedTo({
            ...edition,
            isFeatureEnabled: (feature) =>
              feature === switchedOff
                ? false
                : feature === switchedOn || edition.isFeatureEnabled(feature),
          }),
          settings: await settingsAt({ noCounters }),
          account,
          shareCard,
        })}
      >
        <EditionProvider edition={edition} strings={editionStrings}>
          <SettingsProvider>
            <ProfileScreen />
          </SettingsProvider>
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
}

/** The lines of the counters «Без лічильників» hides. */
const counterLines = [
  'profile-level',
  'profile-level-name',
  'profile-level-progress',
  'profile-level-left',
  'profile-total-xp',
  'profile-ladder',
  'profile-streak',
  'profile-streak-words',
  'profile-best-streak',
];

describe('the Profile', () => {
  it('shows the Level, XP, Streaks, confirmed Entries by rarity, the Badges and each Game Mode', async () => {
    await renderScreen();

    expect(screen.getByText(strings.title)).toBeOnTheScreen();
    expect(screen.getByTestId('profile-streak')).toHaveTextContent('0');
    expect(screen.getByTestId('profile-streak-words')).toHaveTextContent('днів поспіль');
    expect(screen.getByTestId('profile-best-streak')).toHaveTextContent('найкраща серія — 0');
    expect(screen.getByTestId('profile-level-number')).toHaveTextContent('0');
    expect(screen.getByText(strings.levelLabel)).toBeOnTheScreen();
    expect(screen.getByTestId('profile-level-name')).toHaveTextContent('0 · Початківець');
    expect(screen.getByTestId('stats-calendar')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-badges-count')).toHaveTextContent(
      `0 з ${String(edition.badges.length)}`,
    );
    for (const rarity of [1, 2, 3, 4, 5]) {
      expect(screen.getByTestId(`profile-confirmed-${String(rarity)}`)).toHaveTextContent(
        `Рідкість ${String(rarity)}: 0`,
      );
    }
    for (const { name } of edition.badges) expect(screen.getByLabelText(name)).toBeOnTheScreen();
    expect(screen.getByTestId('profile-best-guess-word')).toHaveTextContent(
      `Вгадай слово — ${strings.noGameBest}`,
    );
  });

  it('reads the Level card as «N · name», its XP in the Level and the XP left to the next', async () => {
    await renderScreen({ rounds: 60 });

    expect(screen.getByTestId('profile-level-number')).toHaveTextContent('1');
    expect(screen.getByTestId('profile-level-name')).toHaveTextContent('1 · Початківець');
    expect(screen.getByTestId('profile-level-progress')).toHaveTextContent('10 / 55 XP');
    expect(screen.getByTestId('profile-level-left')).toHaveTextContent('ще 45 XP до рівня 2');
  });

  it('shows the ladder of Level names by range, passed, current and ahead, and the bar to the next name', async () => {
    await renderScreen({ rounds: 60 });
    const { ladder } = strings;

    const captions = ['Рівні 0–4', 'Рівні 5–9', 'Рівні 10–14', 'Рівні 15–19', 'Рівні 20–24'];
    for (const [index, caption] of [...captions, 'Рівні 25+'].entries()) {
      const name = edition.levels.names[index] ?? '';
      const state = index === 0 ? ladder.current : ladder.ahead;
      expect(screen.getByTestId(`profile-ladder-${String(index)}`)).toHaveAccessibleName(
        `${caption}, ${name}, ${state}`,
      );
    }
    expect(screen.queryByTestId('profile-ladder-6')).not.toBeOnTheScreen();
    expect(screen.getByTestId('profile-ladder-bar')).toHaveTextContent(/^РІВЕНЬ 1 · ПОЧАТКІВЕЦЬ/);
    expect(screen.getByTestId('profile-ladder-to-next')).toHaveTextContent('ДО ЧИТАЧ 246 XP');
  });

  it('tags the names below the Level as passed', async () => {
    await renderScreen({ rounds: 306 });

    expect(screen.getByTestId('profile-ladder-0')).toHaveAccessibleName(
      `Рівні 0–4, ${edition.levels.names[0] ?? ''}, ${strings.ladder.passed}`,
    );
    expect(screen.getByTestId('profile-ladder-1')).toHaveAccessibleName(
      `Рівні 5–9, ${edition.levels.names[1] ?? ''}, ${strings.ladder.current}`,
    );
  });

  it('hides the ladder with its switch off, and nothing else', async () => {
    await renderScreen({ rounds: 60, switchedOff: 'levelLadder' });

    expect(screen.queryByTestId('profile-ladder')).not.toBeOnTheScreen();
    expect(screen.getByTestId('profile-level-left')).toBeOnTheScreen();
  });

  it('draws its lists without the React warning of a missing key', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await renderScreen();

    expect(errors.mock.calls.flat().join(' ')).not.toMatch(/unique "key"/);
    errors.mockRestore();
  });

  it('hides the Level, the XP and the Streaks while the reader hides the counters («Без лічильників»)', async () => {
    await renderScreen({ rounds: 50, noCounters: true, shareCard: sendingShareCard });

    for (const line of counterLines) expect(screen.queryByTestId(line)).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: strings.shareLevel })).not.toBeOnTheScreen();
    expect(screen.getByTestId('stats-calendar')).toBeOnTheScreen();
    expect(screen.getByText(strings.confirmed)).toBeOnTheScreen();
  });

  it('shares the Level reached as its Share Card and tells Analytics once it is shared', async () => {
    await renderScreen({ rounds: 50, shareCard: sendingShareCard });
    expect(screen.getByTestId('profile-level-number')).toHaveTextContent('1');

    await fireEvent.press(screen.getByRole('button', { name: strings.shareLevel }));

    const card = within(screen.getByTestId('share-preview')).getByTestId('share-card');
    expect(card).toHaveAccessibleName(/13 жовтня\. Новий рівень у SLOVO\. Рівень 1/);
  });

  it('offers no share of the Level before the first one is reached', async () => {
    await renderScreen({ shareCard: sendingShareCard });

    expect(screen.getByTestId('profile-level-number')).toHaveTextContent('0');
    expect(screen.queryByRole('button', { name: strings.shareLevel })).not.toBeOnTheScreen();
  });

  it('offers no share of the Level with the progress Share Cards off', async () => {
    await renderScreen({
      rounds: 50,
      switchedOff: 'progressShareCards',
      shareCard: sendingShareCard,
    });

    expect(screen.getByTestId('profile-level-number')).toHaveTextContent('1');
    expect(screen.queryByRole('button', { name: strings.shareLevel })).not.toBeOnTheScreen();
  });

  it('stamps no Badge at a tap on one not yet earned', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByLabelText(edition.badges[0]?.name ?? ''));
    expect(screen.queryByTestId('badge-stamp')).not.toBeOnTheScreen();
    expect(screen.queryByText(strings.badgeStamp.title)).not.toBeOnTheScreen();
  });

  it('has no offer to save progress without an Account', async () => {
    await renderScreen();

    expect(screen.queryByTestId('profile-save-progress')).not.toBeOnTheScreen();
  });

  it('offers to save progress at the top while no one is signed in, and opens the Account', async () => {
    await renderScreen({ withAccount: true });

    const { title, save } = editionStrings.feedNotices.saveProgress;
    expect(screen.getByText(title)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: save }));
    expect(mockPush).toHaveBeenCalledWith('/settings/account');
  });

  describe('with the calendar day lines on', () => {
    const months = editionStrings.dates.months;
    const lines = editionStrings.stats.calendar.lines;
    /** Yesterday an Active Day; today, active after 5 XP, with «сумирний» kept as its Word of the Day. */
    const seed: Seed = {
      xpLog: {
        yesterday: {
          kind: 'xp',
          date: '2026-10-12',
          at: '2026-10-12T05:00:00.000Z',
          source: 'game-round',
          amount: 5,
        },
      },
      wordOfTheDayArchive: { '2026-10-13': 'w_sumyrnyi' },
    };
    const tapped = async (date: string) => {
      await renderScreen({ switchedOn: 'calendarDayLines', rounds: 5, seed });
      await fireEvent.press(screen.getByTestId(`stats-calendar-${date}`));
      // The Word of the Day archive is read as the screen comes into view.
      return screen.findByTestId('stats-calendar-line');
    };

    it('shows the line of an Active Day at a tap on it', async () => {
      expect(await tapped('2026-10-12')).toHaveTextContent(
        fill(lines.active, { day: '12', month: months[9] ?? '' }),
      );
    });

    // The Lemma reads as its row in «Слова дня» does, with its Stress mark.
    it('shows today with its Word of the Day once today is active', async () => {
      expect(await tapped('2026-10-13')).toHaveTextContent(fill(lines.today, { word: 'су́мирний' }));
    });

    it('shows the line of a day missed', async () => {
      expect(await tapped('2026-10-11')).toHaveTextContent(
        fill(lines.missed, { day: '11', month: months[9] ?? '' }),
      );
    });

    it('shows the line of a day to come', async () => {
      expect(await tapped('2026-10-18')).toHaveTextContent(lines.future);
    });
  });

  it('shows no line at a tap on a day with the calendar day lines off, the calendar still there', async () => {
    await renderScreen({ switchedOff: 'calendarDayLines', rounds: 1 });
    await fireEvent.press(screen.getByTestId('stats-calendar-2026-10-11'));
    expect(screen.getByTestId('stats-calendar')).toBeOnTheScreen();
    expect(screen.queryByTestId('stats-calendar-line')).toBeNull();
  });
});
