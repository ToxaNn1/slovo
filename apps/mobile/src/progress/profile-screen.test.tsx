import { describe, expect, it, jest } from '@jest/globals';
import {
  createMemorySessionStore,
  createMemoryUserStatePort,
  openAccount,
  openUserState,
  systemRandom,
  type FeatureSwitch,
} from '@slovo/core';
import {
  createFakeAppleSignInSheet,
  createFakeBackend,
  createFakeGoogleSignInSheet,
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
        userState: await openUserState({ port: createMemoryUserStatePort() }),
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
  'profile-to-next',
  'profile-total-xp',
  'profile-streak',
  'profile-best-streak',
];

describe('the Profile', () => {
  it('shows the Level, XP, Streaks, confirmed Entries by rarity, the Badges and each Game Mode', async () => {
    await renderScreen();

    expect(screen.getByText(strings.title)).toBeOnTheScreen();
    expect(screen.getByTestId('profile-total-xp')).toHaveTextContent('Усього XP: 0');
    expect(screen.getByTestId('profile-streak')).toHaveTextContent('Серія: 0');
    expect(screen.getByTestId('profile-best-streak')).toHaveTextContent('Найкраща серія: 0');
    expect(screen.getByTestId('profile-level')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-to-next')).toHaveTextContent(/XP до наступного рівня/);
    expect(screen.getByText(strings.activeDays)).toBeOnTheScreen();
    for (const rarity of [1, 2, 3, 4, 5]) {
      expect(screen.getByTestId(`profile-confirmed-${String(rarity)}`)).toHaveTextContent(
        `Рідкість ${String(rarity)}: 0`,
      );
    }
    for (const { name } of edition.badges) expect(screen.getByText(name)).toBeOnTheScreen();
    expect(screen.getByTestId('profile-best-guess-word')).toHaveTextContent(
      `Вгадай слово — ${strings.noGameBest}`,
    );
  });

  it('hides the Level, the XP and the Streaks while the reader hides the counters («Без лічильників»)', async () => {
    await renderScreen({ rounds: 50, noCounters: true, shareCard: sendingShareCard });

    for (const line of counterLines) expect(screen.queryByTestId(line)).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: strings.shareLevel })).not.toBeOnTheScreen();
    expect(screen.getByText(strings.activeDays)).toBeOnTheScreen();
    expect(screen.getByText(strings.confirmed)).toBeOnTheScreen();
  });

  it('shares the Level reached as its Share Card and tells Analytics once it is shared', async () => {
    await renderScreen({ rounds: 50, shareCard: sendingShareCard });
    expect(screen.getByTestId('profile-level')).toHaveTextContent(/^Рівень 1 · /);

    await fireEvent.press(screen.getByRole('button', { name: strings.shareLevel }));

    const card = within(screen.getByTestId('share-preview')).getByTestId('share-card');
    expect(card).toHaveAccessibleName(/13 жовтня\. Новий рівень у SLOVO\. Рівень 1/);
  });

  it('offers no share of the Level before the first one is reached', async () => {
    await renderScreen({ shareCard: sendingShareCard });

    expect(screen.getByTestId('profile-level')).toHaveTextContent(/^Рівень 0 · /);
    expect(screen.queryByRole('button', { name: strings.shareLevel })).not.toBeOnTheScreen();
  });

  it('offers no share of the Level with the progress Share Cards off', async () => {
    await renderScreen({
      rounds: 50,
      switchedOff: 'progressShareCards',
      shareCard: sendingShareCard,
    });

    expect(screen.getByTestId('profile-level')).toHaveTextContent(/^Рівень 1 · /);
    expect(screen.queryByRole('button', { name: strings.shareLevel })).not.toBeOnTheScreen();
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
