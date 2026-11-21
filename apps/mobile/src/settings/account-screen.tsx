import { SIGN_IN_CODE_DIGITS } from '@slovo/contracts';
import type { Account, AccountState } from '@slovo/core';
import {
  accountCardRadius,
  BackHeader,
  CodeCells,
  DeleteAccountButton,
  disabledOpacity,
  fill,
  GoogleSignInButton,
  Button,
  ProblemLine,
  ResendButton,
  signInButtonHeight,
  space,
  TextField,
  typeStyle,
  useEdition,
  useTokens,
} from '@slovo/ui';
import {
  AppleAuthenticationButton,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
} from 'expo-apple-authentication';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deviceClock } from '../device/device-clock';
import { edition, editionStrings } from '../edition/edition';
import { keep } from '../keep';
import { Opened } from '../opened';
import { useOpened, type Opening } from '../opening';
import { SyncStatusLine } from '../sync/sync-status-line';
import {
  useAccountProblemLine,
  useAccountState,
  type AccountScreenSignIn,
} from '../account/account';

const strings = editionStrings.account;

/** The time the resend countdown counts by, one function for every render. */
const now = () => deviceClock.now();

/** Where the SLOVO ID screen's back link leads: the screen under it, by name. */
export interface AccountScreenBack {
  readonly label: string;
  /** Leaves the screen, with the Account as it stands. */
  readonly onPress: (account: Account) => void;
}

/**
 * The SLOVO ID screen, of Settings and of the onboarding's SLOVO ID step:
 * signing in with Google, while the Edition's switch is on and the build has
 * its Google client id, with Apple, on iOS while the Edition's switch is on
 * and the build has Expo's Apple authentication module (ADR 0047), or with a
 * Sign-in code sent to the email, or, signed in, the email with signing out,
 * signing out everywhere and deleting the Account behind the SLOVO
 * confirmation dialog. It draws the Account's state and calls its actions;
 * the rules are the Account's own.
 */
export function AccountScreen({
  opening,
  back,
  signIn,
}: {
  opening: Opening<Account>;
  back: AccountScreenBack;
  signIn: AccountScreenSignIn;
}) {
  return (
    <Opened opening={opening} failedTestID="account-failed">
      <AccountContent opening={opening} back={back} signIn={signIn} />
    </Opened>
  );
}

