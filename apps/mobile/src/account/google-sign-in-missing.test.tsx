import { describe, expect, it, jest } from '@jest/globals';
import {
  createMemorySessionStore,
  createMemoryUserStatePort,
  openAccount,
  openUserState,
  systemRandom,
} from '@slovo/core';
import { createFakeAccountApi, createFakeGoogleSignInSheet } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { act, render, screen } from '@testing-library/react-native';

// A build with a Google client id whose binary lacks Google's sign-in module,
// such as a dev client built before it: the SDK's JavaScript throws on load,
// as its `TurboModuleRegistry.getEnforcing` does there.
Object.assign(process.env, {
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '123456789012-test.apps.googleusercontent.com',
});
jest.mock('@react-native-google-signin/google-signin', () => {
  throw new Error("TurboModuleRegistry.getEnforcing(...): 'RNGoogleSignin' could not be found.");
});
// Node has `Intl.PluralRules` already, which the polyfill adds on Hermes.
jest.mock('../intl-polyfill', () => ({}));

/** The time stands still: no countdown runs on the signed-out screen. */
const clock = { now: () => new Date('2026-10-25T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

describe('A binary without the Google sign-in module', () => {
  it('starts the app shell', () => {
    expect(() => jest.requireActual('../app/_layout')).not.toThrow();
  });

  it('hides «Увійти через Google» on the SLOVO ID screen', async () => {
    const { edition, editionStrings } =
      jest.requireActual<typeof import('../edition/edition')>('../edition/edition');
    const { googleClientId } =
      jest.requireActual<typeof import('./device-account')>('./device-account');
    const { openOnce } = jest.requireActual<typeof import('../opening')>('../opening');
    const { AccountScreen } =
      jest.requireActual<typeof import('./account-screen')>('./account-screen');
    const opening = openOnce(
      async () =>
        openAccount({
          api: createFakeAccountApi(),
          googleSheet: createFakeGoogleSignInSheet(),
          sessions: createMemorySessionStore(),
          userState: await openUserState({ port: createMemoryUserStatePort() }),
          clock,
          schedule: (run) => {
            run();
            return () => undefined;
          },
          random: systemRandom,
        }),
      { onError: jest.fn() },
    );
    await opening.opened();

    await render(
      <EditionProvider edition={edition} strings={editionStrings}>
        <AccountScreen
          opening={opening}
          back={{ label: editionStrings.settings.title, onPress: jest.fn() }}
          google={{ edition, clientId: googleClientId }}
        />
      </EditionProvider>,
    );
    await act(() => Promise.resolve());

    expect(edition.isFeatureEnabled('googleSignIn')).toBe(true);
    expect(screen.getByTestId('account-email')).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: editionStrings.account.signInWithGoogle }),
    ).not.toBeOnTheScreen();
  });
});
