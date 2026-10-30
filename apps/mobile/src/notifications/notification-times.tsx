import { MAX_NOTIFICATION_TIMES } from '@slovo/contracts';
import {
  fill,
  minTouchTarget,
  SettingsGroup,
  TimeRow,
  typeSize,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text } from 'react-native';

import { deviceClock } from '../device/device-clock';
import { editionStrings } from '../edition/edition';
import { useNotificationsChanges, useNotificationsState } from './notifications';
import { dateOfTime, timeOfDay } from './notification-scheduler';
import { TimePickerSheet, timePickerAvailable } from './time-picker';

const strings = editionStrings.notifications;

/**
 * The Notification times, for Settings › Сповіщення and the onboarding's last
 * step: the times in time order, each with a swipe (and a VoiceOver action)
 * that removes it, «+ Додати час», disabled at the limit with a line saying
 * why, and the line for a time that is in the list already. A change applies
 * at once. Tapping a time, or «+ Додати час», opens the system time picker,
 * which a dev client built before the native batch lacks: then adding and
 * changing a time stay off, and removing still works. Needs a
 * `GestureHandlerRootView` above it.
 */
export function NotificationTimes() {
  const state = useNotificationsState();
  const { keepTime, removeTime } = useNotificationsChanges();
  const { colors, fontFamilies } = useTokens();
  const { count, voice } = useEdition();
  /** The time being picked: the one it replaces (none when adding), and where the picker starts. */
  const [picking, setPicking] = useState<{ replacing?: string; value: Date }>();
  /** The list a time was refused for as a duplicate; the hint shows while the list is still that list. */
  const [refusedFor, setRefusedFor] = useState<string>();
  const duplicate = refusedFor === listKey(state.times);

  const limitHint = count(strings.limitHint, MAX_NOTIFICATION_TIMES);
  const pickerAvailable = timePickerAvailable();
  const canAdd = state.canAddTime && pickerAvailable;

  function pick(replacing?: string) {
    if (!pickerAvailable) return;
    const now = deviceClock.now();
    setRefusedFor(undefined);
    setPicking({
      ...(replacing === undefined ? {} : { replacing }),
      value: replacing === undefined ? now : dateOfTime(replacing, now),
    });
  }

  function keep(picked: Date) {
    const replacing = picking?.replacing;
    const list = listKey(state.times);
    setPicking(undefined);
    void keepTime(timeOfDay(picked), replacing).then((refusal) => {
      // A refusal writes nothing, so the list is the one the time was picked for.
      setRefusedFor(refusal === 'duplicate' ? list : undefined);
      if (refusal === 'duplicate')
        AccessibilityInfo.announceForAccessibility(strings.duplicateHint);
    });
  }

  return (
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
            { color: canAdd ? colors.accent : colors.muted, fontFamily: fontFamilies.ui },
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
      <TimePickerSheet
        visible={picking !== undefined}
        value={picking?.value ?? deviceClock.now()}
        onPick={keep}
        onClose={() => {
          setPicking(undefined);
        }}
      />
    </>
  );
}

/** The Notification times as one key, the same for the same list whatever object holds it. */
function listKey(times: readonly string[]): string {
  return times.join(',');
}

const styles = StyleSheet.create({
  addTime: { minHeight: minTouchTarget, justifyContent: 'center', alignSelf: 'flex-start' },
  addTimeLabel: { fontSize: typeSize.body, fontWeight: '700' },
  hint: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.5 },
});
