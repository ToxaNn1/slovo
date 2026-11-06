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
  seedUserState,
} from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { edition, editionStrings } from '../edition/edition';
import { openOnce } from '../opening';
import { SettingsProvider } from '../settings/settings';
import { ShellProvider, type ShareCard } from '../shell-value';
import { opened, settingsAt, switchedTo, testShell } from '../shell/test-support';
import { ProfileScreen } from './profile-screen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: mockPush }) }));

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

/**
 * The Profile over the Core's composition of a test Shell, as the UA Edition
 * ships it unless a switch is turned off, after `rounds` right Game Rounds of
 * 1 XP each, with the counters hidden or not.
 */
async function renderScreen({
  withAccount = false,
  rounds = 0,
  noCounters = false,
  switchedOff,
  shareCard,
}: {
  withAccount?: boolean;
  rounds?: number;
  noCounters?: boolean;
  switchedOff?: FeatureSwitch;
  shareCard?: ShareCard;
} = {}) {
  const composition = await testShell().composition.opened();
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
          composition: opened(composition),
          remoteSwitches: switchedTo({
            ...edition,
            isFeatureEnabled: (feature) =>
              feature === switchedOff ? false : edition.isFeatureEnabled(feature),
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
});
