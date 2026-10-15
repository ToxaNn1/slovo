import {
  BackLink,
  NavigationRow,
  PrimaryButton,
  ScreenTitle,
  SettingsGroup,
  SwitchRow,
  space,
  typeSize,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '../../composition';
import { editionStrings } from '../../edition';
import { LoadFailed } from '../../language-pack';
import { useNotificationsChanges, useNotificationsState } from '../../notifications';
import { NotificationTimes } from '../../notification-times';

const strings = editionStrings.notifications;

/**
 * Settings › Сповіщення: the Notification times in time order, each with a
 * swipe (and a VoiceOver action) that removes it, «+ Додати час», disabled
 * at the limit with a line saying why, and the switch for the notification
 * sound. A change applies at once. Tapping a time, or «+ Додати час», opens
 * the system time picker, which a dev client built before the native batch
 * lacks: then adding and changing a time stay off, and removing still works.
 * A time that is in the list already shows a one-line hint and is not kept.
 * While the reader hasn't been asked for permission, as after «Пізніше» in the
 * onboarding, «Увімкнути сповіщення» above the times asks, and a grant plans
 * the notifications. While iOS denies notifications, a line above the times
 * says so, with a row that opens the app's iOS settings; the times stay as
 * they are.
 */
export default function NotificationsScreen() {
  const composition = useComposition();
  const state = useNotificationsState();
  const { setSound, askPermission } = useNotificationsChanges();
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const router = useRouter();

  if (composition.status === 'failed') return <LoadFailed onRetry={composition.retry} />;

  return (
    <SafeAreaView
      testID="notifications"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <BackLink
          testID="notifications-back"
          label={editionStrings.settings.title}
          onPress={() => {
            router.back();
          }}
        />
        <View style={styles.header}>
          <ScreenTitle>{strings.title}</ScreenTitle>
        </View>
        {state !== undefined && (
          <>
            {state.permission === 'not-asked' && (
              <View style={styles.enable}>
                <PrimaryButton
                  testID="notifications-enable"
                  label={strings.enable}
                  onPress={askPermission}
                />
              </View>
            )}
            {state.permission === 'denied' && (
              <View testID="notifications-denied" style={styles.denied}>
                <Text
                  {...voice}
                  style={[styles.hint, { color: colors.ink, fontFamily: fontFamilies.ui }]}
                >
                  {strings.denied.message}
                </Text>
                <SettingsGroup>
                  <NavigationRow
                    testID="notifications-open-settings"
                    label={strings.denied.openSettings}
                    onPress={() => {
                      Linking.openSettings().catch((error: unknown) => {
                        console.error("Could not open the app's iOS settings", error);
                      });
                    }}
                  />
                </SettingsGroup>
              </View>
            )}
            <NotificationTimes />
            <View style={styles.section}>
              <SettingsGroup>
                <SwitchRow
                  testID="notifications-sound"
                  label={strings.sound}
                  value={state.sound}
                  onChange={setSound}
                />
              </SettingsGroup>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8] },
  header: { paddingTop: space[2], paddingBottom: space[5] },
  hint: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.5 },
  section: { marginTop: space[6] },
  enable: { marginBottom: space[6] },
  denied: { gap: space[3], marginBottom: space[6] },
});