function AccountContent({
  opening,
  back,
  signIn,
}: {
  opening: Opening<Account>;
  back: AccountScreenBack;
  signIn: AccountScreenSignIn;
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
      <View style={styles.bar}>
        <BackHeader
          titleRole="settingsSubTitle"
          title={state.status === 'code-sent' ? strings.codeLabel : edition.accountName}
          back={{
            label: back.label,
            testID: 'account-back',
            onPress: () => {
              back.onPress(account);
            },
          }}
        />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        testID="account-scroll"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {state.status === 'signed-in' ? (
          <SignedIn account={account} state={state} problem={problem} />
        ) : (
          <SignIn
            account={account}
            state={state}
            problem={problem}
            withGoogle={
              signIn.edition.isFeatureEnabled('googleSignIn') && signIn.googleClientId !== undefined
            }
            withApple={
              Platform.OS === 'ios' &&
              signIn.edition.isFeatureEnabled('signInWithApple') &&
              signIn.appleModule
            }
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type StateOf<S extends AccountState['status']> = Extract<AccountState, { status: S }>;

/**
 * Signed out: the line on why to sign in, then «Увійти через Apple», then «Увійти через Google», each when it
 * is offered, the divider «або поштою» under them, then the email field and
 * «Надіслати код». Once the code is sent, «Код надіслано на <email>» stands
 * over the code's six cells, which sign in as soon as they hold the code,
 * with «Надіслати ще раз» and «Змінити пошту» under them.
 */
function SignIn({
  account,
  state,
  problem,
  withGoogle,
  withApple,
}: {
  account: Account;
  state: StateOf<'signed-out' | 'code-sent'>;
  problem: string | undefined;
  /** Whether «Увійти через Google» is offered. */
  withGoogle: boolean;
  /** Whether «Увійти через Apple» is offered. */
  withApple: boolean;
}) {
  const [email, setEmail] = useState('');
  // The state whose problem the reader has edited the address since: that problem leaves the field.
  const [editedSince, setEditedSince] = useState<AccountState>();
  const [code, setCode] = useState('');
  const tokens = useTokens();
  const { voice } = useEdition();

  if (state.status === 'signed-out') {
    const send = () => {
      void keep('the Account', account.requestCode(email));
    };
    return (
      <View style={styles.form}>
        <Text {...voice} style={[typeStyle('sub', tokens), { color: tokens.colors.muted }]}>
          {strings.whySignIn}
        </Text>
        {withApple && (
          <AppleSignInButton
            testID="account-apple"
            label={strings.signInWithApple}
            busy={state.inFlight === 'signInWithApple'}
            disabled={state.inFlight !== undefined}
            onPress={() => {
              void keep('the Account', account.signInWithApple());
            }}
          />
        )}
        {withGoogle && (
          <GoogleSignInButton
            testID="account-google"
            label={strings.signInWithGoogle}
            busy={state.inFlight === 'signInWithGoogle'}
            disabled={state.inFlight !== undefined}
            onPress={() => {
              void keep('the Account', account.signInWithGoogle());
            }}
          />
        )}
        {(withApple || withGoogle) && <OrByEmail />}
        <TextField
          testID="account-email"
          label={strings.emailLabel}
          value={email}
          onChangeText={(typed) => {
            setEmail(typed);
            setEditedSince(state);
          }}
          problem={editedSince === state ? undefined : problem}
          problemCause={state}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          returnKeyType="send"
          onSubmitEditing={send}
        />
        <Button
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
      <Text {...voice} style={[typeStyle('sub', tokens), { color: tokens.colors.muted }]}>
        {fill(strings.codeSent, { email: state.email })}
      </Text>
      <CodeCells
        testID="account-code"
        label={strings.codeLabel}
        digits={SIGN_IN_CODE_DIGITS}
        value={code}
        onChangeText={(typed) => {
          setCode(typed);
          // The Account sends only a code of six digits.
          void keep('the Account', account.verifyCode(typed));
        }}
        problem={problem !== undefined}
        busy={state.inFlight === 'verifyCode'}
      />
      <ProblemLine testID="account-code-problem" problem={problem} cause={state} />
      <ResendButton
        testID="account-resend"
        resendAt={state.resendAt}
        now={now}
        busy={state.inFlight === 'resendCode'}
        onPress={() => {
          setCode('');
          void keep('the Account', account.resendCode());
        }}
      />
      <Button
        variant="neutral"
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

/** The divider «або поштою» between the sign-in buttons and the email field. */
function OrByEmail() {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const line = [styles.dividerLine, { backgroundColor: colors.line }];
  return (
    <View style={styles.divider}>
      <View style={line} />
      <Text {...voice} style={[typeStyle('meta', tokens), { color: colors.muted }]}>
        {strings.orByEmail}
      </Text>
      <View style={line} />
    </View>
  );
}

/**
 * «Увійти через Apple»: Apple's own button, which Apple's branding rules ask
 * for, through Expo's Apple authentication module: black on the light Theme
 * and white on the dark one, `radius.button`, as tall as Google's. The
 * native button carries Apple's words in the system's language, so VoiceOver
 * reads the Edition's label from the view around it. While its request is on
 * the way, or another is, it is dimmed and takes no press.
 */
function AppleSignInButton({
  label,
  onPress,
  busy,
  disabled,
  testID,
}: {
  label: string;
  onPress: () => void;
  /** Whether the request of the button is on the way. */
  busy: boolean;
  disabled: boolean;
  testID: string;
}) {
  const { colorScheme, radii } = useTokens();
  const { voice } = useEdition();
  const inactive = busy || disabled;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: inactive }}
      {...voice}
      pointerEvents={inactive ? 'none' : 'auto'}
      style={{ opacity: inactive ? disabledOpacity : 1 }}
    >
      <AppleAuthenticationButton
        testID={`${testID}-native`}
        buttonType={AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={
          colorScheme === 'dark'
            ? AppleAuthenticationButtonStyle.WHITE
            : AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={radii.button}
        style={styles.appleButton}
        onPress={onPress}
      />
    </View>
  );
}

/**
 * Signed in: a card of «Твій акаунт», the email and the sync line, then
 * «Вийти», the red «Вийти на всіх пристроях» and, below them, the destructive
 * «Видалити акаунт», which the SLOVO confirmation dialog confirms; this
 * screen is the only way to it. Signing out works at once, even offline.
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
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const deletion = strings.delete;

  return (
    <View style={styles.form}>
      <View accessible style={[styles.card, { backgroundColor: colors.surfaceSunken }]}>
        <Text {...voice} style={[typeStyle('meta', tokens), { color: colors.muted }]}>
          {strings.signedInAs}
        </Text>
        <Text
          testID="account-signed-in-email"
          style={[typeStyle('heading', tokens), { color: colors.ink }]}
        >
          {state.email}
        </Text>
        <SyncStatusLine />
      </View>
      <Button
        variant="neutral"
        testID="account-sign-out"
        label={strings.signOut}
        onPress={() => {
          void keep('the Account', account.signOut());
        }}
      />
      <Button
        testID="account-sign-out-everywhere"
        label={strings.signOutEverywhere}
        busy={state.inFlight === 'signOutEverywhere'}
        disabled={state.inFlight !== undefined}
        onPress={() => {
          void keep('the Account', account.signOutEverywhere());
        }}
      />
      <DeleteAccountButton
        testID="account-delete"
        copy={{
          button: fill(deletion.button, { name: edition.accountName }),
          title: fill(deletion.title, { name: edition.accountName }),
          message: deletion.message,
          confirm: deletion.confirm,
          cancel: deletion.cancel,
        }}
        busy={state.inFlight === 'delete'}
        disabled={state.inFlight !== undefined}
        onDelete={() => {
          void keep('the Account', account.delete());
        }}
      />
      <ProblemLine testID="account-problem" problem={problem} cause={state} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // The back header stays above the list, so the list scrolls under it, not the header under the status bar.
  bar: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[2] },
  content: { paddingHorizontal: space[5], paddingBottom: space[8] },
  header: { paddingTop: space[2], paddingBottom: space[5] },
  form: { gap: space[4] },
  appleButton: { height: signInButtonHeight },
  card: {
    gap: space[2],
    padding: space[4],
    borderRadius: accountCardRadius,
    marginBottom: space[2],
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginVertical: space[2] },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
});
