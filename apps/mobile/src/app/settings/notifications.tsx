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
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '../../composition';
import { editionStrings } from '../../edition';
import { LoadFailed } from '../../language-pack';
import { useNotificationsChanges, useNotificationsState } from '../../notifications';
import { dateOfTime } from '../../notifications-screen';
import { TimePickerSheet, timePickerAvailable } from '../../time-picker';

const strings = editionStrings.notifications;

/**
 * Settings › Сповіщення: the Notification times in time order, each with a
 * swipe (and a VoiceOver action) that removes it, «+ Додати час», disabled
 * at the limit with a line saying why, and the switch for the notification
 * sound. A change applies at once. Tapping a time, or «+ Додати час», opens
 * the system time picker, which a dev client built before the native batch
 * lacks: then adding and changing a time stay off, and removing still works.
 * A time that is in the list already shows a one-line hint and is not kept.
 */
export default function NotificationsScreen() {
  const composition = useComposition();
  const state = useNotificationsState();
  const { keepTime, removeTime, setSound } = useNotificationsChanges();
  const { colors, fontFamilies } = useTokens();
  const { count, voice } = useEdition();
  const router = useRouter();
  /** The time being picked: the one it replaces (none when adding), and where the picker starts. */
  const [picking, setPicking] = useState<{ from?: string; value: Date }>();
  const [duplicate, setDuplicate] = useState(false);
  // The hint is about the list as it was when the time was refused.
  useEffect(() => {
    setDuplicate(false);
  }, [state?.times]);

  if (composition.status === 'failed') return <LoadFailed onRetry={composition.retry} />;
  const limitHint = count(strings.limitHint, MAX_NOTIFICATION_TIMES);
  const pickerAvailable = timePickerAvailable();
  const canAdd = state?.canAddTime === true && pickerAvailable;

  function pick(from?: string) {
    if (!pickerAvailable) return;
    const now = new Date();
    setDuplicate(false);
    setPicking({
      ...(from === undefined ? {} : { from }),
      value: from === undefined ? now : dateOfTime(from, now),
    });
  }

  function keep(picked: Date) {
    const from = picking?.from;
    setPicking(undefined);
    void keepTime(picked, from).then((refusal) => {
      setDuplicate(refusal === 'duplicate');
      if (refusal === 'duplicate')
        AccessibilityInfo.announceForAccessibility(strings.duplicateHint);
    });
  }

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
                      accessibilityHint={strings.change}
                      {...(pickerAvailable && {
                        onPress: () => {
                          pick(time);
                        },
                      })}
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
                accessibilityState={{ disabled: !canAdd }}
                accessibilityHint={state.canAddTime ? undefined : limitHint}
                disabled={!canAdd}
                onPress={() => {
                  pick();
                }}
                {...voice}
                style={styles.addTime}
              >
                <Text
                  style={[
                    styles.addTimeLabel,
                    {
                      color: canAdd ? colors.accent : colors.muted,
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
              {duplicate && (
                <Text
                  testID="notifications-duplicate-hint"
                  {...voice}
                  style={[styles.hint, { color: colors.ink, fontFamily: fontFamilies.ui }]}
                >
                  {strings.duplicateHint}
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
        <TimePickerSheet
          visible={picking !== undefined}
          value={picking?.value ?? new Date()}
          onPick={keep}
          onClose={() => {
            setPicking(undefined);
          }}
        />
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
