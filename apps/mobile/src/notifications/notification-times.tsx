import type { NotificationSlot } from '@slovo/core';
import {
  NavigationRow,
  SettingsGroup,
  space,
  SwitchRow,
  typeStyle,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { deviceClock } from '../device/device-clock';
import { editionStrings } from '../edition/edition';
import { useNotificationsChanges, useNotificationsState } from './notifications';
import { dateOfTime, timeOfDay } from './notification-scheduler';
import { TimePickerSheet, timePickerAvailable } from './time-picker';

const strings = editionStrings.notifications;

/**
 * The Notification times of Settings › Сповіщення (ADR 0200): the switch
 * «Сповіщення» on top and, while it is on, the rows «Слово» and
 * «Нагадування» with their times («Вимкнено» on the Reminder's with none).
 * A change applies at once. Tapping a row opens the system time picker, which
 * a dev client built before the native batch lacks: then the rows do nothing.
 * A Reminder picked at or before the Word, or a Word at or after the
 * Reminder, is not kept and a line under the rows says why.
 */
export function NotificationTimes() {
  const { times } = useNotificationsState();
  const { keepTime, setOn } = useNotificationsChanges();
  const tokens = useTokens();
  const { voice } = useEdition();
  /** The row being picked for, and where the picker starts. */
  const [picking, setPicking] = useState<{ slot: NotificationSlot; value: Date }>();
  /** The times a pick was refused for; the hint shows while they stay as they are. */
  const [refusedFor, setRefusedFor] = useState<typeof times>();

  function pick(slot: NotificationSlot, time: string | undefined) {
    if (!timePickerAvailable()) return;
    const now = deviceClock.now();
    setRefusedFor(undefined);
    setPicking({ slot, value: time === undefined ? now : dateOfTime(time, now) });
  }

  function keep(picked: Date) {
    if (picking === undefined) return;
    const pickedFor = times;
    setPicking(undefined);
    void keepTime(picking.slot, timeOfDay(picked)).then((refusal) => {
      // A refusal writes nothing, so the times are the ones the time was picked for.
      setRefusedFor(refusal === 'order' ? pickedFor : undefined);
      if (refusal === 'order') AccessibilityInfo.announceForAccessibility(strings.orderHint);
    });
  }

  return (
    <>
      <SettingsGroup>
        <SwitchRow
          testID="notifications-on"
          label={strings.title}
          value={times.kind === 'on'}
          onChange={setOn}
        />
      </SettingsGroup>
      {times.kind === 'on' && (
        <View style={styles.times}>
          <SettingsGroup>
            <NavigationRow
              testID="notifications-word"
              label={strings.word}
              value={times.word}
              onPress={() => {
                pick('word', times.word);
              }}
            />
            <NavigationRow
              testID="notifications-reminder"
              label={strings.reminder}
              value={times.reminder ?? strings.off}
              onPress={() => {
                pick('reminder', times.reminder);
              }}
            />
          </SettingsGroup>
        </View>
      )}
      {refusedFor !== undefined && refusedFor === times && (
        <Text
          testID="notifications-order-hint"
          {...voice}
          style={[typeStyle('hint', tokens), styles.hint, { color: tokens.colors.ink }]}
        >
          {strings.orderHint}
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

const styles = StyleSheet.create({
  times: { marginTop: space[6] },
  hint: { marginTop: space[2] },
});
