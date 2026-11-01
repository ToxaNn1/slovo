import { describe, expect, it, jest } from '@jest/globals';
import {
  createMemorySessionStore,
  createMemoryUserStatePort,
  openAccount,
  openUserState,
  systemRandom,
} from '@slovo/core';
import {
  createFakeAppleSignInSheet,
  createFakeBackend,
  createFakeGoogleSignInSheet,
} from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { edition, editionStrings } from '../edition/edition';
import { openOnce } from '../opening';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
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

/** The Profile over the Core's composition of a test Shell, as the UA Edition ships it. */
async function renderScreen({ withAccount = false } = {}) {
  const composition = await testShell().composition.opened();
  const account = withAccount ? await signedOutAccount() : undefined;
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider
        shell={testShell({
          composition: opened(composition),
          remoteSwitches: switchedTo(edition),
          account,
        })}
      >
        <EditionProvider edition={edition} strings={editionStrings}>
          <ProfileScreen />
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
}

describe('the Profile', () => {
  it('shows the Level, XP, Streaks, confirmed Entries by rarity, the Badges and each Game Mode', async () => {
    await renderScreen();

    expect(screen.getByText(strings.title)).toBeOnTheScreen();
    expect(screen.getByTestId('profile-total-xp')).toHaveTextContent('Усього XP: 0');
    expect(screen.getByTestId('profile-streak')).toHaveTextContent('Серія: 0');
    expect(screen.getByTestId('profile-best-streak')).toHaveTextContent('Найкраща серія: 0');
    expect(screen.getByTestId('profile-level')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-to-next')).toHaveTextContent(/XP до наступного рівня/);
    expect(screen.getByRole('button', { name: strings.shareLevel })).toBeOnTheScreen();
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
