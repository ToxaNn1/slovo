import { describe, expect, it, jest } from '@jest/globals';
import {
  createMemorySessionStore,
  loadEdition,
  openAccount,
  systemRandom,
  type AppleSignInSheet,
  type Backend,
  type GoogleSignInSheet,
} from '@slovo/core';
import {
  createFakeAppleSignInSheet,
  createFakeBackend,
  createFakeGoogleSignInSheet,
  seedUserState,
} from '@slovo/core/testing';
import { EditionProvider, OfflinePlateProvider, fill } from '@slovo/ui';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderInGestureRoot } from '../shell/test-render';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { activeEditionFiles, editionStrings } from '../edition/edition';
import { openOnce } from '../opening';
import { AccountScreen } from './account-screen';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const { config } = activeEditionFiles;

// The Sync status line under the signed-in email is Sync's, tested with it;
// it draws over the whole shell, which this screen's test never stands up.
jest.mock('../sync/sync-status-line', () => ({ SyncStatusLine: () => null }));

const strings = editionStrings.account;
const { problems } = strings;

/** A client id of the shape Google gives an iOS app; no real one. */
const CLIENT_ID = '123456789012-test.apps.googleusercontent.com';

/** The Edition with its Google and Apple sign-in and offline plate Feature Switches as given. */
const editionWith = (switches: {
  googleSignIn: boolean;
  signInWithApple: boolean;
  offlinePlate: boolean;
}) => {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, string> };
  const states = Object.fromEntries(
    Object.entries(switches).map(([name, on]) => [name, on ? 'on' : 'off']),
  );
  return loadEdition({ ...rest, featureSwitches: { ...featureSwitches, ...states } });
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
 * The SLOVO ID screen over a signed-out Account, with a fake backend and fake
 * Google and Apple sheets, both switches on and a build with a Google client
 * id and Apple's module unless the test says not.
 */
