import { type Word } from '@slovo/contracts';
import { describe, expect, it, jest } from '@jest/globals';
import {
  createMemorySessionStore,
  openAccount,
  systemRandom,
  type FeatureSwitch,
  type UserStateFact,
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
 * Rounds of 1 XP each plus `xp` seeded in one XP log record (fast for high
 * Levels, where awarding Rounds one by one outruns the test timeout), with the
 * counters hidden or not, over the user state `seed` and a Language Pack of
 * «сумирний».
 */
/** One XP log record of `amount` XP, earned the day before the test's today. */
const seededXp = (amount: number): UserStateFact<'xpLog'>[string] => ({
  kind: 'xp',
  date: '2026-10-12',
  at: '2026-10-12T09:00:00.000Z',
  source: 'daily-crossword',
  amount,
});

async function renderScreen({
  withAccount = false,
  rounds = 0,
  xp = 0,
  noCounters = false,
  switchedOff,
  switchedOn,
  seed = {},
  shareCard,
  name,
}: {
  /** The reader's name, set before the Profile opens. */
  name?: string;
  withAccount?: boolean;
  rounds?: number;
  /** XP seeded as one record the day before the test's today. */
  xp?: number;
  noCounters?: boolean;
  switchedOff?: FeatureSwitch;
  switchedOn?: FeatureSwitch;
  seed?: Seed;
  shareCard?: ShareCard;
} = {}) {
  const userState = opened(
    await seedUserState(
      xp === 0 ? seed : { ...seed, xpLog: { ...seed.xpLog, 'seeded-xp': seededXp(xp) } },
      {
        clock: { now: () => new Date('2026-10-13T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
      },
    ),
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
  if (name !== undefined) await composition.readerName.change(name);
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

/** The Profile's blocks, as the reader meets them from the top. */
const BLOCKS = [
  'profile-settings',
  'profile-level',
  'profile-streak',
  'stats-calendar',
  'profile-badges-count',
  'profile-header',
  'profile-ladder',
  'profile-share-level',
  'profile-break',
  'profile-freeze-card',
  'profile-save-progress',
];

/** The test IDs of the blocks on the screen, in the order they render. */
function blockOrder(): string[] {
  const drawn = JSON.stringify(screen.toJSON());
  return BLOCKS.map((id) => ({ id, at: drawn.indexOf(`"testID":"${id}"`) }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => a.at - b.at)
    .map(({ id }) => id);
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
    // The Best Streak a tile: its number over «рекорд», read whole as «найдовша 0 днів».
    const best = screen.getByTestId('profile-best-streak');
    expect(within(best).getByText('0')).toBeOnTheScreen();
    expect(within(best).getByText(strings.record)).toBeOnTheScreen();
    expect(best).toHaveAccessibleName('найдовша 0 днів');
    expect(screen.getByTestId('profile-level-number')).toHaveTextContent('0');
    expect(screen.getByText(strings.levelLabel)).toBeOnTheScreen();
    expect(screen.getByTestId('profile-level-name')).toHaveTextContent('Початківець');
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

  // ADR 0145: the board's blocks first, then the blocks the board does not draw.
  it('renders the title, Level card, Streak, calendar and Badges, then the name header, ladder, share, freeze card and the offer to save progress', async () => {
    await renderScreen({ rounds: 50, withAccount: true, shareCard: sendingShareCard });

    expect(blockOrder()).toEqual([
      'profile-settings',
      'profile-level',
      'profile-streak',
      'stats-calendar',
      'profile-badges-count',
      'profile-header',
      'profile-ladder',
      'profile-share-level',
      'profile-freeze-card',
      'profile-save-progress',
    ]);
    expect(screen.queryByTestId('profile-header-level')).toBeNull();
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

  // ADR 0145: the Level appears once, its number in the ring and its name beside it.
  it('reads the Level card as its number and name, its XP in the Level and the XP left to the next name', async () => {
    await renderScreen({ rounds: 60 });

    expect(screen.getByTestId('profile-level-number')).toHaveTextContent('1');
    expect(screen.getByTestId('profile-level-name')).toHaveTextContent(/^Початківець$/);
    expect(screen.queryByText(/Рівень 1/)).toBeNull();
    expect(screen.getByTestId('profile-level-progress')).toHaveTextContent('10 / 55 XP');
    expect(screen.getByTestId('profile-level-left')).toHaveTextContent('Читач: ще 246 XP');
  });

  // Owner decision 16 (#1915): N is the XP to the first Level of the next name.
  it.each([
    [0, 0, 'Читач: ще 306 XP'],
    [4, 233, 'Читач: ще 73 XP'],
    [5, 306, 'Знавець: ще 492 XP'],
    [19, 1878, 'Словолюб: ще 120 XP'],
    [20, 1998, 'Мовознавець: ще 600 XP'],
  ])(
    'at Level %i reads «<next name>: ще N XP» on the card and under the row',
    async (level, xp, line) => {
      await renderScreen({ xp });

      expect(screen.getByTestId('profile-level-number')).toHaveTextContent(String(level));
      expect(screen.getByTestId('profile-level-left')).toHaveTextContent(line);
      expect(screen.getByTestId('profile-ladder-to-next')).toHaveTextContent(
        line.toLocaleUpperCase(edition.locale),
      );
    },
  );

  it('under the last name reads the XP to the next Level and draws no line to a next name', async () => {
    await renderScreen({ xp: 2598 });

    expect(screen.getByTestId('profile-level-number')).toHaveTextContent('25');
    expect(screen.getByTestId('profile-level-left')).toHaveTextContent('ще 120 XP до рівня 26');
    expect(screen.queryByTestId('profile-ladder-to-next')).not.toBeOnTheScreen();
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
      expect(screen.getByTestId(`profile-ladder-${String(index)}-first`)).toHaveTextContent(
        String(index * 5),
      );
    }
    expect(screen.queryByTestId('profile-ladder-6')).not.toBeOnTheScreen();
    expect(screen.getByTestId('profile-ladder-bar')).toHaveTextContent(/^РІВЕНЬ 1 · ПОЧАТКІВЕЦЬ/);
    expect(screen.getByTestId('profile-ladder-to-next')).toHaveTextContent('ЧИТАЧ: ЩЕ 246 XP');
    expect(screen.queryByText(/^ДО /)).not.toBeOnTheScreen();
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
    const [plate, name] = within(sheet).getAllByRole('header');
    expect(plate).toHaveTextContent(badges.sheet.kicker);
    expect(name).toHaveTextContent(badge?.name ?? '');
    expect(screen.getByTestId('badge-sheet-status')).toHaveTextContent(/^Ще ні · /);
    // The sheet's status says it is not earned yet; no toast over it (run 10).
    expect(screen.queryByText(/не твоя/)).not.toBeOnTheScreen();
    expect(screen.queryByTestId('badge-stamp')).not.toBeOnTheScreen();
  });

  it('stamps an unopened Badge, and ends its «НОВА» once the stamp is taken', async () => {
    await renderScreen({
      seed: {
        xpLog: {
          won: {
            kind: 'xp',
            date: '2026-10-13',
            at: '2026-10-13T08:00:00.000Z',
            source: 'game-finished',
            amount: 5,
            mode: 'guess-word',
            right: 10,
            played: 10,
          },
        },
      },
    });
    expect(screen.getByTestId('badge-win-words-mark-new')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('badge-win-words'));
    expect(screen.getByTestId('badge-stamp')).toBeOnTheScreen();
    expect(screen.queryByTestId('badge-sheet')).not.toBeOnTheScreen();

    await act(async () => {
      await fireEvent.press(screen.getByTestId('badge-stamp-done'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.queryByTestId('badge-win-words-mark-new')).toBeNull();

    await fireEvent.press(screen.getByTestId('badge-win-words'));
    expect(screen.getByTestId('badge-sheet')).toBeOnTheScreen();
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
      // Each tile reads its big number with its caption declined for it.
      expect(card.getByLabelText(`3 ${words.streakDays.few ?? ''}`)).toBeOnTheScreen();
      expect(card.getByLabelText(`1 ${words.saved.one ?? ''}`)).toBeOnTheScreen();
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

  // Owner decision 17: a tap on a day shows its text in a toast over the screen.
  describe('with the calendar day texts on', () => {
    const months = editionStrings.dates.months;
    const calendar = editionStrings.stats.calendar;
    const october = (day: string) => ({ day, month: months[9] ?? '' });
    const xpOn = (date: string) => ({
      kind: 'xp' as const,
      date,
      at: `${date}T05:00:00.000Z`,
      source: 'game-round' as const,
      amount: 5,
    });
    /** Yesterday an Active Day; today, active after 5 XP, with «сумирний» kept as its Word of the Day. */
    const seed: Seed = {
      xpLog: { yesterday: xpOn('2026-10-12') },
      wordOfTheDayArchive: { '2026-10-13': 'w_sumyrnyi' },
    };
    /** The toast a tap on `date` shows, over the user state `over`. */
    const tapped = async (date: string, over: Seed = seed, rounds = 5) => {
      await renderScreen({ switchedOn: 'calendarDayLines', rounds, seed: over });
      // The Break card's strip draws its days too: the tap is on the calendar's.
      await fireEvent.press(
        within(screen.getByTestId('stats-calendar')).getByTestId(`stats-calendar-${date}`),
      );
      // The Word of the Day archive is read as the screen comes into view.
      return screen.findByTestId('undo-toast-message');
    };

    it('shows the text of a goal day in a toast at a tap on it, and no line under the grid', async () => {
      expect(await tapped('2026-10-12')).toHaveTextContent(
        fill(calendar.lines.active, october('12')),
      );
      expect(screen.queryByTestId('stats-calendar-line')).toBeNull();
    });

    // The Lemma reads as its row in «Слова дня» does, with its Stress mark.
    it('shows today with its Word of the Day', async () => {
      expect(await tapped('2026-10-13')).toHaveTextContent('Сьогодні. Су́мирний — уже твоє слово!');
    });

    it('shows today by its date before its Word of the Day is kept', async () => {
      expect(await tapped('2026-10-13', {}, 0)).toHaveTextContent(
        fill(calendar.days.today, october('13')),
      );
    });

    it('shows the text of a Break day', async () => {
      const onBreak: Seed = {
        xpLog: {
          breakRecord: {
            kind: 'break',
            date: '2026-10-12',
            at: '2026-10-12T05:00:00.000Z',
            days: 3,
          },
        },
      };
      expect(await tapped('2026-10-12', onBreak)).toHaveTextContent(
        fill(calendar.days.break, october('12')),
      );
    });

    it('shows the text of a frozen day', async () => {
      const frozen: Seed = {
        xpLog: {
          a: xpOn('2026-10-10'),
          b: xpOn('2026-10-11'),
          freeze: { kind: 'freeze', date: '2026-10-12', at: '2026-10-12T21:30:00.000Z' },
        },
      };
      expect(await tapped('2026-10-12', frozen)).toHaveTextContent(
        fill(calendar.days.frozen, october('12')),
      );
    });

    it('shows the text of a day missed', async () => {
      expect(await tapped('2026-10-11')).toHaveTextContent(
        '11 жовтня: тут серія спіткнулась. Але ж нова починається з будь-якого дня!',
      );
    });

    it('shows the text of a day to come', async () => {
      expect(await tapped('2026-10-18')).toHaveTextContent(calendar.lines.future);
    });
  });

  it('shows no toast at a tap on a day with the calendar day texts off, the calendar still there', async () => {
    await renderScreen({ switchedOff: 'calendarDayLines', rounds: 1 });
    await fireEvent.press(screen.getByTestId('stats-calendar-2026-10-11'));
    expect(screen.getByTestId('stats-calendar')).toBeOnTheScreen();
    expect(screen.queryByTestId('undo-toast-message')).toBeNull();
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
    });

    // ADR 0145: the Break card is one of the blocks below the Badges.
    it('shows the card below the Badges while a Break runs, the Streak still in its place', async () => {
      await renderScreen({ switchedOn: 'breakCard', seed: running });

      const order = blockOrder();
      expect(order.indexOf('profile-streak')).toBeLessThan(order.indexOf('stats-calendar'));
      expect(order.indexOf('profile-break')).toBeGreaterThan(order.indexOf('profile-badges-count'));
      expect(order.indexOf('profile-break')).toBeGreaterThan(order.indexOf('profile-header'));
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

// ADR 0136: the Profile's header with the reader's optional name.
describe("the Profile's header", () => {
  const nameStrings = strings.readerName;

  /** Types `name` into the name sheet's field. */
  async function typeName(name: string) {
    await act(async () => {
      await fireEvent.changeText(screen.getByTestId('reader-name-input'), name);
      await Promise.resolve();
    });
  }

  /** Keeps the typed name, the sheet gone once it is kept. */
  async function submitName() {
    await act(async () => {
      await fireEvent.press(screen.getByTestId('reader-name-submit'));
      await new Promise((resolve) => setTimeout(resolve, 500));
    });
  }

  /** Opens the name sheet from the «Ім’я» row. */
  async function openNameSheet() {
    await act(async () => {
      await fireEvent.press(screen.getByTestId('profile-reader-name'));
      await Promise.resolve();
    });
  }

  // ADR 0145: the Level appears once, on the Level card.
  it('shows the name and its first letter, and no Level', async () => {
    await renderScreen({ name: 'олена' });

    const header = screen.getByTestId('profile-header');
    expect(within(header).getByTestId('profile-name')).toHaveTextContent('олена');
    expect(within(header).getByTestId('profile-avatar-letter')).toHaveTextContent('О');
    expect(within(header).queryByTestId('profile-header-level')).toBeNull();
    expect(screen.getByTestId('profile-reader-name')).toHaveTextContent(/олена/);
  });

  it('without a name, shows the neutral avatar and the invitation', async () => {
    await renderScreen();

    const header = screen.getByTestId('profile-header');
    expect(within(header).getByTestId('profile-avatar-neutral')).toBeOnTheScreen();
    expect(within(header).queryByTestId('profile-avatar-letter')).toBeNull();
    expect(within(header).getByTestId('profile-invitation')).toHaveTextContent(
      nameStrings.placeholder,
    );
    expect(screen.getByTestId('profile-reader-name')).toHaveTextContent(
      new RegExp(nameStrings.empty),
    );
  });

  it('sets the name on the name sheet, then changes it, trimmed', async () => {
    await renderScreen();

    await openNameSheet();
    expect(screen.getByTestId('reader-name-input')).toBeOnTheScreen();
    await typeName('  Тарас ');
    await submitName();
    expect(screen.getByTestId('profile-name')).toHaveTextContent('Тарас');
    expect(screen.getByTestId('profile-avatar-letter')).toHaveTextContent('Т');

    await openNameSheet();
    expect(screen.getByTestId('reader-name-input')).toHaveDisplayValue('Тарас');
    await typeName('Остап');
    await submitName();
    expect(screen.getByTestId('profile-name')).toHaveTextContent('Остап');
  });

  it('refuses a name too long with its reason, the counter past the limit, the name kept', async () => {
    await renderScreen({ name: 'Остап' });

    await openNameSheet();
    await typeName('я'.repeat(25));
    expect(screen.getByTestId('reader-name-counter')).toHaveTextContent('25 / 24');
    await submitName();
    expect(screen.getByTestId('reader-name-refusal')).toHaveTextContent(
      fill(nameStrings.tooLong, { max: '24' }),
    );
    expect(screen.getByTestId('profile-name')).toHaveTextContent('Остап');
  });

  it('counts each emoji of a name as one character', async () => {
    await renderScreen();

    await openNameSheet();
    await typeName('🦊'.repeat(13));
    expect(screen.getByTestId('reader-name-counter')).toHaveTextContent('13 / 24');
    await submitName();
    expect(screen.getByTestId('profile-name')).toHaveTextContent('🦊'.repeat(13));
  });

  it("keeps today's progress under it, with no Questionnaire rows", async () => {
    await renderScreen({ name: 'Олена' });

    expect(screen.getByTestId('profile-level')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-streak')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-badges-count')).toBeOnTheScreen();
    for (const row of ['Хто ти', 'Навіщо', 'Самооцінка'])
      expect(screen.queryByText(row)).toBeNull();
  });

  it('with the reader name switched off, shows no header and no «Ім’я» row, the Level card still there', async () => {
    await renderScreen({ name: 'Олена', switchedOff: 'readerName' });

    expect(screen.queryByTestId('profile-header')).toBeNull();
    expect(screen.getByTestId('profile-level-name')).toBeOnTheScreen();
    expect(screen.queryByTestId('profile-reader-name')).toBeNull();
    expect(screen.queryByText(nameStrings.row)).toBeNull();
  });
});
