import { describe, expect, it, jest } from '@jest/globals';
import {
  createMemorySessionStore,
  createMemoryUserStatePort,
  openUserState,
  loadEdition,
  openAccount,
  systemRandom,
  type Backend,
  type GoogleSignInSheet,
} from '@slovo/core';
import { createFakeBackend, createFakeGoogleSignInSheet } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import config from 'slovo-edition/config';

import { editionStrings } from '../edition/edition';
import { openOnce } from '../opening';
import { AccountScreen } from './account-screen';

const strings = editionStrings.account;
const { problems } = strings;

/** A client id of the shape Google gives an iOS app; no real one. */
const CLIENT_ID = '123456789012-test.apps.googleusercontent.com';

/** The Edition with its Google sign-in Feature Switch as given. */
const editionWith = ({ googleSignIn }: { googleSignIn: boolean }) => {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, boolean> };
  return loadEdition({ ...rest, featureSwitches: { ...featureSwitches, googleSignIn } });
};

/** The time stands still: no countdown runs on the signed-out screen. */
const clock = { now: () => new Date('2026-10-24T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

/** Lets the Account's requests and the screen's renders finish. */
async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
  });
}

/**
 * The SLOVO ID screen over a signed-out Account, with a fake backend and a
 * fake Google sheet, the switch on and a client id unless the test says not.
 */
async function renderScreen({
  googleSignIn = true,
  withClientId = true,
  googleSheet = createFakeGoogleSignInSheet(),
  backend = createFakeBackend().backend,
}: {
  googleSignIn?: boolean;
  withClientId?: boolean;
  googleSheet?: GoogleSignInSheet;
  backend?: Pick<Backend, 'account'>;
} = {}) {
  const opening = openOnce(
    async () =>
      openAccount({
        backend,
        edition: { id: 'uk' },
        googleSheet,
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
  const edition = editionWith({ googleSignIn });
  await render(
    <EditionProvider edition={edition} strings={editionStrings}>
      <AccountScreen
        opening={opening}
        back={{ label: editionStrings.settings.title, onPress: jest.fn() }}
        google={{ edition, clientId: withClientId ? CLIENT_ID : undefined }}
      />
    </EditionProvider>,
  );
  await settle();
}

const googleButton = () => screen.queryByRole('button', { name: strings.signInWithGoogle });

/** Taps «Увійти через Google» and lets the sign-in finish. */
const signInWithGoogle = () => settle(() => fireEvent.press(screen.getByTestId('account-google')));

describe('«Увійти через Google» on the SLOVO ID screen', () => {
  it('shows above the email field while signed out, with the switch on and a client id', async () => {
    await renderScreen();

    expect(googleButton()).toBeOnTheScreen();
    expect(screen.getByTestId('account-email')).toBeOnTheScreen();
  });

  it('stays hidden with the switch off', async () => {
    await renderScreen({ googleSignIn: false });

    expect(googleButton()).not.toBeOnTheScreen();
    expect(screen.getByTestId('account-email')).toBeOnTheScreen();
  });

  it('stays hidden while the build has no Google client id', async () => {
    await renderScreen({ withClientId: false });

    expect(googleButton()).not.toBeOnTheScreen();
  });

  it("starts the Google path on a tap: Google's sheet shows and the button waits on it", async () => {
    let shown = 0;
    // The reader is still in Google's sheet.
    const googleSheet: GoogleSignInSheet = {
      signIn: () => {
        shown += 1;
        return new Promise(() => undefined);
      },
      forget: () => Promise.resolve(),
    };
    await renderScreen({ googleSheet });

    await signInWithGoogle();

    expect(shown).toBe(1);
    expect(googleButton()).toBeBusy();
    expect(screen.getByRole('button', { name: strings.sendCode })).toBeOnTheScreen();
  });

  it('shows no problem when the reader dismisses the sheet', async () => {
    const googleSheet = createFakeGoogleSignInSheet();
    googleSheet.cancels();
    await renderScreen({ googleSheet });

    await signInWithGoogle();

    expect(googleButton()).toBeOnTheScreen();
    expect(screen.queryByText(problems.offline)).not.toBeOnTheScreen();
    expect(screen.queryByText(problems.refused)).not.toBeOnTheScreen();
  });

  it('says so when the sheet finds no network', async () => {
    const googleSheet = createFakeGoogleSignInSheet();
    googleSheet.fails('offline');
    await renderScreen({ googleSheet });

    await signInWithGoogle();

    expect(screen.getByText(problems.offline)).toBeOnTheScreen();
  });

  it('says so when Google does not confirm the sign-in', async () => {
    const googleSheet = createFakeGoogleSignInSheet();
    googleSheet.signsIn('anna@mail.com', { verified: false });
    await renderScreen({ googleSheet });

    await signInWithGoogle();

    expect(screen.getByText(problems.refused)).toBeOnTheScreen();
    expect(googleButton()).toBeOnTheScreen();
  });

  it('says something went wrong when the sheet fails otherwise', async () => {
    const googleSheet = createFakeGoogleSignInSheet();
    googleSheet.fails('unexpected');
    await renderScreen({ googleSheet });

    await signInWithGoogle();

    expect(screen.getByText(problems.unexpected)).toBeOnTheScreen();
    expect(googleButton()).toBeOnTheScreen();
  });

  it('points to the email code when the backend does not offer Google sign-in', async () => {
    const googleSheet = createFakeGoogleSignInSheet();
    googleSheet.signsIn('anna@mail.com');
    // The switch turned off remotely, or a backend without Google's client ids.
    const fake = createFakeBackend();
    fake.failNext({ procedure: 'account.signInWithGoogle', reason: 'not-found' });
    await renderScreen({ googleSheet, backend: fake.backend });

    await signInWithGoogle();

    expect(screen.getByText(problems.refused)).toBeOnTheScreen();
    expect(googleButton()).toBeOnTheScreen();
  });
});