async function renderScreen({
  googleSignIn = true,
  signInWithApple = true,
  offlinePlate = false,
  withClientId = true,
  appleModule = true,
  googleSheet = createFakeGoogleSignInSheet(),
  backend = createFakeBackend().backend,
  appleSheet = createFakeAppleSignInSheet(),
}: {
  googleSignIn?: boolean;
  signInWithApple?: boolean;
  offlinePlate?: boolean;
  withClientId?: boolean;
  appleModule?: boolean;
  googleSheet?: GoogleSignInSheet;
  backend?: Pick<Backend, 'account'>;
  appleSheet?: AppleSignInSheet;
} = {}) {
  const opening = openOnce(
    async () =>
      openAccount({
        backend,
        edition: { id: 'uk', isFeatureEnabled: () => false },
        googleSheet,
        appleSheet,
        sessions: createMemorySessionStore(),
        userState: await seedUserState(),
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
  const edition = editionWith({ googleSignIn, signInWithApple, offlinePlate });
  await renderInGestureRoot(
    // The SLOVO ID screen's confirmation dialog is a bottom sheet, which reads the safe area.
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={edition} strings={editionStrings}>
        <OfflinePlateProvider message={editionStrings.offlinePlate}>
          <AccountScreen
            opening={opening}
            back={{ label: editionStrings.settings.title, onPress: jest.fn() }}
            signIn={{
              edition,
              googleClientId: withClientId ? CLIENT_ID : undefined,
              appleModule,
            }}
          />
        </OfflinePlateProvider>
      </EditionProvider>
    </SafeAreaProvider>,
  );
  await settle();
}

const googleButton = () => screen.queryByRole('button', { name: strings.signInWithGoogle });
const appleButton = () => screen.queryByRole('button', { name: strings.signInWithApple });

/** Taps «Увійти через Google» and lets the sign-in finish. */
const signInWithGoogle = () => settle(() => fireEvent.press(screen.getByTestId('account-google')));

/** Taps Apple's own button, which answers the press as its native view does, and lets the sign-in finish. */
const signInWithApple = () =>
  settle(() => fireEvent(screen.getByTestId('account-apple-native'), 'buttonPress'));

describe("the Account screen's name", () => {
  it("is the Edition's Account name, never «SLOVO ID»", async () => {
    await renderScreen();

    const { accountName } = editionWith({
      googleSignIn: true,
      signInWithApple: true,
      offlinePlate: false,
    });
    expect(accountName).not.toBe('SLOVO ID');
    expect(screen.getByText(accountName)).toBeOnTheScreen();
    expect(screen.queryByText(/SLOVO ID/)).not.toBeOnTheScreen();
  });
});

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
    expect(screen.queryByTestId('offline-plate')).not.toBeOnTheScreen();
  });

  it('says it on the offline plate, not under the field, with the plate on', async () => {
    const googleSheet = createFakeGoogleSignInSheet();
    googleSheet.fails('offline');
    await renderScreen({ googleSheet, offlinePlate: true });

    await signInWithGoogle();

    expect(screen.getByTestId('offline-plate')).toHaveTextContent(editionStrings.offlinePlate);
    expect(screen.queryByText(problems.offline)).not.toBeOnTheScreen();
  });

  it('waits on «НАДІСЛАТИ КОД» while the code is asked for, then says there is no connection and offers it again', async () => {
    const { backend } = createFakeBackend();
    let giveUp: (error: Error) => void = () => undefined;
    // The device backend fails a try with no answer once its timeout passes.
    const noAnswer = new Promise<never>((_, reject) => {
      giveUp = reject;
    });
    const requestCode: typeof backend.account.requestCode = (...call) =>
      noAnswer.then(() => backend.account.requestCode(...call));
    await renderScreen({
      backend: { account: { ...backend.account, requestCode } },
      offlinePlate: true,
    });
    const sendCode = () => screen.getByRole('button', { name: strings.sendCode });

    await fireEvent.changeText(screen.getByTestId('account-email'), 'olena@ukr.net');
    await settle(() => fireEvent.press(sendCode()));

    expect(sendCode()).toBeBusy();
    expect(screen.queryByTestId('offline-plate')).not.toBeOnTheScreen();

    await settle(() => {
      giveUp(new Error('No answer'));
    });

    expect(screen.getByTestId('offline-plate')).toHaveTextContent(editionStrings.offlinePlate);
    expect(sendCode()).not.toBeBusy();
    expect(sendCode()).toBeEnabled();
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

describe('«Увійти через Apple» on the SLOVO ID screen', () => {
  it('shows on iOS before «Увійти через Google» and the email field, with the switch on', async () => {
    await renderScreen();

    expect(appleButton()).toBeOnTheScreen();
    const buttons = screen.getAllByRole('button');
    const google = screen.getByRole('button', { name: strings.signInWithGoogle });
    const apple = screen.getByRole('button', { name: strings.signInWithApple });
    expect(buttons.indexOf(apple)).toBeLessThan(buttons.indexOf(google));
    expect(screen.getByText(strings.orByEmail)).toBeOnTheScreen();
    expect(screen.getByTestId('account-email')).toBeOnTheScreen();
  });

  it('stays absent on Android', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      await renderScreen();

      expect(appleButton()).not.toBeOnTheScreen();
      expect(googleButton()).toBeOnTheScreen();
      expect(screen.getByTestId('account-email')).toBeOnTheScreen();
    } finally {
      os.restore();
    }
  });

  it('stays absent with the switch off, while «Увійти через Google» shows', async () => {
    await renderScreen({ signInWithApple: false });

    expect(appleButton()).not.toBeOnTheScreen();
    expect(googleButton()).toBeOnTheScreen();
  });

  it("stays absent while the binary lacks Expo's Apple authentication module", async () => {
    await renderScreen({ appleModule: false });

    expect(appleButton()).not.toBeOnTheScreen();
  });

  it("signs the reader in through Apple's sheet, and the screen shows the email", async () => {
    const appleSheet = createFakeAppleSignInSheet();
    appleSheet.signsIn('abc123@privaterelay.appleid.com');
    await renderScreen({ appleSheet });

    await signInWithApple();

    expect(appleSheet.shown).toBe(1);
    expect(screen.getByTestId('account-signed-in-email')).toHaveTextContent(
      'abc123@privaterelay.appleid.com',
    );
    expect(appleButton()).not.toBeOnTheScreen();
  });

  it("starts the Apple path on a tap: Apple's sheet shows and the button waits on it", async () => {
    let shown = 0;
    // The reader is still in Apple's sheet.
    const appleSheet: AppleSignInSheet = {
      signIn: () => {
        shown += 1;
        return new Promise(() => undefined);
      },
    };
    await renderScreen({ appleSheet });

    await signInWithApple();

    expect(shown).toBe(1);
    expect(appleButton()).toBeBusy();
    expect(googleButton()).toBeDisabled();
  });

  it('shows no problem when the reader dismisses the sheet', async () => {
    const appleSheet = createFakeAppleSignInSheet();
    appleSheet.cancels();
    await renderScreen({ appleSheet });

    await signInWithApple();

    expect(appleButton()).toBeOnTheScreen();
    expect(screen.queryByText(problems.refused)).not.toBeOnTheScreen();
    expect(screen.queryByText(problems.unexpected)).not.toBeOnTheScreen();
  });

  it('says so when the backend refuses the token, and stays signed out', async () => {
    const appleSheet = createFakeAppleSignInSheet();
    appleSheet.signsIn('anna@mail.com', { expired: true });
    await renderScreen({ appleSheet });

    await signInWithApple();

    expect(screen.getByText(problems.refused)).toBeOnTheScreen();
    expect(appleButton()).toBeOnTheScreen();
    expect(screen.queryByTestId('account-signed-in-email')).not.toBeOnTheScreen();
  });
});

describe('signing in with a Sign-in code on the Account screen', () => {
  it('fills six cells from one pasted code and signs in, with the delete button below', async () => {
    const { backend, account } = createFakeBackend();
    await renderScreen({ backend });

    await fireEvent.changeText(screen.getByTestId('account-email'), 'olena@ukr.net');
    await settle(() => fireEvent.press(screen.getByTestId('account-send-code')));

    expect(screen.getByText(fill(strings.codeSent, { email: 'olena@ukr.net' }))).toBeOnTheScreen();
    const code = account.sentCodes[0]?.code ?? '';
    await settle(() => fireEvent.changeText(screen.getByLabelText(strings.codeLabel), code));

    expect(screen.getByTestId('account-signed-in-email')).toHaveTextContent('olena@ukr.net');
    const buttons = screen.getAllByRole('button');
    const signOutEverywhere = screen.getByRole('button', { name: strings.signOutEverywhere });
    const deletion = screen.getByRole('button', { name: strings.delete.button });
    expect(buttons.indexOf(signOutEverywhere)).toBeLessThan(buttons.indexOf(deletion));
  });

  it('draws the code typed so far in six cells', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('account-email'), 'olena@ukr.net');
    await settle(() => fireEvent.press(screen.getByTestId('account-send-code')));
    await settle(() => fireEvent.changeText(screen.getByLabelText(strings.codeLabel), '12 3'));

    const cells = Array.from(
      { length: 6 },
      (_, i): unknown =>
        screen.getByTestId(`account-code-cell-${String(i)}`, { includeHiddenElements: true }).props[
          'children'
        ],
    );
    expect(cells).toEqual(['1', '2', '3', '', '', '']);
  });
});

describe('the email problem on the Account screen', () => {
  it('leaves once the reader edits the address, and comes back on the next refused send', async () => {
    await renderScreen();
    const email = () => screen.getByTestId('account-email');
    const send = () => settle(() => fireEvent.press(screen.getByTestId('account-send-code')));

    await fireEvent.changeText(email(), 'abc');
    await send();
    expect(screen.getByText(problems['invalid-email'])).toBeOnTheScreen();

    await settle(() => fireEvent.changeText(email(), 'abc@'));
    expect(screen.queryByText(problems['invalid-email'])).not.toBeOnTheScreen();

    await send();
    expect(screen.getByText(problems['invalid-email'])).toBeOnTheScreen();
  });
});
