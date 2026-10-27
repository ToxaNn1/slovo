import { ACCOUNT_NAME, SIGN_IN_CODE_DIGITS } from '@slovo/contracts';
import type { Account, AccountState } from '@slovo/core';
import {
  BackLink,
  DeleteAccountButton,
  fill,
  GoogleSignInButton,
  PrimaryButton,
  ProblemLine,
  ResendButton,
  ScreenTitle,
  SecondaryButton,
  space,
  TextField,
  typeSize,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deviceClock } from '../device/device-clock';
import { editionStrings } from '../edition/edition';
import { logError } from '../diagnostics/log';
import { Opened } from '../opened';
import { useOpened, type Opening } from '../opening';
import { SyncStatusLine } from '../sync/sync-status-line';
import {
  useAccountProblemLine,
  useAccountState,
  type AccountScreenGoogle,
} from '../account/account';

const strings = editionStrings.account;

/** The time the resend countdown counts by, one function for every render. */
const now = () => deviceClock.now();

/**
 * Runs a request of the Account, which answers every failure of the backend
 * by its own rules; one that fails outside them, such as a Session the device
 * can't keep, is logged.
 */
function run(request: Promise<void>): void {
  request.catch((error: unknown) => {
    logError('The Account could not do what the reader asked', error);
  });
}

/** Where the SLOVO ID screen's back link leads: the screen under it, by name. */
export interface AccountScreenBack {
  readonly label: string;
  /** Leaves the screen, with the Account as it stands. */
  readonly onPress: (account: Account) => void;
}

/**
 * The SLOVO ID screen, of Settings and of the onboarding's SLOVO ID step:
 * signing in with Google, while the Edition's switch is on and the build has
 * its Google client id, or with a Sign-in code sent to the email, or, signed in, the email
 * with signing out, signing out everywhere and deleting the Account behind the
 * SLOVO confirmation dialog. It draws the Account's state and calls its actions; the rules
 * are the Account's own.
 */
export function AccountScreen({
  opening,
  back,
  google,
}: {
  opening: Opening<Account>;
  back: AccountScreenBack;
  google: AccountScreenGoogle;
}) {
  return (
    <Opened opening={opening} failedTestID="account-failed">
      <AccountContent opening={opening} back={back} google={google} />
    </Opened>
  );
}

