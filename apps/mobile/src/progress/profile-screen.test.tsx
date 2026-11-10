import { type Word } from '@slovo/contracts';
import { describe, expect, it, jest } from '@jest/globals';
import {
  createMemorySessionStore,
  openAccount,
  systemRandom,
  type FeatureSwitch,
} from '@slovo/core';
import {
  createFakeAppleSignInSheet,
  createFakeBackend,
  createFakeGoogleSignInSheet,
  createMemoryContentPort,
  seedUserState,
  createMemoryContentStore,
} from '@slovo/core/testing';
import { EditionProvider, fill } from '@slovo/ui';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { renderInGestureRoot } from '../shell/test-render';
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
    },
    contentVersion: () => 1,
    contentUpdate: undefined,
    store: createMemoryContentStore(),
  });
  const composition = await testShell({ userState, languagePack }).composition.opened();
  for (let round = 0; round < rounds; round += 1) {
    composition.xpLog
      .award({ source: 'game-round', mode: 'guess-word', rarity: undefined })
      .commit();
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  const account = withAccount ? await signedOutAccount() : undefined;
  await renderInGestureRoot(
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
  it('shows the Level, XP, Streaks and the Badges', async () => {
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
    for (const { name } of edition.badges) expect(screen.getByLabelText(name)).toBeOnTheScreen();
    const heads = screen.getAllByRole('header');
    const places = edition.badgeFamilies.map(({ name }) =>
      heads.indexOf(screen.getByRole('header', { name })),
    );
    expect(places).toEqual([...places].sort((a, b) => a - b));
    for (const { id } of edition.badgeFamilies) {
      const members = edition.badges.filter(({ family }) => family === id).length;
      expect(screen.getByTestId(`badge-family-${id}-count`)).toHaveTextContent(
        `0 з ${String(members)}`,
      );
    }
  });

  it('shows the confirmed Entries by rarity while their Feature Switch is on', async () => {
    await renderScreen({ switchedOn: 'profileConfirmedByRarity' });

    expect(screen.getByText(strings.confirmed)).toBeOnTheScreen();
    for (const rarity of [1, 2, 3, 4, 5]) {
      expect(screen.getByTestId(`profile-confirmed-${String(rarity)}`)).toHaveTextContent(
        `Рідкість ${String(rarity)}: 0`,
      );
    }
  });

  it("shows each Game Mode's Best result while its Feature Switch is on", async () => {
    await renderScreen({ switchedOn: 'profileGameBest' });

    expect(screen.getByText(strings.gameBest)).toBeOnTheScreen();
    expect(screen.getByTestId('profile-best-guess-word')).toHaveTextContent(
      `Вгадай слово — ${strings.noGameBest}`,
    );
  });

  it('leaves out the confirmed Entries by rarity and the Game Modes in the UA Edition, which turns them off', async () => {
    await renderScreen();

    expect(screen.queryByText(strings.confirmed)).not.toBeOnTheScreen();
    expect(screen.queryByTestId('profile-confirmed-1')).not.toBeOnTheScreen();
    expect(screen.queryByText(strings.gameBest)).not.toBeOnTheScreen();
    expect(screen.queryByTestId('profile-best-guess-word')).not.toBeOnTheScreen();
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
    await renderScreen({
      rounds: 50,
      noCounters: true,
      shareCard: sendingShareCard,
      switchedOn: 'profileConfirmedByRarity',
    });

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

  it('with the sheet off, shows nothing at a tap on a Badge not yet earned', async () => {
    await renderScreen({ switchedOff: 'badgeSheet' });

    await fireEvent.press(screen.getByLabelText(edition.badges[0]?.name ?? ''));
    expect(screen.queryByTestId('badge-stamp')).not.toBeOnTheScreen();
    expect(screen.queryByText(strings.badgeStamp.line)).not.toBeOnTheScreen();
    expect(screen.queryByTestId('badge-sheet')).not.toBeOnTheScreen();
    // Only the sheet goes: the Badges stay.
    for (const { name } of edition.badges) expect(screen.getByLabelText(name)).toBeOnTheScreen();
  });

  // Ticket #1646: board 10 p3/p4.
  it('opens the sheet, and no toast, at a tap on a Badge not yet earned', async () => {
    await renderScreen();
    const badge = edition.badges[0];
    const badges = editionStrings.settings.badges;

    await fireEvent.press(screen.getByLabelText(badge?.name ?? ''));

    const sheet = screen.getByTestId('badge-sheet');
    expect(within(sheet).getByText(badges.sheet.kicker)).toBeOnTheScreen();
    expect(within(sheet).getByRole('header')).toHaveTextContent(badge?.name ?? '');
    expect(screen.getByTestId('badge-sheet-status')).toHaveTextContent(/^Ще ні · /);
    // The sheet's status says it is not earned yet; no toast over it (run 10).
    expect(screen.queryByText(/не твоя/)).not.toBeOnTheScreen();
    expect(screen.queryByTestId('badge-stamp')).not.toBeOnTheScreen();
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

  describe('the Streak freeze card', () => {
    const words = editionStrings.settings.profile.freezeCard;
    const xpOn = (date: string) => ({
      kind: 'xp' as const,
      date,
      at: `${date}T05:00:00.000Z`,
      source: 'game-round' as const,
      amount: 5,
    });
    /** Three Active Days, then yesterday, 2026-10-12, covered by a freeze. */
    const seed: Seed = {
      xpLog: {
        a: xpOn('2026-10-09'),
        b: xpOn('2026-10-10'),
        c: xpOn('2026-10-11'),
        freeze: { kind: 'freeze', date: '2026-10-12', at: '2026-10-12T21:30:00.000Z' },
      },
    };

    it('shows the freezes held, the Streak, the days saved and the last 7 days', async () => {
      await renderScreen({ switchedOn: 'streakFreezeCard', seed });

      const card = within(screen.getByTestId('profile-freeze-card'));
      expect(card.getByText(words.title)).toBeOnTheScreen();
      expect(card.getByText(fill(words.held, { count: '1' }))).toBeOnTheScreen();
      expect(card.getByText(words.explanation)).toBeOnTheScreen();
      expect(card.getByText(fill(words.streakDays.few ?? '', { count: '3' }))).toBeOnTheScreen();
      expect(card.getByText(fill(words.saved.one ?? '', { count: '1' }))).toBeOnTheScreen();
      const days = editionStrings.stats.calendar.days;
      const october = editionStrings.dates.months[9] ?? '';
      for (const label of [
        fill(days.missed, { day: '7', month: october }),
        fill(days.missed, { day: '8', month: october }),
        fill(days.active, { day: '9', month: october }),
        fill(days.active, { day: '10', month: october }),
        fill(days.active, { day: '11', month: october }),
        fill(days.frozen, { day: '12', month: october }),
        fill(days.today, { day: '13', month: october }),
      ]) {
        expect(card.getByLabelText(label)).toBeOnTheScreen();
      }
    });

    it('is hidden with its switch off, and nothing else', async () => {
      await renderScreen({ switchedOff: 'streakFreezeCard', seed });

      expect(screen.queryByTestId('profile-freeze-card')).toBeNull();
      expect(screen.getByTestId('stats-calendar')).toBeOnTheScreen();
      expect(screen.getByTestId('profile-streak')).toBeOnTheScreen();
    });

    it('is hidden while the reader hides the counters («Без лічильників»)', async () => {
      await renderScreen({ switchedOn: 'streakFreezeCard', seed, noCounters: true });

      expect(screen.queryByTestId('profile-freeze-card')).toBeNull();
    });
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
  describe('with the Break card on', () => {
    const months = editionStrings.dates.months;
    const words = strings.breakCard;
    /** Active 9 to 11 October, then a Break of 3 days from 12 October: today, 13 October, is its second day. */
    const xp = (date: string) => ({
      kind: 'xp' as const,
      date,
      at: `${date}T05:00:00.000Z`,
      source: 'game-round' as const,
      amount: 5,
    });
    const running: Seed = {
      xpLog: {
        a: xp('2026-10-09'),
        b: xp('2026-10-10'),
        c: xp('2026-10-11'),
        breakRecord: { kind: 'break', date: '2026-10-12', at: '2026-10-12T05:00:00.000Z', days: 3 },
      },
    };

    it("shows the paused Streak, the Break's last day, its 14 days and the next Break's date", async () => {
      await renderScreen({ switchedOn: 'breakCard', seed: running });

      const card = within(screen.getByTestId('profile-break'));
      expect(card.getByText(words.kicker)).toBeOnTheScreen();
      expect(card.getByText(fill(words.paused, { count: '3' }))).toBeOnTheScreen();
      expect(
        card.getByText(
          fill(words.until, {
            date: fill(editionStrings.share.day, { day: '14', month: months[9] ?? '' }),
          }),
        ),
      ).toBeOnTheScreen();
      expect(
        card.getByText(
          fill(words.next, {
            date: fill(editionStrings.share.day, { day: '11', month: months[10] ?? '' }),
          }),
        ),
      ).toBeOnTheScreen();
      // The 14 days end the day after the Break: 2 to 15 October, today among the Break days.
      const days = editionStrings.stats.calendar.days;
      const label = (key: keyof typeof days, day: number) =>
        fill(days[key], { day: String(day), month: months[9] ?? '' });
      expect(card.getAllByLabelText(/./)).toHaveLength(14);
      expect(card.getByLabelText(label('missed', 2))).toBeOnTheScreen();
      expect(card.getByLabelText(label('active', 11))).toBeOnTheScreen();
      for (const day of [12, 13, 14])
        expect(card.getByLabelText(label('break', day))).toBeOnTheScreen();
      expect(card.getByLabelText(label('future', 15))).toBeOnTheScreen();
      // The card stands in place of the Streak line, and the Best Streak with it.
      expect(screen.queryByTestId('profile-streak')).not.toBeOnTheScreen();
    });

    it('shows no card while no Break runs, the Streak line in its place', async () => {
      await renderScreen({ switchedOn: 'breakCard', rounds: 5 });

      expect(screen.queryByTestId('profile-break')).not.toBeOnTheScreen();
      expect(screen.getByTestId('profile-streak')).toBeOnTheScreen();
    });

    it('shows no card while the reader hides the counters («Без лічильників»)', async () => {
      await renderScreen({ switchedOn: 'breakCard', seed: running, noCounters: true });

      expect(screen.queryByTestId('profile-break')).not.toBeOnTheScreen();
    });
  });

  it('shows no Break card with its switch off, the Streak line still there', async () => {
    await renderScreen({
      switchedOff: 'breakCard',
      seed: {
        xpLog: {
          breakRecord: {
            kind: 'break',
            date: '2026-10-12',
            at: '2026-10-12T05:00:00.000Z',
            days: 3,
          },
        },
      },
    });

    expect(screen.queryByTestId('profile-break')).not.toBeOnTheScreen();
    expect(screen.getByTestId('profile-streak')).toBeOnTheScreen();
  });
});
