import type DateTimePicker from '@react-native-community/datetimepicker';
import { BottomSheet, space, useEdition, useTokens } from '@slovo/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { nativeModules } from './device-native-modules';
import { editionStrings } from './edition';

type TimePickerComponent = typeof DateTimePicker;

/**
 * The native time picker's component, or undefined when the installed binary
 * lacks it (a dev client built before the 0.4 batch). The module is required
 * here and nowhere else: a static import would stop the app at start.
 */
function loadTimePicker(): TimePickerComponent | undefined {
  return nativeModules.load(
    'timePicker',
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access
    () => require('@react-native-community/datetimepicker').default as TimePickerComponent,
  );
}

/** Whether the installed binary has the time picker; without it, adding and changing a time are off. */
export function timePickerAvailable(): boolean {
  return nativeModules.has('timePicker');
}

/**
 * The system time picker in a bottom sheet: it starts at `value`, «Готово»
 * hands the picked time to `onPick`, and a tap on the scrim, a drag down or
 * VoiceOver's escape closes it without a pick. The screen opens it only
 * while `timePickerAvailable()`.
 */
export function TimePickerSheet({
  visible,
  value,
  onPick,
  onClose,
}: {
  visible: boolean;
  value: Date;
  onPick: (picked: Date) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} testID="time-picker-sheet">
      <SheetContent value={value} onPick={onPick} />
    </BottomSheet>
  );
}

function SheetContent({ value, onPick }: { value: Date; onPick: (picked: Date) => void }) {
  const { colors, colorScheme, fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  const strings = editionStrings.notifications;
  const [Picker] = useState(loadTimePicker);
  const [picked, setPicked] = useState(value);

  return (
    <>
      <Text
        accessibilityRole="header"
        {...voice}
        style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
      >
        {strings.pickerLabel}
      </Text>
      <View style={styles.picker}>
        {Picker !== undefined && (
          <Picker
            testID="time-picker"
            accessibilityLabel={strings.pickerLabel}
            mode="time"
            display="spinner"
            value={picked}
            locale={voice.accessibilityLanguage}
            themeVariant={colorScheme}
            textColor={colors.ink}
            onValueChange={(_, date) => {
              setPicked(date);
            }}
          />
        )}
      </View>
      <Pressable
        testID="time-picker-done"
        accessibilityRole="button"
        {...voice}
        onPress={() => {
          onPick(picked);
        }}
        style={[styles.done, { backgroundColor: colors.ink, borderRadius: radii.button }]}
      >
        <Text style={[styles.doneLabel, { color: colors.background, fontFamily: fontFamilies.ui }]}>
          {strings.done}
        </Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '500', paddingBottom: space[2] },
  picker: { alignItems: 'center', paddingVertical: space[2] },
  done: { minHeight: 56, alignItems: 'center', justifyContent: 'center', marginTop: space[3] },
  doneLabel: { fontSize: 17, fontWeight: '700' },
});