function AccountContent({
  opening,
  back,
  google,
}: {
  opening: Opening<Account>;
  back: AccountScreenBack;
  google: AccountScreenGoogle;
}) {
  const account = useOpened(opening);
  const state = useAccountState(account);
  const problem = useAccountProblemLine(state);
  const { colors } = useTokens();
  return (
    <SafeAreaView
      testID="account"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <BackLink
          testID="account-back"
          label={back.label}
          onPress={() => {
            back.onPress(account);
          }}
        />
        <View style={styles.header}>
          <ScreenTitle>{ACCOUNT_NAME}</ScreenTitle>
        </View>
        {state.status === 'signed-in' ? (
          <SignedIn account={account} state={state} problem={problem} />
        ) : (
          <SignIn
            account={account}
            state={state}
            problem={problem}
            withGoogle={
              google.edition.isFeatureEnabled('googleSignIn') && google.clientId !== undefined
            }
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type StateOf<S extends AccountState['status']> = Extract<AccountState, { status: S }>;

/**
 * Signed out: «Увійти через Google» when it is offered, then the email field
 * and «Надіслати код». Once the code is sent, the
 * email stays over the code field, which signs in as soon as it holds the
 * code, with «Надіслати ще раз» and «Змінити пошту» under it.
 */
function SignIn({
  account,
  state,
  problem,
  withGoogle,
}: {
  account: Account;
  state: StateOf<'signed-out' | 'code-sent'>;
  problem: string | undefined;
  /** Whether «Увійти через Google» is offered. */
  withGoogle: boolean;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  if (state.status === 'signed-out') {
    const send = () => {
      run(account.requestCode(email));
    };
    return (
      <View style={styles.form}>
        {withGoogle && (
          <GoogleSignInButton
            testID="account-google"
            label={strings.signInWithGoogle}
            busy={state.inFlight === 'signInWithGoogle'}
            disabled={state.inFlight !== undefined}
            onPress={() => {
              run(account.signInWithGoogle());
            }}
          />
        )}
        <TextField
          testID="account-email"
          label={strings.emailLabel}
          value={email}
          onChangeText={setEmail}
          problem={problem}
          problemCause={state}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          returnKeyType="send"
          onSubmitEditing={send}
        />
        <PrimaryButton
          testID="account-send-code"
          label={strings.sendCode}
          busy={state.inFlight === 'requestCode'}
          onPress={send}
        />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <TextField
        testID="account-email"
        label={strings.emailLabel}
        value={state.email}
        onChangeText={setEmail}
        editable={false}
      />
      <TextField
        testID="account-code"
        label={strings.codeLabel}
        value={code}
        onChangeText={(typed) => {
          setCode(typed);
          // The Account sends only a code of six digits.
          run(account.verifyCode(typed));
        }}
        problem={problem}
        problemCause={state}
        busy={state.inFlight === 'verifyCode'}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={SIGN_IN_CODE_DIGITS}
        autoFocus
      />
      <ResendButton
        testID="account-resend"
        resendAt={state.resendAt}
        now={now}
        busy={state.inFlight === 'resendCode'}
        onPress={() => {
          setCode('');
          run(account.resendCode());
        }}
      />
      <SecondaryButton
        testID="account-change-email"
        label={strings.changeEmail}
        disabled={state.inFlight !== undefined}
        onPress={() => {
          setCode('');
          account.changeEmail();
        }}
      />
    </View>
  );
}

/**
 * Signed in: the email, «Вийти», «Вийти на всіх пристроях» and the destructive
 * «Видалити SLOVO ID», which the SLOVO confirmation dialog confirms. Signing out works at
 * once, even offline.
 */
function SignedIn({
  account,
  state,
  problem,
}: {
  account: Account;
  state: StateOf<'signed-in'>;
  problem: string | undefined;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const deletion = strings.delete;

  return (
    <View style={styles.form}>
      <View style={styles.signedInAs}>
        <Text
          {...voice}
          style={[styles.signedInLabel, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {strings.signedInAs}
        </Text>
        <Text
          testID="account-signed-in-email"
          style={[styles.email, { color: colors.ink, fontFamily: fontFamilies.ui }]}
        >
          {state.email}
          <SyncStatusLine />
        </Text>
      </View>
      <SecondaryButton
        testID="account-sign-out"
        label={strings.signOut}
        onPress={() => {
          run(account.signOut());
        }}
      />
      <SecondaryButton
        testID="account-sign-out-everywhere"
        label={strings.signOutEverywhere}
        busy={state.inFlight === 'signOutEverywhere'}
        disabled={state.inFlight !== undefined}
        onPress={() => {
          run(account.signOutEverywhere());
        }}
      />
      <DeleteAccountButton
        testID="account-delete"
        copy={{
          button: fill(deletion.button, { name: ACCOUNT_NAME }),
          title: fill(deletion.title, { name: ACCOUNT_NAME }),
          message: deletion.message,
          confirm: deletion.confirm,
          cancel: deletion.cancel,
        }}
        busy={state.inFlight === 'delete'}
        disabled={state.inFlight !== undefined}
        onDelete={() => {
          run(account.delete());
        }}
      />
      <ProblemLine testID="account-problem" problem={problem} cause={state} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8] },
  header: { paddingTop: space[2], paddingBottom: space[5] },
  form: { gap: space[4] },
  signedInAs: { gap: space[1], marginBottom: space[2] },
  signedInLabel: { fontSize: typeSize.caption, fontWeight: '600' },
  email: { fontSize: typeSize.listItem, fontWeight: '600' },
});
