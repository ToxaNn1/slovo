import { describe, expect, it, jest } from '@jest/globals';
import {
  createMemorySessionStore,
  loadEdition,
  openAccount,
  systemRandom,
  type GoogleSignInSheet,
} from '@slovo/core';
import { createFakeAccountApi, createFakeGoogleSignInSheet } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import config from 'slovo-edition/config';

import { editionStrings } from '../edition/edition';
import { openOnce } from '../opening';
import { AccountScreen } from './account-screen';
import { createGoogleSignInSheet } from './google-sign-in-sheet';

const { problems } = editionStrings.account;

/**
 * Google's sign-in SDK for React Native, faked: its sheet answers what
 * `mockGoogleSdk.signIn` answers, as the SDK's own `signIn` resolves or rejects.
 */
const mockGoogleSdk = {
  signIn: (): Promise<unknown> => Promise.resolve({ type: 'cancelled', data: null }),
};
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: () => undefined, signIn: () => mockGoogleSdk.signIn() },
}));

/** A rejection of Google's SDK on iOS, as React Native hands over the native error. */
const sdkError = (domain: string, code: string) =>
  Object.assign(new Error(`${domain} ${code}`), { domain, code });

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
}: {
  googleSignIn?: boolean;
  withClientId?: boolean;
  googleSheet?: GoogleSignInSheet;
} = {}) {
  const opening = openOnce(
    () =>
      openAccount({
        api: createFakeAccountApi(),
        googleSheet,
        sessions: createMemorySessionStore(),
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
        back={{ label: 'Налаштування', onPress: jest.fn() }}
        google={{ edition, clientId: withClientId ? CLIENT_ID : undefined }}
      />
    </EditionProvider>,
  );
  await settle();
}

const googleButton = () => screen.queryByRole('button', { name: 'Увійти через Google' });

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
    };
    await renderScreen({ googleSheet });

    await signInWithGoogle();

    expect(shown).toBe(1);
    expect(googleButton()).toBeBusy();
    expect(screen.getByRole('button', { name: 'Надіслати код' })).toBeOnTheScreen();
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

    expect(screen.getByText('Немає з’єднання з інтернетом. Спробуйте ще раз.')).toBeOnTheScreen();
  });

  it('says so when Google does not confirm the sign-in', async () => {
    const googleSheet = createFakeGoogleSignInSheet();
    googleSheet.signsIn('anna@mail.com', { verified: false });
    await renderScreen({ googleSheet });

    await signInWithGoogle();

    expect(
      screen.getByText('Google не підтвердив цей вхід. Спробуйте ще раз або увійдіть кодом.'),
    ).toBeOnTheScreen();
    expect(googleButton()).toBeOnTheScreen();
  });
});

describe("Google's own sign-in sheet behind «Увійти через Google»", () => {
  const googleSheet = createGoogleSignInSheet(CLIENT_ID);

  it("hands the Account the identity token from Google's sheet", async () => {
    mockGoogleSdk.signIn = () =>
      Promise.resolve({
        type: 'success',
        data: { idToken: 'google-id-token:anna@mail.com', user: { email: 'anna@mail.com' } },
      });

    await expect(googleSheet.signIn()).resolves.toEqual({
      ok: true,
      idToken: 'google-id-token:anna@mail.com',
    });
  });

  it('shows no problem when the reader dismisses the sheet', async () => {
    mockGoogleSdk.signIn = () => Promise.resolve({ type: 'cancelled', data: null });
    await renderScreen({ googleSheet });

    await signInWithGoogle();

    expect(googleButton()).toBeOnTheScreen();
    expect(screen.queryByText(problems.offline)).not.toBeOnTheScreen();
    expect(screen.queryByText(problems.unexpected)).not.toBeOnTheScreen();
  });

  it('says so when the sheet finds no network', async () => {
    mockGoogleSdk.signIn = () => Promise.reject(sdkError('NSURLErrorDomain', '-1009'));
    await renderScreen({ googleSheet });

    await signInWithGoogle();

    expect(screen.getByText(problems.offline)).toBeOnTheScreen();
  });

  it('says something went wrong when the sheet fails otherwise', async () => {
    mockGoogleSdk.signIn = () => Promise.reject(sdkError('com.google.GIDSignIn', '-2'));
    await renderScreen({ googleSheet });

    await signInWithGoogle();

    expect(screen.getByText(problems.unexpected)).toBeOnTheScreen();
    expect(googleButton()).toBeOnTheScreen();
  });

  it('says something went wrong when Google signs in without an identity token', async () => {
    mockGoogleSdk.signIn = () =>
      Promise.resolve({
        type: 'success',
        data: { idToken: null, user: { email: 'anna@mail.com' } },
      });
    await renderScreen({ googleSheet });

    await signInWithGoogle();

    expect(screen.getByText(problems.unexpected)).toBeOnTheScreen();
  });
});
