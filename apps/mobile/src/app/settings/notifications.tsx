import { MAX_NOTIFICATION_TIMES } from '@slovo/contracts';
import {
  BackLink,
  fill,
  minTouchTarget,
  ScreenTitle,
  SettingsGroup,
  SwitchRow,
  TimeRow,
  space,
  typeSize,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '../../composition';
import { editionStrings } from '../../edition';
import { LoadFailed } from '../../language-pack';
import { useNotificationsChanges, useNotificationsState } from '../../notifications';

const strings = editionStrings.notifications;

/**
 * Settings › Сповіщення: the Notification times in time order, each with a
 * swipe (and a VoiceOver action) that removes it, «+ Додати час», disabled
 * at the limit with a line saying why, and the switch for the notification
 * sound. A change applies at once. Tapping a time or «+ Додати час» does
 * nothing yet: the time picker comes with its own ticket.
 */
export default function NotificationsScreen() {
  const composition = useComposition();
  const state = useNotificationsState();
  const { removeTime, setSound } = useNotificationsChanges();
  const { colors, fontFamilies } = useTokens();
  const { count, voice } = useEdition();
  const router = useRouter();

  if (composition.status === 'failed') return <LoadFailed onRetry={composition.retry} />;
  const limitHint = count(strings.limitHint, MAX_NOTIFICATION_TIMES);

  return (
    <SafeAreaView
      testID="notifications"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <GestureHandlerRootView style={styles.screen}>
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
              {state.times.length > 0 && (
                <SettingsGroup>
                  {state.times.map((time) => (
                    <TimeRow
                      key={time}
                      testID={`notifications-time-${time}`}
                      time={time}
                      accessibilityLabel={fill(strings.timeLabel, { time })}
                      actions={[
                        {
                          name: 'remove',
                          label: strings.remove,
                          accessibilityLabel: strings.remove,
                          tone: 'destructive',
                          onPress: () => {
                            removeTime(time);
                          },
                        },
                      ]}
                    />
                  ))}
                </SettingsGroup>
              )}
              <Pressable
                testID="notifications-add-time"
                accessibilityRole="button"
                accessibilityLabel={strings.addTime}
                accessibilityState={{ disabled: !state.canAddTime }}
                accessibilityHint={state.canAddTime ? undefined : limitHint}
                disabled={!state.canAddTime}
                {...voice}
                style={styles.addTime}
              >
                <Text
                  style={[
                    styles.addTimeLabel,
                    {
                      color: state.canAddTime ? colors.accent : colors.muted,
                      fontFamily: fontFamilies.ui,
                    },
                  ]}
                >
                  {strings.addTime}
                </Text>
              </Pressable>
              {!state.canAddTime && (
                <Text
                  testID="notifications-limit-hint"
                  // VoiceOver reads it as the hint of the disabled «+ Додати час» instead.
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  {...voice}
                  style={[styles.hint, { color: colors.muted, fontFamily: fontFamilies.ui }]}
                >
                  {limitHint}
                </Text>
              )}
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
      </GestureHandlerRootView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8] },
  header: { paddingTop: space[2], paddingBottom: space[5] },
  addTime: { minHeight: minTouchTarget, justifyContent: 'center', alignSelf: 'flex-start' },
  addTimeLabel: { fontSize: typeSize.body, fontWeight: '700' },
  hint: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.5 },
  section: { marginTop: space[6] },
});
