import { ACCOUNT_NAME } from '@slovo/contracts';
import type { Account, AccountState } from '@slovo/core';
import {
  BackLink,
  fill,
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
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccountProblemLine, useAccountState } from '../../account/account';
import { accountOpening } from '../../account/device-account';
import { deviceClock } from '../../device/device-clock';
import { editionStrings } from '../../edition/edition';
import { Opened } from '../../opened';
import { useOpened, type Opening } from '../../opening';

const strings = editionStrings.account;

/** The time the resend countdown counts by, one function for every render. */
const now = () => deviceClock.now();

/** Runs a request of the Account; one that fails outside its rules is logged. */
function run(request: Promise<void>): void {
  request.catch((error: unknown) => {
    console.error('The Account could not do what the reader asked', error);
  });
}

/**
 * Settings › SLOVO ID: signing in with a Sign-in code sent to the email, or,
 * signed in, the email with signing out, signing out everywhere and deleting
 * the Account behind a system alert. It draws the Account's state and calls
 * its actions; the rules are the Account's own. Without the Edition's Account
 * it leads back to Settings.
 */
export default function AccountScreen() {
  if (accountOpening === undefined) return <Redirect href="/settings" />;
  return (
    <Opened opening={accountOpening} failedTestID="account-failed">
      <AccountContent opening={accountOpening} />
    </Opened>
  );
}

function AccountContent({ opening }: { opening: Opening<Account> }) {
  const account = useOpened(opening);
  const state = useAccountState(account);
  const problem = useAccountProblemLine(state);
  const { colors } = useTokens();
  const router = useRouter();
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
          label={editionStrings.settings.title}
          onPress={() => {
            router.back();
          }}
        />
        <View style={styles.header}>
          <ScreenTitle>{ACCOUNT_NAME}</ScreenTitle>
        </View>
        {state.status === 'signed-in' ? (
          <SignedIn account={account} state={state} problem={problem} />
        ) : (
          <SignIn account={account} state={state} problem={problem} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type StateOf<S extends AccountState['status']> = Extract<AccountState, { status: S }>;

/**
 * Signed out: the email field and «Надіслати код». Once the code is sent, the
 * email stays over the code field, which signs in as soon as it holds the
 * code, with «Надіслати ще раз» and «Змінити пошту» under it.
 */
function SignIn({
  account,
  state,
  problem,
}: {
  account: Account;
  state: StateOf<'signed-out' | 'code-sent'>;
  problem: string | undefined;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  /** Whether the request on the way is for a new code, rather than a sign-in. */
  const [resending, setResending] = useState(false);

  if (state.status === 'signed-out') {
    const send = () => {
      run(account.requestCode(email));
    };
    return (
      <View style={styles.form}>
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
          busy={state.inFlight}
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
        busy={state.inFlight && !resending}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
      />
      <ResendButton
        testID="account-resend"
        resendAt={state.resendAt}
        now={now}
        busy={state.inFlight && resending}
        onPress={() => {
          setResending(true);
          setCode('');
          run(
            account.resendCode().finally(() => {
              setResending(false);
            }),
          );
        }}
      />
      <SecondaryButton
        testID="account-change-email"
        label={strings.changeEmail}
        disabled={state.inFlight}
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
 * «Видалити SLOVO ID», which a system alert confirms. Signing out works at
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
  /** Which of the two requests that end the Session through the server is on the way. */
  const [ending, setEnding] = useState<'everywhere' | 'delete'>();
  const deletion = strings.delete;

  function end(how: 'everywhere' | 'delete') {
    setEnding(how);
    run(
      (how === 'everywhere' ? account.signOutEverywhere() : account.delete()).finally(() => {
        setEnding(undefined);
      }),
    );
  }

  function confirmDelete() {
    Alert.alert(fill(deletion.title, { name: ACCOUNT_NAME }), deletion.message, [
      { text: deletion.cancel, style: 'cancel' },
      {
        text: deletion.confirm,
        style: 'destructive',
        onPress: () => {
          end('delete');
        },
      },
    ]);
  }

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
        busy={state.inFlight && ending === 'everywhere'}
        disabled={state.inFlight}
        onPress={() => {
          end('everywhere');
        }}
      />
      <SecondaryButton
        testID="account-delete"
        label={fill(deletion.button, { name: ACCOUNT_NAME })}
        destructive
        busy={state.inFlight && ending === 'delete'}
        disabled={state.inFlight}
        onPress={confirmDelete}
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
