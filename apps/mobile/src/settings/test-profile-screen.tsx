import type { Account } from '@slovo/core';
import { BackHeader, SettingsGroup, SettingsRow, space, typeStyle, useTokens } from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccountInEffect, useSignedOut } from '../account/account';
import { logError } from '../diagnostics/log';
import { editionStrings } from '../edition/edition';
import type { Opening } from '../opening';
import { testProfiles, type TestProfileName } from '../user-state/test-states';

// Development tooling only (owner, 20.11): the route requires this module
// inside a `__DEV__` branch, so a production bundle holds none of it.

const TITLE = 'Тестовий профіль';
const SIGNED_IN = 'Лише для гостя: спершу вийдіть з акаунта, щоб профіль нічого не синхронізував.';
const LOADING = 'Завантажую профіль…';

/**
 * The test profiles, one row each, for a guest alone: a profile replaces the
 * whole device state, which a signed-in reader's Sync would send to the
 * Account. A row loads its profile and reloads the app.
 */
export function TestProfileList({ guest, load }: { readonly guest: boolean; readonly load: Load }) {
  const tokens = useTokens();
  const [loading, setLoading] = useState(false);
  const note = [typeStyle('rowSub', tokens), { color: tokens.colors.muted }, styles.note];
  if (!guest) {
    return (
      <Text testID="test-profile-signed-in" style={note}>
        {SIGNED_IN}
      </Text>
    );
  }
  return (
    <View>
      <SettingsGroup>
        {testProfiles.map(({ name, label, about }) => (
          <SettingsRow
            key={name}
            testID={`test-profile-${name}`}
            icon="square"
            label={label}
            subtitle={about}
            end={{
              kind: 'action',
              onPress: () => {
                if (loading) return;
                setLoading(true);
                load(name).catch((error: unknown) => {
                  setLoading(false);
                  logError(`Could not load the test profile ${name}`, error);
                });
              },
            }}
          />
        ))}
      </SettingsGroup>
      {loading && (
        <Text testID="test-profile-loading" style={note}>
          {LOADING}
        </Text>
      )}
    </View>
  );
}

/** What loads a profile and reloads the app. */
type Load = (name: TestProfileName) => Promise<void>;

/** The profiles for a guest: always without an Account in the Edition, else while signed out. */
function Profiles({ load }: { readonly load: Load }) {
  const account = useAccountInEffect();
  return account === undefined ? (
    <TestProfileList guest load={load} />
  ) : (
    <SignedOutProfiles account={account} load={load} />
  );
}

function SignedOutProfiles({
  account,
  load,
}: {
  readonly account: Opening<Account>;
  readonly load: Load;
}) {
  return <TestProfileList guest={useSignedOut(account)} load={load} />;
}

/** Settings › «Тестовий профіль», in a development build only, loading each profile by `load`. */
export function TestProfileScreen({ load }: { readonly load: Load }) {
  const { colors } = useTokens();
  const router = useRouter();
  return (
    <SafeAreaView
      testID="test-profile"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={styles.bar}>
        <BackHeader
          titleRole="settingsSubTitle"
          title={TITLE}
          back={{
            label: editionStrings.settings.title,
            testID: 'test-profile-back',
            onPress: () => {
              router.back();
            },
          }}
        />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Profiles load={load} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { paddingHorizontal: space[5], paddingTop: space[2] },
  content: { paddingHorizontal: space[5], paddingBottom: space[8] },
  note: { marginTop: space[3] },
});
